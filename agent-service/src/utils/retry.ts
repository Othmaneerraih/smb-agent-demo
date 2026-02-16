import { sleep } from './time';

const backoff = [1000, 3000, 10000];

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

export const withRetry = async <T>(fn: () => Promise<T>): Promise<T> => {
  let attempt = 0;
  let lastError: unknown;

  while (attempt < 3) {
    attempt += 1;
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const status = (error as { status?: number }).status;
      const isRetryable = (typeof status === 'number' && status >= 500) || error instanceof TimeoutError;
      if (!isRetryable || attempt >= 3) {
        throw error;
      }
      await sleep(backoff[attempt - 1]);
    }
  }

  throw lastError;
};
