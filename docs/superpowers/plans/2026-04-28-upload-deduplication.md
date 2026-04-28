# Upload Deduplication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Detect and block duplicate file uploads per user by hashing file content client-side and checking against existing records before writing to storage.

**Architecture:** The browser computes a SHA-256 hex digest of each file using the Web Crypto API before the storage upload begins. A lightweight server action checks whether `(user_uuid, file_hash)` already exists in `patient_uploads`. If so, the upload is aborted and the UI shows the original filename and upload date. A DB unique constraint on `(user_uuid, file_hash)` acts as the final safety net for race conditions.

**Tech Stack:** Web Crypto API (`crypto.subtle`), Vitest, Supabase, Next.js server actions

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `supabase/migrations/0031_patient_uploads_file_hash.sql` | Create | Add `file_hash` column + unique constraint |
| `lib/supabase/database.types.ts` | Regenerate | Reflect new column |
| `lib/uploads/hash.ts` | Create | `hashFile(buffer): Promise<string>` — SHA-256 hex, isomorphic |
| `app/(app)/uploads/actions.ts` | Modify | Add `checkDuplicate` action; add `fileHash` param to `recordUpload` |
| `app/(app)/uploads/upload-client.tsx` | Modify | Hash before upload; call `checkDuplicate`; show duplicate warning |
| `tests/unit/uploads/hash.test.ts` | Create | Unit tests for `hashFile` |
| `tests/unit/uploads/dedup.test.ts` | Create | Unit tests for `checkDuplicate` server action |

---

## Task 1: Database migration — add `file_hash` column

**Files:**
- Create: `supabase/migrations/0031_patient_uploads_file_hash.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Migration 0031: add file_hash to patient_uploads for deduplication
-- file_hash is SHA-256 hex of the raw file bytes, computed client-side.
-- Nullable for rows created before this migration.
-- Unique per user so the same file cannot be stored twice for the same patient.

alter table public.patient_uploads
  add column if not exists file_hash text;

create unique index if not exists patient_uploads_user_hash_uidx
  on public.patient_uploads(user_uuid, file_hash)
  where file_hash is not null;
```

- [ ] **Step 2: Apply locally and verify**

```bash
supabase db reset
# or
supabase migration up
```

Expected: migration applies without error. Check:
```bash
supabase db diff
```
Expected: no pending diff (schema matches migrations).

- [ ] **Step 3: Regenerate TypeScript types**

```bash
supabase gen types typescript --local > lib/supabase/database.types.ts
```

Expected: `patient_uploads` Row type now includes `file_hash: string | null`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0031_patient_uploads_file_hash.sql lib/supabase/database.types.ts
git commit -m "feat(uploads): add file_hash column for deduplication"
```

---

## Task 2: `hashFile` utility

**Files:**
- Create: `lib/uploads/hash.ts`
- Create: `tests/unit/uploads/hash.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/uploads/hash.test.ts
import { describe, expect, it } from "vitest";
import { hashFile } from "@/lib/uploads/hash";

describe("hashFile", () => {
  it("returns a 64-character lowercase hex string", async () => {
    const buf = new TextEncoder().encode("hello world").buffer;
    const hash = await hashFile(buf);
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("returns the correct SHA-256 for a known input", async () => {
    // echo -n "hello world" | sha256sum → b94d27b9...
    const buf = new TextEncoder().encode("hello world").buffer;
    const hash = await hashFile(buf);
    expect(hash).toBe("b94d27b9934d3e08a52e52d7da7dabfac484efe04294e576ced05e5a80bd02c5");
  });

  it("returns different hashes for different content", async () => {
    const a = new TextEncoder().encode("file a").buffer;
    const b = new TextEncoder().encode("file b").buffer;
    expect(await hashFile(a)).not.toBe(await hashFile(b));
  });

  it("returns the same hash for identical content", async () => {
    const buf = new TextEncoder().encode("identical").buffer;
    expect(await hashFile(buf)).toBe(await hashFile(buf));
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
pnpm test tests/unit/uploads/hash.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/uploads/hash'`

- [ ] **Step 3: Implement `hashFile`**

```ts
// lib/uploads/hash.ts

/**
 * Computes a SHA-256 hex digest of raw file bytes.
 * Uses Web Crypto API (available in browser and Node.js 16+).
 */
export async function hashFile(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test tests/unit/uploads/hash.test.ts
```

Expected: 4 passing.

- [ ] **Step 5: Commit**

```bash
git add lib/uploads/hash.ts tests/unit/uploads/hash.test.ts
git commit -m "feat(uploads): hashFile utility — SHA-256 hex via Web Crypto API"
```

---

## Task 3: `checkDuplicate` server action

**Files:**
- Modify: `app/(app)/uploads/actions.ts`
- Create: `tests/unit/uploads/dedup.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/uploads/dedup.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest";

// ── Supabase mock ──────────────────────────────────────────────────────────
const mockSingle = vi.fn();
const mockEq2 = vi.fn(() => ({ single: mockSingle }));
const mockEq1 = vi.fn(() => ({ eq: mockEq2 }));
const mockSelect = vi.fn(() => ({ eq: mockEq1 }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: "user-abc" } } })) },
    from: mockFrom,
  })),
}));

import { checkDuplicate } from "@/app/(app)/uploads/actions";

beforeEach(() => vi.clearAllMocks());

describe("checkDuplicate", () => {
  it("returns { duplicate: false } when no row exists for that hash", async () => {
    mockSingle.mockResolvedValue({ data: null, error: null });
    const result = await checkDuplicate("aabbcc");
    expect(result).toEqual({ duplicate: false });
  });

  it("returns duplicate: true with original filename and date when a match exists", async () => {
    mockSingle.mockResolvedValue({
      data: { original_filename: "blood-work.pdf", created_at: "2026-03-10T07:42:00Z" },
      error: null,
    });
    const result = await checkDuplicate("aabbcc");
    expect(result).toEqual({
      duplicate: true,
      originalFilename: "blood-work.pdf",
      uploadedAt: "2026-03-10T07:42:00Z",
    });
  });

  it("returns { duplicate: false } when not signed in", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValueOnce({
      auth: { getUser: vi.fn(async () => ({ data: { user: null } })) },
      from: mockFrom,
    } as never);
    const result = await checkDuplicate("aabbcc");
    expect(result).toEqual({ duplicate: false });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
pnpm test tests/unit/uploads/dedup.test.ts
```

Expected: FAIL — `checkDuplicate is not exported from actions`

- [ ] **Step 3: Add `checkDuplicate` to `actions.ts`**

Add the following export at the top of `app/(app)/uploads/actions.ts`, after the existing imports:

```ts
export interface CheckDuplicateResult {
  duplicate: boolean;
  originalFilename?: string;
  uploadedAt?: string;
}

export async function checkDuplicate(fileHash: string): Promise<CheckDuplicateResult> {
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

  return {
    duplicate: true,
    originalFilename: data.original_filename,
    uploadedAt: data.created_at,
  };
}
```

- [ ] **Step 4: Also add `fileHash` to `recordUpload`**

Update the `recordUpload` params interface and the insert in `app/(app)/uploads/actions.ts`:

```ts
// Update the params interface:
export interface RecordUploadResult { ... }  // unchanged

// Change the function signature:
export async function recordUpload(params: {
  storagePath: string;
  originalFilename: string;
  mimeType: string;
  fileSizeBytes: number;
  fileHash: string;          // ← add this
}): Promise<RecordUploadResult> {

// Update the .insert() call to include file_hash:
  const { data: row, error: insertError } = await supabase
    .from("patient_uploads")
    .insert({
      user_uuid: user.id,
      storage_path: params.storagePath,
      original_filename: params.originalFilename,
      mime_type: params.mimeType,
      file_size_bytes: params.fileSizeBytes,
      file_hash: params.fileHash,     // ← add this
      janet_status: "processing",
    })
    .select("id")
    .single();
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
pnpm test tests/unit/uploads/dedup.test.ts
```

Expected: 3 passing.

- [ ] **Step 6: Commit**

```bash
git add app/(app)/uploads/actions.ts tests/unit/uploads/dedup.test.ts
git commit -m "feat(uploads): checkDuplicate server action + fileHash in recordUpload"
```

---

## Task 4: Client-side hash + duplicate check in the upload UI

**Files:**
- Modify: `app/(app)/uploads/upload-client.tsx`

> No separate unit test for the client component — the behaviour is tested via the server action tests above. E2E coverage is out of scope here.

- [ ] **Step 1: Import `hashFile` and `checkDuplicate`**

At the top of `app/(app)/uploads/upload-client.tsx`, add:

```ts
import { hashFile } from "@/lib/uploads/hash";
import { recordUpload, deleteUpload, checkDuplicate } from "./actions";
```

- [ ] **Step 2: Hash the file and check for duplicates before the storage upload**

Inside `processFile`, replace the block that starts with `const { data: userData } = await supabase.auth.getUser();` with:

```ts
const { data: userData } = await supabase.auth.getUser();
if (!userData.user) throw new Error("Not signed in");

// Hash before upload — lets us abort early without consuming storage quota
const fileBuffer = await file.arrayBuffer();
const fileHash = await hashFile(fileBuffer);

const dupeCheck = await checkDuplicate(fileHash);
if (dupeCheck.duplicate) {
  const uploadedOn = dupeCheck.uploadedAt
    ? new Date(dupeCheck.uploadedAt).toLocaleDateString(undefined, {
        year: "numeric", month: "short", day: "numeric",
      })
    : "previously";
  addError(
    `${file.name}: already uploaded as "${dupeCheck.originalFilename}" on ${uploadedOn}`
  );
  setInFlight((prev) => { const m = new Map(prev); m.delete(localId); return m; });
  return;
}

const ext = file.name.includes(".") ? file.name.split(".").pop() : "";
const uuid = crypto.randomUUID();
const storagePath = `${userData.user.id}/${uuid}${ext ? `.${ext}` : ""}`;

const { error: storageError } = await supabase.storage
  .from("patient-uploads")
  .upload(storagePath, file, { upsert: false, duplex: "half" });

if (storageError) throw new Error(storageError.message);
```

- [ ] **Step 3: Pass `fileHash` to `recordUpload`**

Update the `recordUpload` call in the same function:

```ts
const result = await recordUpload({
  storagePath,
  originalFilename: file.name,
  mimeType: file.type,
  fileSizeBytes: file.size,
  fileHash,           // ← add this
});
```

- [ ] **Step 4: Build check — no TypeScript errors**

```bash
pnpm build
```

Expected: clean build, zero TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add app/(app)/uploads/upload-client.tsx
git commit -m "feat(uploads): hash file client-side and block duplicate uploads with user-friendly message"
```

---

## Task 5: Manual smoke test

- [ ] **Step 1: Start the dev server**

```bash
pnpm dev
```

- [ ] **Step 2: Upload a sample PDF twice**

1. Go to `/uploads`
2. Upload `tests/fixtures/uploads/blood-work-lipid-fbc.pdf`
3. Wait for Janet to finish (status: "Read")
4. Upload the same file again

Expected on second upload: an error banner appears immediately (no spinner, no storage write) reading:
`blood-work-lipid-fbc.pdf: already uploaded as "blood-work-lipid-fbc.pdf" on <date>`

- [ ] **Step 3: Confirm different files still upload**

Upload `tests/fixtures/uploads/blood-work-hormones.pdf` — should upload successfully.

- [ ] **Step 4: Run full test suite**

```bash
pnpm test
```

Expected: all tests pass.

- [ ] **Step 5: Final commit**

```bash
git add -p   # review any stray changes
git commit -m "test(uploads): smoke test deduplication — all green"
```

---

## Edge cases covered

| Scenario | Handled by |
|---|---|
| Same file, same user | `checkDuplicate` returns early before storage write |
| Same file, different user | Unique index is scoped to `(user_uuid, file_hash)` — not blocked |
| Same filename, different content | Different hash — not blocked |
| File deleted then re-uploaded | Row deleted → no hash match → allowed |
| Race condition (two simultaneous identical uploads) | DB unique index rejects the second insert; `recordUpload` returns `{ error }` which surfaces in the UI |
| Pre-migration rows (null `file_hash`) | Index is `WHERE file_hash IS NOT NULL` — nulls never collide |
