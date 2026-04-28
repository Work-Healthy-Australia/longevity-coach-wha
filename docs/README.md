# Longevity Coach — Documentation Index

**Project:** Longevity Coach (longevity-coach.io)  
**Stack:** Next.js 16 · TypeScript · Supabase · Stripe · Resend · Anthropic Claude API  
**Product owner:** James Murray  
**Last updated:** 2026-04-27

---

## Product

High-level product vision, twelve thematic epics, status dashboard, and the legacy phased roadmap. Start with `product.md`.

| Document | Contents |
|---|---|
| [Product](./product/product.md) | **Step-back vision (Dan Shipper frame).** Audiences, four ranked values, moat, business model. |
| [Epics](./product/epics.md) | **Fourteen thematic epics.** Each with thesis, bundle, mechanism, success criterion. |
| [Epic Status](./product/epic-status.md) | **At-a-glance dashboard.** Pipeline glyphs, % estimate, open/closed bug counts per epic. |
| [Product Overview](./product/00-product-overview.md) | Original executive brief — vision, audiences, value proposition, business model |
| [Product Timeline](./product/01-product-timeline.md) | Six-phase roadmap with goals and status per phase |
| [Phase 1 — Foundation](./product/phase-01-foundation.md) | Marketing, account creation, questionnaire, payment, dashboard ✅ |
| [Phase 2 — Intelligence](./product/phase-02-intelligence.md) | Biological age, risk scoring, supplement protocol, PDF report 🔄 |
| [Phase 3 — Engagement](./product/phase-03-engagement.md) | Daily check-in, habits, AI coaches, meal planning |
| [Phase 4 — Clinical Depth](./product/phase-04-clinical-depth.md) | Lab uploads, biomarker tracking, wearables, risk simulator |
| [Phase 5 — Care Network](./product/phase-05-care-network.md) | Clinician portal, care team sharing, community |
| [Phase 6 — Scale](./product/phase-06-scale.md) | Corporate wellness, admin CRM, supplement marketplace |

---

## Architecture

System design and technical architecture documents.

| Document | Contents |
|---|---|
| [Database Schema](./architecture/database-schema.md) | Full schema map, table purposes, migration history, design principles |
| [Agent System](./architecture/agent-system.md) | AI agent and pipeline worker design, build order, component specs |
| [AI Vision](./architecture/ai-vision.md) | High-level agentic system vision and patient workflow |

---

## Features

Proposals and specifications for individual features being built or planned.

| Document | Contents |
|---|---|
| [Pricing — Voice Brief](./features/pricing/voice-brief.md) | Original product owner brief (raw) |
| [Pricing — Feature Proposal](./features/pricing/feature-proposal.md) | Four-subsystem breakdown: plans, add-ons, employer toggles, supplier catalog |
| [Pricing — System Design](./features/pricing/system-design.md) | Technical system design for the pricing feature |
| [Pricing — Database Design](./features/pricing/database-design.md) | Schema design for plans, billing, and supplier tables |

---

## Engineering

Sprint handoffs, gap analyses, session notes, and change records.

| Document | Contents |
|---|---|
| [2026-04-24 Handoff](./engineering/sprints/2026-04-24-handoff.md) | Dave → Trac handoff: what was built, what is blocked, recommended next steps |
| [Vietnam Sprint Plan](./engineering/sprints/vietnam-sprint-plan.md) | Sprint contract — 7 MVP workflows |
| [Gap Analysis (2026-04-27)](./engineering/2026-04-27-gap-analysis.md) | Base44 vs new build comparison, missing features, database gaps |
| [Gap Closure Plan (2026-04-27)](./engineering/2026-04-27-gap-closure-plan.md) | Ordered plan to close identified gaps |
| [Morning Scope (2026-04-27)](./engineering/2026-04-27-morning-scope.md) | Session scope and decisions from 2026-04-27 morning |

### Changes

Each change delivered via the `dev-loop` skill produces a dated subfolder here containing PLAN, CHANGELOG, QA_REPORT, and EXECUTIVE_SUMMARY.

| Folder | Contents |
|---|---|
| _(none yet — first change will appear here)_ | |

---

## QA

Quality assurance plan, regression reports, and test findings.

| Document | Contents |
|---|---|
| [QA Plan](./qa/qa-plan.md) | **Forever QA plan (Dan Shipper × webapp-testing skill).** Tier 1–8 testing pyramid, AI evals (Atlas/Sage/Janet/document analyser), manual best practices, quality gates, sequencing. |
| [QA Report (2026-04-27)](./qa/2026-04-27-qa-report.md) | Full regression report: 91 tests, 1 bug fixed, 1 external limitation |

---

## Brand

Brand assets for use in the product and documents.

| Asset | Description |
|---|---|
| [longevity-coach-logo.png](./brand/longevity-coach-logo.png) | Primary logo (stacked) |
| [longevity-coach-horizontal-logo.png](./brand/longevity-coach-horizontal-logo.png) | Horizontal logo (600×125, ~54KB) — used in nav and auth |
| [WHA-LOGO_COLOURED_PNG.png](./brand/WHA-LOGO_COLOURED_PNG.png) | WHA coloured logo |

---

## Archive

| Document | Note |
|---|---|
| [Product Vision v1](./engineering/product-vision-v1-archive.md) | Original combined roadmap — superseded by `docs/product/` |
