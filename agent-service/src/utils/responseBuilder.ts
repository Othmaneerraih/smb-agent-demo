import { Product } from '../mocks/productIndex';
import { OutboundEnvelope, ProductCard } from '../types/outbound';
import { makeMessageId } from './id';

const baseEnvelope = <T>(type: OutboundEnvelope<T>['type'], conversationId: string, payload: T): OutboundEnvelope<T> => ({
  type,
  message_id: makeMessageId('msg'),
  conversation_id: conversationId,
  timestamp: new Date().toISOString(),
  payload,
  meta: {
    source: 'agent_service',
    schema_version: '1.0',
  },
});

const toCard = (product: Product): ProductCard => ({
  id: product.id,
  image: product.image,
  title: product.title,
  price: product.price,
  currency: product.currency,
  stock_status: product.stock_status,
  key_attributes: Object.entries(product.attributes)
    .slice(0, 3)
    .map(([name, value]) => ({ name, value })),
  product_url: product.product_url,
  cta_buttons: [
    {
      label: 'View Product',
      value: `open_product:${product.id}`,
      action: 'open_url',
      url: product.product_url,
    },
  ],
});

export const buildText = (conversationId: string, text: string): OutboundEnvelope<{ text: string }> =>
  baseEnvelope('text', conversationId, { text });

export const buildProductCards = (
  conversationId: string,
  products: Product[],
  summaryText = 'Here are options that match your request.',
): OutboundEnvelope<{ summary_text: string; cards: ProductCard[] }> =>
  baseEnvelope('product_cards', conversationId, {
    summary_text: summaryText,
    cards: products.slice(0, 5).map(toCard),
  });

export const buildQuickReplies = (
  conversationId: string,
  prompt: string,
  replies: Array<{ label: string; value: string; meaning: 'confirm' | 'cancel' | 'yes' | 'no' | 'show_more' | 'filter' }>,
): OutboundEnvelope<{ prompt: string; replies: Array<{ label: string; value: string; meaning: 'confirm' | 'cancel' | 'yes' | 'no' | 'show_more' | 'filter' }> }> =>
  baseEnvelope('quick_replies', conversationId, { prompt, replies });

export const buildError = (
  conversationId: string,
  code: string,
  message: string,
  retryable: boolean,
): OutboundEnvelope<{ code: string; message: string; retryable: boolean }> =>
  baseEnvelope('error', conversationId, { code, message, retryable });

export const buildHandoff = (
  conversationId: string,
  queue: string,
  reason = 'user_requested_human',
): OutboundEnvelope<{ reason: string; message: string; queue: string; priority: 'normal' }> =>
  baseEnvelope('handoff', conversationId, {
    reason,
    message: 'I’m connecting you to a human agent now.',
    queue,
    priority: 'normal',
  });
