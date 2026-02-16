export interface ChatwootAttachment {
  id?: number | string;
  file_type?: string;
  content_type?: string;
  data_url?: string;
  file_url?: string;
  account_id?: number;
}

export interface ChatwootSender {
  id?: number;
  type?: 'contact' | 'agent' | 'bot' | string;
}

export interface ChatwootMessage {
  id: number;
  content?: string;
  message_type?: 'incoming' | 'outgoing' | 'template' | string;
  private?: boolean;
  sender?: ChatwootSender;
  attachments?: ChatwootAttachment[];
}

export interface ChatwootWebhookPayload {
  event: string;
  event_id?: string;
  id?: number;
  message_type?: string;
  private?: boolean;
  content?: string;
  conversation?: { id: number };
  sender?: ChatwootSender;
  attachments?: ChatwootAttachment[];
  message?: ChatwootMessage;
}
