import { env } from '../config/env';
import { TimeoutError } from '../utils/retry';

const defaultHeaders = {
  api_access_token: env.chatwootApiToken,
  'Content-Type': 'application/json',
};

const withTimeout = async (input: RequestInfo, init: RequestInit, timeoutMs = 8000): Promise<Response> => {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      throw new TimeoutError('Chatwoot request timed out');
    }
    throw error;
  } finally {
    clearTimeout(t);
  }
};

const handleResponse = async (res: Response): Promise<unknown> => {
  if (!res.ok) {
    const err = new Error(`Chatwoot API error ${res.status}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return null;
  return res.json();
};

export const postMessage = async (conversationId: string, content: string): Promise<unknown> => {
  const url = `${env.chatwootBaseUrl}/api/v1/accounts/${env.chatwootAccountId}/conversations/${conversationId}/messages`;
  const res = await withTimeout(url, {
    method: 'POST',
    headers: defaultHeaders,
    body: JSON.stringify({ content, message_type: 'outgoing', private: false }),
  });
  return handleResponse(res);
};

export const assignConversation = async (conversationId: string, queue: string): Promise<unknown> => {
  const url = `${env.chatwootBaseUrl}/api/v1/accounts/${env.chatwootAccountId}/conversations/${conversationId}/assignments`;
  const res = await withTimeout(url, {
    method: 'POST',
    headers: defaultHeaders,
    body: JSON.stringify({ team_id: queue }),
  });
  return handleResponse(res);
};

export const fetchMessage = async (conversationId: string, messageId: string): Promise<unknown> => {
  const url = `${env.chatwootBaseUrl}/api/v1/accounts/${env.chatwootAccountId}/conversations/${conversationId}/messages/${messageId}`;
  const res = await withTimeout(url, {
    method: 'GET',
    headers: defaultHeaders,
  });
  return handleResponse(res);
};
