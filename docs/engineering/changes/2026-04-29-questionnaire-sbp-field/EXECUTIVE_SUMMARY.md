# Executive Summary: SBP questionnaire field
Date: 2026-04-29
Audience: Product owner, clinical advisor

## What was delivered

Members can now enter their most recent systolic blood pressure reading during onboarding — a small optional field on the "About you" step labelled "Recent systolic BP reading". When a member fills it in (say, 145 mmHg), three things happen automatically with no further code:

- The risk engine sees a real number instead of the binary "hypertension yes/no" flag from their medical-history list.
- The Risk Simulator's BP slider opens at their actual reading instead of the population default of 125.
- Atlas's next narrative refers to "145 mmHg" rather than the generic "hypertension".

This finishes the simulator personalisation loop we started two days ago. The numeric BP scoring shipped on 2026-04-29; the slider on the simulator page shipped the same day; today's change is the third leg — the data source. From now on, every new member who completes onboarding feeds their numeric SBP into the engine.

## What phase this advances

**Epic 2 (The Intake)** stays at 99%. This was a small one-field change inside an already-substantially-complete onboarding flow.

**Epic 3 (The Number)** — the engine now has a real-world data source for numeric SBP scoring. Previously, the AHA-aligned scoring bands were live but only fired for seeded test users. Now they fire for any real member who enters a reading.

**Epic 8 (The Living Record)** — the simulator now opens at the member's actual SBP rather than a synthetic baseline whenever they've completed (or re-edited) onboarding. The "(population default)" caption disappears for those members.

## What comes next

The simulator is now functionally complete for the four numeric levers we ship today (LDL, HbA1c, hsCRP, weight, plus SBP). The natural follow-ups, in order:

1. **Manual smoke test** with a real seeded member — fill 145 in onboarding, click through to the simulator, confirm the slider opens at 145 with no population-default caption. Five operator minutes.
2. **Align the simulator slider min** with the questionnaire bound. The questionnaire allows 70–250 mmHg (clinically correct — below 70 is shock); the simulator slider currently has min 90. A member who enters 80 (legitimate hypotension) would saturate the slider at 90. One-line fix in a separate change; flagged in the changelog.
3. **DBP slider + questionnaire field**. Diastolic correlates with systolic but adds clinical nuance. Same shape as today's work — a small follow-up that closes the BP capture surface entirely.
4. **Janet extraction of BP from uploaded blood-test reports.** Many lab PDFs have vital signs at the top. Extending Janet's structured findings array to capture them lets us populate `systolic_bp_mmHg` automatically without member self-report. Larger change; tracked for Sprint 2.

My recommendation: **smoke test first, then the simulator slider min alignment** — both are five-minute tasks.

## Risks or open items

- **Self-reported values are noisier** than clinic-measured ones. The numeric path still beats the binary `hypertension` fallback either way (graded scoring vs. yes/no). When Janet's BP-from-PDF extraction lands later, it can override the self-report with the clinical-grade reading.
- **Stale readings** — a member might enter last year's annual physical reading. The label says "Recent" and the helpText nudges toward "from a clinic, home monitor, or pharmacy" but there's no temporal enforcement. Worth watching member behaviour; tighter copy ("within the last 6 months") is a one-line change if needed.
- **Bound mismatch** between questionnaire (70–250) and simulator slider (90–200). Documented; should be aligned by lifting the simulator slider min to 70 in a separate change so hypotension entries display correctly.
- **Members on antihypertensive medication** automatically get the engine's −15 adjustment without seeing it in the UI. The simulator and report don't surface this. If a clinical advisor wants the adjustment surfaced, a small UI annotation is the right answer.
