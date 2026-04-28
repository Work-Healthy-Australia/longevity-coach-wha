# Feature Proposal — Alex CS Agent Sidecar

**Date:** 2026-04-28  
**Phase:** 3 (Engagement)  
**Status:** Approved (engineering sign-off, user-requested)

---

## Problem

Members have no low-friction way to ask support questions. Current options: reply to email (async, no agent), read docs (no docs). Support load will increase post-launch.

## Solution

Alex is a customer support chatbot that lives as a persistent FAB (Floating Action Button) at the bottom-right corner of every signed-in page. It answers product questions, guides members through features, and handles common issues without leaving the current page.

## Scope

**Alex can help with:**
- How to use the platform (onboarding, uploads, report, account)
- Understanding their report and supplement protocol at a surface level (not health coaching — that's Janet)
- Subscription and billing questions (directs to account page)
- Technical troubleshooting (upload failures, report not generating, etc.)

**Alex cannot:**
- Access or discuss health data (Janet's domain)
- Make subscription changes directly
- Replace clinical or medical advice

## Architecture

```
Trigger: FAB button (bottom-right, app layout)
  └─ Zustand: toggleAlex() → isOpen: true

Panel: slides up above FAB (400px wide, 500px tall)
  └─ useChat(api: '/api/chat/alex') → streamText → toDataStreamResponse

Agent: lib/ai/agents/alex.ts
  └─ streamText with CS system prompt
  └─ No PatientContext load (privacy boundary — Alex doesn't see health data)
  └─ Context: site URL + current page path (injected from client)

API: POST /api/chat/alex
  └─ Auth required (session check)
  └─ No persistence (ephemeral support chat)
```

## Zustand store design

```typescript
interface ChatStore {
  // UI state for all agents
  janet: { isOpen: boolean }
  alex: { isOpen: boolean; unread: number }
  // Actions
  toggleAlex / openAlex / closeAlex / clearUnread
}
```

Janet's `isOpen` is managed in the report page (scoped). Alex's is global.

## Database changes

None. Alex conversations are ephemeral — no persistence for MVP.
Agent definition seeded into `agent_definitions` table (migration 0019).

## New routes

| Route | Auth | Purpose |
|---|---|---|
| `POST /api/chat/alex` | Required | Alex streaming endpoint |
