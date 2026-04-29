# Executive Summary: Bio-age input coverage
Date: 2026-04-29
Audience: Product owner, clinical advisor

## What was delivered

The deterministic biological-age engine consumes 11 inputs. Until today, only 7 of them had a path from the front-end to the engine — the four missing ones (HRV, deep sleep %, VO₂max, visceral fat) happened to be among the most heavily-weighted predictors. A member with full blood-panel uploads but no wearable could only populate 7 of 11 modifiers; the engine still produced a number but with low confidence and a synthetic feel.

After today, a member can populate **all 11** inputs without owning a wearable:

- The **daily check-in** gains three optional fields for the wearable-style metrics — Resting HRV, Resting heart rate, Deep sleep %. Members with an Apple Watch / Garmin / Whoop / Oura type a number from their app each morning. Three more inputs into the engine, three more days of trend data into `/trends`.
- The **onboarding lifestyle step** gains an optional **VO₂max** field — the single biggest weight in the bio-age model. If a member knows their VO₂max from a clinical assessment or a wearable, they enter it. If they don't, they skip it.
- The **onboarding basics step** gains an optional **Waist circumference** field. A real DEXA-derived visceral fat reading still wins, but if the member has no DEXA, the engine uses a sex-adjusted estimate (slope 5 cm² per cm above the IDF threshold of 90 cm male / 80 cm female) to get a defensible value into the model.
- **DEXA scan uploads now feed the engine.** Janet was already extracting structured biomarkers from any uploaded document (the work we shipped last week). Today's change adds an imaging-key routing table in `assemble.ts` so when Janet pulls "Visceral Fat Area: 95 cm²" out of a DEXA report, the value lands on `Biomarkers.imaging` instead of being dropped. Same path lights up coronary calcium (CAC), DEXA T-scores (spine + hip), liver fat fraction, and carotid IMT — five additional clinical inputs that were previously hard-coded to empty.

## What phase this advances

**Epic 2 (The Intake)** stays at 99%. These were small additive fields on existing surfaces.

**Epic 3 (The Number)** moves from 75% → roughly 85%. The engine's input coverage is the big shift; the deterministic risk engine now sees every input it was designed to consume for any member who completes onboarding plus a daily check-in. Confidence labels should rise from "moderate" to "high" for actively engaged members.

**Epic 8 (The Living Record)** unchanged but indirectly improved — the simulator inherits the same data. A member who enters waist circumference will see their visceral-fat-derived contribution to risk at simulator load time without any UI change.

## What comes next

In rough order of value:

1. **Manual smoke test** with seeded data. Five operator minutes — log a check-in with HRV 60 / RHR 58 / deep sleep 18, complete onboarding with waist 95 + VO₂max 42, visit `/report` and confirm the bio-age output reflects the new inputs.
2. **Wearable OAuth integrations** (Apple Watch, Garmin, Whoop, Oura) — Phase 4 work. Today's self-report fields are the bridge until the OAuth path exists. When wearables land, the engine prefers the wearable value and the self-reports become an editable fallback.
3. **DEXA upload UX** — Janet extracts visceral fat correctly today, but `/labs` doesn't yet surface body-composition data as a separate card. A small follow-up to add a "Body composition" section.
4. **Waist→visceral-fat slope** — a clinical advisor's sanity check on the empirical slope of 5 cm² per cm. The current default is reasonable against population data but isn't published clinically; a quick review by the panel-doctor cycle would tighten it.

My recommendation: **smoke test first, then wearable OAuth scoping**. The wearable integrations are bigger work but they unlock the full bio-age model for any member with a smartwatch, with no manual entry friction.

## Risks or open items

- **Self-reported values are noisier than wearable-derived ones.** A member who enters VO₂max 50 from a Garmin estimate is feeding the engine a slightly different number than a clinical max test would show — but the engine still scores them better than someone with no input at all. The numeric path strictly improves on the previous "no signal" state.
- **Visceral fat estimate from waist is heuristic.** A member at waist 95 cm gets 25 cm² (male) or 75 cm² (female). DEXA always wins when present. Worth flagging in clinical-advisor review whether the slope and threshold need tuning.
- **Bounds rejection on optional fields.** A member entering VO₂max 5 (way below the realistic minimum of ~10) will see an inline form error, not a silent skip. This protects the engine but may surprise users — worth watching support inbox for confusion.
- **Schema migration applied to remote** but no operator action needed beyond confirming the column appeared (`biomarkers.daily_logs.deep_sleep_pct`).
- **No engine domain-scoring change.** The bio-age weighted-modifier model is unchanged; we only fed it more inputs. Existing GP-panel-pack output for users with seeded data is identical or strictly better.
