# Secure Messaging — Design Spec

Date: 2026-04-29
Epic: 9 (The Care Team)
Status: Spec — approved, ready for implementation planning

---

## What we're building

Bidirectional secure messaging between patients and their assigned human clinicians. Conversations are end-to-end encrypted and live exclusively in-app. SMS and WhatsApp are notification channels only — a doorbell that tells the recipient a message is waiting. Zero health information ever leaves the platform.

---

## Architecture decision

**Option B — Next.js API routes + Supabase Realtime.**

Messages sent via `POST /api/messages/[convId]/send`. Supabase Realtime pushes INSERT events to both parties in <500ms. Twilio nudge fires async after insert (fire-and-forget, never blocks sender). Application-level AES-256-GCM encryption in `lib/messages/crypto.ts` — decryption happens server-side only; browser never sees the key.

Alternatives considered and rejected:
- Server actions + polling: too much latency for clinical urgency
- Vercel Queues for notification delivery: overkill at pilot scale, public beta risk

---

## Database schema

New `janet` Postgres schema alongside `public`, `biomarkers`, `billing`, `clinical`.

### janet.conversations

```sql
CREATE TABLE janet.conversations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clinician_id    UUID NOT NULL REFERENCES auth.users(id),
  assignment_id   UUID NOT NULL REFERENCES clinical.patient_assignments(id),
  patient_dob     DATE NOT NULL,         -- retention computation for minors
  jurisdiction    TEXT NOT NULL DEFAULT 'au',
  status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','archived','closed')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  -- NOTE: no metadata JSONB — data minimisation (Privacy Act APP 3)
);

CREATE INDEX ON janet.conversations(patient_id);
CREATE INDEX ON janet.conversations(clinician_id);
CREATE INDEX ON janet.conversations(assignment_id);
```

**Design notes:**
- `assignment_id` FK enforces clinician can only message assigned patients — not any patient on the platform
- `patient_dob` used by purge cron: `MAX(created_at + 7 years, dob + 25 years)` — minor patients retained until age 25 per Medical Board of Australia guidelines
- `jurisdiction` drives per-region retention: AU=7yr, SG=6yr, PH=10yr
- No `metadata JSONB` — data minimisation obligation

---

### janet.messages

```sql
CREATE TABLE janet.messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  UUID NOT NULL REFERENCES janet.conversations(id) ON DELETE CASCADE,
  sender_id        UUID NOT NULL REFERENCES auth.users(id),
  sender_role      TEXT NOT NULL CHECK (sender_role IN ('patient','clinician','system')),
  body_encrypted   BYTEA NOT NULL,   -- AES-256-GCM ciphertext
  body_iv          BYTEA NOT NULL,   -- 96-bit IV
  body_hmac        TEXT NOT NULL,    -- HMAC-SHA256 of plaintext — tamper evidence for legal proceedings
  message_type     TEXT NOT NULL DEFAULT 'text'
                     CHECK (message_type IN ('text','file','system_event')),
  attachment_path  TEXT,             -- Supabase Storage path
  attachment_mime  TEXT,             -- validated MIME type
  read_at          TIMESTAMPTZ,      -- both-sides read receipts
  delivered_at     TIMESTAMPTZ,      -- set by client Realtime subscription on receipt
  deleted_at       TIMESTAMPTZ,      -- soft delete only — hard purge handled by cron
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
  -- NOTE: no body_preview column — PHI risk (Privacy Act APP 11)
  -- NOTE: deleted messages returned as { message_type: 'deleted', body: '[Message deleted]' }
  --       by GET /api/messages/[convId] — enforced at the API layer, not the client
);

CREATE INDEX ON janet.messages(conversation_id, created_at DESC);
CREATE INDEX ON janet.messages(sender_id);
```

**Design notes:**
- No `body_preview` column — even 30 chars of a clinical message is health information. Preview derived on-the-fly server-side when building push payloads.
- `body_hmac`: HMAC-SHA256 of the plaintext body using `MESSAGE_HMAC_KEY` (separate from the encryption key). Computed at write time. Allows tamper-detection without decryption — admissible in court or AHPRA disciplinary proceedings.
- Per-conversation encryption key derived via HKDF from master key + `conversation_id` — a compromised conversation key exposes one thread only.
- Soft delete: `deleted_at` set when a participant deletes a message. Hard purge by cron after retention period. Deleted messages show as `[Message deleted]` to the other party — audit trail preserved.

---

### janet.messaging_consent

```sql
CREATE TABLE janet.messaging_consent (
  user_id                    UUID PRIMARY KEY REFERENCES auth.users(id),
  sms_consented              BOOLEAN NOT NULL DEFAULT false,
  whatsapp_consented         BOOLEAN NOT NULL DEFAULT false,
  phone                      TEXT,    -- E.164 format
  whatsapp_phone             TEXT,    -- E.164 format
  consent_date               TIMESTAMPTZ,
  consent_method             TEXT,    -- 'onboarding_gate', 'account_settings'
  consent_policy_version     TEXT NOT NULL DEFAULT '1.0',
  re_consent_required_at     TIMESTAMPTZ,    -- set when policy version changes
  whatsapp_last_user_msg_at  TIMESTAMPTZ,    -- Meta 24h window tracking
  withdrawn_date             TIMESTAMPTZ     -- opt-out timestamp
);
```

**Design notes:**
- `consent_policy_version`: when terms change, set `re_consent_required_at`. A banner in `/messages` blocks access until re-consent is captured.
- `whatsapp_last_user_msg_at`: tracks last inbound WhatsApp reply. If `> 24h`, nudge must use the approved Meta template (`TWILIO_WHATSAPP_TEMPLATE_SID`).
- `withdrawn_date`: set by server action from `/account/notifications`. All future nudges suppressed immediately.
- AU Spam Act 2003: consent must be explicit and on record before any Twilio call.

---

### janet.notification_log

```sql
CREATE TABLE janet.notification_log (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id),
  conversation_id  UUID REFERENCES janet.conversations(id),
  channel          TEXT NOT NULL CHECK (channel IN ('sms','whatsapp','push')),
  twilio_sid       TEXT,
  status           TEXT NOT NULL DEFAULT 'queued'
                     CHECK (status IN ('queued','sent','delivered','failed')),
  sent_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

### janet.access_log

```sql
CREATE TABLE janet.access_log (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id),
  conversation_id  UUID NOT NULL REFERENCES janet.conversations(id),
  accessed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address       TEXT,
  user_agent       TEXT,
  access_type      TEXT NOT NULL DEFAULT 'read'
                     CHECK (access_type IN ('read','admin_override','export'))
);
```

**Design notes:**
- Written server-side on every `GET /api/messages/[convId]` call.
- Required by Privacy Act APP 11 and AHPRA clinical record access requirements.
- `admin_override` entries require a prior `janet.admin_access_requests` approval row.

---

### janet.admin_access_requests

```sql
CREATE TABLE janet.admin_access_requests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id    UUID NOT NULL REFERENCES auth.users(id),
  conversation_id  UUID NOT NULL REFERENCES janet.conversations(id),
  reason           TEXT NOT NULL,
  approved_by      UUID REFERENCES auth.users(id),
  approved_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Design notes:**
- Admin users (`is_admin = true`) CANNOT read `janet.messages` by default — RLS blocks them.
- Access requires: written reason + second admin approval + every read logged to `janet.access_log`.
- Enforces Privacy Act APP 6: use/disclosure limited to collection purpose.

---

### RLS policies

```sql
ALTER TABLE janet.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE janet.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE janet.messaging_consent ENABLE ROW LEVEL SECURITY;
ALTER TABLE janet.notification_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE janet.access_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE janet.admin_access_requests ENABLE ROW LEVEL SECURITY;

-- Conversations: patient or assigned clinician only
CREATE POLICY conv_participant ON janet.conversations FOR SELECT
  USING (auth.uid() = patient_id OR auth.uid() = clinician_id);

CREATE POLICY conv_insert ON janet.conversations FOR INSERT
  WITH CHECK (
    auth.uid() = patient_id OR auth.uid() = clinician_id
  );

-- Messages: participants of the parent conversation only
CREATE POLICY msg_participant ON janet.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM janet.conversations c
      WHERE c.id = conversation_id
      AND (c.patient_id = auth.uid() OR c.clinician_id = auth.uid())
    )
  );

-- Consent: owner only
CREATE POLICY consent_owner ON janet.messaging_consent FOR ALL
  USING (auth.uid() = user_id);

-- Notification log: owner-select, service-role insert
CREATE POLICY notif_owner_select ON janet.notification_log FOR SELECT
  USING (auth.uid() = user_id);

-- Access log: owner-select, service-role insert
CREATE POLICY access_log_owner ON janet.access_log FOR SELECT
  USING (auth.uid() = user_id);
```

### Supabase Realtime

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE janet.messages;
```

---

## Backend

### lib/messages/ structure

```
lib/messages/
  crypto.ts       — encrypt / decrypt / deriveConversationKey / hmac
  nudge.ts        — Twilio SMS + WhatsApp fire-and-forget
  context.ts      — load conversation + paginated decrypted messages
  types.ts        — ConversationRow, MessageRow, DecryptedMessage
```

### lib/messages/crypto.ts

```ts
// Derive a per-conversation key from the master key + conversation ID
// A compromised conversation key exposes one thread only, not the corpus
deriveConversationKey(masterKeyHex: string, conversationId: string): Promise<CryptoKey>

// AES-256-GCM encrypt using derived key
encrypt(plaintext: string, key: CryptoKey): Promise<{ iv: Buffer, ciphertext: Buffer }>

// AES-256-GCM decrypt
decrypt(iv: Buffer, ciphertext: Buffer, key: CryptoKey): Promise<string>

// HMAC-SHA256 for tamper evidence — uses separate MESSAGE_HMAC_KEY
hmac(plaintext: string, hmacKeyHex: string): Promise<string>
```

Uses Node.js `crypto.subtle` (WebCrypto) — zero third-party deps.

### API routes — app/api/messages/

| Route | Auth | Description |
|---|---|---|
| `POST /api/messages/conversations` | session | Create conversation — verifies `patient_assignments` row exists |
| `GET /api/messages/conversations` | session | List caller's conversations with unread count |
| `POST /api/messages/[convId]/send` | session | Encrypt → insert → fire nudge async |
| `GET /api/messages/[convId]` | session | Paginated history, decrypted server-side. Writes `access_log` row. |
| `GET /api/messages/[convId]/[msgId]` | session | Single decrypted message — called by Realtime handler on INSERT |
| `POST /api/messages/[convId]/read` | session | Sets `read_at = now()` on unread messages from the other party |
| `POST /api/messages/[convId]/upload` | session | MIME + size validate → Supabase Storage → insert file message |

All routes use `lib/supabase/server.ts` — RLS enforces access. No admin client.
All `app/api/messages/*` routes export `export const preferredRegion = 'syd1'` — AU data stays in AU.

### send flow

```
POST /api/messages/[convId]/send
  1. Verify session — get caller user_id and role
  2. Load conversation row — RLS implicitly validates participant membership
  3. deriveConversationKey(MESSAGE_ENCRYPTION_KEY, convId)
  4. encrypt(body, key) → { iv, ciphertext }
  5. hmac(body, MESSAGE_HMAC_KEY) → body_hmac
  6. INSERT into janet.messages
  7. nudge(recipientId) — fire and forget, never awaited
  8. Return decrypted MessageRow to caller
```

---

## Frontend

### Route structure

```
app/(app)/messages/
  page.tsx                      ← Server Component — initial conversation list
  messages.css
  [convId]/
    page.tsx                    ← Server Component — initial message history
    thread.css
    _components/
      message-thread.tsx        ← 'use client' — Realtime subscription + state
      message-bubble.tsx        ← individual message, read receipt trigger
      message-composer.tsx      ← text input + file attach + send
      file-attachment.tsx       ← inline image / PDF download chip
  _components/
    conversation-list.tsx       ← inbox list with unread badges
    consent-gate.tsx            ← blocks entry until consent captured
```

`/messages` added to `PROTECTED_PREFIXES` in `proxy.ts`.

### Server / client split

`page.tsx` — Server Component. Fetches initial data via API routes (decryption server-side). Passes decrypted props to client components. Browser never receives `body_encrypted`.

`message-thread.tsx` — only `'use client'` component. Holds Realtime subscription + local message state.

### Realtime flow

```
Supabase Realtime INSERT fires → payload.new.id
→ GET /api/messages/[convId]/[msgId]  (fetches decrypted message)
→ append to local state
```

One extra round-trip per incoming message. Encryption key stays server-side.

### Consent gate

Renders on first visit to `/messages` if `janet.messaging_consent` row is missing. Collects:
- SMS opt-in (required to receive nudges)
- WhatsApp opt-in (optional) — includes Meta metadata disclosure copy
- Submits to server action → writes consent row with `consent_policy_version = '1.0'`

### Read receipts

`message-thread.tsx` calls `POST /api/messages/[convId]/read` on mount and on each new message while thread is open.

### File attachments

Supabase Storage under `messages/{conversation_id}/{message_id}/{filename}`. MIME whitelist + 50 MB cap enforced client-side and server-side. Signed URLs (1-hour TTL). Images inline; PDFs as download chip.

### /account/notifications

New section on `/account`. Per-channel toggles for SMS and WhatsApp. Toggle-off → server action sets `withdrawn_date = now()`. Deep-linkable at `/account/notifications`. Reached within 2 taps from any Twilio nudge URL.

---

## Notification routing

### lib/messages/nudge.ts — full decision tree

```
on message INSERT → nudge(recipientId, conversationId):
  1. Load janet.messaging_consent
     → no row OR both channels withdrawn: return (skip)
  2. Check Supabase Realtime presence
     → recipient online: return (they see it in-app)
  3. Check janet.notification_log
     → nudge sent to this recipient for this conversation in last 4h: return
  4. Determine channel:
     a. WhatsApp if whatsapp_consented AND phone set
        - now() - whatsapp_last_user_msg_at < 24h → free-form
        - otherwise → approved template (TWILIO_WHATSAPP_TEMPLATE_SID)
     b. SMS if sms_consented (fallback or primary)
  5. Send via Twilio REST
     Body (constant, never interpolated):
     "You have a new message from your care team.
      Read it securely: https://longevity-coach.io/messages"
  6. Log result → janet.notification_log
  7. Update whatsapp_last_user_msg_at if WhatsApp used
```

### Twilio channels

| Channel | From | To format |
|---|---|---|
| SMS | `LongevityC` (alphanumeric, AU ACMA compliant) | `+61XXXXXXXXX` |
| WhatsApp | `whatsapp:+61...` | `whatsapp:+61XXXXXXXXX` |

WhatsApp approved template: `"You have a secure message from your care team at Longevity Coach. Tap to read: {{1}}"`

---

## Compliance — all gaps closed

### Schema changes from compliance audit

| Gap | Fix | Where |
|---|---|---|
| `body_preview` plaintext PHI | Removed from schema | `janet.messages` |
| Global encryption key | Per-conversation HKDF derivation | `lib/messages/crypto.ts` |
| Minor patient retention | `patient_dob` + age-aware purge cron | `janet.conversations` |
| No message read audit | `janet.access_log` table | New table |
| Message tamper evidence | `body_hmac` column | `janet.messages` |
| Admin uncontrolled access | `janet.admin_access_requests` + RLS | New table + policies |
| No consent versioning | `consent_policy_version` + `re_consent_required_at` | `janet.messaging_consent` |
| WhatsApp 24h window | `whatsapp_last_user_msg_at` | `janet.messaging_consent` |
| `metadata JSONB` data minimisation risk | Removed | `janet.conversations` |
| `janet.*` missing from export bundle | Add to `GET /api/export` | Epic 11 export route |
| Vercel region unpinned | `preferredRegion = 'syd1'` | All `app/api/messages/*` |
| No opt-out UI | `/account/notifications` | Frontend |
| TGA SaMD undocumented | Disclaimer in UI + assessment doc | `docs/operations/` |
| No incident response procedure | NDB + SG 3-day + PH 72hr paths | `docs/operations/` |
| No lawful interception procedure | Warrant response doc | `docs/operations/` |
| Jurisdiction retention config | `jurisdiction` column + retention map | Purge cron |

### Retention map (purge cron)

```ts
const RETENTION_YEARS: Record<string, number> = {
  au: 7, sg: 6, ph: 10, th: 7, my: 7, id: 7
}
// Minor override: retain until patient turns 25 regardless of jurisdiction
```

### Purge cron — /api/cron/messages-purge

Weekly. Hard-deletes `janet.messages` rows where:
```sql
deleted_at IS NOT NULL
AND deleted_at < now() - (RETENTION_YEARS[jurisdiction] * interval '1 year')
AND (
  patient_dob + interval '25 years' < now()  -- minor is now adult + retention elapsed
  OR patient_dob + interval '25 years' <= deleted_at + (RETENTION_YEARS * interval '1 year')
)
```
Logs each purge run count to `docs/operations/` monthly summary.

**Register in `vercel.json`:**
```json
{ "path": "/api/cron/messages-purge", "schedule": "0 2 * * 1" }
```
This runs every Monday at 02:00 UTC (12:00 AEDT). Add to the `crons` array in `vercel.json` alongside any existing cron entries.

### ASEAN expansion posture

| Country | Status | Blocker |
|---|---|---|
| AU | ✅ Ready | — |
| SG | ⚠ Needs PIA + DPO designation | 3-day breach SLA, 6yr retention (`jurisdiction='sg'`) |
| MY | ✅ Compatible | Enable `jurisdiction='my'` |
| TH | ⚠ Needs per-purpose consent | Right to erasure = hard delete on request |
| PH | ❌ Blocked | PIA + NPC registration required before launch |
| ID | ❌ Blocked | Data localisation requirements — needs local Supabase instance |
| VN | ❌ Blocked | Cross-border transfer notification + potential localisation |

**Singapore AI guideline (PDPC 2022):** Messages must NEVER be passed to any LLM for training, fine-tuning, or improvement. Surfaced as a disclaimer in composer: *"🔒 never used to train AI"*. Enforced architecturally — `janet.*` tables are excluded from all AI pipelines.

---

## New environment variables

```
MESSAGE_ENCRYPTION_KEY        # 32-byte hex — AES master key (server-only)
MESSAGE_HMAC_KEY              # 32-byte hex — separate HMAC key (server-only)
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_MESSAGING_SID          # SMS Messaging Service SID
TWILIO_WHATSAPP_FROM          # whatsapp:+61...
TWILIO_WHATSAPP_TEMPLATE_SID  # Meta-approved template for >24h window
```

---

## New docs/operations/ files required

| File | Contents |
|---|---|
| `incident-response.md` | NDB 30-day procedure, SG 3-day path, PH 72-hour path, named Privacy Officer |
| `warrant-response.md` | Lawful interception procedure, key access process |
| `data-residency.md` | Region pinning rationale, Vercel KMS trade-off, GA migration trigger |
| `tga-samd-assessment.md` | TGA risk classification, disclaimer language, registration decision |
| `retention-policy.md` | Per-jurisdiction retention table, minor patient rules, purge cron schedule |

---

## Epic 9 bundle additions

The following items should be added to Epic 9 (The Care Team) in `epics.md` on next `--epics` update:

- Secure in-app messaging between patient and assigned clinician (encrypted, Realtime)
- SMS + WhatsApp notification channels (doorbell only — zero PHI in notifications)
- AHPRA-compliant 7-year retention with jurisdiction-configurable rules
- Consent gate for notification channel opt-in
- `/account/notifications` opt-out surface
- Per-conversation AES-256-GCM encryption with HKDF key derivation
- Tamper-evident message audit trail (`body_hmac`)
- Admin access control with approval workflow
- ASEAN expansion posture (jurisdiction column, per-region retention)

---

## Reference

- Existing spec (partial, wrong stack): `docs/features/secure-messaging/janet-secure-messaging-spec.md`
- UI mockup: `/tmp/messages-mockup.html`
- Compliance laws: Privacy Act 1988, Spam Act 2003, TGA, AHPRA, Singapore PDPA, Philippines DPA 2012
