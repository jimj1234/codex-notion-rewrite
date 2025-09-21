"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.richTextToPlain = exports.blocksToMarkdown = exports.expandBlocks = exports.fetchBlockChildren = void 0;
const notion_1 = require("../clients/notion");
const safeRichText = (richText) => (richText ?? []).map((item) => item.plain_text).join('');
const listChildren = async (blockId, startCursor) => {
    const params = { block_id: blockId };
    if (startCursor) {
        params.start_cursor = startCursor;
    }
    return notion_1.notionClient.blocks.children.list(params);
};
const fetchBlockChildren = async (blockId) => {
    const results = [];
    let cursor;
    do {
        const response = await listChildren(blockId, cursor);
        results.push(...response.results);
        cursor = response.has_more ? response.next_cursor ?? undefined : undefined;
    } while (cursor);
    return results;
};
exports.fetchBlockChildren = fetchBlockChildren;
const expandBlocks = async (blocks) => {
    const expanded = [];
    for (const block of blocks) {
        const children = block.has_children ? await (0, exports.fetchBlockChildren)(block.id) : [];
        const expandedChildren = children.length ? await (0, exports.expandBlocks)(children) : [];
        expanded.push({ ...block, children: expandedChildren });
    }
    return expanded;
};
exports.expandBlocks = expandBlocks;
const blockToMarkdown = (block, depth) => {
    const indent = '  '.repeat(depth);
    let body;
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
const blocksToMarkdown = (blocks) => blocks.map((block) => blockToMarkdown(block, 0)).join('\n');
exports.blocksToMarkdown = blocksToMarkdown;
exports.richTextToPlain = safeRichText;
//# sourceMappingURL=notionBlocks.js.map