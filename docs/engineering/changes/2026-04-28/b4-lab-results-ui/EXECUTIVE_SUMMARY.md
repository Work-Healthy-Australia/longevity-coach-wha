# Executive Summary: B4 — Lab results UI
Date: 2026-04-28
Audience: Product owner, clinical advisor

## What was delivered

Members can now see their lab results inside Longevity Coach instead of paging through PDFs. After a member uploads a blood panel and Janet extracts the biomarkers, those results appear on a new **Lab Results** page reachable from the dashboard.

The page groups every biomarker by category (Cardiovascular, Metabolic, Hormonal, Inflammatory, Haematology, Vitamins, Kidney, Liver, Thyroid, Other). Each card shows the latest value, the reference range, and a colour-coded status pill — Low, Optimal, Borderline, High, or Critical — using the interpretation Janet derived from the lab's own reference range.

Clicking into any biomarker opens a detail page with a **time-series chart** of that biomarker over time (with a green band marking the optimal reference range), a header card with the latest reading, and a full history table showing the date, value, lab, and panel name for every prior measurement.

Members with zero uploads see a friendly empty state pointing them at the upload portal. The dashboard's "Coming soon · Lab Results" placeholder has been replaced with a live tile showing how many biomarkers are tracked and when the most recent panel was processed.

## What phase this advances

This is the first member-facing surface of **Epic 8 — The Living Record**, which moves from 5% to roughly 25% complete. It also unblocks the next two adjacent items:

- **B5 — Daily-log trends.** Charts of sleep / energy / mood / steps over the last 30 days can now reuse the Recharts library introduced here.
- **B6 — Risk simulator.** "What happens to my risk score if I lower my LDL?" sliders depend on the same charting infrastructure.

## What comes next

The most valuable adjacent moves, in order:

1. **B5 — Daily-log trends** (S, ~1 day). Smallest delta, member-visible, reuses everything we just built. The dashboard already has 30 days of check-in data sitting in `biomarkers.daily_logs` waiting for a chart.
2. **B7 — Out-of-range alerts and repeat-test reminders** (S, ~1 day). Now that the labs page exists, the natural follow-up is "tell me when something I've measured drifts out of range." Adds a chip to the dashboard hero.
3. **D3 — Sentry error monitoring** (S, ~1 day). Still the biggest gap in production observability. No member-visible value, but it removes the operational blind spot.

A decision is needed from you on the order. My recommendation is **B5 → B7 → D3** because the first two extend the daily-return loop you've already built, while D3 is purely defensive.

## Risks or open items

- **Manual smoke test.** The Recharts chart cannot be unit-tested in our test environment. Before the next release, a human needs to visit `/labs/[any biomarker]` with seeded data and confirm the chart and reference band render correctly.
- **Locale drift.** Date formatting in the dashboard tile and the labs pages uses slightly different locale paths. Cosmetic, not functional, but worth tightening if it becomes visible.
- **No source-upload back-link.** Each lab row knows which uploaded document it came from, but the UI doesn't link back to that document. Worth adding when the uploads page is next touched.
- **Top-nav entry.** `/labs` is reachable from the dashboard quick-links tile only. If member feedback says "I keep losing the labs page," promoting it into the top nav is a one-line change.
