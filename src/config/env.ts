const required = (value: string | undefined, name: string): string => {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const numberFromEnv = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid number for environment variable`);
  }
  return parsed;
};

export const env = {
  PORT: numberFromEnv(process.env.PORT, 3000),
  NOTION_API_KEY: required(process.env.NOTION_API_KEY, 'NOTION_API_KEY'),
  // Optional: internal Notion webhooks may not use signing secrets
  NOTION_WEBHOOK_SECRET: process.env.NOTION_WEBHOOK_SECRET,
  OPENROUTER_API_KEY: required(process.env.OPENROUTER_API_KEY, 'OPENROUTER_API_KEY'),
  OPENROUTER_MODEL: process.env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-4',
  TRIGGER_KEYWORD: (process.env.TRIGGER_KEYWORD || 'ty').toLowerCase(),
};
