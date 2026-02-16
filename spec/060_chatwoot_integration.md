# 060 — Chatwoot Integration Specification

## Scope
This specification defines the Chatwoot integration behavior for the Agent Service in the demo architecture:

**Chatwoot web widget on WooCommerce WordPress + AI Agent Service behind it**.

This document is normative for webhook ingestion, attachment handling, outbound posting, retries, deduplication, and security.

---

## 1) Webhook Events Handled

## 1.1 Supported event
- The Agent Service MUST handle Chatwoot webhook event:
  - `message_created`

## 1.2 Event filtering
On `message_created`, the Agent Service MUST apply the following filters before processing:

1. **Ignore agent-originated messages**
   - If message sender type indicates `agent` (or bot/system equivalent), do not process.

2. **Process incoming customer messages only**
   - Only process messages where direction/type indicates incoming customer/user content.
   - Ignore outgoing/private/system notes for response generation.

## 1.3 Processing gate pseudocode
```text
if event != "message_created": ignore
if sender is agent/bot/system: ignore
if message is not incoming customer message: ignore
else: continue pipeline
```

---

## 2) Attachment Handling

## 2.1 Attachment extraction from webhook payload
- The Agent Service MUST attempt to extract attachment metadata from webhook payload first.
- Expected extracted fields (when present):
  - `attachment_id`
  - `file_type` / `content_type` (MIME)
  - `file_url` (or equivalent download URL)
  - `file_name`
  - `size_bytes`

## 2.2 Fallback fetch when metadata is missing
- If required attachment metadata is missing or incomplete in webhook payload,
  the Agent Service MUST fetch full message details via **Chatwoot Messages API** for the same conversation/message.
- The fetched message payload is then treated as source-of-truth for attachment metadata.

## 2.3 Supported MIME handling
- The integration MUST handle:
  - `image/*`
  - `audio/*`

### `image/*`
- Record image attachment metadata and pass image context into Agent reasoning path.
- No transcription step is needed.

### `audio/*`
- Download audio attachment using authenticated Chatwoot media URL flow.
- Transcribe audio to text (STT only).
- Inject transcript as user text input for intent/response generation.
- Do not produce TTS output.

## 2.4 Audio processing pipeline
```text
audio attachment detected
  -> download file
  -> transcribe
  -> append transcript to normalized user input
  -> continue as text flow
```

## 2.5 Error behavior for attachments
- If attachment retrieval/transcription fails:
  - emit `error` outbound type,
  - include safe user-facing message,
  - mark operation retryable when failure cause is transient (timeout/5xx).

---

## 3) Reply Posting to Chatwoot

## 3.1 API used
- The Agent Service MUST post replies via **Chatwoot Create Message API** for the target conversation.

## 3.2 Outbound type mapping
The Agent Service MUST map internal outbound schema types to Chatwoot posting behavior as follows:

1. `text` -> post standard text message.
2. `product_cards` -> post native interactive cards if channel/version supports; otherwise post fallback clickable list.
3. `quick_replies` -> post native interactive quick reply/buttons if supported; otherwise post numbered fallback list with parseable values.
4. `error` -> post plain text error message (user-safe).
5. `handoff` -> assign conversation to human queue/agent and post a system/user-visible transition message.

## 3.3 Fallback formatting requirements
When native interactive format is unavailable:

- Product cards fallback MUST include per item:
  - title
  - price + currency
  - stock status
  - key attributes summary
  - absolute clickable product URL

- Quick replies fallback MUST include:
  - prompt text
  - numbered options
  - machine-parseable option values

## 3.4 Posting pseudocode
```text
switch outbound.type
  text -> create_message(text)
  product_cards -> create_interactive_or_fallback_list()
  quick_replies -> create_interactive_or_fallback_buttons_list()
  error -> create_message(plain_text_error)
  handoff -> assign_conversation(); create_message(handoff_notice)
```

---

## 4) Retry Rules

## 4.1 Retry conditions
- Retry outbound Chatwoot API calls when failure is:
  - HTTP `5xx`, or
  - network timeout.

- Do NOT retry on deterministic client errors (e.g., `4xx` except rate-limit policies if explicitly added later).

## 4.2 Backoff schedule
- Fixed retry backoff sequence:
  1. attempt 2 after **1s**
  2. attempt 3 after **3s**
  3. final wait **10s** is allowed for terminal retry timing window/logging

## 4.3 Maximum attempts
- Maximum total attempts per operation: **3**.

## 4.4 Retry pseudocode
```text
attempts = 0
max_attempts = 3
backoff = [1s, 3s, 10s]

while attempts < max_attempts:
  attempts += 1
  result = post_to_chatwoot()
  if success: break
  if failure is 5xx or timeout:
    if attempts == max_attempts: fail
    sleep(backoff[attempts-1])
    continue
  else:
    fail immediately
```

---

## 5) Deduplication

## 5.1 Dedup key
- Use `event_id` when present, otherwise `message_id`, as deduplication key.
- Key format recommendation:
  - `cw:dedup:<event_id>` OR `cw:dedup:<message_id>`

## 5.2 Storage
- Store dedup keys in Redis.
- TTL: **24h** per processed event/message.

## 5.3 Behavior
- On webhook receive:
  1. compute dedup key,
  2. check Redis.
- If key exists: **ignore** processing (idempotent no-op).
- If key does not exist: set key with 24h TTL and continue.

## 5.4 Atomicity requirement
- Dedup set/check SHOULD be atomic (e.g., `SET key value NX EX 86400`) to avoid race-condition double processing.

---

## 6) Security

## 6.1 Signature validation
- Every inbound Chatwoot webhook request MUST be verified via configured webhook signature mechanism.
- Validation must use constant-time comparison where possible.

## 6.2 Invalid signature handling
- If signature is invalid or missing:
  - reject request,
  - return non-success status (e.g., `401`/`403`),
  - do not process message,
  - do not write dedup processed state.

## 6.3 Logging guidance
- Log validation outcome and request identifiers.
- Never log secrets, raw signature secret values, or sensitive tokens.

---

## 7) End-to-End Processing Sequence (Reference)

```text
receive webhook
  -> validate signature
  -> dedup check (event_id/message_id, Redis 24h)
  -> filter to message_created + incoming customer only
  -> extract attachments from webhook payload
  -> if metadata missing: fetch message via Chatwoot Messages API
  -> normalize inputs:
       image/* => image context
       audio/* => download + transcribe => text
  -> call Agent runtime
  -> map outbound type to Chatwoot Create Message API payload
  -> post reply with retry policy (5xx/timeout; 1s,3s,10s; max 3)
```

---

## 8) Acceptance Checks

1. Given `message_created` from customer,
   when signature is valid and not duplicate,
   then event is processed.

2. Given `message_created` from agent,
   when webhook arrives,
   then event is ignored.

3. Given incoming message with missing attachment metadata,
   when webhook is processed,
   then service fetches message via Chatwoot Messages API.

4. Given attachment MIME `audio/mpeg`,
   when processed,
   then audio is downloaded, transcribed, and transcript is used as text input.

5. Given outbound type `product_cards` and no interactive support,
   when reply is posted,
   then fallback clickable list is sent.

6. Given outbound post gets `502` then timeout then success,
   when retries run,
   then backoff sequence includes 1s then 3s and stops on success (max attempts <= 3).

7. Given duplicate webhook key already present in Redis,
   when same webhook is received again,
   then processing is skipped.

8. Given invalid webhook signature,
   when request is received,
   then request is rejected and not processed.
