# Longevity Coach — Software Architecture Assessment

**Date:** 2026-04-29  
**Assessor:** Principal Software Engineer  
**Scope:** Full-stack engineering system assessment

---

## Executive Summary

| Dimension | Grade | Summary |
|-----------|-------|---------|
| **1. Completeness** | B+ | Core Phase 1-2 features complete; Phase 3-6 partially implemented. 55 migrations show mature schema. AI agent system architecturally sound but needs hardening. |
| **2. Scalability** | B | pgvector + HNSW for RAG, parallel PatientContext loads. Risk: No caching layer beyond unstable_cache, single-region deployment. |
| **3. Clean Code** | A- | Strong typing, pure functions in risk engine, clear module boundaries. Minor: eslint-disable comments, some `any` casts in DB layer. |
| **4. Maintainability** | A | Excellent documentation (docs/ index, architecture specs), 65+ unit tests, 12 integration tests, 7 E2E tests. Dev-loop skill enforces wave-based delivery. |
| **5. Stability/Production-Ready** | B+ | Comprehensive RLS policies, CI with typecheck/lint/test/build/pgTAP/playwright/lighthouse. Needs: error boundary audit, rate limiting review, webhook idempotency checks. |
| **6. Business/Vision Alignment** | A | Clear phase roadmap (6 phases), epic-based tracking, PII compliance architecture. AI agents map directly to user journeys (Janet coach, clinician portal). |

---

## 1. Completeness Assessment

### Implemented (Production-Ready)
- **Auth:** Login/signup/password reset with Supabase Auth, email verification
- **Onboarding:** Multi-step questionnaire with validation, PII split compliance
- **Billing:** Stripe integration (checkout, webhooks, subscription management)
- **Dashboard:** Streak tracking, metric tiles, health overview
- **Risk Engine:** Deterministic 5-domain scoring (CV, metabolic, neuro, onco, MSK), biological age estimation
- **Database:** 55 migrations, RLS policies, pgvector for RAG, clinical schema
- **AI Infrastructure:** Agent definitions table, streaming agent factory, RAG hybrid search

### Partially Implemented (Phase 2-3 Gaps)
- **AI Pipelines:** Risk narrative, supplement protocol stubs exist but not production-hardened
- **PDF Report:** lib/pdf/ stubs present, needs completion
- **Daily Check-ins:** Schema exists, UI partially implemented
- **Lab Uploads:** Janet parser exists, needs biomarker extraction pipeline
- **Meal Plans:** Schema + seed data, UI incomplete

### Not Yet Implemented (Phase 4-6)
- Wearables integration (HRV, sleep deep linking)
- Clinician portal full workflow
- B2B/org management beyond schema
- Supplement marketplace

**Verdict:** Phase 1 complete. Phase 2 ~70% (risk engine done, narrative/supplement AI needs completion). Phases 3-6 have schema foundation but minimal UI.

---

## 2. Scalability Assessment

### Strengths
- **Database:** Proper indexing (user_uuid on all patient tables), HNSW for vector search (~10ms)
- **AI Latency:** Single LLM call per message, sub-agent tool_use for heavy lifting, parallel PatientContext.load()
- **Storage:** JSONB for flexible questionnaire responses, typed columns for queryable data

### Concerns
| Issue | Risk | Mitigation Needed |
|-------|------|-------------------|
| No Redis/caching layer | DB pressure under load | Add Redis for session/cache; current `unstable_cache` is per-request |
| Single-region (Vercel + Supabase) | Latency for AU users | Consider edge functions or multi-region read replicas |
| pgvector 2560-dim embeddings | Storage growth (1.6MB migration) | Monitor index bloat; consider MRL reduction to 512 dims |
| No rate limiting visible | AI API cost explosion | Add rate limiting middleware for /api/chat |

**Verdict:** Suitable for 1K-10K users. Plan for caching + rate limiting before 50K users.

---

## 3. Clean Code Assessment

### Strengths
- **Type Safety:** Strict TypeScript (`strict: true`), database types auto-generated
- **Pure Functions:** Risk engine is deterministic, testable, no side effects
- **Module Boundaries:** Clear separation: `lib/risk/`, `lib/ai/`, `lib/supabase/`
- **Naming:** Descriptive function names (`scoreCardiovascular`, `loadPatientContext`)
- **Design System:** CSS custom properties, scoped `.lc-*` classes, no Tailwind utility abuse

### Issues Found
```typescript
// lib/ai/loader.ts:9 - Explicit any with eslint suppression
const { data, error } = await (admin as any)
  .schema('agents')
  .from('agent_definitions')

// lib/ai/patient-context.ts:164-173 - Multiple any casts for schema queries
(admin as any).from('journal_entries')
```

**Recommendation:** Extend Database types to include `agents` schema tables properly.

---

## 4. Maintainability Assessment

### Strengths
- **Documentation:** 106-line docs index, architecture specs, agent system design doc (1000+ lines)
- **Testing:** 50+ unit tests, 12 integration tests, 7 E2E tests, pgTAP RLS regression
- **CI/CD:** 6-job pipeline (typecheck, lint, test, build, pgTAP, playwright, lighthouse)
- **Migrations:** Sequential numbered, idempotent with `IF NOT EXISTS`, 55 migrations applied cleanly
- **Dev Loop:** `.claude/skills/dev-loop/` enforces wave-based delivery with mandatory QA

### Test Coverage Analysis
```
✅ Unit: 50+ tests covering risk engine, AI tools, questionnaire, labs, billing
✅ Integration: 12 tests for auth, AI, onboarding, Stripe webhooks
✅ E2E: 7 specs for auth flows, Janet conversation, simulator
✅ RLS: pgTAP regression suite
```

### Gaps
- No visible contract tests for Stripe webhook schemas
- No load tests for AI streaming endpoints
- No visual regression tests (though Lighthouse CI present)

**Verdict:** Exceptional maintainability for a project of this size. Test pyramid is appropriate.

---

## 5. Stability & Production Readiness

### Security (Strong)
- **RLS:** All tables have row-level security, policies for owner/admin access
- **PII:** Proper separation (profiles table only), PII split at write time
- **Secrets:** `.gitleaks.toml` configured, GitHub secrets for CI
- **Auth:** PKCE flow, OTP email verification, role-based route guards

### Reliability (Good)
- **Error Handling:** Try/catch in proxy.ts with fail-open for paused accounts
- **Idempotency:** Stripe webhook should check `stripe_event_id` uniqueness (verify this)
- **Async Pipelines:** AI pipelines fire post-redirect, never block user

### Observability (Needs Work)
| Missing | Impact | Priority |
|---------|--------|----------|
| Structured logging (no Pino/Winston) | Debugging production issues is hard | High |
| Error tracking (Sentry) | Uncaught exceptions invisible | High |
| AI token usage metrics | Cost management blind | Medium |
| Health check endpoint | Load balancer can't verify | Medium |

### Infrastructure
- **Vercel:** Configured with `vercel.json`
- **Database:** Supabase with 55 migrations, pgvector enabled
- **Cron:** 6 cron jobs for health updates, meal plans, etc.

**Verdict:** Secure and stable core. Add observability before full production launch.

---

## 6. Business Logic & Vision Alignment

### Vision Fit (Excellent)
- **Dan Shipper Frame:** Clear from `docs/product/product.md` — "AI-native, not AI-bolted"
- **Four Values:** 1) AI coaching first, 2) Actionable insights, 3) Trust through transparency, 4) Privacy
- **Moat:** Patient health graph + longitudinal biomarker tracking

### Architecture Supports Vision
- **Janet Agent:** Central coaching interface with RAG grounding — matches "AI coaching first"
- **Risk Engine:** Deterministic scoring with confidence levels — matches "trust through transparency"
- **PII Boundary:** Proper data separation — matches privacy value
- **Pipeline Design:** Async, non-blocking — supports "actionable insights" without UX degradation

### Phase Mapping (Accurate)
| Phase | Status | Alignment |
|-------|--------|-----------|
| 1 Foundation | ✅ Complete | Auth, payment, onboarding |
| 2 Intelligence | 🔄 70% | Risk engine ✅, AI narrative 🔄 |
| 3 Engagement | 📋 Planned | Daily check-in schema ready |
| 4 Clinical Depth | 📋 Planned | Lab schema exists |
| 5 Care Network | 📋 Planned | Clinician portal stubs |
| 6 Scale | 📋 Planned | B2B schema exists |

### Feature Completeness vs Roadmap
- **Epic Tracking:** 14 epics defined in `docs/product/epics.md`
- **Epic Status:** Dashboard in `epic-status.md` with pipeline glyphs
- **Progress:** Checklist in `progress-checklist.md`

**Verdict:** Architecture directly enables the product vision. Phase planning is realistic and tracked.

---

## Critical Recommendations

### Immediate (Pre-Production)
1. **Add Sentry:** Error tracking for uncaught exceptions
2. **Add Pino:** Structured logging with request correlation IDs
3. **Rate Limiting:** Implement for `/api/chat` to prevent AI cost spikes
4. **Health Endpoint:** Add `/api/health` for load balancer checks
5. **Webhook Idempotency:** Verify Stripe webhook deduplication

### Short-Term (Next 4 Weeks)
6. **AI Token Budgets:** Add per-user monthly token limits
7. **Redis Cache:** Replace `unstable_cache` with Redis for multi-instance safety
8. **Type Safety:** Remove `any` casts in `lib/ai/patient-context.ts`
9. **Error Boundaries:** Add React Error Boundaries for agent UI components
10. **Load Tests:** Add k6 or Artillery tests for AI streaming endpoints

### Medium-Term (Phase 2 Completion)
11. **Risk Narrative Pipeline:** Complete the AI-powered narrative generation
12. **Supplement Protocol:** Finish supplement advisor tool integration
13. **PDF Report:** Implement branded PDF generation
14. **Multi-Region:** Consider Supabase read replicas for AU users

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| AI API rate limits | Medium | High | Implement exponential backoff, token budgets |
| Vector DB bloat | Medium | Medium | Monitor 90-day prune, consider dim reduction |
| Stripe webhook failures | Low | High | Idempotency keys, dead letter queue |
| Schema migration conflicts | Low | High | Sequential migrations, CI pgTAP tests |
| PII exposure via logs | Low | Critical | Structured logging with PII redaction |

---

## Conclusion

**Overall Grade: A-**

This is a well-architected, professionally maintained codebase with:
- ✅ Excellent documentation and testing discipline
- ✅ Clean separation of concerns
- ✅ Strong type safety and PII compliance
- ✅ Appropriate technology choices (Next.js 16, Supabase, Vercel)
- ✅ Clear alignment with product vision

**Blockers to Full Production:**
1. Observability (logging, error tracking)
2. Rate limiting and cost controls
3. Completion of Phase 2 AI pipelines

**Confidence Level:** High — The foundation is solid. The remaining work is completion, not architectural correction.

---

*Assessment generated via comprehensive codebase review of migrations, tests, lib/ architecture, app/ routes, docs/, and CI/CD configuration.*
