# Executive Summary: conversation-compression
Date: 2026-04-28
Audience: Product owner, clinical advisor

## What was delivered
Janet, the AI health coach, can now remember what happened in previous sessions. When a conversation grows longer than 20 exchanges, the system quietly summarises the older portion into a short paragraph and stores it against the patient's profile. The next time the patient chats with Janet, that summary is automatically loaded into her memory before the first response. This happens in the background after each turn — it does not slow Janet down or change anything the patient sees.

## What phase this advances
Phase 3 — Janet (Real-time Health Coach). Conversation continuity is a prerequisite for Janet to feel like a genuine personal coach rather than a stateless chatbot. This change closes that requirement.

## What comes next
- Eval suites (same release) validate that Janet actually uses the summary when answering memory-related questions.
- The `0030_conversation_summaries.sql` migration must be applied to the production database before the feature is live.
- Future work: per-session compression summaries could be surfaced to the patient as a "session recap" feature.

## Risks or open items
- The migration must be applied before deployment or the feature will silently no-op (errors are swallowed by design, so there is no production risk — the feature simply will not activate until the table exists).
- Summary quality has not yet been validated by a clinical reviewer. The current implementation produces a factual condensation of the conversation transcript; no clinical interpretation is added.
