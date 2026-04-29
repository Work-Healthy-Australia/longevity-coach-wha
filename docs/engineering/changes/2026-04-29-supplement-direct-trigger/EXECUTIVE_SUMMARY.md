# Executive Summary: Supplement Direct Trigger + Janet Auto-Behavior + Live Refresh
Date: 2026-04-29
Audience: Product owner, clinical advisor

## What was delivered

Members can now generate or refresh their supplement protocol directly from their report page, without needing to ask Janet. A "Generate my protocol" button appears in the supplement card. Clicking it starts the generation process in the background. The page watches for the result and — when the protocol is ready, typically within a minute — the supplement card updates automatically and Janet posts a summary message in the chat thread explaining what was generated. No page reload is needed.

Janet's behaviour has also been improved in two ways. First, when a member opens a chat with no supplement protocol yet (or one that is more than a day old), Janet now automatically kicks off a refresh in the background and tells the member it is on its way — without waiting to be asked. Second, when the protocol is fresh, Janet answers supplement questions directly from the data she already has loaded, making her responses faster and reducing unnecessary processing.

## What phase this advances

This completes the Phase 2 supplement protocol delivery loop:
- Members can self-serve protocol generation without clinical or support intervention
- The protocol auto-refreshes via Janet when stale, keeping recommendations current
- Janet's supplement knowledge is now context-aware and cost-efficient

## What comes next

The next step in Phase 2 is the branded PDF report, which gives members a downloadable summary of their biological age, risk scores, and supplement protocol. A decision is needed from the product owner on whether the PDF should be generated on demand or pre-generated nightly.

## Risks or open items

- The generation pipeline runs asynchronously and typically takes 30–90 seconds. If a member closes the tab before it completes, they will need to return to the report page to see the result — the button will show the protocol once they reload.
- The one-day staleness threshold for Janet's auto-trigger is set per product owner direction. This can be adjusted via a migration if the threshold needs to change.
