# Executive Summary: nova-pipeline
Date: 2026-04-28
Audience: Product owner, clinical advisor

## What was delivered

Every Monday at 2 AM, the platform now automatically searches PubMed — the world's largest biomedical research database — for the latest scientific papers across six health areas: cardiovascular health, metabolic health, brain and cognitive health, cancer prevention, musculoskeletal health, and supplements. It reads the most relevant recent papers, synthesises them into plain-language digests using Claude, and stores them in the database. Janet, the AI health coach, now draws on this fresh evidence when responding to member questions — meaning her advice reflects current science rather than only the knowledge built into her training.

Each digest is labelled by evidence strength: "Strong evidence" for findings from clinical trials and systematic reviews, "Preliminary evidence" for early or observational findings, and "Expert consensus" for widely accepted clinical practice. Members will never receive an unsubstantiated recommendation presented as fact.

## What phase this advances

- **Phase 3 — Engagement (Epic 3.5.3):** The infrastructure for the personalised health insights feed is now built. The weekly digest data is stored and available to surface in a future member-facing news feed.
- **Phase 3 — AI Coaching (Epic 3.3):** Janet's responses are now evidence-grounded by a continuously updated knowledge base — not just the static clinical knowledge loaded in the last sprint.

## What comes next

The next two logical steps are:
1. **Enable the vector extension** in the Supabase dashboard (Database → Extensions → vector). This activates full semantic search on the knowledge base so Janet finds the most relevant evidence for each member's specific question, not just keyword matches. This is a one-click, zero-downtime action.
2. **Member insights feed UI**: A simple feed page showing the latest weekly digests, filterable by health category. This is the user-visible side of what Nova now powers.

## Risks or open items

- **Action required (one-time):** Enable the `vector` pgvector extension in Supabase dashboard. Until then, evidence retrieval uses keyword search only — still functional, but lower precision.
- Nova searches PubMed directly using its free API. If the platform scales to running Nova multiple times per day, an NCBI API key should be added (free to obtain, raises the rate limit). Not needed at weekly cadence.
- The first Nova run will populate the knowledge base with current research. Until it runs (next Monday 02:00 UTC), Janet still uses the 65 manually curated evidence chunks loaded in the previous sprint.
