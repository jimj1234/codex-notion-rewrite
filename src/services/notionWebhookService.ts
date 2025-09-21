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

export const handleNotionWebhook = async (payload: NotionWebhookBody): Promise<void> => {
  if (payload.payload.type !== 'event_callback') {
    return;
  }

  const relevantEvents = payload.payload.events.filter((event) => event.type === 'comment');

  for (const event of relevantEvents) {
    const commentId = (event.data as { id?: string }).id;
    if (!commentId) {
      continue;
    }

    const comment = (await notionClient.comments.retrieve({ comment_id: commentId })) as CommentObjectResponse;
    const commentText = getCommentText(comment);

    if (!hasTriggerKeyword(commentText)) {
      continue;
    }

    const instructionOverride = stripTriggerKeyword(commentText);
    const targetPageId = await resolvePageIdFromParent(comment.parent);

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
  }
};
