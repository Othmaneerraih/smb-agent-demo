import { ChatwootAttachment } from '../types/chatwoot';
import { TimeoutError } from '../utils/retry';

const downloadBinary = async (url: string, timeoutMs = 8000): Promise<Buffer> => {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      const err = new Error(`Attachment download failed ${res.status}`) as Error & { status?: number };
      err.status = res.status;
      throw err;
    }
    return Buffer.from(await res.arrayBuffer());
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      throw new TimeoutError('Attachment download timed out');
    }
    throw error;
  } finally {
    clearTimeout(t);
  }
};

export const handleImage = async (attachment: ChatwootAttachment): Promise<{ imageUrl: string; mimeType: string }> => {
  const imageUrl = attachment.file_url ?? attachment.data_url;
  if (!imageUrl) {
    throw new Error('Image attachment missing URL');
  }
  return {
    imageUrl,
    mimeType: attachment.content_type ?? attachment.file_type ?? 'image/*',
  };
};

const mockTranscribeAudio = (audioBytes: Buffer): string => {
  if (audioBytes.length === 0) return 'audio message (empty)';
  return 'transcribed audio request';
};

export const handleAudio = async (attachment: ChatwootAttachment): Promise<{ transcript: string; mimeType: string }> => {
  const audioUrl = attachment.file_url ?? attachment.data_url;
  if (!audioUrl) {
    throw new Error('Audio attachment missing URL');
  }
  const rawAudio = await downloadBinary(audioUrl);
  const transcript = mockTranscribeAudio(rawAudio);

  return {
    transcript,
    mimeType: attachment.content_type ?? attachment.file_type ?? 'audio/*',
  };
};
