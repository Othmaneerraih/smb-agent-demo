const yesWords = new Set(['yes', 'y', 'confirm', 'ok', 'okay', 'sure', 'ah', 'wakha', 'mzyan', 'iyyeh', 'na3am']);
const noWords = new Set(['no', 'n', 'cancel', 'stop', 'nope', 'la', 'bala', 'mansalich']);

export const normalizeText = (input: string): string =>
  input
    .toLowerCase()
    .replace(/[.,!?;:]+/g, '')
    .trim();

export const isYesEquivalent = (input: string): boolean => yesWords.has(normalizeText(input));
export const isNoEquivalent = (input: string): boolean => noWords.has(normalizeText(input));
