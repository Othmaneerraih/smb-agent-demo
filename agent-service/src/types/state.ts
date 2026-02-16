export type ConversationStatus =
  | 'idle'
  | 'clarifying'
  | 'recommending'
  | 'awaiting_confirmation'
  | 'paginating'
  | 'error'
  | 'handoff';

export interface PaginationState {
  offset: number;
  limit: number;
  last_query_hash: string | null;
}

export interface PendingConfirmation {
  action: string | null;
  target_id: string | null;
  created_at: string | null;
}

export interface ConversationState {
  state: ConversationStatus;
  last_intent: string | null;
  pagination: PaginationState;
  pending_confirmation: PendingConfirmation;
  clarification_attempts: number;
  last_user_message_id: string | null;
  last_agent_message_id: string | null;
}
