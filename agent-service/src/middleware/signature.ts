import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { env } from '../config/env';

export const validateSignature = (req: Request, res: Response, next: NextFunction): void => {
  const signature = req.header('x-chatwoot-signature');
  if (!signature) {
    res.status(401).json({ error: 'Missing signature' });
    return;
  }

  const bodyRaw = JSON.stringify(req.body);
  const expected = crypto.createHmac('sha256', env.webhookSecret).update(bodyRaw).digest('hex');

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length) {
    res.status(403).json({ error: 'Invalid signature' });
    return;
  }

  const valid = crypto.timingSafeEqual(sigBuf, expBuf);

  if (!valid) {
    res.status(403).json({ error: 'Invalid signature' });
    return;
  }

  next();
};
