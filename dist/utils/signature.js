"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyNotionSignature = exports.notionHeaders = void 0;
const crypto_1 = require("crypto");
const env_1 = require("../config/env");
const SIGNATURE_HEADER = 'x-notion-signature';
const TIMESTAMP_HEADER = 'x-notion-timestamp';
exports.notionHeaders = {
    signature: SIGNATURE_HEADER,
    timestamp: TIMESTAMP_HEADER,
};
const verifyNotionSignature = (rawBody, signature, timestamp) => {
    if (!signature || !timestamp) {
        return false;
    }
    const signedPayload = `${timestamp}${rawBody.toString()}`;
    const computed = (0, crypto_1.createHmac)('sha256', env_1.env.NOTION_WEBHOOK_SECRET).update(signedPayload).digest('hex');
    const normalizedSignature = signature.startsWith('sha256=') ? signature.slice(7) : signature;
    if (normalizedSignature.length !== computed.length) {
        return false;
    }
    try {
        return (0, crypto_1.timingSafeEqual)(Buffer.from(normalizedSignature), Buffer.from(computed));
    }
    catch (error) {
        console.error('Failed to verify Notion signature', error);
        return false;
    }
};
exports.verifyNotionSignature = verifyNotionSignature;
//# sourceMappingURL=signature.js.map