import { env } from '../config/env';
import { getProductsPage } from '../mocks/productIndex';
import { ConversationState } from '../types/state';
import { isNoEquivalent, isYesEquivalent, normalizeText } from '../utils/normalize';
import { buildError, buildHandoff, buildProductCards, buildQuickReplies, buildText } from '../utils/responseBuilder';

export interface StateMachineInput {
  conversationId: string;
  messageId: string;
  text: string;
  state: ConversationState;
  repeatedIntentCount: number;
  shownProductIds: string[];
}

export interface StateMachineOutput {
  outbound: ReturnType<typeof buildText> | ReturnType<typeof buildProductCards> | ReturnType<typeof buildQuickReplies> | ReturnType<typeof buildError> | ReturnType<typeof buildHandoff>;
  state: ConversationState;
  shownProductIds: string[];
}

const detectIntent = (text: string): 'show_more' | 'confirmation' | 'product_search' => {
  const normalized = normalizeText(text);
  if (normalized.includes('show more')) return 'show_more';
  if (isYesEquivalent(normalized) || isNoEquivalent(normalized)) return 'confirmation';
  return 'product_search';
};

const isExpiredConfirmation = (createdAt: string | null): boolean => {
  if (!createdAt) return false;
  const created = new Date(createdAt).getTime();
  return Date.now() - created > 5 * 60 * 1000;
};

const ensureConsistentState = (state: ConversationState): ConversationState => {
  const allowed = new Set(['idle', 'clarifying', 'recommending', 'awaiting_confirmation', 'paginating', 'error', 'handoff']);
  if (!allowed.has(state.state)) {
    return {
      ...state,
      state: 'idle',
      pending_confirmation: { action: null, target_id: null, created_at: null },
    };
  }
  return state;
};

export const runStateMachine = ({ conversationId, messageId, text, state, repeatedIntentCount, shownProductIds }: StateMachineInput): StateMachineOutput => {
  const nextState = ensureConsistentState({ ...state, last_user_message_id: messageId });
  const normalized = normalizeText(text);
  const intent = detectIntent(text);
  const updatedShown = [...shownProductIds];

  if (repeatedIntentCount >= 3) {
    nextState.state = 'clarifying';
    nextState.clarification_attempts += 1;
    nextState.last_intent = intent;

    if (nextState.clarification_attempts > 2) {
      nextState.state = 'handoff';
      nextState.clarification_attempts = 0;
      return { outbound: buildHandoff(conversationId, env.defaultHandoffQueue, 'low_confidence'), state: nextState, shownProductIds: updatedShown };
    }

    return {
      outbound: buildQuickReplies(conversationId, 'Can you clarify what you need?', [
        { label: 'Show More', value: 'show_more_items', meaning: 'show_more' },
        { label: 'Filter', value: 'open_filter_options', meaning: 'filter' },
      ]),
      state: nextState,
      shownProductIds: updatedShown,
    };
  }

  if (isExpiredConfirmation(nextState.pending_confirmation.created_at)) {
    nextState.pending_confirmation = { action: null, target_id: null, created_at: null };
    nextState.state = 'idle';
  }

  if (intent === 'confirmation' && nextState.state === 'awaiting_confirmation') {
    nextState.last_intent = intent;
    if (isYesEquivalent(normalized)) {
      nextState.pending_confirmation = { action: null, target_id: null, created_at: null };
      nextState.state = 'recommending';
      nextState.clarification_attempts = 0;
      return {
        outbound: buildText(conversationId, 'Confirmed. Proceeding with your request.'),
        state: nextState,
        shownProductIds: updatedShown,
      };
    }
    if (isNoEquivalent(normalized)) {
      nextState.pending_confirmation = { action: null, target_id: null, created_at: null };
      nextState.state = 'idle';
      nextState.clarification_attempts = 0;
      return {
        outbound: buildText(conversationId, 'Cancelled. Let me know what you want instead.'),
        state: nextState,
        shownProductIds: updatedShown,
      };
    }
  }

  if (intent === 'show_more') {
    if (!nextState.pagination.last_query_hash) {
      nextState.state = 'clarifying';
      nextState.clarification_attempts += 1;
      return {
        outbound: buildQuickReplies(conversationId, 'What products should I continue from?', [
          { label: 'Shoes', value: 'filter_shoes', meaning: 'filter' },
          { label: 'Jackets', value: 'filter_jackets', meaning: 'filter' },
        ]),
        state: nextState,
        shownProductIds: updatedShown,
      };
    }

    nextState.state = 'paginating';
    nextState.pagination.offset += nextState.pagination.limit;
    const page = getProductsPage(
      nextState.pagination.last_query_hash,
      nextState.pagination.offset,
      nextState.pagination.limit,
      updatedShown,
    );

    if (page.length === 0) {
      nextState.state = 'idle';
      return { outbound: buildText(conversationId, 'No more products found.'), state: nextState, shownProductIds: updatedShown };
    }

    nextState.state = 'recommending';
    updatedShown.push(...page.map((p) => p.id));
    return {
      outbound: buildProductCards(conversationId, page, 'Here are more options.'),
      state: nextState,
      shownProductIds: updatedShown,
    };
  }

  nextState.last_intent = intent;
  nextState.pagination.last_query_hash = normalized;
  nextState.pagination.offset = 0;
  nextState.pagination.limit = Math.min(nextState.pagination.limit, 5);

  const products = getProductsPage(normalized, 0, nextState.pagination.limit, updatedShown);

  if (products.length === 0) {
    nextState.state = 'clarifying';
    nextState.clarification_attempts += 1;
    if (nextState.clarification_attempts > 2) {
      nextState.state = 'handoff';
      nextState.clarification_attempts = 0;
      return { outbound: buildHandoff(conversationId, env.defaultHandoffQueue, 'low_confidence'), state: nextState, shownProductIds: updatedShown };
    }

    return {
      outbound: buildQuickReplies(conversationId, 'I need a bit more detail. Can you refine your request?', [
        { label: 'Show More', value: 'show_more_items', meaning: 'show_more' },
        { label: 'Filter', value: 'open_filter_options', meaning: 'filter' },
      ]),
      state: nextState,
      shownProductIds: updatedShown,
    };
  }

  nextState.state = 'recommending';
  nextState.clarification_attempts = 0;
  updatedShown.push(...products.map((p) => p.id));

  if (normalized.includes('shortlist') || normalized.includes('add')) {
    nextState.state = 'awaiting_confirmation';
    nextState.pending_confirmation = {
      action: 'shortlist_add',
      target_id: products[0].id,
      created_at: new Date().toISOString(),
    };
    return {
      outbound: buildQuickReplies(conversationId, `Confirm adding ${products[0].title} to your shortlist?`, [
        { label: 'Confirm', value: 'shortlist_confirm', meaning: 'confirm' },
        { label: 'Cancel', value: 'shortlist_cancel', meaning: 'cancel' },
      ]),
      state: nextState,
      shownProductIds: updatedShown,
    };
  }

  return {
    outbound: buildProductCards(conversationId, products, 'Here are matching products.'),
    state: nextState,
    shownProductIds: updatedShown,
  };
};

export const buildStateMachineError = (conversationId: string) =>
  buildError(conversationId, 'STATE_MACHINE_ERROR', 'I’m having trouble processing your request right now.', true);
