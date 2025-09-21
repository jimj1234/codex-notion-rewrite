import {
  ListBlockChildrenResponse,
  BlockObjectResponse,
  RichTextItemResponse,
} from '@notionhq/client/build/src/api-endpoints';
import { notionClient } from '../clients/notion';

export type ExpandedBlock = BlockObjectResponse & { children: ExpandedBlock[] };

const safeRichText = (richText?: RichTextItemResponse[]): string =>
  (richText ?? []).map((item) => item.plain_text).join('');

const listChildren = async (blockId: string, startCursor?: string): Promise<ListBlockChildrenResponse> => {
  const params: { block_id: string; start_cursor?: string } = { block_id: blockId };
  if (startCursor) {
    params.start_cursor = startCursor;
  }
  return notionClient.blocks.children.list(params);
};

export const fetchBlockChildren = async (blockId: string): Promise<BlockObjectResponse[]> => {
  const results: BlockObjectResponse[] = [];
  let cursor: string | undefined;

  do {
    const response = await listChildren(blockId, cursor);
    results.push(...(response.results as BlockObjectResponse[]));
    cursor = response.has_more ? response.next_cursor ?? undefined : undefined;
  } while (cursor);

  return results;
};

export const expandBlocks = async (blocks: BlockObjectResponse[]): Promise<ExpandedBlock[]> => {
  const expanded: ExpandedBlock[] = [];

  for (const block of blocks) {
    const children = block.has_children ? await fetchBlockChildren(block.id) : [];
    const expandedChildren = children.length ? await expandBlocks(children) : [];
    expanded.push({ ...(block as BlockObjectResponse), children: expandedChildren });
  }

  return expanded;
};

const blockToMarkdown = (block: ExpandedBlock, depth: number): string => {
  const indent = '  '.repeat(depth);
  let body: string;

  switch (block.type) {
    case 'paragraph':
      body = `${indent}${safeRichText(block.paragraph.rich_text)}\n`;
      break;
    case 'heading_1':
      body = `${indent}# ${safeRichText(block.heading_1.rich_text)}\n`;
      break;
    case 'heading_2':
      body = `${indent}## ${safeRichText(block.heading_2.rich_text)}\n`;
      break;
    case 'heading_3':
      body = `${indent}### ${safeRichText(block.heading_3.rich_text)}\n`;
      break;
    case 'bulleted_list_item':
      body = `${indent}- ${safeRichText(block.bulleted_list_item.rich_text)}\n`;
      break;
    case 'numbered_list_item':
      body = `${indent}1. ${safeRichText(block.numbered_list_item.rich_text)}\n`;
      break;
    case 'to_do':
      body = `${indent}- [${block.to_do.checked ? 'x' : ' '}] ${safeRichText(block.to_do.rich_text)}\n`;
      break;
    case 'toggle': {
      const title = safeRichText(block.toggle.rich_text);
      const childContent = block.children.map((child) => blockToMarkdown(child, depth + 1)).join('');
      return `${indent}<toggle title="${title}">\n${childContent}${indent}</toggle>\n`;
    }
    case 'callout':
      body = `${indent}> ${safeRichText(block.callout.rich_text)}\n`;
      break;
    case 'quote':
      body = `${indent}> ${safeRichText(block.quote.rich_text)}\n`;
      break;
    case 'code': {
      const codeContent = block.code.rich_text.map((item) => item.plain_text).join('');
      body = `${indent}\n${indent}\`\`\`${block.code.language || ''}\n${codeContent}\n${indent}\`\`\`\n`;
      break;
    }
    default:
      body = `${indent}[Unsupported block type: ${block.type}]\n`;
      break;
  }

  const childContent = block.children.map((child) => blockToMarkdown(child, depth + 1)).join('');
  return `${body}${childContent}`;
};

export const blocksToMarkdown = (blocks: ExpandedBlock[]): string =>
  blocks.map((block) => blockToMarkdown(block, 0)).join('\n');

export const richTextToPlain = safeRichText;
