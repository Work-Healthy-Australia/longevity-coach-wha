# Executive Summary: Risk Engine Port
Date: 2026-04-28
Audience: Product owner, clinical advisor

## What was delivered

Every member who completes the health questionnaire now automatically receives a health score the moment they finish. When a member submits their answers, the platform runs a deterministic, evidence-based calculation that produces: a biological age, an overall longevity score (0–100), and a five-domain risk breakdown covering cardiovascular health, metabolic health, brain and cognitive risk, cancer risk, and musculoskeletal strength. It also projects how much improvement the member could see in six months if they follow the recommended actions, and identifies the top modifiable risk factors — the highest-leverage things they could change. All of this happens immediately, with no AI generation or wait time, and a result is always produced even if the member has not yet uploaded any lab results.

## What phase this advances

- **Epic 2.1 — Biological Age Assessment**: Biological age is now calculated automatically on questionnaire submit (story 2.1.1 complete). The data for the score comparison visual (2.1.2), contributing factors (2.1.3), and projected improvement (2.1.4) is now available in the database — those stories need a UI to display it.
- **Epic 2.2 — Five-Domain Risk Breakdown**: All five risk domain scores are now written to the database on questionnaire submit (story 2.2.1 complete data layer). Stories 2.2.2, 2.2.3, and 2.2.4 need a UI.

## What comes next

The next logical step is to build the member-facing report screen (`/report` page) that displays the biological age, domain scores, projected improvement, and top risk factors the engine is now producing. This is Epic 2.5 and is a pure UI task — all the data is ready.

In parallel, the Atlas pipeline (risk narrative AI) can now be wired, since it reads from the `risk_scores` table that the engine is now populating. Atlas generates the plain-language explanation of the scores that members will read in their report.

## Risks or open items

1. **Migration must be applied to production before go-live.** A database change (migration 0034) was written that must be run against the live database before members can successfully submit the questionnaire in production. The change is low-risk (adds a unique constraint and converts one column type). This requires Docker to be running to push through the Supabase CLI.

2. **Lab results not yet feeding into scores.** Members who have uploaded pathology results will not see those results reflected in their risk score yet — biomarker parsing from uploads into the scoring system is a separate pipeline not yet built. Scores are currently based on questionnaire and wearable data only, and the report must make this clear to members. Confidence levels (shown as "low" or "insufficient" for questionnaire-only data) communicate this automatically.

3. **Alcohol intake not yet collected.** The questionnaire does not yet ask about weekly alcohol consumption, which is a factor in three of the five risk domains. This field should be added to the lifestyle section of the questionnaire.
