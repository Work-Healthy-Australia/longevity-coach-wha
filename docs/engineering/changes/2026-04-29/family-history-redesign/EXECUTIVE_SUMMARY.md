# Executive Summary: Family History Redesign
Date: 2026-04-29
Audience: Product owner, clinical advisor

## What was delivered

Members can now describe their family medical history one relative at a time — exactly the way a clinician would take it during an interview — instead of filling out flat lists of "which relatives had heart disease" and a separate page about which relatives have died. Each family member becomes a card on the onboarding page: who they are, whether they're alive, their age (current or at death), what they died of if applicable, lifestyle (smoking, alcohol), and the conditions they have or had with the age each one started.

Behind the scenes, the platform now has strictly richer family history data feeding the risk engine — per-relative ages of onset (instead of a single "earliest" number), accurate counting of how many close relatives are affected, and structured cause-of-death categories. Two parents with diabetes now correctly elevates the risk score (this was a silent bug: the engine wanted a `multiple` flag the old form never set).

The questionnaire is now six steps instead of seven — the separate "Deaths in the family" step is gone because cause of death is now captured directly on each relative's card. Existing members who started filling out the old form lose nothing: their data is automatically translated into the new shape every time they open the form.

## What phase this advances

**Epic 2 (The Intake)** — closes the long-standing "Family-history sub-fields (age of onset, cancer types)" outstanding item that's been on the backlog since the first onboarding port from Base44. Epic 2 advances from 97% to ~99% complete; the only remaining outstanding item is the optional E2E Playwright test of the full onboarding flow.

**Epic 3 (The Number)** — the deterministic risk engine now receives strictly richer family-history aggregates. The `multiple` flag fix alone changes the metabolic domain score for any member with two or more diabetic parents. GP-panel-pack outputs are equivalent or strictly better.

**Epic 8 (The Living Record)** — no UI change to the simulator, but the simulator's baseline now reflects more accurate family-history scoring for any member who completes (or re-edits) the new family step.

## What comes next

The most valuable adjacent moves, in order:

1. **Manual smoke test on a seeded staging member.** Five operator minutes — load onboarding for a user with legacy data, confirm cards appear pre-populated, click through, save, confirm the database has `family_members[]` and the old keys are gone.
2. **Resume the SBP questionnaire field** that's parked at `docs/engineering/changes/2026-04-29-questionnaire-sbp-field/PLAN.md`. Adds a one-line vital-sign field to the basics step so the simulator's SBP slider opens at each member's actual reading instead of the population default. Plan is complete and ready to execute (the Path A JSONB approach we locked).
3. **Engine extension to consume per-relative smoking and alcohol.** Currently stored but unused. A future change can use parental smoking → CV uplift (well-established clinical signal). The data is already in `family_members[].smoking_status` ready for it.
4. **D3 — Sentry error monitoring** (S, ~1 day, Epic 14). Largest remaining production-observability gap. With the new card UI in production, any client-side errors deserve to be surfaced.

My recommendation: **smoke test first, then the parked SBP questionnaire field** — it's a one-line change that finishes the simulator personalisation we started two days ago.

## Risks or open items

- **Manual smoke test owed.** Three Vitest integration cases prove the data flow end-to-end, but there's no automated browser test on the rendered cards UI. A human eye in a real browser is worth the five minutes before declaring done.
- **Cause-of-death category mapping is heuristic.** The hydration shim uses a regex against free-text `mother_cause_of_death` etc. — "passed in his sleep" maps to `unknown`. Acceptable; the cause field is informational and is not consumed by the scoring engine today. Any clinician-visible report can show the category as a hint and still display the original free text where preserved.
- **Multiple aunts cannot be disambiguated.** The model supports two `aunt` cards but offers no free-text label ("Aunt Mary" vs "Aunt Susan"). A small follow-up if clinical advisors flag confusion.
- **Smoking/alcohol per relative stored but unused by the engine.** Captured for future engine extensions. The simulator and the report don't surface this data yet.
- **Mid-deploy member experience:** anyone who has the onboarding page open during the Wave 3 push will keep seeing the dual-input UI from Wave 2 until they reload. Once they reload, they get the clean six-step flow. Their data is fine either way.
- **Existing JSONB rows still contain orphan legacy keys** until each user saves their form once after Wave 3. This is by design — no risky DB rewrite, no migration. Storage cost is minimal.
