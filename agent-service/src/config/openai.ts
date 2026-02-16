import OpenAI from 'openai';
import { env } from './env';

// Placeholder only; real calls are intentionally not used.
export const openai = new OpenAI({ apiKey: env.openaiApiKey });
