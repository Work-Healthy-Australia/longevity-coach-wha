# Technical Debt

Running ledger of known gaps, deferred work, and unfinished slices. Each entry names the slice, the gap, and the epic it belongs to.

When opening a follow-up PR that closes one of these items, delete the entry in the same commit.

---

## Deceased-flag flow (Epic 11 — Trust Layer)

Backend slice shipped 2026-04-30 (migration `0065_deceased_flag.sql`, admin server actions, `deceased_log` audit table). The following pieces are deliberately deferred:

- **Warm-copy UI flow.** Epic 11's outstanding item explicitly says the deceased flow needs a warm copy path (not a checkbox). The current admin surface is a button in `/admin/users/[id]/`. The human-facing flow — admin → support contact → family confirmation → soft transition copy — is unbuilt.
- **Proxy redirect for deceased users.** The migration comment promises that `proxy.ts` will check `deceased_at` and block access the same way it does for `paused_at`. As of the 0065 commit, [proxy.ts](../../lib/supabase/proxy.ts) does not reference `deceased_at` yet. Until it does, marking a member as deceased only stops the audit clock — they can still sign in.
- **Page wiring.** [app/(admin)/admin/users/[id]/page.tsx](../../app/<openparen>admin<closeparen>/admin/users/[id]/page.tsx) does not yet render the mark/unmark form that calls `markDeceased` / `unmarkDeceased`. The actions exist but no UI invokes them.
- **Build/typecheck not run** at the time the slice landed. Three files follow established patterns (Zod, `loose()`, erasure_log mirror) but `pnpm build` was deferred to the PR pipeline.
