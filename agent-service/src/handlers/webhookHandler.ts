import { Request, Response } from 'express';
import { assignConversation, fetchMessage, postMessage } from '../clients/chatwootClient';
import { env } from '../config/env';
import { handleAudio, handleImage } from './attachmentHandler';
import { getState, getShownProductIds, incrementRepeatedIntent, resetState, saveShownProductIds, saveState } from '../state/stateManager';
import { buildStateMachineError, runStateMachine } from '../state/stateMachine';
import { ChatwootAttachment, ChatwootMessage, ChatwootWebhookPayload } from '../types/chatwoot';
import { OutboundMessage } from '../types/outbound';
import { withRetry } from '../utils/retry';

const isIncomingCustomerMessage = (payload: ChatwootWebhookPayload): boolean => {
  const senderType = payload.sender?.type ?? payload.message?.sender?.type;
  const messageType = payload.message?.message_type ?? payload.message_type;
  const isPrivate = payload.message?.private ?? payload.private;

  return senderType !== 'agent' && senderType !== 'bot' && senderType !== 'system' && messageType === 'incoming' && !isPrivate;
};

const toTextFallback = (outbound: OutboundMessage): string => {
  switch (outbound.type) {
    case 'text':
      return outbound.payload.text;
    case 'product_cards':
      return outbound.payload.cards
        .map((card, i) => {
          const attrs = card.key_attributes.map((a) => `${a.name}: ${a.value}`).join('; ');
          return `${i + 1}) ${card.title} — ${card.currency} ${card.price} (${card.stock_status})\n   ${attrs}\n   View: ${card.product_url}`;
        })
        .join('\n');
    case 'quick_replies':
      return [
        outbound.payload.prompt,
        ...outbound.payload.replies.map((r, i) => `[${i + 1}] ${r.label} (${r.value})`),
      ].join('\n');
    case 'error':
      return outbound.payload.message;
    case 'handoff':
      return outbound.payload.message;
    default:
      return 'Unhandled message type';
  }
};

const postOutboundToChatwoot = async (conversationId: string, outbound: OutboundMessage): Promise<void> => {
  if (outbound.type === 'handoff') {
    await withRetry(() => assignConversation(conversationId, outbound.payload.queue ?? env.defaultHandoffQueue));
    await withRetry(() => postMessage(conversationId, outbound.payload.message));
    return;
  }

  // Minimal production-ready behavior: always posts readable clickable fallback text.
  const content = toTextFallback(outbound);
  await withRetry(() => postMessage(conversationId, content));
};

const getMessageObject = (payload: ChatwootWebhookPayload): ChatwootMessage => {
  if (payload.message) return payload.message;
  return {
    id: payload.id ?? 0,
    content: payload.content,
    message_type: payload.message_type,
    private: payload.private,
    sender: payload.sender,
    attachments: payload.attachments,
  };
};

const getAttachmentList = async (payload: ChatwootWebhookPayload, conversationId: string, messageId: string): Promise<ChatwootAttachment[]> => {
  const direct = payload.message?.attachments ?? payload.attachments ?? [];
  if (direct.length > 0) return direct;

  const fetched = (await fetchMessage(conversationId, messageId)) as { attachments?: ChatwootAttachment[] };
  return fetched.attachments ?? [];
};

const normalizeUserInput = async (
  text: string,
  attachments: ChatwootAttachment[],
): Promise<{ normalizedText: string; imageContexts: string[] }> => {
  const imageContexts: string[] = [];
  let composedText = text || '';

  for (const attachment of attachments) {
    const mime = attachment.content_type ?? attachment.file_type ?? '';
    if (mime.startsWith('image/')) {
      const image = await handleImage(attachment);
      imageContexts.push(image.imageUrl);
    }
    if (mime.startsWith('audio/')) {
      const audio = await handleAudio(attachment);
      composedText = `${composedText} ${audio.transcript}`.trim();
    }
  }

  return { normalizedText: composedText.trim(), imageContexts: imageContexts };
};

export const handleChatwootWebhook = async (req: Request, res: Response): Promise<void> => {
  const payload = req.body as ChatwootWebhookPayload;

  if (payload.event !== 'message_created') {
    res.status(200).json({ status: 'ignored_event' });
    return;
  }

  if (!isIncomingCustomerMessage(payload)) {
    res.status(200).json({ status: 'ignored_non_customer_message' });
    return;
  }

  const conversationId = String(payload.conversation?.id ?? '');
  const message = getMessageObject(payload);
  const messageId = String(message.id);

  if (!conversationId || !messageId) {
    res.status(400).json({ error: 'Missing conversation/message id' });
    return;
  }

  try {
    const attachments = await getAttachmentList(payload, conversationId, messageId);
    const normalized = await normalizeUserInput(message.content ?? '', attachments);
    const inputText = normalized.normalizedText || 'product';

    let currentState = await getState(conversationId);
    const shownProductIds = await getShownProductIds(conversationId);
    const repeatedIntentCount = await incrementRepeatedIntent(conversationId, inputText.toLowerCase().includes('show more') ? 'show_more' : inputText);

    if (!['idle', 'clarifying', 'recommending', 'awaiting_confirmation', 'paginating', 'error', 'handoff'].includes(currentState.state)) {
      currentState = await resetState(conversationId);
    }

    const { outbound, state, shownProductIds: nextShownProductIds } = runStateMachine({
      conversationId,
      messageId,
      text: inputText,
      state: currentState,
      repeatedIntentCount,
      shownProductIds,
    });

    await postOutboundToChatwoot(conversationId, outbound);

    state.last_agent_message_id = outbound.message_id;
    await saveState(conversationId, state);
    await saveShownProductIds(conversationId, nextShownProductIds);

    res.status(200).json({ status: 'processed', type: outbound.type });
  } catch (error) {
    console.error('Webhook processing failure', error);
    const fallback = buildStateMachineError(conversationId || 'unknown');
    try {
      if (conversationId) {
        await postOutboundToChatwoot(conversationId, fallback);
      }
    } catch (postError) {
      console.error('Failed posting fallback', postError);
    }
    res.status(500).json({ status: 'error' });
  }
};
