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
const unique = (arr) => Array.from(new Set(arr));
const extractCandidateCommentIds = (payload) => {
    const candidates = [];
    const p = payload;
    // Common locations
    candidates.push(p?.payload?.data?.comment?.id);
    candidates.push(p?.payload?.data?.id);
    candidates.push(p?.data?.comment?.id);
    candidates.push(p?.data?.id);
    // Event array shapes
    const evtArr = Array.isArray(p?.payload?.events)
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
    return unique(candidates.filter((v) => typeof v === 'string' && v.length > 0));
};
const handleNotionWebhook = async (body) => {
    const envelope = body?.payload ?? body;
    if (!envelope || typeof envelope !== 'object') {
        return;
    }
    // Support both envelope.type === 'event_callback' and single-event envelopes (e.g., 'comment.created')
    let eventsArray = Array.isArray(envelope.events)
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
    eventsArray = eventsArray.filter((e) => e && typeof e === 'object' && typeof e.type === 'string');
    // Notion may send event types like "comment", "comment.created", etc.
    const relevantEvents = eventsArray.filter((event) => {
        const t = typeof (event && event.type) === 'string' ? String(event.type).toLowerCase() : '';
        return t.includes('comment');
    });
    // If events did not include a comment type, still try to extract a comment id from the whole payload
    const fallbackCandidates = relevantEvents.length === 0 ? extractCandidateCommentIds(body) : [];
    for (const event of relevantEvents.length ? relevantEvents : fallbackCandidates) {
        try {
            let commentId;
            if (typeof event === 'string') {
                commentId = event;
            }
            else {
                const data = (event && typeof event === 'object' ? event.data : undefined);
                commentId =
                    data?.id ||
                        data?.comment?.id ||
                        data?.comment_id ||
                        body?.payload?.data?.comment?.id ||
                        body?.entity?.id;
            }
            if (!commentId) {
                continue;
            }
            let comment = null;
            try {
                comment = (await notion_1.notionClient.comments.retrieve({ comment_id: commentId }));
            }
            catch (err) {
                // Try other candidates if this id is not a valid comment id
                if (relevantEvents.length === 0) {
                    const more = extractCandidateCommentIds(body).filter((id) => id !== commentId);
                    for (const alt of more) {
                        try {
                            comment = (await notion_1.notionClient.comments.retrieve({ comment_id: alt }));
                            commentId = alt;
                            break;
                        }
                        catch (_) {
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
            const pageIdFromPayload = body?.payload?.data?.page_id || body?.data?.page_id;
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
            await (0, rewriteService_1.rewritePage)(rewriteContext);
        }
        catch (err) {
            console.error('Failed to process comment event', err);
            // continue with other events
        }
    }
};
exports.handleNotionWebhook = handleNotionWebhook;
//# sourceMappingURL=notionWebhookService.js.map