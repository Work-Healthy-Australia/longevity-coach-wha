# Executive Summary: B7 — Member alerts
Date: 2026-04-28
Audience: Product owner, clinical advisor

## What was delivered

The dashboard can now tell members **what they should notice**. A new alert chip appears at the top of the dashboard whenever the system has something specific to surface — for example, "you're due for a thyroid panel" if Atlas has recommended one and we have no recent thyroid biomarkers on file, or "your LDL is in the high range" once we have lab data showing it.

A daily background job ("repeat-test cron") scans every member's most recent risk-score recommendations against their last 12 months of lab data. When a recommended screening hasn't been covered, an alert is created. The chip shows a one-line headline, a one-sentence body, a `View →` link to the relevant page (uploads, or a specific biomarker), and a Dismiss button.

Members dismiss alerts in one click. Dismissed alerts disappear immediately and don't come back unless the cron re-emits them later (e.g. they're still due for the screening next month).

This change is the **third member-facing surface of Epic 8 (The Living Record)**. With B4 (`/labs`) showing what the system already knows and B5 (`/trends`) showing how their daily logs move, B7 closes the loop by telling them **what to do about it**.

## What phase this advances

**Epic 8 — The Living Record** moves from 35% → roughly 45% complete. Three of the planned member-visible surfaces of this epic now exist (Lab Results, Trends, Alerts); the largest remaining piece is the risk simulator (B6).

The alerting infrastructure is dual-purpose by design:
- **Repeat-test alerts** fire today because Atlas already populates `risk_scores.recommended_screenings`.
- **Lab-out-of-range alerts** are wired but defensive — they will start firing automatically once the Janet → structured `lab_results` writer lands. That's the **largest remaining follow-up** for B7's full value.

## What comes next

In rough order:

1. **Janet → `lab_results` writer.** This is the bottleneck for B7's lab-alert surface AND for B4's data depth. Today Janet writes free-text findings into JSONB; we need a step that converts those findings into structured biomarker rows. Once that exists, both B4 and B7 light up automatically. No spec yet — small design conversation needed first.
2. **D3 — Sentry error monitoring** (S, ~1 day, Epic 14). The biggest remaining production-observability gap. No member-visible value, but it removes a known operational blind spot.
3. **B6 — Risk simulator** (M, ~2 days, Epic 8). Sliders for LDL / HbA1c / BP that recompute risk in real-time. Builds on the deterministic risk engine we shipped in P0.

My recommendation is **Janet → `lab_results` writer first**, because it unlocks two already-built surfaces (B4 + B7) without any new UI work. If that needs design time, **D3 next** as a fast win on production hygiene.

## Risks or open items

- **Lab alerts inert today.** The chip surface is real; the repeat-test cron will fire as soon as it's scheduled in `vercel.json`. Lab-out-of-range alerts won't fire until Janet writes structured rows. Members reading a "your labs are alright" silence today are hearing it because we have no data, not because nothing's wrong.
- **`vercel.json` cron registration.** The route is built and tested; an operator needs to add the `crons` block (or trigger it manually for now). One-line config change.
- **`CRON_SECRET` env var.** The route lets requests through when the secret is unset (matches existing routes' dev convenience). Production must set the secret before exposing the route.
- **Heuristic screening match.** "Thyroid panel" matches biomarkers tokenised as `tsh`/`t3`/`t4`/`thyroid`; "lipid panel" matches `ldl`/`hdl`/`cholesterol`/`triglycerides`/`apob`. The map covers the screenings Atlas emits today. New screening types need a map entry; until then they fall back to tokenising the screening string itself.
- **Re-emit semantics.** A member who dismisses an alert today CAN see it again after the next cron run if the underlying recommendation is still relevant. This is intended (a still-due screening should re-surface) but worth member feedback before deciding whether to add a snooze window.
- **Borderline tone deliberately suppressed.** Lab readings flagged as `borderline` do not produce alerts (noise control). Revisit if member feedback says we're missing too much.
