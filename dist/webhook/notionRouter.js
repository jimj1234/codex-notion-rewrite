"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notionWebhookRouter = void 0;
const express_1 = __importDefault(require("express"));
const fs_1 = require("fs");
const path_1 = require("path");
const signature_1 = require("../utils/signature");
const notionWebhookService_1 = require("../services/notionWebhookService");
exports.notionWebhookRouter = express_1.default.Router();
exports.notionWebhookRouter.post('/', async (req, res) => {
    try {
        const ua = req.header('user-agent') || 'unknown';
        const pType = req.body?.payload?.type ?? req.body?.type;
        const eventsPreview = Array.isArray(req.body?.payload?.events)
            ? req.body.payload.events.map((e) => e?.type).slice(0, 5)
            : [];
        console.log('[Notion] Incoming webhook', { ua, pType, eventsPreview });
        try {
            const dumpPath = (0, path_1.resolve)(process.cwd(), 'last-webhook.json');
            (0, fs_1.writeFileSync)(dumpPath, JSON.stringify(req.body, null, 2), 'utf8');
        }
        catch (_) {
            // ignore
        }
    }
    catch (_) {
        // ignore logging errors
    }
    // Handle Notion webhook verification handshake (capture token)
    try {
        const maybeType = req.body?.payload?.type ?? req.body?.type;
        const maybeToken = req.body?.payload?.verification_token ?? req.body?.verification_token;
        if ((maybeType === 'verification' || typeof maybeToken === 'string') && typeof maybeToken === 'string') {
            try {
                const tokenPath = (0, path_1.resolve)(process.cwd(), 'verification-token.txt');
                (0, fs_1.writeFileSync)(tokenPath, maybeToken, 'utf8');
                console.log('[Notion] Captured verification_token');
            }
            catch (err) {
                console.error('Failed to persist verification token', err);
            }
            return res.status(200).json({ ok: true });
        }
    }
    catch (err) {
        // noop; fall through to normal path
    }
    const rawBody = req.rawBody;
    const signature = req.header(signature_1.notionHeaders.signature);
    const timestamp = req.header(signature_1.notionHeaders.timestamp);
    if (!rawBody || !(0, signature_1.verifyNotionSignature)(rawBody, signature ?? undefined, timestamp ?? undefined)) {
        return res.status(401).json({ ok: false, error: 'Invalid signature' });
    }
    try {
        await (0, notionWebhookService_1.handleNotionWebhook)(req.body);
        return res.status(200).json({ ok: true });
    }
    catch (error) {
        console.error('Failed to handle Notion webhook', error);
        return res.status(500).json({ ok: false });
    }
});
//# sourceMappingURL=notionRouter.js.map