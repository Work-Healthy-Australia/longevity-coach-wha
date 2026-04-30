# Executive Summary: Numeric SBP slider for the simulator
Date: 2026-04-29
Audience: Product owner, clinical advisor

## What was delivered

The risk simulator gains its most-asked-for fifth slider: **Systolic BP**. A signed-in member can now drag a blood-pressure reading from 90 to 200 mmHg and watch their cardiovascular and composite risk update smoothly through six clinical bands, instead of hitting the binary "hypertension yes/no" cliff that the engine produced before.

The scoring uses the AHA / ACC 2017 bands:

| SBP (mmHg) | Score | Clinical band |
|---|---:|---|
| < 120 | 0 | Optimal |
| 120–129 | 15 | Elevated |
| 130–139 | 35 | Stage 1 hypertension |
| 140–159 | 60 | Stage 2 hypertension |
| 160–179 | 85 | Severe |
| ≥ 180 | 100 | Crisis |

A member on antihypertensive medication has 15 points subtracted from the score (clamped to zero) to reflect that the medicated reading understates underlying pressure.

**Zero regression.** Members with no numeric SBP value behave exactly as before — the engine falls through to the binary `hypertension` flag from their medical-history list. Every existing cardiovascular test still passes unchanged.

The simulator slider opens at 125 mmHg with a `(population default)` caption when the member has no numeric SBP on file. Once a future change wires SBP into the questionnaire or Janet's blood-test extraction, members will see their real value as the starting position.

## What phase this advances

- **Epic 3 (The Number — risk engine)** — the engine's first numeric blood-pressure input, opening the door to more graded clinical inputs in future.
- **Epic 8 (The Living Record — simulator)** — fifth slider on `/simulator`. The simulator now covers the four most-modifiable cardio-metabolic levers (LDL, HbA1c, hsCRP, weight) plus the most-asked-for vital sign (SBP).

## What comes next

The simulator is now functionally complete. The natural follow-ups are about feeding real data into it:

1. **Manual smoke test with seeded data.** Five operator minutes — drag SBP from 145 to 120 and confirm cardiovascular and composite risk drop directionally.
2. **Production data source for SBP.** Three candidates, in order of effort: (a) add a "Recent blood pressure reading" field to the questionnaire (S, ~0.5 day); (b) extend Janet's structured extraction to pull BP from blood-test PDFs that include vital signs at the top (M, ~1 day); (c) wearable OAuth (Phase 4 work). Pick the questionnaire route first — it's the cheapest path to real data.
3. **DBP slider** (S, ~0.5 day after data source). Diastolic correlates with systolic but adds clinical nuance.
4. **D3 — Sentry error monitoring** (S, ~1 day, Epic 14). Largest remaining production-observability gap.

My recommendation: smoke test first, then a small "vitals" question in onboarding so the simulator gets real data on the next member who completes the assessment.

## Risks or open items

- **Hypotension blind spot.** Systolic readings below 90 mmHg currently score zero — the same as 110. Real hypotension (syncope, perfusion concerns) is not modelled. The slider's minimum of 90 prevents members from reaching this region via the UI today, but if a future writer feeds 75 mmHg from a lab report or wearable the engine will silently treat it as optimal. Adding a hypotension band is a clinical-review decision and is deliberately deferred.
- **Numeric reading overrides binary self-report.** A member who self-reported "hypertension" in their conditions list AND has a numeric SBP of 110 (e.g. on aggressive medication) now scores zero. This is the desired behaviour — the actual measurement beats the self-report — but worth flagging so the clinical advisor is not surprised on the next review.
- **`raw_value` string format change.** The cardiovascular factor's display value used to be `"normal"` or `"hypertension"`; it is now also `"145 mmHg"` when a numeric reading is present. The Atlas narrative pipeline and the PDF report read these strings. No type-level breakage and no consumer fails today, but the first Atlas run after deploy will see a new format and may produce slightly different narrative phrasing for members with numeric SBP.
- **Antihypertensive adjustment is heuristic.** Subtracting 15 from the medicated reading is a rule of thumb, not a clinical model. Real practice considers what the underlying pressure would be off-medication, which depends on the medication class and dose. Adjustable in a future change with clinical input.
- **No production data source today.** Until questionnaire or Janet wires SBP, every member sees the population default of 125 mmHg. Fine for a what-if simulator (B6 already shipped this way for hsCRP), but worth shipping a data source soon to make the slider personally meaningful.
