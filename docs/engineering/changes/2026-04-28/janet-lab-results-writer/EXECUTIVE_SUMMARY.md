# Executive Summary: Janet → lab_results structured writer
Date: 2026-04-28
Audience: Product owner, clinical advisor

## What was delivered

Janet now reads a blood panel and writes the actual numbers into structured rows that the rest of the platform can use. Until today, when a member uploaded a blood test, Janet wrote a free-text summary into a notes column — useful to read, but invisible to the system. As a result, the **Lab Results** page (B4) and the **out-of-range alerts** chip (B7) were both built but had no data to show.

This change closes that gap. When a blood panel is uploaded:

1. Janet extracts each biomarker from the document — name, value, unit, reference range, test date, panel name, lab provider.
2. The server determines whether each reading is low / optimal / high / critical using a fixed, explainable rule (no AI judgement on clinical status).
3. The reading is saved as a structured row.
4. The `/labs` page renders the panel automatically — no UI change.
5. Anything out of range produces an alert chip on the dashboard automatically — no further code change.

The same panel can be re-uploaded without creating duplicate rows; a database constraint handles that.

## What phase this advances

- **Epic 2 (The Intake — Janet)** moves from 85% → ~88%. Janet now produces structured output, not just narrative.
- **Epic 8 (The Living Record)** moves from 45% → ~55%. The labs surface and the alerts surface both go from "wired but empty" to "live."
- Downstream effect on **Epic 3 (The Number — risk engine)**: the deterministic risk engine now has real biomarker data to consume on subsequent runs, lifting confidence labels off the "moderate" floor for any member who has uploaded a panel.

## What comes next

The most valuable adjacent moves, in order:

1. **Manual smoke test with a real panel.** The plumbing is correct; we need one real upload to verify Janet's prompt actually emits the new biomarkers array on a representative document. Five minutes of operator time.
2. **D3 — Sentry error monitoring** (S, ~1 day, Epic 14). Largest remaining production-observability gap. With Janet now writing to a constrained schema, parse and validation errors become much more interesting to surface.
3. **B6 — Risk simulator** (M, ~2 days, Epic 8). Sliders for LDL / HbA1c / BP that recompute risk in real-time. Builds on the deterministic risk engine and the structured biomarker data this change unlocks.
4. **Biomarker name canonicalisation** (S, follow-up). Right now `LDL`, `LDL Cholesterol`, and `LDL-C` are stored as three different biomarkers. A small lookup table folds them together. Becomes more valuable as more panels arrive.

My recommendation: **smoke test first, then D3, then B6**. The smoke test is the fastest way to confirm production readiness; D3 is the operational hygiene gap; B6 is the next big member-visible feature.

## Risks or open items

- **Janet might miss or misread a biomarker on an unusual lab format.** Storage is verbatim, so a misread shows as a wrong value in the UI rather than corrupting downstream — a clinician spot-checking the Lab Results page can catch this. The downstream risk engine degrades gracefully on noisy inputs (lower confidence, not silent failure).
- **Same panel uploaded twice** is handled by the new database constraint; no duplicate rows.
- **Status thresholds** (`>1.5× max → critical`, `<0.5× min → critical`) are defensible defaults, not clinically reviewed. Worth a panel-doctor sanity check on the next clinical-advisory cycle.
- **`borderline` status** is intentionally suppressed for now (noise control). If a clinician advisor says "we're missing meaningful early signals," revisit.
- **No re-processing** of uploads that landed before today. New uploads populate `lab_results`; old uploads stay in JSONB. If we want to back-fill, that's a separate one-shot script.
