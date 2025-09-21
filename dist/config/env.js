"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const required = (value, name) => {
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
};
const numberFromEnv = (value, fallback) => {
    if (!value) {
        return fallback;
    }
    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
        throw new Error(`Invalid number for environment variable`);
    }
    return parsed;
};
exports.env = {
    PORT: numberFromEnv(process.env.PORT, 3000),
    NOTION_API_KEY: required(process.env.NOTION_API_KEY, 'NOTION_API_KEY'),
    // Optional: internal Notion webhooks may not use signing secrets
    NOTION_WEBHOOK_SECRET: process.env.NOTION_WEBHOOK_SECRET,
    OPENROUTER_API_KEY: required(process.env.OPENROUTER_API_KEY, 'OPENROUTER_API_KEY'),
    OPENROUTER_MODEL: process.env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-4',
    TRIGGER_KEYWORD: (process.env.TRIGGER_KEYWORD || 'ty').toLowerCase(),
};
//# sourceMappingURL=env.js.map