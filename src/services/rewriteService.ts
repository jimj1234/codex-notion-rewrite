import { BlockObjectRequest } from '@notionhq/client/build/src/api-endpoints';
import { notionClient } from '../clients/notion';
import { openRouterClient } from '../clients/openrouter';
import { blockSpecsToNotionBlocks, BlockSpec } from '../utils/blockSpec';
import { env } from '../config/env';

export interface RewriteContext {
  pageId: string;
  pageTitle: string;
  rootBlockIds: string[];
  pageMarkdown: string;
  overrideInstructions?: string;
}

interface RewriteResponsePayload {
  page_title?: string;
  blocks: BlockSpec[];
}

const DEFAULT_SYSTEM_PROMPT = `You are an elite knowledge architect assisting with reorganizing Notion documentation.
- Preserve all factual information while dramatically improving readability.
- Start the page with a concise orientation (summary or key outcomes).
- Structure the content into nested toggle blocks that provide a skimmable overview first, then allow drilling down.
- Use informative toggle titles, and place details, lists, and examples within nested toggles.
- When useful, convert dense paragraphs into bullet points or tables, but remain faithful to original meaning.
- Maintain references, links, and metadata already present.
- Respond with pure JSON (no code fences) describing the rewritten page using the agreed schema.`;

const buildUserPrompt = (context: RewriteContext): string => {
  const additional = context.overrideInstructions
    ? `Additional rewrite instructions provided by the user comment: "${context.overrideInstructions.trim()}"\n`
    : 'No additional rewrite instructions were provided in the triggering comment.\n';

  return `The original Notion page is titled "${context.pageTitle}".\n${additional}
Provide a JSON response with the structure: {"page_title": string (optional), "blocks": BlockSpec[]} where BlockSpec can represent paragraph, heading_1/2/3, bulleted_list_item, numbered_list_item, toggle, quote, callout, or code as described earlier.\nEach toggle must contain informative children blocks; paragraphs should be concise.\nHere is the current page content serialized in Markdown-like form:\n\n${context.pageMarkdown}`;
};

const extractJson = (raw: string): string => {
  const trimmed = raw.trim();
  if (trimmed.startsWith('```')) {
    return trimmed.replace(/```json|```/gi, '').trim();
  }
  return trimmed;
};

const parseRewriteResponse = (raw: string): RewriteResponsePayload => {
  try {
    const jsonString = extractJson(raw);
    const parsed = JSON.parse(jsonString);

    if (!parsed || typeof parsed !== 'object') {
      throw new Error('LLM response is not an object');
    }

    if (!Array.isArray(parsed.blocks)) {
      throw new Error('LLM response missing blocks array');
    }

    return parsed as RewriteResponsePayload;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown parse error';
    throw new Error(`Failed to parse rewrite response: ${message}`);
  }
};

const chunk = <T>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

const deleteExistingBlocks = async (blockIds: string[]): Promise<void> => {
  for (const id of blockIds) {
    await notionClient.blocks.delete({ block_id: id });
  }
};

const appendBlocks = async (pageId: string, blocks: BlockObjectRequest[]): Promise<void> => {
  const batches = chunk(blocks, 50);
  for (const batch of batches) {
    await notionClient.blocks.children.append({
      block_id: pageId,
      children: batch,
    });
  }
};

const updatePageTitleIfNeeded = async (pageId: string, currentTitle: string, nextTitle?: string): Promise<void> => {
  if (!nextTitle || nextTitle.trim() === '' || nextTitle.trim() === currentTitle.trim()) {
    return;
  }

  const textToRichText = (text: string) => [
    {
      type: 'text',
      text: { content: text },
    },
  ];

  const propertiesUpdate = {
    title: {
      title: textToRichText(nextTitle.trim()),
    },
  };

  await notionClient.pages.update({
    page_id: pageId,
    properties: propertiesUpdate as any,
  });
};

export const rewritePage = async (context: RewriteContext): Promise<void> => {
  const payload = {
    model: env.OPENROUTER_MODEL,
    messages: [
      { role: 'system', content: DEFAULT_SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(context) },
    ],
    temperature: 0.2,
  };

  const response = await openRouterClient.post('/chat/completions', payload);
  const message = response.data?.choices?.[0]?.message?.content;

  if (!message || typeof message !== 'string') {
    throw new Error('Received empty response from language model');
  }

  const parsed = parseRewriteResponse(message);
  const blockRequests = blockSpecsToNotionBlocks(parsed.blocks ?? []);

  if (blockRequests.length === 0) {
    throw new Error('LLM returned no blocks; aborting rewrite to avoid wiping the page.');
  }

  await deleteExistingBlocks(context.rootBlockIds);
  await appendBlocks(context.pageId, blockRequests);
  await updatePageTitleIfNeeded(context.pageId, context.pageTitle, parsed.page_title);
};
