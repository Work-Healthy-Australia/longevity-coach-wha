# Executive Summary: Pipeline JSON Parse Stability
Date: 2026-04-29
Audience: Product owner, clinical advisor

## What was delivered
The AI background jobs that produce the monthly clinician brief and the personalised exercise plan were occasionally failing silently — the job would run, hit an error parsing the AI's response, and produce no output without any notification. This meant some patients' clinician briefs or PT plans would quietly not be generated for that month. The fix makes these jobs automatically retry once when the AI produces a response that doesn't match the expected format, and also removes over-strict formatting requirements that were the most common cause of the failure. Jobs that still fail after retry are now logged with enough detail to diagnose and fix further if needed.

## What phase this advances
Phase 3 — Intelligence. This improves the reliability of the Janet Clinician Brief pipeline and the PT Plan pipeline, both of which are core Phase 3 deliverables.

## What comes next
No decisions needed from the product owner for this item. The next Phase 3 milestones are the live PT coach agent and completing the Janet conversational agent integration with all sub-agents.

## Risks or open items
None. No database changes were made. No user-facing behaviour changed. The fix is entirely within the background pipeline layer.
