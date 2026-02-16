import { NextFunction, Request, Response } from 'express';
import { redis } from '../config/redis';
import { ChatwootWebhookPayload } from '../types/chatwoot';

export const dedupWebhook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const payload = req.body as ChatwootWebhookPayload;
  const dedupId = payload.event_id ?? payload.message?.id?.toString() ?? payload.id?.toString();

  if (!dedupId) {
    res.status(400).json({ error: 'Missing dedup key (event_id/message_id)' });
    return;
  }

  const key = `cw:dedup:${dedupId}`;
  const inserted = await redis.set(key, '1', 'NX', 'EX', 86400);

  if (inserted === null) {
    res.status(200).json({ status: 'duplicate_ignored' });
    return;
  }

  next();
};
