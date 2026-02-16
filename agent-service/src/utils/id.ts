export const makeMessageId = (prefix: string): string => `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
