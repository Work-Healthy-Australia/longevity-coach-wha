# Monday 2026-05-04 Ship Plan

The plan for getting from Saturday night 2026-05-02 to a stable production deploy on Monday morning. Treat as a working document — tick items as you go.

**Owner:** James Murray
**Target:** Production deploy live and stable by Monday 2026-05-04 09:00 AEST
**Working time available:** ~20h active (Sat night → Sun all day → Mon AM), assuming 8h sleep × 2 nights

---

## TL;DR — what ships, what gets cut

| Decision | What | Why |
|---|---|---|
| **SHIPS** | All 12 PRs from today (#113–#124) | Front-door regulatory fixes + PII security + Stripe payment path. Can't be on prod broken. |
| **SHIPS** | Role system foundation | If locally verified on the M5. Purely additive, low risk. |
| **SHIPS** | Real Privacy + Terms pages OR `mailto:` fallback for footer links | Privacy Policy is mandatory under Privacy Act 1988. Cannot be `#`. |
| **SHIPS** | CI re-enabled (at minimum: lint + typecheck) | Without it every merge ships blind. |
| **NICE** | RLS rewrites (0069) | Depends on role foundation merging early Sunday. Defer if tight. |
| **NICE** | Super Admin assignment UI | Gates on RLS. Can do role grants via SQL until shipped. |
| **NICE** | BUG-018 + BUG-024 (login redirect) | P1 but not show-stopper. Annoying, not breaking. |
| **CUT** | Phase B Role Builder | Was always Phase B. |
| **CUT** | BUG-021/022 (team page h1, portrait photo) | Need design + content decisions, not engineering. |

---

## Time-blocked schedule

### Saturday 2026-05-02 — tonight (now → midnight)

- [x] Setup checklist written (PR [#115](https://github.com/Work-Healthy-Australia/longevity-coach-wha/pull/115))
- [x] User testing checklist written (PR [#120](https://github.com/Work-Healthy-Australia/longevity-coach-wha/pull/120))
- [x] 11 P-bugs closed across 12 PRs ([#113](https://github.com/Work-Healthy-Australia/longevity-coach-wha/pull/113)–[#124](https://github.com/Work-Healthy-Australia/longevity-coach-wha/pull/124))
- [ ] M5 OS update finishes
- [ ] Optional if you have energy: setup steps 1–6 (system settings, Xcode CLT, Homebrew, shell). Save Docker + Supabase for tomorrow when fresh.

### Sunday 2026-05-03 morning (07:00 → 12:00)

| Block | Action | Time |
|---|---|---|
| 07:00 | Wake, coffee | — |
| 07:30 | New MBP setup steps 7–17 ([new-mac-setup.md](docs/engineering/setup/new-mac-setup.md)) | 90 min |
| 09:00 | Verify `supabase start` succeeds locally | 10 min |
| 09:10 | **Merge PR [#114](https://github.com/Work-Healthy-Australia/longevity-coach-wha/pull/114)** (pgvector) — first | 5 min |
| 09:15 | `supabase db reset` to confirm 0015b applies | 5 min |
| 09:20 | **Merge PR [#113](https://github.com/Work-Healthy-Australia/longevity-coach-wha/pull/113)** (role system) | 10 min |
| 09:30 | `supabase db reset`, run role system smoke tests from PR body | 30 min |
| 10:00 | Bootstrap yourself as super_admin via SQL (see PR #113 body) | 5 min |
| 10:05 | Merge PRs [#115](https://github.com/Work-Healthy-Australia/longevity-coach-wha/pull/115)–[#119](https://github.com/Work-Healthy-Australia/longevity-coach-wha/pull/119) (5 PRs in any order) | 30 min |
| 10:35 | Merge PRs [#120](https://github.com/Work-Healthy-Australia/longevity-coach-wha/pull/120)–[#124](https://github.com/Work-Healthy-Australia/longevity-coach-wha/pull/124) | 30 min |
| 11:05 | Verify Vercel production auto-deploy succeeded | 10 min |
| 11:15 | Walk testing checklist sections 1, 2 ([smoke]) on prod | 30 min |
| 11:45 | Lunch | 30 min |

### Sunday 2026-05-03 afternoon (12:30 → 18:30)

| Block | Action | Time |
|---|---|---|
| 12:30 | Tackle CI (Epic 14): read each failing job log, identify root cause | 60 min |
| 13:30 | Fix lint + typecheck minimum-viable to get checks green | 90 min |
| 15:00 | **Decision:** RLS rewrites (0069) attempt today? If yes, kick off dev-loop | 5 min |
| 15:05 | If yes — RLS dev-loop in background while you work on next items | (in parallel) |
| 15:05 | BUG-016 decision + execution: ship real Privacy/Terms OR replace footer dead links with `mailto:legal@janet.care` | 60 min |
| 16:05 | Walk testing checklist sections 3, 4, 5 ([smoke]) | 45 min |
| 16:50 | Walk testing checklist sections 6, 7 ([smoke]) | 30 min |
| 17:20 | Walk testing checklist sections 10 (RLS isolation), 15 (regulatory) | 45 min |
| 18:05 | Triage anything that failed | flexible |

### Sunday 2026-05-03 evening (18:30 → 22:00)

| Block | Action | Time |
|---|---|---|
| 18:30 | Dinner | 60 min |
| 19:30 | If RLS rewrites finished by dev-loop — review and merge | 60 min |
| 20:30 | Final smoke pass on Vercel preview using [smoke] subset of checklist | 45 min |
| 21:15 | Update `docs/product/epic-status.md` with what shipped | 30 min |
| 21:45 | **Stop.** Sleep before launch morning. | — |

### Monday 2026-05-04 AM (07:00 → 09:00)

| Block | Action | Time |
|---|---|---|
| 07:00 | Wake, coffee, check Vercel deploy is still green | 15 min |
| 07:15 | Final preview check: home, signup, pricing, /report, Janet chat, Stripe checkout | 30 min |
| 07:45 | Verify Sentry baseline error rate, no spikes overnight | 10 min |
| 07:55 | **Run the [smoke] subset of the testing checklist on production** | 45 min |
| 08:40 | Go / no-go decision against ship criteria below | 5 min |
| 08:45 | If GO: announce internally / to first members | 15 min |
| 09:00 | Watch logs and Sentry for the first hour | 60 min |

---

## Ship criteria (Monday AM go/no-go)

**ALL must be true before announcing.** If any is false, do not ship until resolved.

- [ ] All 12 today's PRs merged to `main` and deployed to production via Vercel
- [ ] Production deploy is healthy (Vercel dashboard green for at least 30 min)
- [ ] Role system foundation (#113) verified locally and merged — OR explicitly deferred with documented reason
- [ ] User testing checklist sections 1, 2, 3, 4, 5, 10, 15 ALL pass [smoke] (the critical path + RLS isolation + regulatory)
- [ ] No P0 bugs open in `docs/qa/QA-bugs.md`
- [ ] BUG-016 (footer dead links) — Privacy + Terms either real pages OR replaced with `mailto:` fallback
- [ ] No console errors on production homepage in Chrome / Safari / Firefox
- [ ] Stripe checkout end-to-end test with `4242` card succeeds, redirects to `/dashboard`, subscription state updates within 30s
- [ ] Sentry shows baseline error rate, no recent spikes
- [ ] No PII in any production logs (`vercel logs --since 1h | grep -iE "email|dob|address|phone"` returns empty)

---

## Risk register

| # | Risk | Probability | Impact | Mitigation |
|---|---|---|---|---|
| R1 | New MBP setup hits problems beyond the doc | Medium | High (blocks role-system verification) | Setup doc has verify steps; iCloud Photos Optimise enabled day 1 (no repeat of disk-full) |
| R2 | `supabase start` still fails after pgvector fix | Low | Medium (delays #113 verification) | If fails, can verify via Vercel preview deploy of #114 instead of local |
| R3 | Role system migration fails on prod | Low | High (rollback) | Migration is purely additive + idempotent. `if not exists` + `create or replace` everywhere. Reverting 0068 is a delete of the new tables, no data loss for existing tables |
| R4 | CI fixes uncover deeper issues | Medium | Low (don't block ship on CI) | Don't gate ship on CI. Gate on Vercel preview + manual checklist |
| R5 | BUG-016 not closed before ship | Medium | High (regulatory) | Minimum viable: replace `#` hrefs with `mailto:legal@janet.care` (15 min) |
| R6 | Stripe webhook drops events at low traffic | Low | Medium | Existing event log catches retries; Stripe auto-retries 3 days |
| R7 | Janet chat performance degrades under first-day load | Low | Medium | Latency benchmarks in place; cost dashboard will show if usage spikes |
| R8 | One of today's 12 PRs introduces a regression visible only on prod | Medium | Medium | Each PR small + isolated; rollback by reverting individual commit |
| R9 | Disk-full incident on the M5 mid-Sunday | Very low | High | Setup doc enables iCloud Photos Optimise + Time Machine on external drive from day 1 |
| R10 | Real Privacy Policy needs legal review (not just engineering) | Medium | High | If legal counsel unavailable Sunday: hide the link rather than ship un-reviewed legal copy. The `mailto:` fallback is defensible |

---

## What "shipping" actually means

Be precise:

- "Live" = Vercel production deploy successful, latest commit on main is what's serving traffic
- "Stable" = no Sentry spikes for 1 hour after deploy
- "Announce" = only after stable check passes

Do NOT make external announcements before the 1h stability check completes. Better to ship at 09:00 silent, announce at 10:00 confident, than ship loud at 08:00 and walk back errors at 08:30.

---

## What gets done after Monday (the v1.1 backlog)

Cut from Monday but immediately on the queue:

1. **Phase B Role Builder** (Super Admin can define roles + permissions in UI)
2. **Super Admin assignment UI** at `/admin/users` (if not done Sunday)
3. **RLS rewrites (0069)** to route all patient-data tables through the role helpers (if not done Sunday)
4. **BUG-018 / BUG-024** (login redirect preservation across all guarded routes) — careful E2E testing
5. **BUG-021** (team + stories pages h1) — needs copy decision
6. **BUG-022** (team page portrait) — needs photo or design decision
7. **Re-enable full CI suite** (Gitleaks, pgTAP RLS regression, E2E tests, Lighthouse) — beyond minimum lint+typecheck
8. **Privacy + Terms** as proper pages (if shipped as `mailto:` fallback for Monday)
9. **Seed `billing.plans`** so the pricing page renders real plans (BUG-014 root cause)

Estimate for v1.1: ~5 working days.

---

## Daily summary template (for after each day)

Use this at the end of Sunday and end of Monday for a quick "what shipped, what didn't" log.

```
Date: ____________
Time worked: ____________
Shipped:
  -
  -
Did not ship:
  -
Blockers hit:
  -
Decisions made:
  -
What to do tomorrow:
  -
```

---

## Communication

If you need to tell anyone something:

- **Team / clinicians** — wait until ship is stable + announced
- **Existing members** — no notification needed (changes are mostly defects, not features)
- **AHPRA / regulatory** — no notification triggered by these changes
- **Press / external** — not yet
- **Investors / board** — your call; "v1 production-stable" is a reasonable milestone to mention

---

**Last update:** 2026-05-02 evening, after a day of disk drama, 12 PRs shipped, role system foundation in PR review.
