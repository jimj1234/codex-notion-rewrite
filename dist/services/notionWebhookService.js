"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleNotionWebhook = void 0;
const notion_1 = require("../clients/notion");
const env_1 = require("../config/env");
const rewriteService_1 = require("./rewriteService");
const notionBlocks_1 = require("../utils/notionBlocks");
const escapeForRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const triggerRegex = (keyword) => new RegExp(`\\b${escapeForRegex(keyword)}\\b`, 'i');
const hasTriggerKeyword = (text) => triggerRegex(env_1.env.TRIGGER_KEYWORD).test(text);
const stripTriggerKeyword = (text) => text.replace(new RegExp(`\\b${escapeForRegex(env_1.env.TRIGGER_KEYWORD)}\\b`, 'ig'), '').trim();
const getPageTitle = (page) => {
    for (const property of Object.values(page.properties)) {
        if (property?.type === 'title') {
            const titleItems = (property.title ?? []);
            if (titleItems.length > 0) {
                return titleItems.map((item) => item.plain_text).join('');
            }
        }
    }
    return 'Untitled';
};
const resolvePageIdFromParent = async (parent) => {
    if (!parent) {
        return null;
    }
    if (parent.type === 'page_id') {
        return parent.page_id;
    }
    if (parent.type === 'block_id') {
        let currentId = parent.block_id;
        while (currentId) {
            const block = (await notion_1.notionClient.blocks.retrieve({ block_id: currentId }));
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
const gatherPageContext = async (pageId) => {
    const page = (await notion_1.notionClient.pages.retrieve({ page_id: pageId }));
    const title = getPageTitle(page);
    const rootBlocks = await (0, notionBlocks_1.fetchBlockChildren)(pageId);
    const expandedBlocks = await (0, notionBlocks_1.expandBlocks)(rootBlocks);
    const markdown = (0, notionBlocks_1.blocksToMarkdown)(expandedBlocks);
    return {
        pageTitle: title,
        pageMarkdown: markdown,
        rootBlockIds: rootBlocks.map((block) => block.id),
    };
};
const getCommentText = (comment) => (comment.rich_text ?? []).map((rt) => rt.plain_text).join(' ');
const handleNotionWebhook = async (payload) => {
    if (payload.payload.type !== 'event_callback') {
        return;
    }
    const relevantEvents = payload.payload.events.filter((event) => event.type === 'comment');
    for (const event of relevantEvents) {
        const commentId = event.data.id;
        if (!commentId) {
            continue;
        }
        const comment = (await notion_1.notionClient.comments.retrieve({ comment_id: commentId }));
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
        await (0, rewriteService_1.rewritePage)(rewriteContext);
    }
};
exports.handleNotionWebhook = handleNotionWebhook;
//# sourceMappingURL=notionWebhookService.js.map