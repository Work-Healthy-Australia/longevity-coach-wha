# QA Report: Sprint 2 Engineering Completeness — Wave 1
Date: 2026-04-29
Reviewer: QA subagent

## Build status
pnpm build: PASS (39 routes compiled, 0 TypeScript errors)

## Checklist
| Item | Status | Notes |
|---|---|---|
| No migration prefix collisions | ✅ | Old 0031/0032 collision files absent; 0039/0040 present with correct SQL |
| CI playwright job | ✅ | `needs: [build]`, Chromium install, runs `pnpm exec playwright test` |
| CI lighthouse job | ✅ | `needs: [build]`, runs `pnpm exec lhci autorun` |
| .lighthouserc.json correct | ✅ | Targets `/`, `/dashboard`, `/report`; perf 0.8 warn, a11y 0.9 error, best-practices 0.9 error |
| vercel.json 3 crons | ✅ | nova, drip-emails, repeat-tests all present |
| PDF route auth check | ✅ | Returns 401 if no session before any DB query |
| PDF all sections present | ⚠️ | header/bio-age/domains/supplement/footer confirmed; "narrative" rendered as structured list — see findings |

## Findings

### Confirmed working

**W1-1 — Migration collision fix:** `0039_patient_uploads_file_hash.sql` and `0040_seed_admins.sql` present with correct SQL. Old collision files absent. No duplicate 4-digit prefixes.

**W1-3 — CI jobs:** Both `playwright` and `lighthouse` jobs correctly gated on `needs: [build]`. Playwright installs Chromium and passes Supabase env secrets. Lighthouse runs `lhci autorun` with correct config.

**W1-3 — `.lighthouserc.json`:** All three URLs targeted. Score thresholds match spec. `startServerCommand` configured for CI.

**W1-4 — `vercel.json` crons:** All three crons present at correct schedules.

**W1-2 — PDF route:** Auth guard returns 401 before any DB query. Parallel `Promise.all` for profile, risk scores, supplement plan. Handles legacy/new supplement field names. Returns correct `Content-Type: application/pdf`.

**W1-2 — PDF document sections:** Header (logo + title), bio-age hero banner, 5-domain tile grid with risk pills, supplement table (sorted by tier, 4 columns), AHPRA footer on every page. Graceful fallback when `engineOutput` is null.

### Open items (non-blocking)

**[MINOR] Narrative section:** The spec listed a "narrative section" for Atlas narrative text. Page 3 of the PDF renders the top modifiable risks as a structured numbered list — not a prose paragraph. A free-text LLM narrative requires the `risk_analyzer` pipeline (Phase 3 P2). Product owner to confirm whether the structured list satisfies the requirement or whether LLM narrative is deferred. No action needed before merge.

## Verdict
APPROVED — one non-blocking open clarification on narrative format.
