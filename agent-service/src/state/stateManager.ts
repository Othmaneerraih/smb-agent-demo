import { redis } from '../config/redis';
import { ConversationState } from '../types/state';

const stateKey = (conversationId: string): string => `cw:state:${conversationId}`;
const intentKey = (conversationId: string): string => `cw:intent:${conversationId}`;
const shownProductsKey = (conversationId: string): string => `cw:shown:${conversationId}`;

export const defaultState = (): ConversationState => ({
  state: 'idle',
  last_intent: null,
  pagination: {
    offset: 0,
    limit: 5,
    last_query_hash: null,
  },
  pending_confirmation: {
    action: null,
    target_id: null,
    created_at: null,
  },
  clarification_attempts: 0,
  last_user_message_id: null,
  last_agent_message_id: null,
});

export const getState = async (conversationId: string): Promise<ConversationState> => {
  const raw = await redis.get(stateKey(conversationId));
  if (!raw) return defaultState();
  try {
    return JSON.parse(raw) as ConversationState;
  } catch {
    return defaultState();
  }
};

export const saveState = async (conversationId: string, state: ConversationState): Promise<void> => {
  await redis.set(stateKey(conversationId), JSON.stringify(state), 'EX', 60 * 60 * 24);
};

export const resetState = async (conversationId: string): Promise<ConversationState> => {
  const state = defaultState();
  await saveState(conversationId, state);
  await redis.del(intentKey(conversationId));
  await redis.del(shownProductsKey(conversationId));
  return state;
};

export const incrementRepeatedIntent = async (conversationId: string, intent: string): Promise<number> => {
  const key = intentKey(conversationId);
  const raw = await redis.get(key);
  if (!raw) {
    await redis.set(key, JSON.stringify({ intent, count: 1 }), 'EX', 60 * 60);
    return 1;
  }

  const parsed = JSON.parse(raw) as { intent: string; count: number };
  const count = parsed.intent === intent ? parsed.count + 1 : 1;
  await redis.set(key, JSON.stringify({ intent, count }), 'EX', 60 * 60);
  return count;
};

export const getShownProductIds = async (conversationId: string): Promise<string[]> => {
  const raw = await redis.get(shownProductsKey(conversationId));
  if (!raw) return [];
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
};

export const saveShownProductIds = async (conversationId: string, ids: string[]): Promise<void> => {
  await redis.set(shownProductsKey(conversationId), JSON.stringify(Array.from(new Set(ids))), 'EX', 60 * 60 * 24);
};
