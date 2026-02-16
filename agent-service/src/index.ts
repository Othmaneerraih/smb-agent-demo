import express from 'express';
import { env } from './config/env';
import { redis } from './config/redis';
import { handleChatwootWebhook } from './handlers/webhookHandler';
import { dedupWebhook } from './middleware/dedup';
import { validateSignature } from './middleware/signature';

const app = express();

app.use(express.json({ limit: '2mb' }));

app.get('/health', async (_req, res) => {
  try {
    await redis.ping();
    res.status(200).json({ status: 'ok' });
  } catch (error) {
    res.status(500).json({ status: 'degraded', error: (error as Error).message });
  }
});

app.post('/webhooks/chatwoot', validateSignature, dedupWebhook, handleChatwootWebhook);

app.listen(env.port, () => {
  console.log(`agent-service listening on :${env.port}`);
});
