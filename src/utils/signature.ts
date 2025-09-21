import { createHmac, timingSafeEqual } from 'crypto';
import { env } from '../config/env';

const SIGNATURE_HEADER = 'x-notion-signature';
const TIMESTAMP_HEADER = 'x-notion-timestamp';

export const notionHeaders = {
  signature: SIGNATURE_HEADER,
  timestamp: TIMESTAMP_HEADER,
} as const;

export const verifyNotionSignature = (rawBody: Buffer, signature?: string, timestamp?: string): boolean => {
  // If no signing secret configured, accept the request (internal webhook without signatures)
  if (!env.NOTION_WEBHOOK_SECRET) {
    return true;
  }
  if (!signature || !timestamp) {
    return false;
  }

  const signedPayload = `${timestamp}${rawBody.toString()}`;
  const computed = createHmac('sha256', env.NOTION_WEBHOOK_SECRET).update(signedPayload).digest('hex');
  const normalizedSignature = signature.startsWith('sha256=') ? signature.slice(7) : signature;

  if (normalizedSignature.length !== computed.length) {
    return false;
  }

  try {
    return timingSafeEqual(Buffer.from(normalizedSignature), Buffer.from(computed));
  } catch (error) {
    console.error('Failed to verify Notion signature', error);
    return false;
  }
};
