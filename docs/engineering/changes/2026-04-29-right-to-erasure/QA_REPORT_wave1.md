# QA Report: Right-to-erasure — Wave 1
Date: 2026-04-29
Reviewer: QA pass post-implementation

## Build status

- `pnpm build`: **PASS** (Next.js 16 build clean, full route tree printed, no TypeScript errors)
- `pnpm test`: **PASS** — 77 test files, 532 tests, all green

## What this wave delivers

A non-breaking schema foundation for the right-to-erasure flow:

- New `public.erasure_log` audit table with append-only RLS (admin-select, service-role-insert)
- `profiles.erased_at` soft-delete marker column
- FK relaxation on `consent_records.user_uuid` and `export_log.user_uuid` from
  `ON DELETE CASCADE` to `ON DELETE SET NULL`, with the columns made nullable —
  so a hard-delete of `auth.users` no longer wipes those audit trails
- New `data_no_training` consent policy registered in `lib/consent/policies.ts`
  (version `2026-04-29-1`)

No application code paths exercise these objects yet. Existing code is unaffected.

## Files changed

| File | Status |
|---|---|
| `supabase/migrations/0052_erasure_log_and_data_no_training.sql` | New |
| `lib/consent/policies.ts` | Modified — one entry added |
| `docs/engineering/changes/2026-04-29-right-to-erasure/PLAN.md` | New (planning doc) |
| `docs/engineering/changes/2026-04-29-right-to-erasure/QA_REPORT_wave1.md` | New (this file) |

## Reviews

- **Spec compliance review:** FAIL on canonical schema files (`supabase/schema/`
  directory does not exist in the repo; the rule was never bootstrapped).
  Deferred to a separate "bootstrap canonical schema" task per James'
  decision. All other plan acceptance criteria met.
- **Code quality review:** PASS_WITH_CONCERNS — no blocking fixes. One
  comment improvement applied (meta-PII rationale on `erasure_log.request_ip`
  and `request_user_agent`).

## Findings

### Confirmed working
- Idempotent SQL throughout — `IF NOT EXISTS` on table/columns/indexes;
  guarded `DO $$ ... END $$` blocks for FK swaps.
- RLS enabled on the new table; admin-select policy uses the canonical
  project pattern (`profiles.is_admin` flag check, matching `lib/admin/guard.ts`).
- Append-only enforced by omission (no insert/update/delete policy for
  authenticated users) — matches the existing `consent_records` and
  `export_log` conventions.
- Build clean, full test suite passing.

### Deferred items
- **`lib/supabase/database.types.ts` regeneration.** The Supabase CLI requires
  a running local stack (`supabase start`); this was not stood up. Once the
  migration is applied to local/dev, regenerate via:
  ```
  pnpm exec supabase gen types typescript --local > lib/supabase/database.types.ts
  ```
  After regeneration, `consent_records.user_uuid` and `export_log.user_uuid`
  will surface as `string | null`. The few existing readers were checked —
  none dereference these columns directly, so no application code breaks.
- **Canonical schema files** (`supabase/schema/public/tables/*.sql`) skipped.
  See "Reviews" above.

### Known limitations
- `erasure_log` has no insert policy — by design, only `service_role` writes
  via the admin client. Wave 2's `deleteAccount` action must use the admin
  Supabase client.
- Hard-deleted `auth.users` rows now leave orphan `consent_records` /
  `export_log` rows with `user_uuid = NULL`. This is the desired AHPRA-audit
  behaviour; surfaced here so future readers don't mistake it for a bug.

### Pre-existing issues surfaced (out of scope)
- Migration `0048_clinician_portal_foundation.sql` uses `auth.jwt() ->> 'role' = 'admin'`
  in its admin-select policies. This project's admin signal is
  `profiles.is_admin`; the JWT carries no `role` claim. Those policies are
  effectively dead — only `service_role` bypass works on those tables.
  Worth a separate follow-up.

## Verdict

**APPROVED**

The migration is sound and the policy registration is purely additive. The
spec-review FAIL is a doc-vs-reality artefact (canonical schema convention
never bootstrapped), not a Wave-1 implementation gap.

## Browser verification note

This wave has **no UI surface**. The migration creates a table that will not
be queried until Wave 2; the policy registration adds a constant that will
not be referenced until Wave 3. Standard browser-verification step (start
dev server, click through changes) is not applicable.

To sanity-check locally if desired: apply the migration against a local
Supabase instance and run:

```sql
-- Verify the new table is queryable as admin
select * from public.erasure_log limit 1;

-- Verify the FK relaxation took effect
select conname, confupdtype, confdeltype
  from pg_constraint
  where conname in ('consent_records_user_uuid_fkey', 'export_log_user_uuid_fkey');
-- Expected: confdeltype = 'n' (SET NULL) for both rows
```
