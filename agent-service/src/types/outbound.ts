export type OutboundType = 'text' | 'product_cards' | 'quick_replies' | 'error' | 'handoff';

export interface OutboundEnvelope<TPayload> {
  type: OutboundType;
  message_id: string;
  conversation_id: string;
  timestamp: string;
  payload: TPayload;
  meta: {
    source: 'agent_service';
    schema_version: '1.0';
  };
}

export interface ProductCard {
  id: string;
  image: string;
  title: string;
  price: number;
  currency: string;
  stock_status: 'in_stock' | 'low_stock' | 'out_of_stock' | 'preorder';
  key_attributes: Array<{ name: string; value: string }>;
  product_url: string;
  cta_buttons?: Array<{
    label: string;
    value: string;
    action: 'postback' | 'open_url';
    url?: string;
  }>;
}

export type OutboundMessage =
  | OutboundEnvelope<{ text: string; markdown?: boolean }>
  | OutboundEnvelope<{ summary_text?: string; cards: ProductCard[] }>
  | OutboundEnvelope<{
      prompt: string;
      replies: Array<{
        label: string;
        value: string;
        meaning: 'confirm' | 'cancel' | 'yes' | 'no' | 'show_more' | 'filter';
      }>;
    }>
  | OutboundEnvelope<{ code: string; message: string; retryable: boolean; suggested_next_step?: string }>
  | OutboundEnvelope<{ reason: string; message: string; queue?: string; priority?: 'low' | 'normal' | 'high' }>;
