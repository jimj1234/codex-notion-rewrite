import {
  PageObjectResponse,
  CommentObjectResponse,
  BlockObjectResponse,
  RichTextItemResponse,
} from '@notionhq/client/build/src/api-endpoints';
import { notionClient } from '../clients/notion';
import { env } from '../config/env';
import { rewritePage } from './rewriteService';
import { fetchBlockChildren, expandBlocks, blocksToMarkdown } from '../utils/notionBlocks';

interface NotionWebhookEvent {
  id: string;
  type: string;
  created_time: string;
  data: Record<string, unknown>;
}

interface NotionWebhookBody {
  event_id: string;
  created_time: string;
  payload: {
    type: string;
    events: NotionWebhookEvent[];
  };
}

const escapeForRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const triggerRegex = (keyword: string): RegExp => new RegExp(`\\b${escapeForRegex(keyword)}\\b`, 'i');

const hasTriggerKeyword = (text: string): boolean => triggerRegex(env.TRIGGER_KEYWORD).test(text);

const stripTriggerKeyword = (text: string): string =>
  text.replace(new RegExp(`\\b${escapeForRegex(env.TRIGGER_KEYWORD)}\\b`, 'ig'), '').trim();

const getPageTitle = (page: PageObjectResponse): string => {
  for (const property of Object.values(page.properties)) {
    if (property?.type === 'title') {
      const titleItems = (property.title ?? []) as RichTextItemResponse[];
      if (titleItems.length > 0) {
        return titleItems.map((item) => item.plain_text).join('');
      }
    }
  }
  return 'Untitled';
};

const resolvePageIdFromParent = async (parent: CommentObjectResponse['parent']): Promise<string | null> => {
  if (!parent) {
    return null;
  }

  if (parent.type === 'page_id') {
    return parent.page_id;
  }

  if (parent.type === 'block_id') {
    let currentId: string | undefined = parent.block_id;

    while (currentId) {
      const block = (await notionClient.blocks.retrieve({ block_id: currentId })) as BlockObjectResponse & {
        parent?: { type: string; [key: string]: any };
      };

      if (block.parent?.type === 'page_id') {
        return block.parent.page_id;
      }

      if (block.parent?.type === 'block_id') {
        currentId = block.parent.block_id;
        continue;
      }

      currentId = undefined;
    }
  }

  return null;
};

const gatherPageContext = async (pageId: string) => {
  const page = (await notionClient.pages.retrieve({ page_id: pageId })) as PageObjectResponse;
  const title = getPageTitle(page);
  const rootBlocks = await fetchBlockChildren(pageId);
  const expandedBlocks = await expandBlocks(rootBlocks);
  const markdown = blocksToMarkdown(expandedBlocks);

  return {
    pageTitle: title,
    pageMarkdown: markdown,
    rootBlockIds: rootBlocks.map((block) => block.id),
  };
};

const getCommentText = (comment: CommentObjectResponse): string =>
  (comment.rich_text ?? []).map((rt: RichTextItemResponse) => rt.plain_text).join(' ');

const unique = <T>(arr: T[]): T[] => Array.from(new Set(arr));

const extractCandidateCommentIds = (payload: Record<string, any>): string[] => {
  const candidates: (string | undefined)[] = [];
  const p = payload as any;
  // Common locations
  candidates.push(p?.payload?.data?.comment?.id);
  candidates.push(p?.payload?.data?.id);
  candidates.push(p?.data?.comment?.id);
  candidates.push(p?.data?.id);
  // Event array shapes
  const evtArr: any[] = Array.isArray(p?.payload?.events)
    ? p.payload.events
    : Array.isArray(p?.events)
    ? p.events
    : p?.event
    ? [p.event]
    : [];
  for (const e of evtArr) {
    const d = e?.data;
    candidates.push(d?.comment?.id);
    candidates.push(d?.id);
  }
  return unique(candidates.filter((v): v is string => typeof v === 'string' && v.length > 0));
};

export const handleNotionWebhook = async (body: NotionWebhookBody | Record<string, any>): Promise<void> => {
  const envelope: any = (body as any)?.payload ?? body;
  if (!envelope || typeof envelope !== 'object') {
    return;
  }

  // Support both envelope.type === 'event_callback' and single-event envelopes (e.g., 'comment.created')

  let eventsArray: any[] = Array.isArray(envelope.events)
    ? envelope.events
    : envelope.event
    ? [envelope.event]
    : [];

  // Some Notion payloads may provide a single event via type+data only
  if ((!Array.isArray(eventsArray) || eventsArray.length === 0) && typeof envelope.type === 'string' && envelope.data) {
    eventsArray = [{ type: envelope.type, data: envelope.data }];
  }

  if (!Array.isArray(eventsArray) || eventsArray.length === 0) {
    return;
  }

  // Drop any falsy/invalid entries to avoid accessing undefined.type
  eventsArray = eventsArray.filter((e: any) => e && typeof e === 'object' && typeof e.type === 'string');

  // Notion may send event types like "comment", "comment.created", etc.
  const relevantEvents = eventsArray.filter((event) => {
    const t = typeof (event && (event as any).type) === 'string' ? String((event as any).type).toLowerCase() : '';
    return t.includes('comment');
  });

  // If events did not include a comment type, still try to extract a comment id from the whole payload
  const fallbackCandidates = relevantEvents.length === 0 ? extractCandidateCommentIds(body as any) : [];

  for (const event of relevantEvents.length ? relevantEvents : fallbackCandidates) {
    try {
      let commentId: string | undefined;
      if (typeof event === 'string') {
        commentId = event;
      } else {
        const data = (event && typeof event === 'object' ? (event as any).data : undefined) as
          | Record<string, any>
          | undefined;
        commentId =
          data?.id ||
          data?.comment?.id ||
          data?.comment_id ||
          (body as any)?.payload?.data?.comment?.id ||
          (body as any)?.entity?.id;
      }
      if (!commentId) {
        continue;
      }

      let comment: CommentObjectResponse | null = null;
      try {
        comment = (await notionClient.comments.retrieve({ comment_id: commentId })) as CommentObjectResponse;
      } catch (err) {
        // Try other candidates if this id is not a valid comment id
        if (relevantEvents.length === 0) {
          const more = extractCandidateCommentIds(body as any).filter((id) => id !== commentId);
          for (const alt of more) {
            try {
              comment = (await notionClient.comments.retrieve({ comment_id: alt })) as CommentObjectResponse;
              commentId = alt;
              break;
            } catch (_) {
              // keep trying
            }
          }
        }
        if (!comment) {
          continue;
        }
      }
      const commentText = getCommentText(comment);

      if (!hasTriggerKeyword(commentText)) {
        continue;
      }

      const instructionOverride = stripTriggerKeyword(commentText);
      const pageIdFromPayload: string | undefined =
        (body as any)?.payload?.data?.page_id || (body as any)?.data?.page_id;
      const targetPageId = pageIdFromPayload || (await resolvePageIdFromParent(comment.parent));

      if (!targetPageId) {
        console.warn(`Unable to resolve page for comment ${commentId}`);
        continue;
      }

      const { pageTitle, pageMarkdown, rootBlockIds } = await gatherPageContext(targetPageId);
      const rewriteContext = {
        pageId: targetPageId,
        pageTitle,
        pageMarkdown,
        rootBlockIds,
        ...(instructionOverride.length ? { overrideInstructions: instructionOverride } : {}),
      };

      await rewritePage(rewriteContext);
    } catch (err) {
      console.error('Failed to process comment event', err);
      // continue with other events
    }
  }
};
