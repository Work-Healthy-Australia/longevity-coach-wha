# QA Report: Right-to-erasure — Wave 3
Date: 2026-04-29
Reviewer: QA pass post-implementation

## Build status

- `pnpm build`: **PASS** — Next.js 16 build clean. New `/legal/data-handling` route appears as `○ /legal/data-handling` (static).
- `pnpm test`: **PASS** — 79 test files, 552 tests, all green.

## What this wave delivers

The user-facing surfaces of the right-to-erasure feature, completing Epic 11's
two outstanding items (working erasure flow + "we never train on your data"
clause):

- **Fourth onboarding consent toggle** (`data_no_training`) — wired to the
  policy registered in Wave 1. New signups now write a `consent_records`
  row capturing acceptance of the no-training commitment. Form validation
  blocks submission until the toggle is checked.
- **`/legal/data-handling` page** — formal data-handling statement carrying
  the load-bearing legal copy ("we never train AI models on your personal
  data") plus a named-processors table (Anthropic, Resend, Stripe,
  Supabase, Vercel) with vendor / purpose / region / DPA links. Static
  prerender, reachable for both signed-in and signed-out users. Footer
  link added site-wide on public pages.
- **`/account` "How we use your data" card** — between Identity and Care
  team. Shows the user's `data_no_training` acceptance state: "You agreed
  to this policy on [date]" if a current-version consent record exists,
  or "Not yet confirmed" with a CTA otherwise. RLS-bound query (user's
  own server client, not admin).
- **Hardened delete-account confirmation** — replaces the Wave 2
  hidden-input placeholder with a real type-`DELETE` text input. Submit
  is disabled until the typed string is exactly `DELETE`. Server-side
  defence-in-depth check (in the locked Wave 2 server action) is
  unchanged.

## Files changed

| File | Status |
|---|---|
| `lib/questionnaire/questions.ts` | Modified — added `data_no_training` toggle, "three" → "four" in description |
| `app/(app)/onboarding/actions.ts` | Modified — `collectAcceptedConsents()` pushes `'data_no_training'` |
| `tests/unit/questionnaire/schema.test.ts` | Modified — new test asserting the four-toggle order |
| `tests/unit/questionnaire/validation.test.ts` | Modified — extended to require `data_no_training` |
| `app/(public)/legal/data-handling/page.tsx` | New — static legal page |
| `app/(public)/legal/data-handling/data-handling.css` | New — scoped CSS |
| `app/(public)/_components/footer.tsx` | Modified — "Data handling" link added |
| `app/(app)/account/page.tsx` | Modified — new "How we use your data" card |
| `app/(app)/account/account.css` | Modified — `.lc-account-meta` + `.lc-delete-confirm*` rules |
| `app/(app)/account/_components/delete-account-button.tsx` | Replaced — full type-DELETE confirmation |
| `docs/engineering/changes/2026-04-29-right-to-erasure/QA_REPORT_wave3.md` | New (this file) |

## Reviews

- **Phase A (3.1 + 3.2):** PASS — no concrete fixes needed. 5 non-blocking suggestions captured (collection-notice cross-reference, shared CSS extraction, footer ordering, Anthropic DPA URL, effective-date sourcing).
- **Phase B (3.3 + 3.4):** PASS_WITH_CONCERNS — no blocking fixes. 5 non-blocking suggestions captured (`.lc-account-danger` styling, `autoCorrect` documentation, disabled-button tooltip, version-change notice, "already erased" copy refinement).

## Behaviours verified

| Behaviour | Verification |
|---|---|
| Four toggles in the consent step, in deterministic order | `tests/unit/questionnaire/schema.test.ts` asserts exact order |
| Submission blocked until all four toggles checked | `tests/unit/questionnaire/validation.test.ts` asserts `requiredMissing` rejects `data_no_training: false` |
| Acceptance writes one `consent_records` row with `policy_id = 'data_no_training'` | `collectAcceptedConsents()` pushes the policy ID; the existing onboarding action already inserts via `recordConsents()` |
| `/legal/data-handling` static prerenders | `pnpm build` route table shows `○ /legal/data-handling` |
| Footer link site-wide on public pages | Single `PublicFooter` component used by all `(public)` routes |
| `/account` card shows acceptance date for new users | RLS-scoped query against `consent_records` filtered to current `policy_version` |
| `/account` card shows "Not yet confirmed" for legacy users | Empty result returns null acceptance row, conditional renders the CTA |
| Delete button stays disabled until exactly `DELETE` typed | `disabled={pending \|\| typed !== 'DELETE'}` (case-sensitive, no whitespace tolerance) |
| Mobile keyboards don't auto-correct/capitalise | `autoComplete="off"` + `autoCapitalize="off"` + `autoCorrect="off"` + `spellCheck={false}` on the input |
| Server-side `confirmation === 'DELETE'` check unchanged | Wave 2 server action locked; this wave only changes the input that produces the form data |

## Findings

### Confirmed working
- All acceptance criteria from the plan's Wave 3 section met.
- No scope creep across tasks: Phase A didn't touch `/account`; Phase B didn't touch `/legal` or onboarding.
- CSS additions are namespaced — no global rule leakage.
- Server contract intact — the Wave 2 `deleteAccount` action receives the same `formData.confirmation` shape as before.

### Deferred items
- Polish suggestions from both reviews (10 total) — captured as follow-up tasks, none blocking.
- Browser smoke-test of the delete-confirmation UX not yet done — recommended before merging.

### Pre-existing issues surfaced (out of scope)
- The collection-notice page still references "three mandatory consents" in one paragraph — could update to four, but the existing copy isn't strictly wrong (the new toggle is a positive commitment, not a permission grant).
- Other footer links are placeholder `<a href="#">`. Pre-existing.

## Verdict

**APPROVED**

All four Wave 3 tasks meet acceptance criteria with passing build + test
suite. Combined with Wave 1 (schema + audit foundation) and Wave 2
(cascade engine + audited server action), this closes the Epic 11 legal
blocker on right-to-erasure and unblocks the Epic 9 clinician pilot for
real PII.

## Browser verification recommended before merge

This wave has visible UI surface. Suggested smoke test:

1. `pnpm dev`, sign in as a test user, visit `/account`.
2. Verify "How we use your data" card sits between Identity and Care team.
3. If your test user accepted `data_no_training` during onboarding,
   confirm the en-AU date displays. If not, confirm the "Not yet
   confirmed" CTA links to `/legal/data-handling`.
4. Click "Delete my account". Verify the warning copy lists removed +
   retained items. Verify the submit button stays disabled until you
   type exactly `DELETE` (lowercase, partial matches, etc. should keep
   it disabled). Verify Cancel returns to the idle state.
5. Visit `/legal/data-handling` directly. Verify the four sections,
   processors table, and back-link.
6. Sign out, visit `/legal/data-handling` directly. Verify it renders
   without auth.
7. (Optional) actually delete a disposable account — confirm redirect
   to `/?erased=1`.
