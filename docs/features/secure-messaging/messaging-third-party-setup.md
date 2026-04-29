# Secure Messaging — Third-Party Service Setup

Setup guide for the three external services required by the secure messaging feature: Supabase Realtime, Twilio SMS, and Twilio WhatsApp Business.

---

## 1. Supabase Realtime

**No new keys required.** Uses the existing `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

### Enable Realtime on messaging tables

Run this in the **SQL editor** (dashboard or local `supabase db push`):

```sql
-- 1. Add tables to the Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE janet.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE janet.conversations;

-- 2. Grant schema access — required for non-public schemas
--    Without this, Realtime subscriptions silently receive nothing
GRANT USAGE ON SCHEMA janet TO anon, authenticated;
GRANT SELECT ON janet.messages TO anon, authenticated;
GRANT SELECT ON janet.conversations TO anon, authenticated;
```

You can also toggle tables on via **Database → Replication** in the dashboard, but you still need the `GRANT` statements above for the `janet` schema — the dashboard toggle alone is not enough.

### Event filtering

There is no event filter in the publication or dashboard. Filtering by event type (`INSERT`, `UPDATE`, `DELETE`) is done **client-side** in the JavaScript subscription:

```ts
supabase
  .channel('new-messages')
  .on('postgres_changes', { event: 'INSERT', schema: 'janet', table: 'messages' }, handler)
  .subscribe()
```

### Notes

- RLS is enabled on both tables (per the schema). Supabase Realtime respects RLS — clients only receive rows their policy allows them to `SELECT`.
- No package changes needed. `@supabase/realtime-js` is already bundled with `@supabase/supabase-js`.
- Test with the Supabase dashboard **Realtime Inspector** (Database → Replication → Realtime) before running integration tests.

---

## 2. Twilio SMS

### Account setup

1. Sign up at [console.twilio.com](https://console.twilio.com)
2. Complete identity verification (required for AU numbers)

### API credentials

Prefer **API Keys** over the master Account SID + Auth Token for app-level access — they are scoped and revocable without affecting the account.

1. Go to **Account → API Keys & Tokens → Create API Key**
2. Select **Standard** key type
3. Copy the **SID** (starts with `SK`) and **Secret** — the Secret is shown only once

### Phone number

1. Go to **Phone Numbers → Manage → Buy a Number**
2. Filter by: Country = Australia, Capabilities = SMS
3. Purchase a number (approx. AUD $2/month)

### Alphanumeric sender ID (optional, AU)

Allows messages to show `LongevityC` as the sender instead of a phone number.

1. Go to **Messaging → Sender Pool → Alphanumeric Sender IDs**
2. Register `LongevityC`
3. Requires business name verification with Twilio — allow 1–3 business days
4. Once approved, set `TWILIO_ALPHANUMERIC_SENDER=LongevityC` in your env

> **Note:** Alphanumeric senders are one-way — patients cannot reply to them. If two-way SMS is ever needed, keep the phone number as fallback.

### ENV vars

```bash
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_API_KEY_SID=SKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_API_KEY_SECRET=your_api_key_secret
TWILIO_SMS_FROM=+61XXXXXXXXX
TWILIO_ALPHANUMERIC_SENDER=LongevityC   # add only after approval
```

---

## 3. Twilio WhatsApp Business API

This is the longest path — allow **5–10 business days** for Meta approval. Start this in parallel with SMS setup.

### Phase 1 — Sandbox (dev/test, immediate)

1. In Twilio console → **Messaging → Try it out → Send a WhatsApp message**
2. Note the sandbox number (e.g. `+1 415 523 8886`) and join code
3. Set `TWILIO_WHATSAPP_FROM=whatsapp:+14155238886` for local and staging environments
4. Sandbox is sufficient for development — switch to the approved number for production only

### Phase 2 — Production number (requires Meta approval)

**Step 1 — Meta Business Manager**

1. Go to [business.facebook.com](https://business.facebook.com) → **Business Settings → WhatsApp Accounts**
2. Create a **WhatsApp Business Account (WABA)**
3. Verify your business: AU ABN, registered business name, business address

**Step 2 — Link to Twilio**

1. In Twilio console → **Messaging → Senders → WhatsApp Senders → Request a WhatsApp-enabled number**
2. Follow the embedded Meta Business Manager flow
3. Select your verified WABA
4. Choose a display name: `Longevity Coach`
5. Submit — Meta review takes 2–5 business days

**Step 3 — Submit notification template**

WhatsApp requires pre-approved templates for outbound messages sent outside the 24-hour user-initiated window.

Submit via Twilio console → **Messaging → Content Template Builder**:

```
Template name:   new_message_notification
Category:        UTILITY
Language:        en
Body:            You have a new message from your care team on Longevity Coach.
                 Open the app to view and reply: {{1}}
Footer:          Reply STOP to opt out
```

- `{{1}}` = deep-link URL to the conversation (e.g. `https://longevity-coach.io/messages`)
- **UTILITY** category approves faster than MARKETING
- Do not include PHI, patient name, or message content in the template body

Once approved, Twilio returns a **Content SID** (`HXxxxxxxxx`). Set this as `TWILIO_WHATSAPP_TEMPLATE_SID`.

### ENV vars

```bash
# Dev/staging — sandbox
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886

# Production — replace with approved number after Meta approval
# TWILIO_WHATSAPP_FROM=whatsapp:+61XXXXXXXXX

TWILIO_WHATSAPP_TEMPLATE_SID=HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## 4. Encryption master key

The messaging layer uses AES-256-GCM with HKDF per-conversation key derivation. A single master key is stored in env and never written to the database.

**Generate:**
```bash
openssl rand -base64 32
```

**Rules:**
- Generate once per environment (dev, staging, prod)
- Store only in env — never commit to git, never log
- Rotation requires a re-encryption migration — treat it like the database password
- If compromised, open a security incident immediately; all conversation keys are derived from it

```bash
MESSAGES_MASTER_KEY=<output of openssl rand -base64 32>
```

---

## 5. Full ENV var checklist

Add all of these to `.env.local` (local dev), Vercel project environment variables (staging + prod), and the `.env.example` template (values blank).

```bash
# Twilio — SMS
TWILIO_ACCOUNT_SID=
TWILIO_API_KEY_SID=
TWILIO_API_KEY_SECRET=
TWILIO_SMS_FROM=
TWILIO_ALPHANUMERIC_SENDER=        # optional, add after approval

# Twilio — WhatsApp
TWILIO_WHATSAPP_FROM=
TWILIO_WHATSAPP_TEMPLATE_SID=

# Messaging encryption
MESSAGES_MASTER_KEY=
```

Supabase Realtime requires no new env vars.

---

## 6. Recommended setup order

| Step | Service | Time | Blocker |
|------|---------|------|---------|
| 1 | Enable Supabase Realtime on `janet.*` tables | 5 min | None |
| 2 | Create Twilio account + buy AU number | 1 hour | Identity verification |
| 3 | Generate and store `MESSAGES_MASTER_KEY` | 5 min | None |
| 4 | Test SMS with your own number | 30 min | Step 2 |
| 5 | Start Meta business verification (async) | 15 min to submit | Takes 2–5 days |
| 6 | Submit WhatsApp notification template | 30 min | Step 5 |
| 7 | Switch `TWILIO_WHATSAPP_FROM` to prod number | 5 min | Meta approval |

Steps 1–4 unblock all development and staging work. Steps 5–7 are production-only prerequisites and can proceed in the background.
