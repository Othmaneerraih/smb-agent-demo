# 000 — Demo Overview

## Scope
This overview defines the MVP demo for:

**Chatwoot web widget on WooCommerce WordPress + AI Agent Service behind it**.

---

## 1) Component Diagram (Text Description)

### Components
1. **WooCommerce WordPress Site (Frontend)**
   - Hosts the Chatwoot web widget script.
   - Provides customer browsing context (optional metadata such as page URL/product page).

2. **Chatwoot (Inbox + Conversations + Webhooks)**
   - Receives inbound user messages from the widget.
   - Emits webhook events for new incoming messages.
   - Accepts outbound agent responses via API to post back into conversation.

3. **Agent Service (Custom AI Backend)**
   - Receives Chatwoot webhook events.
   - Normalizes text/image/audio inputs.
   - For audio: performs transcription only (speech-to-text), then continues as text.
   - Uses conversation state + local product index to generate response.
   - Returns structured message payloads (product cards / quick replies) to Chatwoot.

4. **Local Product Index (Read-Optimized Store)**
   - Contains product catalog snapshots needed for chat recommendations.
   - Synced asynchronously from WooCommerce (outside chat critical path).
   - Queried by Agent Service during live chat handling.

5. **(Out of Critical Path) Catalog Sync Worker**
   - Pulls product data from WooCommerce APIs.
   - Updates local product index on a schedule or via background triggers.

### Key Constraint
- Live chat handling must not synchronously call WooCommerce APIs.

---

## 2) End-to-End Event Flow

### Primary Flow: Text/Image/Audio Message to Reply
1. User sends a message in **WP Chatwoot widget** (text, image, or audio).
2. Message is stored by **Chatwoot** and triggers a webhook event.
3. **Agent Service webhook endpoint** receives the event.
4. Agent Service validates source/signature and extracts payload.
5. If input is audio:
   - Agent Service runs transcription (STT only).
   - Transcribed text replaces/augments user message context.
6. If input is image:
   - Agent Service attaches image context for downstream reasoning.
7. Agent Service retrieves relevant product data from **local product index**.
8. Agent Service composes reply:
   - Product recommendation/details as **product cards**.
   - Confirmation choices as **quick replies**.
9. Agent Service posts reply to **Chatwoot conversation reply API**.
10. Chatwoot displays structured response back in the **WP widget**.

### Non-Critical Background Flow: Product Sync
1. Sync worker reads WooCommerce catalog via API.
2. Worker transforms and writes to local product index.
3. Agent Service reads updated index for subsequent chats.

---

## 3) MVP Features vs Deferred Features

### MVP Features (In Scope)
- Chatwoot widget embedded on WooCommerce WordPress site.
- Webhook integration from Chatwoot to Agent Service.
- Agent reply integration from Agent Service back to Chatwoot.
- Support for text + image + audio input.
- Audio support via transcription only (no TTS).
- Product retrieval from local product index.
- Structured response types:
  - Product cards for product outputs.
  - Quick replies for confirmation prompts.
- Basic conversational memory per conversation.

### Deferred Features (Out of Scope for MVP)
- Real-time WooCommerce API lookups during chat turn.
- TTS voice responses.
- Checkout/order mutation actions from chat.
- Advanced personalization/recommendation ranking pipelines.
- Human handoff orchestration enhancements beyond Chatwoot defaults.
- Multi-language localization beyond baseline model capability.
- Analytics dashboards and A/B experimentation framework.

---

## 4) Demo Acceptance Tests

1. **Widget to Webhook Delivery**
   - Given a user sends text in WP widget,
   - When Chatwoot receives the message,
   - Then a webhook is delivered to Agent Service with expected conversation/message IDs.

2. **Agent Reply Roundtrip**
   - Given a valid inbound webhook,
   - When Agent Service processes it,
   - Then a reply appears in the same Chatwoot conversation and is visible in WP widget.

3. **Product Card Rendering**
   - Given user asks for product recommendations,
   - When Agent Service responds,
   - Then response is structured as product cards (not plain text only).

4. **Quick Reply Confirmation Rendering**
   - Given agent asks for confirmation (e.g., “Do you want this option?”),
   - When response is sent,
   - Then options appear as quick replies.

5. **No Woo API in Critical Path**
   - Given a chat request is processed,
   - When tracing dependencies/logs,
   - Then no synchronous WooCommerce API call occurs during response generation.

6. **Local Index Product Retrieval**
   - Given catalog data exists in local index,
   - When user requests a product,
   - Then Agent Service uses local index data to answer.

7. **Image Input Handling**
   - Given user sends an image,
   - When webhook is processed,
   - Then Agent Service includes image context and returns a valid structured reply.

8. **Audio Transcription Handling (No TTS)**
   - Given user sends an audio clip,
   - When webhook is processed,
   - Then audio is transcribed to text for understanding,
   - And response is returned as text/structured chat content only (no TTS output).

9. **Spec-First Compliance**
   - Given a proposed behavior change,
   - When it is implemented,
   - Then corresponding `/spec/*` documentation exists before or with the implementation.
