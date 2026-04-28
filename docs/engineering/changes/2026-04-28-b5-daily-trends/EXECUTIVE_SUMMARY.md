# Executive Summary: B5 — Daily-log trends
Date: 2026-04-28
Audience: Product owner, clinical advisor

## What was delivered

Members can now see how the things they log every day move over time. A new **Trends** page (reachable from the dashboard's quick-links row) shows the last 30 days of their daily check-ins as five small charts: Sleep, Energy, Mood, Steps, and Water.

Each chart shows the latest reading, the average over the days they actually logged, and a sparkline that breaks where days were missed (so a streak gap is visible at a glance, not papered over with zeroes).

Members who haven't logged a check-in yet see a friendly empty panel pointing them at the daily check-in form. The page header summarises how many of the last 30 days have been logged, so a member can see their consistency without scrolling.

This is the second member-facing surface of Epic 8 (The Living Record), shipping the same day as B4 (Lab Results UI). Together, members can now see *both* their occasional lab data *and* their daily self-reported data under one roof.

## What phase this advances

**Epic 8 — The Living Record** moves from 25% → roughly 35% complete. Two of the three big member-visible surfaces of this epic are now live (Lab Results and Trends); the third (a risk simulator) and a smaller alerting surface remain.

The Recharts dependency, introduced for B4 yesterday, is now reused — confirming the choice was the right one. The same pattern (server-component page + client-component chart + pure data helpers in `lib/`) will carry through to B6 (risk simulator) and beyond.

## What comes next

In rough order of value:

1. **B7 — Out-of-range alerts and repeat-test reminders** (S, ~1 day, Epic 8). With both `/labs` and `/trends` live, the natural next move is "tell me when something I've measured drifts." Adds a chip to the dashboard hero.
2. **D3 — Sentry error monitoring** (S, ~1 day, Epic 14). The biggest remaining gap in production observability. No member-visible value, but it removes the operational blind spot.
3. **B6 — Risk simulator** (M, ~2 days, Epic 8). Sliders for LDL, HbA1c, BP, weight that recompute risk in real time. Higher build cost; pair with the deterministic risk engine.

My recommendation is **B7 → D3 → B6**: B7 closes the "what should I notice?" loop B4 + B5 just opened, D3 removes a known operational risk, and B6 is the larger feature you can plan around.

## Risks or open items

- **Manual visual smoke test owed.** Like B4, the Recharts charts cannot be automated through our test environment. Before the next member release, an operator must visit `/trends` with seeded data and confirm the five sparklines render, line breaks at null gaps look right, and the per-metric palette reads well.
- **Glass size assumption.** The water chart converts millilitres to glasses at a fixed 250 ml. If members report different glass sizes, this becomes a per-user preference. Flagged in the helper as a named constant for easy tuning.
- **Timezone caveat.** The 30-day window is UTC-aligned (matching the streak math we ship today). A member in a non-UTC zone may see a late-night check-in land in the adjacent UTC bucket. Same caveat as the existing streak surface — no regression — but worth being aware of when reading these charts alongside a member's local sense of "yesterday."
- **No top-nav entry yet.** `/trends` lives only in the dashboard quick-links tile. If member feedback says they want it more prominent, promoting it to the top nav is a one-line change.
