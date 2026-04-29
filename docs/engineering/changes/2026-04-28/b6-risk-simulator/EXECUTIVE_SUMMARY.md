# Executive Summary: B6 — Risk simulator
Date: 2026-04-29
Audience: Product owner, clinical advisor

## What was delivered

A signed-in member can now open a new **Risk Simulator** page from the dashboard, drag four sliders — LDL cholesterol, HbA1c, hsCRP (inflammation), and weight — and watch their composite risk score and five domain scores update in real time, side-by-side with their current baseline.

The page answers the question every member eventually asks: *"What happens to my risk if I lower my LDL from 130 to 100? What if I drop ten kilos?"* The answer comes from the same deterministic risk engine that produces the daily report, run live in the browser as the slider moves.

A member who hasn't completed their assessment yet (or has very little data on file) sees a friendly "Complete your assessment to use the simulator" panel pointing them at the questionnaire, instead of a misleading zero baseline. A member who has data but is missing one specific input (say, an hsCRP reading) sees the slider open at a population default with a "(population default)" caption — visible disclosure that the simulation is partly synthetic.

The simulator is **stateless** — there's nothing to save, nothing to share, no journal of past simulations. It's a what-if tool. A "Reset to current" button restores the member's real baseline at any time.

## What phase this advances

**Epic 8 — The Living Record** moves from 55% → roughly 65% complete. Five member-visible surfaces of this epic now exist: Lab Results (B4), Trends (B5), Alerts (B7), the Janet → lab_results structured writer, and the Risk Simulator (B6). The remaining major piece in the epic is wearable data integration (Oura, Apple Watch, Garmin), which is a Phase 4 item.

This is also a quiet **proof of life** for the deterministic risk engine that was ported from Base44 in the P0 wave: it runs cleanly in the browser, recomputes in microseconds, and produces directionally sensible results when sliders move (a smoke test in this change asserts that LDL going up always raises composite risk, and weight going up always raises the metabolic score).

## What comes next

In rough order:

1. **Manual smoke test** with a real seeded user. Five operator minutes; the Recharts-style visual feedback can't be unit-tested cleanly.
2. **Numeric systolic BP slider** (S, ~1 day). The simulator's most-asked-for fifth slider. Today the engine treats blood pressure as a binary `hypertension` flag from the medical-history list; making it a numeric input is a small engine extension that unlocks a more honest simulator.
3. **D3 — Sentry error monitoring** (S, ~1 day, Epic 14). Largest production-observability gap. Now that the simulator runs the risk engine in the browser, any future engine change will benefit from production error visibility.
4. **Wearable OAuth integrations (Oura / Apple Watch / Garmin)** — Phase 4 work. Unlocks the inputs that make a bio-age delta in the simulator defensible.

My recommendation: **smoke test, then numeric SBP slider** — the simulator is materially more useful with five sliders than four, and the engine extension is small.

## Risks or open items

- **Population defaults can mislead.** A member with no hsCRP on file who slides hsCRP from 1.5 to 8 will see CV risk rise — but the baseline was synthetic. The "(population default)" caption is the disclosure. If clinical advisors say the disclosure is too quiet, this becomes a UX adjustment.
- **Bio-age delta is intentionally not shown.** Bio-age depends on heart rate variability, VO₂ max, and deep sleep — none of which the four sliders touch. Showing a bio-age delta off this slider set would be misleading. When wearable data lands and those inputs become member-visible, the simulator can grow into showing bio-age too.
- **The engine ships in the client bundle.** This is by design — without it, the simulator has to round-trip to a server action on every slider tick, which kills the feel. The engine has been carefully decoupled from server-only modules to make this safe. A safety test is in place to catch a future regression that accidentally bundles the database client.
- **Member-level JSON serialised into the HTML payload.** The full `PatientInput` is sent to the client component as a prop, which Next.js serialises into the page payload. It is de-identified data (no name, no DOB, no email) but it is questionnaire + biomarker information. Trimming to just-what-the-simulator-needs is a deferred follow-up if the payload size becomes an issue.
