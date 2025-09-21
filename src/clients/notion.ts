import { Client } from '@notionhq/client';
import { env } from '../config/env';

export const notionClient = new Client({ auth: env.NOTION_API_KEY });
