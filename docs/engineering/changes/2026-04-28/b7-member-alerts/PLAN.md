# Plan: B7 — Member alerts (out-of-range + repeat-test reminders)
**Date:** 2026-04-28
**Phase:** Epic 8 (The Living Record), pre-approved sprint-1 stretch
**Status:** Draft

## Objective

Ship the alerting layer that closes the "what should I notice?" loop opened by B4 (`/labs`) and B5 (`/trends`). Concretely:

1. A new `public.member_alerts` table (append-mostly; `status` mutable for dismiss/resolve) with owner-select + owner-dismiss RLS.
2. A pure helper `evaluateLabAlerts(rows)` that flags `low`, `high`, and `critical` lab readings into alert objects.
3. A daily cron route at `/api/cron/repeat-tests` that reads each user's most recent `risk_scores.recommended_screenings` and emits `repeat_test` alerts when no `lab_results` row of that screening type has landed in the last 12 months.
4. A dashboard hero chip that shows the most recent **open** alert with a `Dismiss` button (server action) and a `View →` link.
5. A "hook point" inside the upload flow that calls `evaluateLabAlerts` against the user's lab rows after each successful upload — defensive against the current reality (Janet does not yet write to `lab_results`); the moment a Janet → `lab_results` converter lands, lab alerts will fire automatically with no further code change.

Done = an authenticated member with at least one `recommended_screening` that has no matching recent lab row sees a chip on `/dashboard` after the cron runs; the same surface displays lab-out-of-range alerts the moment lab data is written.

## Scope

**In scope:**
- Migration `0031_member_alerts.sql` (table + RLS + unique partial index for de-dupe + index on `(user_uuid, status)`).
- `lib/alerts/` pure helpers (`evaluateLabAlerts`, `evaluateRepeatTests`, `formatAlertChip`).
- `app/api/cron/repeat-tests/route.ts` — secured by `x-pipeline-secret`, idempotent insert.
- `app/(app)/dashboard/_actions/dismiss-alert.ts` (or co-located in `app/(app)/dashboard/actions.ts`) — dismiss server action.
- Dashboard hero chip (above today-strip; small, dismissable).
- Tests for both helpers + the route handler's pure parts.
- One alert-helper hook in the upload-action flow (defensive — runs on best-effort, never blocks the upload response).
- Out-of-range tones: `low`, `high`, `critical` (not `borderline`, not `optimal`).

**Out of scope:**
- Janet → `lab_results` converter. **This is the largest known follow-up** — without it, lab alerts will not fire today. Tracked separately.
- Push / SMS / email delivery of alerts (in-app chip only).
- Per-alert triage page (`/alerts` index). Defer.
- Auto-resolve when the next lab reading is back in range. Ship dismiss-only first; auto-resolve in a follow-up.
- Clinician-facing alert surfaces.
- Internationalisation of alert body strings.
- Migration renumber cleanup (the cosmetic 0025/0026 collisions remain).

## Data model changes

**New table** `public.member_alerts`. All non-PII (no name, no DOB, no phone). Columns:

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK default gen_random_uuid() | |
| `user_uuid` | uuid not null FK → `auth.users(id)` on delete cascade | RLS predicate |
| `alert_type` | text not null check `('lab_out_of_range', 'repeat_test')` | enum-like |
| `severity` | text not null check `('info', 'attention', 'urgent')` | UI tone |
| `source_id` | text not null | for lab alerts: biomarker name; for repeat-test: screening string. Used in the unique partial index for de-dupe. |
| `title` | text not null | one-line headline e.g. "LDL is in the high range" |
| `body` | text not null | one-sentence body |
| `link_href` | text | optional URL for the chip's "View →" |
| `status` | text not null default `'open'` check `('open', 'dismissed', 'resolved')` | mutable |
| `created_at` | timestamptz default now() | |
| `dismissed_at` | timestamptz | set when status=dismissed |
| `resolved_at` | timestamptz | reserved for future auto-resolve |

**Indexes:**
- `member_alerts_user_status_idx` on `(user_uuid, status, created_at desc)` — drives the dashboard query.
- `member_alerts_open_unique_partial` UNIQUE on `(user_uuid, alert_type, source_id) where status = 'open'` — enforces de-dupe at the DB so re-running the cron is idempotent.

**RLS:**
- `member_alerts_owner_select` — `for select to authenticated using (auth.uid() = user_uuid)`.
- `member_alerts_owner_update` — `for update to authenticated using (auth.uid() = user_uuid) with check (auth.uid() = user_uuid)` — gates dismiss to the owner.
- No insert policy. **Service-role-only insert** (cron + upload-flow helper use the admin client). Same pattern as `export_log`.

**Single-writer principle (data-management Rule 4):**
- Inserts: cron route + post-upload helper (both via admin client).
- Updates: owner dismiss server action only (`status` field). One column, one writer; acceptable.

## Tasks

Two tasks, sequential. Task 1 = migration + helpers + types. Task 2 = cron route + upload-flow hook + dashboard chip + dismiss action + UI.

---

### Task 1 — Migration `0031` + `lib/alerts/` helpers

**Files affected:**
- `supabase/migrations/0031_member_alerts.sql` (new).
- `lib/alerts/index.ts` (new — re-exports).
- `lib/alerts/types.ts` (new — re-exports `MemberAlertRow` once types are regenerated; until then the helper accepts a structurally typed input).
- `lib/alerts/evaluate-lab-alerts.ts` (new).
- `lib/alerts/evaluate-repeat-tests.ts` (new).
- `lib/alerts/format-alert.ts` (new — `chipPayload(alert)`).
- `tests/unit/alerts/evaluate-lab-alerts.test.ts` (new).
- `tests/unit/alerts/evaluate-repeat-tests.test.ts` (new).
- `tests/unit/alerts/format-alert.test.ts` (new).

**What to build:**

#### Migration `0031_member_alerts.sql`

Full contents (idempotent, RLS, indexes):

```sql
-- 0031_member_alerts.sql
-- In-app alerts surface. Append-mostly; status mutates on dismiss.
-- Inserts: service-role (cron + post-upload helper). Updates: owner only.

create table if not exists public.member_alerts (
  id            uuid primary key default gen_random_uuid(),
  user_uuid     uuid not null references auth.users(id) on delete cascade,
  alert_type    text not null check (alert_type in ('lab_out_of_range', 'repeat_test')),
  severity      text not null check (severity in ('info', 'attention', 'urgent')),
  source_id     text not null,
  title         text not null,
  body          text not null,
  link_href     text,
  status        text not null default 'open' check (status in ('open', 'dismissed', 'resolved')),
  created_at    timestamptz not null default now(),
  dismissed_at  timestamptz,
  resolved_at   timestamptz
);

alter table public.member_alerts enable row level security;

drop policy if exists "member_alerts_owner_select" on public.member_alerts;
create policy "member_alerts_owner_select" on public.member_alerts
  for select to authenticated using (auth.uid() = user_uuid);

drop policy if exists "member_alerts_owner_update" on public.member_alerts;
create policy "member_alerts_owner_update" on public.member_alerts
  for update to authenticated
  using (auth.uid() = user_uuid)
  with check (auth.uid() = user_uuid);

-- No insert policy: service-role-only insert via admin client.

create index if not exists member_alerts_user_status_idx
  on public.member_alerts(user_uuid, status, created_at desc);

create unique index if not exists member_alerts_open_unique_partial
  on public.member_alerts(user_uuid, alert_type, source_id)
  where status = 'open';
```

#### `lib/alerts/evaluate-lab-alerts.ts`

```ts
import type { LabRow } from "@/lib/labs";

export type AlertSeverity = "info" | "attention" | "urgent";

export type AlertDraft = {
  alert_type: "lab_out_of_range" | "repeat_test";
  severity: AlertSeverity;
  source_id: string;
  title: string;
  body: string;
  link_href: string | null;
};

export function evaluateLabAlerts(rows: LabRow[]): AlertDraft[];
```

Rules:
- Group by `biomarker`; pick latest by `test_date`.
- Skip rows where `status` is `null`, `optimal`, or `borderline`.
- For `low`: severity `attention`, title `${biomarker} is below the reference range`, body `Your latest ${biomarker} reading is ${value} ${unit} (range ${formatRange(...)}). Consider a follow-up panel.`, link `/labs/${encodeURIComponent(biomarker)}`.
- For `high`: severity `attention`, similar wording.
- For `critical`: severity `urgent`, body adds "Speak with your clinician.".
- `source_id` is the **biomarker name** verbatim.
- Pure function — no DB calls.

#### `lib/alerts/evaluate-repeat-tests.ts`

```ts
export type RepeatTestInputs = {
  recommendedScreenings: string[];
  recentLabBiomarkers: string[]; // unique biomarker names with a row in last 12 months
  // The mapping from screening name → biomarker names is heuristic. See body.
};

export function evaluateRepeatTests(inputs: RepeatTestInputs): AlertDraft[];
```

Rules:
- For each item in `recommendedScreenings`:
  - Lowercase + tokenise both the screening string and `recentLabBiomarkers`.
  - If any biomarker token contains a meaningful keyword from the screening (e.g. screening `"thyroid panel"` → biomarker contains `thyroid`/`tsh`/`t3`/`t4`), consider it covered. Match list is a small const map inside the helper. (Imperfect; explicit comment that this is heuristic and improves with dedicated columns later.)
  - If not covered, emit an alert: severity `info`, title `You're due for ${screening}`, body `Atlas recommended ${screening}. We have no recent lab data on file for this. Upload a recent panel or book one with your GP.`, link `/uploads`.
- `source_id` is the screening string verbatim (lower-cased and trimmed for stability).
- Pure function — caller does the DB queries.

#### `lib/alerts/format-alert.ts`

`chipPayload(alert)` — picks the chip text, severity tone, and link; trivial. Used by the dashboard.

#### Tests

`evaluate-lab-alerts.test.ts` (≥ 6 cases):
1. Empty rows → `[]`.
2. One row with `status: "optimal"` → `[]` (suppressed).
3. One row with `status: "borderline"` → `[]` (suppressed).
4. One row with `status: "low"` → one `attention` alert.
5. Two rows for same biomarker, latest `optimal`, prior `high` → `[]` (only latest counts).
6. One row `critical` → one `urgent` alert with the right body wording.
7. (Extra) Two different biomarkers both `high` → two alerts.

`evaluate-repeat-tests.test.ts` (≥ 4 cases):
1. No recommended screenings → `[]`.
2. Screening `"thyroid panel"`, recent biomarkers include `"TSH"` → `[]` (covered).
3. Screening `"colonoscopy"`, no related biomarker → one `info` alert.
4. Screening `"lipid panel"`, recent biomarker `"LDL Cholesterol"` → `[]`.

`format-alert.test.ts` (≥ 2 cases): chipPayload returns expected shape for both alert types.

**Acceptance criteria:**
- `pnpm build` clean.
- `pnpm test` green; ≥ 12 new test cases under `tests/unit/alerts/`.
- Migration file written but **NOT applied** (operator step).
- Helpers exported from `lib/alerts/index.ts`.
- No `lab_results` writer required for tests — fixtures are inline.

**Rules to apply:**
- `.claude/rules/database.md` — idempotent migration, RLS, indexes, unique partial index.
- `.claude/rules/data-management.md` — single-writer principle (cron + upload helper insert; owner update only `status`).
- `.claude/rules/nextjs-conventions.md` — pure helpers in `lib/`.

---

### Task 2 — Cron route + upload-flow hook + dashboard chip + dismiss action

**Files affected:**
- `app/api/cron/repeat-tests/route.ts` (new — `POST` + `GET` for Vercel cron).
- `app/(app)/uploads/actions.ts` (modify — call `evaluateLabAlerts` post-upload, best-effort).
- `app/(app)/dashboard/page.tsx` (modify — fetch latest open alert; render chip when present).
- `app/(app)/dashboard/dashboard.css` (modify — chip styles for three severity tones).
- `app/(app)/dashboard/_actions/dismiss-alert.ts` (new — server action).
- `app/(app)/dashboard/_components/alert-chip.tsx` (new — client component because dismiss needs a button onClick → server action; alternatively a `<form action={dismissAlert}>` keeps it server-rendered — preferred).
- `tests/unit/alerts/repeat-tests-route.test.ts` (new — pure helper test for the cron route's selection + assemble logic).

**What to build:**

#### `app/api/cron/repeat-tests/route.ts`

```ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
```

- Auth: `x-pipeline-secret` header check. If missing or mismatched → 401. Same pattern as `app/api/cron/drip-emails/route.ts`.
- For each user with at least one `risk_scores` row and at least one entry in `risk_scores.recommended_screenings[0]` (latest by `computed_at`):
  - Read `recommended_screenings` (latest row).
  - Read distinct `biomarker` from `biomarkers.lab_results` for that user where `test_date >= now() - interval '12 months'`.
  - Pass both into `evaluateRepeatTests(...)`.
  - For each draft alert, `INSERT ... ON CONFLICT DO NOTHING` against `member_alerts` (the unique partial index makes this idempotent without re-querying).
- Use the **admin client** (cron context). Document at top of file with one-line comment.
- Wrap each user's evaluation in try/catch — one user's failure should not abort the batch.
- Return `{ scanned: N, emitted: M }` JSON.

Pure helper extracted: `selectUsersToScan(allRiskScores)` and `assembleAlertsForUser(user, screenings, biomarkers)` — both unit-testable.

Vercel cron config: register in `vercel.json` if a `crons` block exists; otherwise leave it for the operator and document in the handoff. (Don't invent a `vercel.json` if the project doesn't already have one for crons — check `vercel.json` first.)

#### Upload-flow hook

In `app/(app)/uploads/actions.ts`, after the existing `patient_uploads.update({ janet_status: 'done', janet_findings: ... })`, add:

```ts
// B7 alerts hook: evaluate lab alerts off the user's full row set.
// Best-effort — failure must not block the upload response.
try {
  const adminClient = createAdminClient(); // from "@/lib/supabase/admin"
  const { data: rows } = await adminClient
    .schema("biomarkers")
    .from("lab_results")
    .select("biomarker, value, unit, reference_min, reference_max, status, test_date")
    .eq("user_uuid", user.id);
  const drafts = evaluateLabAlerts((rows ?? []) as LabRow[]);
  if (drafts.length) {
    await adminClient.from("member_alerts").insert(
      drafts.map((d) => ({ ...d, user_uuid: user.id })),
      { onConflict: "ignore" }, // unique partial index does the work
    );
  }
} catch (err) {
  // swallow — alert evaluation must not break the upload flow
  console.error("[B7] alert evaluation failed:", err);
}
```

(Actual Supabase client doesn't expose `onConflict: 'ignore'`; instead use `.insert(...)` and rely on the unique partial index to throw a 23505 the executor catches per-row, or pre-filter against a `select` of existing open alerts. Executor's call. Document the choice in the handoff.)

**Defensive expectation:** today, `lab_results` is empty for most users. The helper returns `[]`, no inserts. When a Janet → `lab_results` writer is added later, alerts fire with no further code change.

#### Dashboard chip

In `app/(app)/dashboard/page.tsx`:
- Add a parallel query alongside the existing fetches: most-recent **open** alert.
  ```ts
  const { data: latestAlert } = await supabase
    .from("member_alerts")
    .select("id, alert_type, severity, title, body, link_href, created_at")
    .eq("user_uuid", user.id)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  ```
- When present, render `<AlertChip alert={latestAlert} />` directly under the hero summary line (above the today-strip).
- Chip layout: pill with severity-tone background, alert title, "View →" link to `link_href`, dismiss `<form>` posting to the dismiss server action.

#### Dismiss server action

```ts
// app/(app)/dashboard/_actions/dismiss-alert.ts
"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function dismissAlert(formData: FormData) {
  const id = String(formData.get("id"));
  if (!id) return;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("member_alerts")
    .update({ status: "dismissed", dismissed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_uuid", user.id); // RLS already enforces this; defensive
  revalidatePath("/dashboard");
}
```

Server action via `<form action={dismissAlert}>` — no client component needed.

#### CSS

Three severity tones: `info` (sage), `attention` (amber), `urgent` (red). Reuse tokens already in `dashboard.css` and `labs.css`. No new colour palette invented.

#### Tests

`repeat-tests-route.test.ts` — unit tests for the pure helpers extracted from the route:
1. `selectUsersToScan` returns latest risk_scores row per user.
2. `assembleAlertsForUser` returns expected drafts for canned input.

(Don't try to test the route handler with a mocked admin client end-to-end; pure-helper tests are the contract.)

**Acceptance criteria:**
- Migration file `0031_member_alerts.sql` is written and applied (operator does the apply via Supabase MCP after this change merges; the executor only writes the file).
- `/api/cron/repeat-tests` returns 401 without the secret header; returns `{ scanned, emitted }` JSON with the secret.
- Re-running the cron does not produce duplicate open alerts (unique partial index).
- Dashboard hero shows chip when at least one open alert exists; absent when none.
- Dismiss button changes status to `dismissed` and the chip disappears on next page load.
- Upload-flow hook does not affect upload response on alert-helper failure (verify by manually inducing an error in a smoke test, or document as deferred).
- `pnpm build` clean.
- `pnpm test` green.
- Total ≥ 14 new tests across alerts.

**Rules to apply:**
- `.claude/rules/security.md` — cron route gated by `x-pipeline-secret`; admin client only in cron + upload hook; dismiss action authenticates user.
- `.claude/rules/ai-agents.md` — pipeline worker pattern: idempotent, non-fatal, single write target.
- `.claude/rules/nextjs-conventions.md` — server action via `<form action>` so no client component needed; underscore-prefixed `_actions/` and `_components/` for any client component if added.
- `.claude/rules/data-management.md` — single-writer principle.

---

## Build order

Sequential. Task 1 must complete before Task 2 (Task 2 imports `evaluateLabAlerts`, `evaluateRepeatTests`, `chipPayload`).

## Per-task review gate

Spec compliance + code-quality reviews per task. Both must pass before marking complete.

## Definition of done (whole change)

1. Both tasks ✅ on both reviews.
2. `pnpm build` clean.
3. `pnpm test` green with ≥ 14 new tests under `tests/unit/alerts/`.
4. Migration `0031_member_alerts.sql` written (operator applies post-merge).
5. Manual: hit `/api/cron/repeat-tests` with the secret header — get a JSON response, no 500.
6. Manual: with a member who has both a relevant risk_scores row and a missing screening, see an alert chip on `/dashboard`.
7. Manual: dismiss button removes the chip.
8. CHANGELOG, EXECUTIVE_SUMMARY, QA_REPORT present.
9. Operator follow-up tracked: apply migration `0031`; regenerate `lib/supabase/database.types.ts`.

## Plan-review addenda (post Phase 4)

The plan reviewer cleared APPROVED WITH NOTES. The following are mandatory for the executor:

1. **Cron auth: use the canonical pattern.** The route MUST gate on `Authorization: Bearer ${process.env.CRON_SECRET}`, not a custom `x-pipeline-secret` header. This matches `app/api/cron/drip-emails/route.ts` and `app/api/cron/nova/route.ts`. The plan text uses `x-pipeline-secret` in places — treat the canonical pattern as authoritative. Vercel cron sets the `Authorization` header automatically when `CRON_SECRET` is set. If the secret env var is unset, follow the same `if (secret && ...)` guard the existing routes use (i.e. don't crash; let it through in dev).

2. **Whole-token matching in `evaluateRepeatTests`.** Do NOT use `String.includes` on lowercased strings — it false-positives (`"lipid panel"` matching `"apolipoprotein b"` because of the `"lipo"` substring). Tokenise both the screening string and each biomarker name on whitespace + punctuation; only count a match when at least one whole token from the screening's keyword set appears as a whole token in any recent biomarker name. Helper internal map lives close to the function for review.

3. **Normalise and dedupe `recommended_screenings` before evaluation.** Atlas may emit `"Lipid panel"` and `"lipid panel"` independently; the helper should receive a `Set` of trimmed, lowercased screening names. The cron route does this normalisation before calling `evaluateRepeatTests`.

4. **Deterministic conflict handling on insert.** Do NOT rely on a Supabase `onConflict: 'ignore'` option — it is not a real API. Instead, **pre-filter in JS**: before inserting drafts, query the user's existing **open** rows for the relevant `(alert_type, source_id)` tuples and skip drafts that already have an open match. The unique partial index is the safety net; the pre-filter keeps the happy path deterministic across pg drivers and avoids 23505 noise in logs.

### Minor refinements

- **Severity tiebreak in `evaluateLabAlerts`.** Sort each biomarker's rows by `(test_date desc, id desc)` before picking the latest, so two same-day rows with different statuses produce a stable answer.
- **Dismiss/re-emit semantics.** A row dismissed today CAN be re-surfaced by a future cron run (the unique partial index only blocks new `open` rows when an existing `open` row is present). This is **intended** — a still-relevant screening recommendation should re-surface — but flag it in the changelog so a reviewer doesn't read it as a bug. A "snooze for N days" mechanism is a deferred follow-up.
- **Cron scaling note.** A naive sequential loop over all users can exceed Vercel's function timeout. The route MAY iterate sequentially for the first ship (data volume is small today) but the executor should add a top-of-file comment noting that chunking via `Promise.all` with a concurrency cap is the next step when user count grows.

## Out of scope (carried forward + reality flags)

- **Janet → `lab_results` writer** — without this, lab-out-of-range alerts cannot fire today. The hook is wired and ready; it's a no-op on empty data. Tracked as the **single most important follow-up** for B7's full value.
- Push / SMS / email delivery.
- `/alerts` index / triage page.
- Auto-resolve when next reading is back in range.
- Clinician alert surfaces.
- Migration renumber cleanup (cosmetic 0025/0026 collisions).
- Borderline-tone alerts (deliberately suppressed for noise control).
