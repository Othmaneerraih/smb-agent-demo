import dotenv from 'dotenv';

dotenv.config();

const required = ['PORT', 'REDIS_URL', 'CHATWOOT_BASE_URL', 'CHATWOOT_API_TOKEN', 'CHATWOOT_ACCOUNT_ID', 'WEBHOOK_SECRET'];
for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required env var: ${key}`);
  }
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3000),
  redisUrl: process.env.REDIS_URL as string,
  webhookSecret: process.env.WEBHOOK_SECRET as string,
  chatwootBaseUrl: process.env.CHATWOOT_BASE_URL as string,
  chatwootApiToken: process.env.CHATWOOT_API_TOKEN as string,
  chatwootAccountId: process.env.CHATWOOT_ACCOUNT_ID as string,
  defaultHandoffQueue: process.env.DEFAULT_HANDOFF_QUEUE ?? 'support',
  openaiApiKey: process.env.OPENAI_API_KEY ?? 'placeholder',
};
