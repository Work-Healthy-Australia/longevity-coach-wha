# Executive Summary: Pipeline JSON Parse Stability
Date: 2026-04-29
Audience: Product owner, clinical advisor

## What was delivered
The AI background jobs that generate the monthly clinician brief and the personalised exercise plan would occasionally fail silently — the job ran but produced no output, with no alert or retry. The root cause was that the AI model sometimes produced responses that were almost correct but violated strict formatting rules (for example, using "declining" instead of "worsening" for a trend label, or producing a number as text). The system had no way to recover from these small deviations.

This change gives the system three chances to succeed before giving up. On the first attempt it uses the normal method. If that fails, it automatically tries again with more conservative settings. If that also fails, it switches to a completely different approach — asking the model to write each piece of information in a clearly labelled text format, then assembles it back into the required structure itself. Only a genuine outage (server down, network failure) can now prevent a pipeline run from completing. Any recovery attempt is logged with enough detail to diagnose and improve further.

## What phase this advances
Phase 3 — Intelligence. Improves the reliability of two core Phase 3 deliverables: the Janet Clinician Brief pipeline and the PT Plan pipeline.

## What comes next
No decisions needed from the product owner for this item. The next Phase 3 milestones are completing the live PT coach agent and the Janet conversational agent integration with all sub-agents. If the model should be upgraded to a more capable version for any pipeline, that is a configuration change in the database — no code change required.

## Risks or open items
None. No database schema was changed. No user-facing behaviour changed. The fix is entirely within the background AI pipeline layer.
