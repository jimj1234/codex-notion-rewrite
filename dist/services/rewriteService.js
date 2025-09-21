"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rewritePage = void 0;
const notion_1 = require("../clients/notion");
const openrouter_1 = require("../clients/openrouter");
const blockSpec_1 = require("../utils/blockSpec");
const env_1 = require("../config/env");
const DEFAULT_SYSTEM_PROMPT = `You are an elite knowledge architect assisting with reorganizing Notion documentation.
- Preserve all factual information while dramatically improving readability.
- Start the page with a concise orientation (summary or key outcomes).
- Structure the content into nested toggle blocks that provide a skimmable overview first, then allow drilling down.
- Use informative toggle titles, and place details, lists, and examples within nested toggles.
- When useful, convert dense paragraphs into bullet points or tables, but remain faithful to original meaning.
- Maintain references, links, and metadata already present.
- Respond with pure JSON (no code fences) describing the rewritten page using the agreed schema.`;
const buildUserPrompt = (context) => {
    const additional = context.overrideInstructions
        ? `Additional rewrite instructions provided by the user comment: "${context.overrideInstructions.trim()}"\n`
        : 'No additional rewrite instructions were provided in the triggering comment.\n';
    return `The original Notion page is titled "${context.pageTitle}".\n${additional}
Provide a JSON response with the structure: {"page_title": string (optional), "blocks": BlockSpec[]} where BlockSpec can represent paragraph, heading_1/2/3, bulleted_list_item, numbered_list_item, toggle, quote, callout, or code as described earlier.\nEach toggle must contain informative children blocks; paragraphs should be concise.\nHere is the current page content serialized in Markdown-like form:\n\n${context.pageMarkdown}`;
};
const extractJson = (raw) => {
    const trimmed = raw.trim();
    if (trimmed.startsWith('```')) {
        return trimmed.replace(/```json|```/gi, '').trim();
    }
    return trimmed;
};
const parseRewriteResponse = (raw) => {
    try {
        const jsonString = extractJson(raw);
        const parsed = JSON.parse(jsonString);
        if (!parsed || typeof parsed !== 'object') {
            throw new Error('LLM response is not an object');
        }
        if (!Array.isArray(parsed.blocks)) {
            throw new Error('LLM response missing blocks array');
        }
        return parsed;
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown parse error';
        throw new Error(`Failed to parse rewrite response: ${message}`);
    }
};
const chunk = (items, size) => {
    const chunks = [];
    for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size));
    }
    return chunks;
};
const deleteExistingBlocks = async (blockIds) => {
    for (const id of blockIds) {
        await notion_1.notionClient.blocks.delete({ block_id: id });
    }
};
const appendBlocks = async (pageId, blocks) => {
    const batches = chunk(blocks, 50);
    for (const batch of batches) {
        await notion_1.notionClient.blocks.children.append({
            block_id: pageId,
            children: batch,
        });
    }
};
const updatePageTitleIfNeeded = async (pageId, currentTitle, nextTitle) => {
    if (!nextTitle || nextTitle.trim() === '' || nextTitle.trim() === currentTitle.trim()) {
        return;
    }
    const textToRichText = (text) => [
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
    await notion_1.notionClient.pages.update({
        page_id: pageId,
        properties: propertiesUpdate,
    });
};
const rewritePage = async (context) => {
    const payload = {
        model: env_1.env.OPENROUTER_MODEL,
        messages: [
            { role: 'system', content: DEFAULT_SYSTEM_PROMPT },
            { role: 'user', content: buildUserPrompt(context) },
        ],
        temperature: 0.2,
    };
    const response = await openrouter_1.openRouterClient.post('/chat/completions', payload);
    const message = response.data?.choices?.[0]?.message?.content;
    if (!message || typeof message !== 'string') {
        throw new Error('Received empty response from language model');
    }
    const parsed = parseRewriteResponse(message);
    const blockRequests = (0, blockSpec_1.blockSpecsToNotionBlocks)(parsed.blocks ?? []);
    if (blockRequests.length === 0) {
        throw new Error('LLM returned no blocks; aborting rewrite to avoid wiping the page.');
    }
    await deleteExistingBlocks(context.rootBlockIds);
    await appendBlocks(context.pageId, blockRequests);
    await updatePageTitleIfNeeded(context.pageId, context.pageTitle, parsed.page_title);
};
exports.rewritePage = rewritePage;
//# sourceMappingURL=rewriteService.js.map