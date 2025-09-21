"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const env_1 = require("./config/env");
const notionRouter_1 = require("./webhook/notionRouter");
const app = (0, express_1.default)();
app.use(express_1.default.json({
    verify: (req, _res, buf) => {
        req.rawBody = buf;
    },
}));
app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
});
app.use('/webhook/notion', notionRouter_1.notionWebhookRouter);
app.listen(env_1.env.PORT, () => {
    console.log(`Notion Rewriter listening on port ${env_1.env.PORT}`);
});
//# sourceMappingURL=index.js.map