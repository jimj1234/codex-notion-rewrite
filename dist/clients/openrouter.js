"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.openRouterClient = void 0;
const axios_1 = __importDefault(require("axios"));
const env_1 = require("../config/env");
exports.openRouterClient = axios_1.default.create({
    baseURL: 'https://openrouter.ai/api/v1',
    headers: {
        Authorization: `Bearer ${env_1.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://digitalriver-droplet.example',
        'X-Title': 'Notion Rewriter by Codex',
    },
});
//# sourceMappingURL=openrouter.js.map