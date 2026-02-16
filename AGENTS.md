# AGENTS.md

## Scope Lock
All implementation work in this repository is strictly scoped to:

**Chatwoot web widget on WooCommerce WordPress + AI Agent Service behind it**.

Anything outside this scope is out of bounds unless explicitly added to the spec files.

## Spec-First Workflow (Mandatory)
- Always implement from specifications under `/spec/*`.
- If behavior is not documented in `/spec/*`, do not implement it.
- If a requested change is missing from `/spec/*`, update/create the relevant spec first, then implement.
- Treat `/spec/*` as the source of truth for scope, behavior, and acceptance criteria.

## Output Format Requirements (Mandatory)
For user-facing confirmation and recommendation messages, responses must use structured outputs:
- **Product cards** for product recommendations/details.
- **Quick replies** for confirmations and next-step choices.

Free-form text alone is insufficient where a card or confirmation action is expected.

## Performance / Integration Constraint
- **Do not call WooCommerce APIs on the chat critical path.**
- Product lookup for chat responses must come from a **local product index** (synced out-of-band).

## Input Modalities (Mandatory)
- Support **image input**.
- Support **audio input as transcription only**.
- **Do not implement TTS** for MVP/demo scope.

## Definition of Done (Working Demo)
A change is considered done only if all items below are satisfied:

- [ ] Behavior is documented in `/spec/*` and implementation matches it.
- [ ] End-to-end flow works: WP widget → Chatwoot → webhook → Agent Service → Chatwoot reply.
- [ ] Product recommendation/selection messages render as product cards.
- [ ] Confirmation prompts render quick replies.
- [ ] No WooCommerce API call occurs on the synchronous chat response path.
- [ ] Local product index is used for product retrieval in chat interactions.
- [ ] Image input is accepted and handled in the Agent Service flow.
- [ ] Audio input is accepted and transcribed (no TTS output).
- [ ] Demo acceptance tests in `/spec/*` pass.
