# Longevity Coach — Product

Last updated **2026-04-28**. Drafted in the Dan Shipper school: AI-native, treats the product as a relationship not a SaaS, obsessed with the moment of truth.

**Companion docs:**
- [epics.md](./epics.md) — the twelve bodies of work.
- [epic-status.md](./epic-status.md) — what's shipped, what's broken, what's next.
- [../qa/qa-plan.md](../qa/qa-plan.md) — how we know what we shipped is right.

---

## 0. The frame

Most personal-health products optimise for "more data shown to the user." That's the wrong target for Longevity Coach. Longevity Coach is a **medical-grade second opinion** that produces a credible biological age, a defensible risk picture, and a 30-day plan a curious 45-year-old will actually follow.

The thing we're really building is one moment: the patient finishes their questionnaire (and maybe uploads a recent blood panel) and lands on `/report`. There they see, for the first time, **their** number, **their** five-domain risk picture, and **their** supplement protocol — named for them, written for them, with the work shown.

If that screen feels like medicine, we win. If it feels like a wellness quiz score, we lose. Every other surface — the dashboard, the daily check-in, Janet — exists to bring the patient back to that moment with new data.

---

## 1. What we are

A personal health intelligence layer that turns a 30-minute questionnaire and any blood test you've ever had into:

1. A **biological age** the patient trusts.
2. A **five-domain risk picture** (cardiovascular, metabolic, neurological, oncological, musculoskeletal).
3. A **30-day supplement protocol** with timing, dose, and rationale per item.
4. A **branded PDF report** the patient can hand to a GP or keep in a drawer.
5. An **AI coach** (Janet) that knows their history and never forgets.
6. A **path to a clinician** when the patient wants a human second opinion.

We are not a wellness blog. We are not a generic supplement upsell. We are not a calculator. The closest thing to us in spirit is a really good private GP who took an extra hour to read your chart — except they remember everything, they're available at 2am, and they don't forget what your liver enzymes did last quarter.

---

## 2. Who we serve

Three audiences, three distinct asks:

| Audience | Who they are | The frame they bring | What we sell them |
|---|---|---|---|
| **Individual member** | 35–65, professional, has just realised their 50s won't be like their 40s | "Longevity," not "wellness" | A number, a plan, and a coach |
| **Corporate wellness buyer** | HR / People Ops at a 100–5,000-person company | "ROI per seat" | Aggregate dashboards, team challenges, employee licences |
| **Clinical practitioner** | Longevity-focused GP, integrative medicine doctor, concierge clinic | "Fewer hours per patient, better outcomes" | A structured patient view + AI-assisted summaries between visits |

The individual member is the wedge. Phase 1–3 is built around them. Corporate and clinical layers come on top of a working consumer product. We do not chase B2B before the consumer product holds.

---

## 3. The four values we ship

Everything we build has to land on at least one of these. If a feature doesn't, we don't build it. They are ranked.

### 3.1 A number you trust

A biological age and risk profile that a curious 45-year-old will accept as credible — and that a GP will accept as defensible. Trust comes from showing the work: which questionnaire answers drove which scores, which uploads moved which numbers, what's still missing. Without this, nothing else matters because the user leaves on day one.

### 3.2 A plan you can act on tomorrow

A 30-day supplement protocol with rationale per item, and a daily target you don't have to think about. Concrete beats clever. "Take 2g of EPA at breakfast because your hs-CRP is elevated" beats "improve cardiovascular health."

### 3.3 A coach who remembers

Janet reads the patient's full context before every conversation. The patient never has to re-explain. The coaching gets sharper the longer they stay. Atlas (risk narrative) and Sage (supplement protocol) are sub-agents Janet calls when a specialist answer is needed in real time.

### 3.4 A trust layer your doctor accepts

RLS at the database, PII separated from clinical data, AHPRA-compliant consent records, "we never train on your data" in writing **and in the architecture**. This is what differentiates us from every consumer wellness app — and what unlocks the clinician channel.

---

## 4. What makes us different

Most consumer health platforms show you a dashboard and walk away. We close the loop in three places competitors don't:

| Gap | Competitors | Longevity Coach |
|---|---|---|
| The protocol | Show a risk score, link to the supplements aisle | Specific 30-day plan with timing, dose, rationale per item |
| The coach | Generic chatbot that doesn't know you | Claude Sonnet 4.6 with 50ms parallel context loading + RAG over a research knowledge base + sub-agents for risk and supplement specialty |
| The clinician path | Either don't have it, or charge $400/mo for it | Real practitioner can be added to the care team and see the same data |

---

## 5. The competitive moat is AI quality

Anyone can build a questionnaire. Anyone can hire a doctor to write supplement rules. The defensible thing is:

- The narrative **Atlas** writes for each domain, indistinguishable from a thoughtful GP letter.
- The protocol **Sage** assembles, indistinguishable from what an integrative medicine clinic would prescribe at $600 a visit.
- **Janet's** ability to pick up a conversation three weeks later as if she had been waiting all along.

The eval suite (qa-plan.md §2) is the system that lets us hold that bar — and notice the day a model upgrade quietly breaks it. Without evals, "AI quality" is theatre.

---

## 6. The architecture in one sentence

A patient identity and questionnaire layer (Supabase, RLS-enforced, PII-isolated) feeds two pipelines (Atlas and Sage) that run async on assessment submit and on every upload, writing structured narratives and protocols back to the patient's row, which Janet reads in parallel via `PatientContext.load()` before every conversation.

Specifics in [`docs/architecture/agent-system.md`](../architecture/agent-system.md). The data rules live in [`.claude/rules/data-management.md`](../../.claude/rules/data-management.md). The AI rules live in [`.claude/rules/ai-agents.md`](../../.claude/rules/ai-agents.md).

---

## 7. Business model

| Revenue line | Why now | Status |
|---|---|---|
| **Individual subscriptions** (monthly + annual) | The wedge. Pays for the unit economics of the AI layer. | Live |
| **Clinical tier** (practitioner subscription) | Activates the care-team feature. Drives word-of-mouth into the consumer base. | Phase 5 |
| **Corporate wellness** (per-seat enterprise) | Sales cycle is long. Build only after the consumer product holds. | Phase 6 |
| **Supplement marketplace** | The protocol page is the natural surface. We sell only what we'd recommend. | Phase 6 |

---

## 8. Market sizing (rough)

- **TAM (consumer)**: 200M adults globally aged 35–65 with disposable income for a £20–60/mo health subscription.
- **SAM (English-speaking, AU/UK/US)**: ~80M.
- **SOM (year 1)**: 5,000 paying members across founding-pilot AU + UK markets.
- **Clinical SAM (AU)**: ~12,000 longevity-aware GPs and integrative medicine practitioners. SOM (year 1): 50.
- **Corporate (AU)**: ~6,000 mid-market employers (100–5,000 staff) with active wellness budgets. SOM (year 2): 20.

These are starting numbers, not commitments. The point is the consumer wedge is real and the upstream channels exist.

---

## 9. What's true today (2026-04-28)

We are mid-Phase-2.

**Shipped:**
- Marketing presence (`/`, `/science`, `/team`, `/stories`, `/sample-report`, `/legal/collection-notice`).
- Auth, signup, password reset, welcome email.
- Six-step health questionnaire with save-and-resume.
- Stripe subscription checkout + webhook.
- Patient uploads portal + Janet document analyser (Claude Opus 4.7).
- Atlas + Sage pipelines (risk narrative + supplement protocol).
- Janet streaming chat agent (Claude Sonnet 4.6).
- `/report` page combining narrative, scores, protocol, and Janet chat.
- Drip-email cron, basic admin pages, consent records.
- 13 RLS-enforced migrations, full TypeScript schema types regenerated.

**Not shipped:**
- Deterministic risk engine port from Base44 (Atlas currently derives all scores via LLM at `confidence_level = 'moderate'`).
- Branded PDF export (skeleton only).
- Patient `/account` self-service page.
- pgvector / RAG (migration written, extension not enabled).
- Daily check-in, habits, streaks, AI coach suite beyond Janet.
- Clinician portal, care-team sharing, appointment booking.
- Wearable connections, biomarker tracking, risk simulator.
- Corporate accounts, supplement marketplace.

Detail in [epic-status.md](./epic-status.md).

---

## 10. The principle to remember

**Patients don't come back for features. They come back because last time it told them something they didn't know about themselves, and it was right.**

That's the bar. Everything in product, engineering, AI, and QA serves that one sentence.

Everything else is theatre.
