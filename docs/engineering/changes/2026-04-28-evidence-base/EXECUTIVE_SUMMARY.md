# Executive Summary: evidence-base
Date: 2026-04-28
Audience: Product owner, clinical advisor

## What was delivered

Janet, Atlas, and Sage can now draw on a curated library of 65 clinical reference points covering cardiovascular risk, metabolic health, neurocognitive function, cancer prevention, musculoskeletal health, supplements, and drug interactions. Each reference point is drawn from high-quality Australian and international guidelines (Heart Foundation, AUSDRISK, AIHW, Cancer Council Australia, Osteoporosis Australia, and peer-reviewed sources). When a patient asks Janet a question, or when Atlas generates a risk narrative, the system now automatically retrieves the most relevant clinical evidence to ground its answer — rather than relying solely on the language model's general knowledge.

All AI agent tables have been reorganised into their own dedicated database section (`agents` schema), keeping them cleanly separated from patient records and billing data.

## What phase this advances

- **Phase 2 — Intelligence:** Atlas and Sage now have evidence-anchored system prompts and access to the clinical knowledge library. The risk narrative and supplement protocol are grounded in guideline-level evidence.
- **Phase 3 — Coaching:** Janet's patient context loader now pulls relevant knowledge chunks in parallel with patient data, making every coaching response evidence-informed.

## What comes next

The next step is to enable vector search in the database (a one-click action in the Supabase dashboard under Database → Extensions → vector). Once enabled, the system will use semantic similarity search on top of keyword search, significantly improving how accurately the right clinical evidence is retrieved for each patient's specific question. Until then, keyword-only search is active and fully functional.

After that, Phase 2 completion requires the risk engine to calculate and store biological age and the five-domain risk scores — the data that Atlas and Sage will use to personalise their outputs.

## Risks or open items

- **Action required (James or Trac):** Enable the `vector` extension in the Supabase dashboard → Database → Extensions. This is a one-click, zero-downtime operation. Without it, semantic search is disabled and keyword search is used instead.
- The clinical knowledge library covers the primary risk domains but will need periodic review as guidelines are updated (typically annually). A future Nova pipeline worker will automate this.
