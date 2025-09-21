import axios from 'axios';
import { env } from '../config/env';

export const openRouterClient = axios.create({
  baseURL: 'https://openrouter.ai/api/v1',
  headers: {
    Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://digitalriver-droplet.example',
    'X-Title': 'Notion Rewriter by Codex',
  },
});
