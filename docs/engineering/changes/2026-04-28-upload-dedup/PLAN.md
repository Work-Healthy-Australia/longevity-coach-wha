# Plan: Upload Deduplication
Date: 2026-04-28
Phase: 4 (Clinical Depth — patient upload portal quality)
Status: Approved (plan-reviewer 2026-04-28)
Phase note: Upload portal is an already-shipped early Phase 4 delivery. Deduplication is a quality improvement on shipped code, not new scope.

## Objective

Prevent a patient from uploading the same pathology file more than once. Duplicate detection uses a SHA-256 content hash computed client-side via the Web Crypto API before any storage write occurs. If the hash matches an existing upload for that user, the upload is aborted immediately and the UI shows a clear message including the original filename and the date it was first uploaded. A database unique index on `(user_uuid, file_hash)` acts as the safety net for race conditions. Pre-existing rows with no hash are unaffected.

## Scope

**In scope:**
- `file_hash` column on `patient_uploads` (nullable, for backward compat)
- Unique index scoped to `(user_uuid, file_hash) WHERE file_hash IS NOT NULL`
- `hashFile(buffer)` utility in `lib/uploads/hash.ts`
- `checkDuplicate(fileHash)` server action in `app/(app)/uploads/actions.ts`
- `fileHash` param added to `recordUpload` so new rows always store the hash
- Client-side hash + pre-check in `upload-client.tsx` before storage write
- Unit tests for `hashFile` and `checkDuplicate`

**Out of scope:**
- Cross-user deduplication (each patient has their own upload namespace)
- Deduplication of uploads already in storage before this migration
- Retroactive hash population of existing rows

## Data model changes

| Table | Column | Type | PII? | Writer |
|---|---|---|---|---|
| `public.patient_uploads` | `file_hash` | `text` nullable | No | Upload server action only |

Unique index: `patient_uploads_user_hash_uidx` on `(user_uuid, file_hash) WHERE file_hash IS NOT NULL`

`file_hash` is a SHA-256 hex digest — 64 lowercase hex characters. Not PII. Not queryable for clinical purposes. JSONB is not appropriate; typed column is correct per data-management Rule 3.

## Tasks

---

### Task 1 — DB migration: add `file_hash` column + unique index

**Files affected:**
- Create: `supabase/migrations/0031_patient_uploads_file_hash.sql`
- Modify: `lib/supabase/database.types.ts` (regenerated, not hand-edited)

**What to build:**

Write an idempotent migration that adds a nullable `file_hash text` column to `public.patient_uploads` and creates a partial unique index on `(user_uuid, file_hash) WHERE file_hash IS NOT NULL`. The partial predicate ensures legacy rows with `NULL` hash never trigger the constraint.

```sql
alter table public.patient_uploads
  add column if not exists file_hash text;

create unique index if not exists patient_uploads_user_hash_uidx
  on public.patient_uploads(user_uuid, file_hash)
  where file_hash is not null;
```

After applying, regenerate TypeScript types:
```bash
supabase gen types typescript --local > lib/supabase/database.types.ts
```

**Acceptance criteria:**
- Migration applies with `supabase migration up` without error
- `supabase db diff` shows no pending diff after applying
- `database.types.ts` `patient_uploads` Row includes `file_hash: string | null`
- `database.types.ts` `patient_uploads` Insert includes `file_hash?: string | null`

**Rules to apply:** `.claude/rules/database.md` (migration naming, idempotency, `IF NOT EXISTS`), `.claude/rules/data-management.md` (typed column, single writer)

---

### Task 2 — `hashFile` utility

**Files affected:**
- Create: `lib/uploads/hash.ts`
- Create: `tests/unit/uploads/hash.test.ts`

**What to build:**

A single exported async function `hashFile(buffer: ArrayBuffer): Promise<string>` that computes a SHA-256 hex digest using `crypto.subtle.digest`. Available in both browser and Node.js 16+. No dependencies.

```ts
// lib/uploads/hash.ts
export async function hashFile(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
```

Tests must cover: correct length (64 chars), correct hex format, known SHA-256 value for `"hello world"`, same hash for identical input, different hash for different input.

Known SHA-256 for `"hello world"` (UTF-8, no newline):
`b94d27b9934d3e08a52e52d7da7dabfac484efe04294e576ced05e5a80bd02c5`

**Acceptance criteria:**
- `pnpm test tests/unit/uploads/hash.test.ts` passes (4 tests)
- No external dependencies added
- Function works in both browser (`crypto.subtle`) and Node.js (`globalThis.crypto.subtle`)

**Rules to apply:** `.claude/rules/nextjs-conventions.md` (no unnecessary abstraction)

---

### Task 3 — `checkDuplicate` server action + `fileHash` param in `recordUpload`

**Files affected:**
- Modify: `app/(app)/uploads/actions.ts`
- Create: `tests/unit/uploads/dedup.test.ts`

**What to build:**

Add to `app/(app)/uploads/actions.ts`:

1. **`checkDuplicate(fileHash: string): Promise<CheckDuplicateResult>`** — a `"use server"` action that queries `patient_uploads` for a row matching `(user_uuid, file_hash)`. Returns `{ duplicate: false }` if not signed in or no match. Returns `{ duplicate: true, originalFilename, uploadedAt }` if match found.

```ts
export interface CheckDuplicateResult {
  duplicate: boolean;
  originalFilename?: string;
  uploadedAt?: string;
}

export async function checkDuplicate(fileHash: string): Promise<CheckDuplicateResult> {
  // Validate shape before any DB access — SHA-256 hex is always exactly 64 lowercase hex chars
  if (!/^[0-9a-f]{64}$/.test(fileHash)) return { duplicate: false };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { duplicate: false };

  const { data } = await supabase
    .from("patient_uploads")
    .select("original_filename, created_at")
    .eq("user_uuid", user.id)
    .eq("file_hash", fileHash)
    .single();

  if (!data) return { duplicate: false };
  return { duplicate: true, originalFilename: data.original_filename, uploadedAt: data.created_at };
}
```

2. **Add `fileHash: string` to `recordUpload` params** and include it in the `.insert()` call as `file_hash: params.fileHash`.

Unit tests must cover:
- `checkDuplicate` returns `{ duplicate: false }` when no row exists
- `checkDuplicate` returns `{ duplicate: true, originalFilename, uploadedAt }` when row exists
- `checkDuplicate` returns `{ duplicate: false }` when user is not signed in

Mock `@/lib/supabase/server` — do not use a real database.

**Acceptance criteria:**
- `pnpm test tests/unit/uploads/dedup.test.ts` passes (3 tests)
- `recordUpload` insert now includes `file_hash`
- `pnpm build` clean — no TypeScript errors
- Server action is `"use server"` (already enforced by file-level directive)

**Rules to apply:** `.claude/rules/nextjs-conventions.md` (server actions return typed result objects, never throw), `.claude/rules/security.md` (validate at server boundary, never trust client), `.claude/rules/data-management.md` (table ownership — `patient_uploads` writer is upload server action only)

---

### Task 4 — Client-side hash + duplicate check in `upload-client.tsx`

**Files affected:**
- Modify: `app/(app)/uploads/upload-client.tsx`

**Prerequisite:** Tasks 1–3 complete. `hashFile` and `checkDuplicate` are exported and typed.

**What to build:**

Inside the `processFile` function in `upload-client.tsx`, after validating file type and size but before the Supabase storage upload:

1. Read the file as `ArrayBuffer`
2. Call `hashFile(fileBuffer)` to get the hex digest
3. Call `checkDuplicate(fileHash)` — if `duplicate: true`, call `addError(...)` with the message format: `"<filename>: already uploaded as "<originalFilename>" on <date>"`, remove the file from `inFlight`, and `return`
4. Pass `fileHash` to `recordUpload`

Date formatting for the error message:
```ts
const uploadedOn = dupeCheck.uploadedAt
  ? new Date(dupeCheck.uploadedAt).toLocaleDateString(undefined, {
      year: "numeric", month: "short", day: "numeric",
    })
  : "a previous session";
addError(`${file.name}: already uploaded as "${dupeCheck.originalFilename}" on ${uploadedOn}`);
```

**Important:** The `arrayBuffer()` call reads the file into memory. This is fine for the 50 MB limit already enforced. Do not read the file twice — pass `fileBuffer` to the storage upload instead of `file` directly if needed (or keep both reads — `file` is a Blob, re-reading is acceptable for < 50 MB).

**Acceptance criteria:**
- Uploading the same file twice shows the error inline, no spinner persists, no storage write occurs on the second attempt
- Uploading two different files with the same filename both succeed
- `pnpm build` clean — no TypeScript errors
- `pnpm test` passes (no regressions)

**Rules to apply:** `.claude/rules/nextjs-conventions.md` (`"use client"` component, no server imports except via server actions), `.claude/rules/security.md` (file size and MIME validation still runs before hash)
