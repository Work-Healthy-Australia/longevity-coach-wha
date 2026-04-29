# Executive Summary: Agent rename — human names to role-based identifiers
Date: 2026-04-29
Audience: Product owner

## What was delivered
The internal code names for four of our AI components have been standardised. The risk analysis component is now called "risk_analyzer", the supplement protocol component is called "supplement_advisor", the research component is called "health_researcher", and the support chat is called "support". These are internal engineering labels — members and clinicians do not see them. Janet retains her name everywhere she appears to members. The change touches no member-visible functionality and introduces no new features.

## What phase this advances
This is a code health change that applies across Phase 2 and Phase 3 work. It ensures that as we build more components (the physical therapist coach, meal planning, clinician brief), every new component is named by what it does rather than who it is, making the codebase easier to navigate and maintain.

## What comes next
No product decisions are required. Engineering can continue Phase 2 deliverables (risk engine, supplement protocol, PDF report) on the clean naming foundation this change establishes.

## Risks or open items
- Authenticated end-to-end testing should be run on the staging environment after this branch is merged to confirm the support chat widget and all agent-triggered pipelines behave correctly with live Supabase credentials.
- The database migration (0036) must be applied to production immediately after deployment — it is a data-only update and runs in under a second.
