# 020 — Agent Conversation State Machine Specification

## Scope
This specification defines the Agent Service conversation state model and transition behavior for:

**Chatwoot web widget on WooCommerce WordPress + AI Agent Service behind it**.

This document is normative for runtime conversation state handling.

---

## 1) `conversation_state` JSON Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "conversation_state",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "state",
    "last_intent",
    "pagination",
    "pending_confirmation",
    "clarification_attempts",
    "last_user_message_id",
    "last_agent_message_id"
  ],
  "properties": {
    "state": {
      "type": "string",
      "enum": [
        "idle",
        "clarifying",
        "recommending",
        "awaiting_confirmation",
        "paginating",
        "error",
        "handoff"
      ]
    },
    "last_intent": {
      "type": ["string", "null"],
      "description": "Most recently inferred intent label (e.g., product_search, show_more, confirm)."
    },
    "pagination": {
      "type": "object",
      "additionalProperties": false,
      "required": ["offset", "limit", "last_query_hash"],
      "properties": {
        "offset": { "type": "integer", "minimum": 0 },
        "limit": { "type": "integer", "minimum": 1, "maximum": 5 },
        "last_query_hash": { "type": ["string", "null"] }
      }
    },
    "pending_confirmation": {
      "type": "object",
      "additionalProperties": false,
      "required": ["action", "target_id"],
      "properties": {
        "action": { "type": ["string", "null"] },
        "target_id": { "type": ["string", "null"] },
        "created_at": {
          "type": ["string", "null"],
          "description": "ISO-8601 timestamp used for 5-minute expiry checks."
        }
      }
    },
    "clarification_attempts": {
      "type": "integer",
      "minimum": 0
    },
    "last_user_message_id": {
      "type": ["string", "null"]
    },
    "last_agent_message_id": {
      "type": ["string", "null"]
    }
  }
}
```

### Field notes
- `state` is the active finite state machine node.
- `last_intent` tracks the latest interpreted user intent.
- `pagination` stores cursor-like values for show-more flows.
- `pending_confirmation` stores the action waiting for user confirmation.
- `clarification_attempts` increments on each clarification prompt.
- `last_user_message_id` and `last_agent_message_id` support idempotency and traceability.

---

## 2) Allowed States

The only valid `state` values are:

1. `idle`
2. `clarifying`
3. `recommending`
4. `awaiting_confirmation`
5. `paginating`
6. `error`
7. `handoff`

No additional states are allowed unless this spec is updated.

---

## 3) Transition Rules by State

## 3.1 `idle`
### Entry conditions
- New conversation or reset due to global timeout fallback.

### Allowed transitions
- `idle -> recommending`
  - Trigger: clear product-search intent.
- `idle -> clarifying`
  - Trigger: ambiguous/underspecified query.
- `idle -> awaiting_confirmation`
  - Trigger: intent requires explicit confirmation before action.
- `idle -> error`
  - Trigger: recoverable system failure.
- `idle -> handoff`
  - Trigger: explicit user request for human or hard policy/system condition.

## 3.2 `clarifying`
### Entry conditions
- Intent confidence below threshold or required slot(s) missing.

### Allowed transitions
- `clarifying -> recommending`
  - Trigger: clarification resolved and searchable query formed.
- `clarifying -> awaiting_confirmation`
  - Trigger: user clarification implies action needing confirmation.
- `clarifying -> clarifying`
  - Trigger: additional clarification needed (subject to max attempts).
- `clarifying -> handoff`
  - Trigger: clarification limit exceeded (see loop prevention).
- `clarifying -> error`
  - Trigger: recoverable processing failure.

## 3.3 `recommending`
### Entry conditions
- Agent is returning initial recommendation set.

### Allowed transitions
- `recommending -> paginating`
  - Trigger: user chooses `show_more`.
- `recommending -> awaiting_confirmation`
  - Trigger: user selects an item requiring confirmation.
- `recommending -> clarifying`
  - Trigger: repeated unresolved intent or filter ambiguity.
- `recommending -> idle`
  - Trigger: response complete and no pending action.
- `recommending -> error`
  - Trigger: recoverable issue while preparing response.
- `recommending -> handoff`
  - Trigger: user asks for human or policy/system condition.

## 3.4 `awaiting_confirmation`
### Entry conditions
- Agent has asked user to confirm/cancel an action and set `pending_confirmation`.

### Allowed transitions
- `awaiting_confirmation -> recommending`
  - Trigger: confirmation accepted and next result should be shown.
- `awaiting_confirmation -> idle`
  - Trigger: cancellation or completion with no further action.
- `awaiting_confirmation -> clarifying`
  - Trigger: user reply is neither valid confirmation nor cancellation.
- `awaiting_confirmation -> handoff`
  - Trigger: expiry + repeated ambiguity or explicit human request.
- `awaiting_confirmation -> error`
  - Trigger: recoverable execution failure after confirmation.

### Required behavior
- If `pending_confirmation` is expired (> 5 minutes), clear it and transition to `idle` with a fresh clarification/confirmation prompt as needed.

## 3.5 `paginating`
### Entry conditions
- User requested additional results from current query context.

### Allowed transitions
- `paginating -> recommending`
  - Trigger: next page found and rendered.
- `paginating -> idle`
  - Trigger: no more results.
- `paginating -> clarifying`
  - Trigger: lost/invalid query context (`last_query_hash` mismatch/null).
- `paginating -> error`
  - Trigger: recoverable pagination failure.

## 3.6 `error`
### Entry conditions
- Recoverable runtime or dependency issue.

### Allowed transitions
- `error -> idle`
  - Trigger: fallback/retry prepared and state normalized.
- `error -> handoff`
  - Trigger: repeated errors or user requests human.

## 3.7 `handoff`
### Entry conditions
- User requested human or automation cannot safely continue.

### Allowed transitions
- `handoff -> handoff`
  - While waiting for human ownership.
- `handoff -> idle`
  - Only after explicit human resolution and bot reactivation policy allows return.

---

## 4) Loop Prevention Rules

1. **Clarification cap**
   - Max `clarification_attempts` is **2**.
   - On the 3rd unresolved clarification turn, transition to `handoff` with reason `low_confidence`.

2. **Repeated intent guard**
   - If the same normalized `last_intent` repeats **3 times** without successful progression,
   - transition to `clarifying` and ask a disambiguating question.

3. **Counter reset conditions**
   - Reset `clarification_attempts` to `0` when entering `recommending`, `idle`, or `handoff`.

---

## 5) Pagination Rules

1. **Card count cap**
   - Each outbound `product_cards` message MUST include at most **5** cards.
   - Enforced by `pagination.limit <= 5`.

2. **Show-more behavior**
   - On user action with meaning `show_more`, set:
     - `pagination.offset = pagination.offset + pagination.limit`
     - keep same `pagination.last_query_hash`
   - Transition to `paginating` before fetching/rendering next page.

3. **No duplicates in conversation**
   - A product ID already shown in the same conversation MUST NOT be shown again in later pages.
   - If candidate page includes duplicates, filter duplicates and fill with next unique IDs where available.

4. **Context integrity**
   - If `last_query_hash` is missing/invalid during show-more, transition to `clarifying` and request refreshed criteria.

---

## 6) Confirmation Handling

## 6.1 Accepted confirmation inputs
The agent MUST accept:
1. **Quick reply clicks** (`meaning` in `confirm` or `cancel`), and
2. **Typed equivalents** in English + Darija.

### Positive (confirm/yes) typed equivalents
- English: `yes`, `y`, `confirm`, `ok`, `okay`, `sure`
- Darija (Latin): `ah`, `wakha`, `mzyan`, `iyyeh`, `na3am`

### Negative (cancel/no) typed equivalents
- English: `no`, `n`, `cancel`, `stop`, `nope`
- Darija (Latin): `la`, `bala`, `mansalich`

Normalization MUST be case-insensitive and trim surrounding punctuation/whitespace.

## 6.2 Expiry
- `pending_confirmation` expires **5 minutes** after `pending_confirmation.created_at`.
- On expiry:
  - clear `pending_confirmation.action` and `pending_confirmation.target_id`,
  - clear `pending_confirmation.created_at`,
  - transition to `idle`,
  - optionally send a brief prompt to restart/confirm again.

---

## 7) Global Timeout / Inconsistency Fallback

If runtime logic detects an inconsistent state (e.g., unknown state value, missing required dependent fields, invalid transition), the system MUST:

1. Reset `state` to `idle`.
2. Clear transient fields:
   - `pending_confirmation.action`
   - `pending_confirmation.target_id`
   - `pending_confirmation.created_at`
3. Preserve traceability fields where possible:
   - `last_user_message_id`
   - `last_agent_message_id`
4. Emit a safe fallback message asking the user to continue with a fresh request.

---

## 8) Acceptance Checks

1. Given `clarification_attempts = 2` and unresolved next turn,
   when another clarification would be required,
   then next state is `handoff` with reason `low_confidence`.

2. Given intent `product_search` repeats three turns with no progress,
   when processing the third repeat,
   then state transitions to `clarifying`.

3. Given `pagination.limit = 5` and `offset = 0`,
   when user sends `show_more`,
   then new offset is `5` and no duplicate product IDs are returned.

4. Given a valid pending confirmation,
   when user types `wakha`,
   then confirmation is treated as accepted.

5. Given a valid pending confirmation,
   when user types `la`,
   then confirmation is treated as cancelled.

6. Given `pending_confirmation.created_at` older than 5 minutes,
   when next user message arrives,
   then pending confirmation is expired and state returns to `idle`.

7. Given inconsistent in-memory state,
   when guardrail check runs,
   then state resets to `idle`.
