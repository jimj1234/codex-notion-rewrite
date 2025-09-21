import express, { Request, Response } from 'express';
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { verifyNotionSignature, notionHeaders } from '../utils/signature';
import { handleNotionWebhook } from '../services/notionWebhookService';

export const notionWebhookRouter = express.Router();

type NotionRequest = Request & { rawBody?: Buffer };

notionWebhookRouter.post('/', async (req: NotionRequest, res: Response) => {
  try {
    const ua = req.header('user-agent') || 'unknown';
    const pType: unknown = (req.body as any)?.payload?.type ?? (req.body as any)?.type;
    const eventsPreview: unknown = Array.isArray((req.body as any)?.payload?.events)
      ? (req.body as any).payload.events.map((e: any) => e?.type).slice(0, 5)
      : [];
    console.log('[Notion] Incoming webhook', { ua, pType, eventsPreview });
    try {
      const dumpPath = resolve(process.cwd(), 'last-webhook.json');
      writeFileSync(dumpPath, JSON.stringify(req.body, null, 2), 'utf8');
    } catch (_) {
      // ignore
    }
  } catch (_) {
    // ignore logging errors
  }
  // Handle Notion webhook verification handshake (capture token)
  try {
    const maybeType: unknown = (req.body as any)?.payload?.type ?? (req.body as any)?.type;
    const maybeToken: unknown = (req.body as any)?.payload?.verification_token ?? (req.body as any)?.verification_token;
    if ((maybeType === 'verification' || typeof maybeToken === 'string') && typeof maybeToken === 'string') {
      try {
        const tokenPath = resolve(process.cwd(), 'verification-token.txt');
        writeFileSync(tokenPath, maybeToken, 'utf8');
        console.log('[Notion] Captured verification_token');
      } catch (err) {
        console.error('Failed to persist verification token', err);
      }
      return res.status(200).json({ ok: true });
    }
  } catch (err) {
    // noop; fall through to normal path
  }

  const rawBody: Buffer | undefined = req.rawBody;
  const signature = req.header(notionHeaders.signature);
  const timestamp = req.header(notionHeaders.timestamp);

  if (!rawBody || !verifyNotionSignature(rawBody, signature ?? undefined, timestamp ?? undefined)) {
    return res.status(401).json({ ok: false, error: 'Invalid signature' });
  }

  try {
    await handleNotionWebhook(req.body);
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Failed to handle Notion webhook', error);
    return res.status(500).json({ ok: false });
  }
});
