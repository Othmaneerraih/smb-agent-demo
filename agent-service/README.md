# Agent Service (Minimal Production-Ready Backend)

This service implements the Chatwoot webhook backend specified in:
- `spec/010_widget_ux_message_schema.md`
- `spec/020_agent_state_machine.md`
- `spec/060_chatwoot_integration.md`

## Tech Stack
- Node.js + TypeScript
- Express
- Redis (dedup + state)
- OpenAI SDK placeholder (no real OpenAI calls)

## Features Included
- `GET /health`
- `POST /webhooks/chatwoot`
- JSON body parsing middleware
- Webhook signature validation placeholder
- Dedup middleware using Redis `SET NX EX 86400`
- Chatwoot client module:
  - `postMessage(conversationId, content)`
  - `assignConversation(conversationId, queue)`
  - `fetchMessage(conversationId, messageId)`
- Attachment handler module:
  - `handleImage()`
  - `handleAudio()` (download + deterministic mock transcription)
- Conversation state manager:
  - `getState(conversationId)`
  - `saveState(conversationId, state)`
  - `resetState(conversationId)`
- Deterministic state machine + intent detection:
  - contains "show more" => `show_more`
  - yes/no equivalents => `confirmation`
  - else => `product_search`
- Local product index mock in `data/products.json` (no Woo API usage)
- Structured response builder for `text`, `product_cards`, `quick_replies`, `error`, `handoff`
- Retry wrapper for Chatwoot API calls:
  - retry on 5xx + timeout only
  - backoff: 1s, 3s, 10s
  - max 3 attempts

## Run Locally
1. Install dependencies:
   ```bash
   npm install
   ```
2. Create env file:
   ```bash
   cp .env.example .env
   ```
3. Start Redis (example):
   ```bash
   docker run --rm -p 6379:6379 redis:7-alpine
   ```
4. Start dev server:
   ```bash
   npm run dev
   ```

For compiled run:
```bash
npm run build
npm start
```

## Expose Webhook via ngrok
Run app on port 3000, then:
```bash
ngrok http 3000
```
Use the generated HTTPS URL in Chatwoot webhook config:
`https://<your-ngrok-subdomain>.ngrok.io/webhooks/chatwoot`

## Required Environment Variables
- `PORT`
- `REDIS_URL`
- `WEBHOOK_SECRET`
- `CHATWOOT_BASE_URL`
- `CHATWOOT_API_TOKEN`
- `CHATWOOT_ACCOUNT_ID`
- `DEFAULT_HANDOFF_QUEUE`
- `OPENAI_API_KEY` (placeholder only)
