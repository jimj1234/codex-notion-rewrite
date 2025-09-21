"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notionWebhookRouter = void 0;
const express_1 = __importDefault(require("express"));
const signature_1 = require("../utils/signature");
const notionWebhookService_1 = require("../services/notionWebhookService");
exports.notionWebhookRouter = express_1.default.Router();
exports.notionWebhookRouter.post('/', async (req, res) => {
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