import 'dotenv/config';
import express, { Request, Response } from 'express';
import { env } from './config/env';
import { notionWebhookRouter } from './webhook/notionRouter';

const app = express();

app.use(
  express.json({
    verify: (req: Request, _res, buf) => {
      (req as Request & { rawBody?: Buffer }).rawBody = buf;
    },
  }),
);

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/webhook/notion', notionWebhookRouter);

app.listen(env.PORT, () => {
  console.log(`Notion Rewriter listening on port ${env.PORT}`);
});
