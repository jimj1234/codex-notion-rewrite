import express, { Request, Response } from 'express';
import { verifyNotionSignature, notionHeaders } from '../utils/signature';
import { handleNotionWebhook } from '../services/notionWebhookService';

export const notionWebhookRouter = express.Router();

type NotionRequest = Request & { rawBody?: Buffer };

notionWebhookRouter.post('/', async (req: NotionRequest, res: Response) => {
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
