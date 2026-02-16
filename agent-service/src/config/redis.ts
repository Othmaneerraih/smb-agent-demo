import Redis from 'ioredis';
import { env } from './env';

export const redis = new Redis(env.redisUrl, { lazyConnect: false });

redis.on('error', (err) => {
  console.error('Redis error', err);
});
