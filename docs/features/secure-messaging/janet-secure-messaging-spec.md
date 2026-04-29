# JANET — Secure Messaging Platform

**Full Technical Specification**

| Field | Detail |
|---|---|
| Version | 1.0 |
| Date | April 2026 |
| Author | Longevity Coach Platform |
| Stack | FastAPI · Supabase · React/Vite · Twilio · Expo |
| Regulatory | AHPRA · Privacy Act 1988 (AU) · Spam Act 2003 (AU) |
| Status | Specification — Ready for Development |

This document specifies the complete end-to-end architecture for Janet, the secure messaging layer of the Longevity Coach platform. It covers SMS-based OTP authentication via Twilio and Supabase Auth, the Supabase database schema for encrypted message storage, FastAPI backend endpoints, and the React/Expo frontend integration pattern.

---

## 1. System Overview

Janet enables secure, asynchronous communication between coaches and clients on the Longevity Coach platform. The flow is: an event triggers an SMS nudge, the client authenticates via OTP, and the conversation proceeds through an encrypted in-app messaging thread. No health data ever travels via SMS.

### 1.1 End-to-End Flow

| Step | Actor | Channel | Description |
|---|---|---|---|
| 1 | Platform | Internal | Event fires: check-in due, biomarker alert, new recommendation |
| 2 | Twilio | SMS | Content-free nudge sent to client mobile — no PHI in message body |
| 3 | Client | App/Web | Client taps deep link, opens Janet login screen |
| 4 | Supabase Auth | SMS OTP | 6-digit OTP sent via Twilio, client authenticates |
| 5 | Client | In-App | Client lands in encrypted Janet thread, reads and replies securely |
| 6 | Coach | In-App | Coach notified via push, responds in same encrypted thread |

### 1.2 Design Principles

- **Zero PHI in SMS** — SMS is the doorbell, not the message
- **Single vendor for auth + realtime** — Supabase handles both OTP and message delivery
- **Compliance-first schema** — encryption at rest, audit log, 7-year retention
- **Commission partner-ready** — messages scoped to `coach_id` for multi-partner model
- **Offline-tolerant** — messages queue locally on mobile and sync on reconnect

---

## 2. Twilio + Supabase Auth Configuration

### 2.1 Twilio Setup

Supabase Auth has a native Twilio integration. You configure it directly in the Supabase dashboard — no separate Twilio SDK is needed in your backend for OTP delivery.

#### 2.1.1 Twilio Account Requirements

| Requirement | Detail |
|---|---|
| Account type | Twilio pay-as-you-go or committed use plan |
| Phone number | Australian local number (+61) or Alphanumeric Sender ID |
| Alphanumeric ID | "JanetHealth" — displays instead of number (AU supported) |
| SMS geo-permissions | Enable Australia in Twilio console geographic permissions |
| Credentials needed | Account SID, Auth Token, Messaging Service SID (or From number) |

#### 2.1.2 Supabase Auth — Phone Provider Config

In **Supabase Dashboard → Authentication → Providers → Phone**:

```
Enable Phone provider:        ON
SMS Provider:                 Twilio
Twilio Account SID:           AC...
Twilio Auth Token:            [from Twilio console]
Twilio Message Service SID:   MG... (preferred over From number)
OTP Expiry:                   300 (5 minutes)
OTP Length:                   6
```

> ⚑ Use a Messaging Service SID rather than a direct From number. It enables Twilio's Copilot for carrier optimisation and gives you a fallback number pool for AU delivery.

#### 2.1.3 SMS Message Template

Customise in **Dashboard → Authentication → Email Templates → Phone (SMS)**:

```
Your Janet verification code is: {{ .Token }}
Expires in 5 minutes. Do not share this code.
```

> ⚑ AU Spam Act 2003: ensure your sender ID is identifiable (`JanetHealth`) and the message contains no marketing content.

#### 2.1.4 Trigger SMS — Nudge via Twilio REST (FastAPI)

The notification SMS (Step 2 in the flow) is a separate call from OTP auth. This is triggered by your FastAPI backend when a platform event fires:

```
POST https://api.twilio.com/2010-04-01/Accounts/{SID}/Messages.json

From: JanetHealth  (Alphanumeric Sender ID)
To:   +61{client_mobile}
Body: You have a new message from your health coach.
      View securely: https://app.janetcoach.com.au/messages
```

> ⚑ Never include the client name, health topic, or any clinical context in the SMS body. The URL should be a generic deep link — not a session token.

### 2.2 Authentication Flow (Frontend)

#### 2.2.1 OTP Request

```ts
// React / Expo — request OTP
const { error } = await supabase.auth.signInWithOtp({
  phone: '+61412345678',  // E.164 format
});
```

#### 2.2.2 OTP Verify

```ts
// Verify OTP — creates session on success
const { data, error } = await supabase.auth.verifyOtp({
  phone: '+61412345678',
  token: '123456',
  type: 'sms',
});
// data.session contains access_token and refresh_token
```

#### 2.2.3 Session Persistence

```ts
// supabase-js handles session refresh automatically
// For Expo: use AsyncStorage adapter
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabase = createClient(URL, ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
  },
});
```

---

## 3. Supabase Database Schema

### 3.1 Schema Overview

The messaging schema sits in a dedicated `janet` Postgres schema within your existing Supabase project, isolating it from the longevity_coach biomarker and scoring tables.

### 3.2 Core Tables

#### 3.2.1 conversations

```sql
CREATE TABLE janet.conversations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  coach_id     UUID NOT NULL REFERENCES auth.users(id),
  status       TEXT NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active','archived','closed')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata     JSONB DEFAULT '{}'
);

CREATE INDEX ON janet.conversations(client_id);
CREATE INDEX ON janet.conversations(coach_id);
```

#### 3.2.2 messages

```sql
CREATE TABLE janet.messages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id   UUID NOT NULL
                      REFERENCES janet.conversations(id) ON DELETE CASCADE,
  sender_id         UUID NOT NULL REFERENCES auth.users(id),
  sender_role       TEXT NOT NULL CHECK (sender_role IN ('client','coach','system')),
  body_encrypted    BYTEA NOT NULL,  -- AES-256-GCM encrypted
  body_iv           BYTEA NOT NULL,  -- initialisation vector
  body_preview      TEXT,            -- plaintext 30-char preview for push notif
  message_type      TEXT NOT NULL DEFAULT 'text'
                      CHECK (message_type IN ('text','file','system_event')),
  read_at           TIMESTAMPTZ,
  delivered_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ  -- soft delete
);

CREATE INDEX ON janet.messages(conversation_id, created_at DESC);
CREATE INDEX ON janet.messages(sender_id);
```

> ⚑ Encrypt `body_encrypted` in your FastAPI backend before `INSERT`. Store the IV alongside. Never store plaintext message bodies in the database.

#### 3.2.3 notification_log

```sql
CREATE TABLE janet.notification_log (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id),
  conversation_id  UUID REFERENCES janet.conversations(id),
  channel          TEXT NOT NULL CHECK (channel IN ('sms','push','email')),
  twilio_sid       TEXT,            -- Twilio MessageSid for delivery tracking
  status           TEXT NOT NULL DEFAULT 'queued'
                     CHECK (status IN ('queued','sent','delivered','failed')),
  sent_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### 3.2.4 sms_consent

```sql
CREATE TABLE janet.sms_consent (
  user_id          UUID PRIMARY KEY REFERENCES auth.users(id),
  consented        BOOLEAN NOT NULL DEFAULT false,
  consent_date     TIMESTAMPTZ,
  consent_method   TEXT,  -- 'onboarding_form', 'explicit_opt_in'
  withdrawn_date   TIMESTAMPTZ
);
```

> ⚑ AU Spam Act 2003 compliance: you must record explicit consent before sending any commercial SMS. Check `janet.sms_consent` before every Twilio call.

### 3.3 Row Level Security (RLS)

Enable RLS on all Janet tables. Clients see only their own conversations; coaches see conversations where `coach_id` matches their user ID.

```sql
ALTER TABLE janet.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE janet.messages ENABLE ROW LEVEL SECURITY;

-- Clients: read own conversations
CREATE POLICY client_conversations ON janet.conversations
  FOR SELECT USING (auth.uid() = client_id);

-- Coaches: read assigned conversations
CREATE POLICY coach_conversations ON janet.conversations
  FOR SELECT USING (auth.uid() = coach_id);

-- Messages: visible to conversation participants only
CREATE POLICY message_visibility ON janet.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM janet.conversations c
      WHERE c.id = conversation_id
      AND (c.client_id = auth.uid() OR c.coach_id = auth.uid())
    )
  );
```

### 3.4 Realtime Subscription

Supabase Realtime enables live message delivery without polling. Enable it on the messages table:

```sql
-- Enable realtime for janet schema
ALTER PUBLICATION supabase_realtime ADD TABLE janet.messages;
```

```ts
// Frontend subscription
const channel = supabase
  .channel('janet-messages')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'janet',
    table: 'messages',
    filter: `conversation_id=eq.${conversationId}`,
  }, (payload) => {
    decryptAndAppend(payload.new);
  })
  .subscribe();
```

---

## 4. FastAPI Backend

### 4.1 Key Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/janet/conversations` | JWT (coach) | Create a new conversation thread |
| GET | `/janet/conversations` | JWT | List conversations for authenticated user |
| POST | `/janet/messages` | JWT | Send an encrypted message |
| GET | `/janet/messages/{conv_id}` | JWT | Fetch paginated message history |
| POST | `/janet/notify/sms` | Internal API key | Trigger SMS nudge via Twilio |
| POST | `/janet/notify/push` | Internal API key | Trigger push notification |
| PATCH | `/janet/messages/{id}/read` | JWT | Mark message as read |
| GET | `/janet/consent/{user_id}` | JWT (coach) | Check SMS consent status |

### 4.2 Send Message Endpoint

```python
# POST /janet/messages
@router.post('/messages', response_model=MessageOut)
async def send_message(
    payload: MessageIn,
    user: User = Depends(get_current_user),
    db: AsyncClient = Depends(get_supabase),
):
    # 1. Verify user is participant in conversation
    conv = await verify_participant(db, payload.conversation_id, user.id)

    # 2. Encrypt body with AES-256-GCM
    iv, encrypted = encrypt_message(payload.body, settings.MESSAGE_KEY)

    # 3. Insert to Supabase
    row = await db.table('janet.messages').insert({
        'conversation_id': str(payload.conversation_id),
        'sender_id': user.id,
        'sender_role': user.role,
        'body_encrypted': encrypted,
        'body_iv': iv,
        'body_preview': payload.body[:30],
    }).execute()

    # 4. Trigger async SMS nudge if recipient offline
    await maybe_send_sms_nudge.delay(conv.other_party_id)

    return MessageOut(**row.data[0])
```

### 4.3 Encryption Utility

```python
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import os, base64

def encrypt_message(plaintext: str, key_hex: str) -> tuple[bytes, bytes]:
    key = bytes.fromhex(key_hex)  # 32 bytes for AES-256
    iv = os.urandom(12)           # 96-bit IV for GCM
    aesgcm = AESGCM(key)
    ciphertext = aesgcm.encrypt(iv, plaintext.encode(), None)
    return iv, ciphertext

def decrypt_message(iv: bytes, ciphertext: bytes, key_hex: str) -> str:
    key = bytes.fromhex(key_hex)
    aesgcm = AESGCM(key)
    return aesgcm.decrypt(iv, ciphertext, None).decode()
```

> ⚑ Store `MESSAGE_KEY` in AWS Secrets Manager or Supabase Vault — never in `.env` committed to git. Rotate the key on a quarterly schedule.

### 4.4 SMS Nudge Logic

```python
async def maybe_send_sms_nudge(recipient_id: str):
    # 1. Check SMS consent
    consent = await get_sms_consent(recipient_id)
    if not consent.consented:
        return

    # 2. Check if user is currently active (Supabase presence)
    if await is_user_online(recipient_id):
        return  # Skip SMS, they'll see it in-app

    # 3. Rate limit — max 1 SMS nudge per 4 hours per conversation
    if await recent_nudge_sent(recipient_id, hours=4):
        return

    # 4. Send via Twilio
    client = Client(settings.TWILIO_SID, settings.TWILIO_TOKEN)
    msg = client.messages.create(
        messaging_service_sid=settings.TWILIO_MSID,
        to=f'+61{recipient_mobile}',
        body='You have a new message from your health coach. '
             'View securely: https://app.janetcoach.com.au/messages'
    )
    await log_notification(recipient_id, 'sms', msg.sid)
```

---

## 5. Frontend Integration

### 5.1 Component Structure

| Component | Responsibility |
|---|---|
| `JanetLogin.tsx` | Phone number input + OTP verify screen |
| `JanetInbox.tsx` | List of conversations with unread counts |
| `JanetThread.tsx` | Message thread with realtime subscription |
| `JanetCompose.tsx` | Message input with send + attachment |
| `useJanetAuth.ts` | Hook: OTP request/verify, session state |
| `useJanetMessages.ts` | Hook: fetch history, realtime subscribe, decrypt |
| `janetApi.ts` | FastAPI client: send message, mark read, fetch thread |

### 5.2 Deep Link Handling

```json
// Expo — app.json
"scheme": "janetcoach",
"intentFilters": [{ "action": "VIEW", "data": { "scheme": "https",
  "host": "app.janetcoach.com.au", "pathPrefix": "/messages" } }]
```

```ts
// React Navigation — handle deep link
const linking = {
  prefixes: ['janetcoach://', 'https://app.janetcoach.com.au'],
  config: { screens: { Messages: 'messages' } },
};
```

### 5.3 Environment Variables

| Variable | Value / Source |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key (safe to expose) |
| `TWILIO_ACCOUNT_SID` | Twilio console — backend only |
| `TWILIO_AUTH_TOKEN` | Twilio console — backend only, AWS Secrets Manager |
| `TWILIO_MESSAGING_SID` | Messaging Service SID from Twilio |
| `MESSAGE_KEY` | 32-byte hex key for AES-256 — AWS Secrets Manager |
| `JANET_DEEP_LINK_BASE` | `https://app.janetcoach.com.au/messages` |

---

## 6. Compliance Summary

### 6.1 Australian Regulatory Obligations

| Obligation | Legislation | Requirement | Implementation |
|---|---|---|---|
| SMS consent | Spam Act 2003 | Explicit opt-in before any commercial SMS | `janet.sms_consent` table, consent at onboarding |
| Health data encryption | Privacy Act 1988 | PHI protected at rest and in transit | AES-256-GCM at rest, TLS 1.3 in transit |
| Data retention | Privacy Act 1988 | Health records 7 years minimum | Soft delete only, retention policy in Supabase |
| Access controls | Privacy Act 1988 | Minimum necessary access | RLS policies per user role |
| Breach notification | Privacy Act 1988 | Notify OAIC within 30 days | Audit log in `notification_log` table |
| Sender ID | Spam Act 2003 | Identifiable sender | Alphanumeric: `JanetHealth` |

### 6.2 Key Rules

- Never include PHI, client name, or clinical context in any SMS body
- Always check `sms_consent` before triggering any Twilio call
- Rotate AES message key quarterly — re-encrypt stored messages on rotation
- Audit all message access — log reads with `user_id` and timestamp
- Enforce 7-year retention — use soft delete (`deleted_at`) not hard `DELETE`

---

## 7. Implementation Checklist

### Phase 1 — Auth & Infrastructure (Week 1–2)

- [ ] Configure Twilio account: AU phone number + Alphanumeric Sender ID (`JanetHealth`)
- [ ] Enable Supabase Phone Auth provider with Twilio credentials
- [ ] Create `janet` schema and all tables with RLS policies
- [ ] Store Twilio credentials and `MESSAGE_KEY` in AWS Secrets Manager
- [ ] Build `JanetLogin` component with OTP request/verify flow
- [ ] Test OTP delivery to AU mobile numbers end-to-end

### Phase 2 — Messaging Core (Week 3–4)

- [ ] Build FastAPI message endpoints with AES-256-GCM encryption
- [ ] Enable Supabase Realtime on `janet.messages`
- [ ] Build `JanetThread` component with realtime subscription + decrypt
- [ ] Build `JanetInbox` with unread badge counts
- [ ] Wire SMS nudge trigger to platform event system

### Phase 3 — Compliance & Polish (Week 5)

- [ ] Add `sms_consent` capture to onboarding flow
- [ ] Implement rate limiting on SMS nudges (4-hour window)
- [ ] Deep link integration for iOS and Android
- [ ] Penetration test: verify RLS prevents cross-account access
- [ ] Document key rotation procedure and test restore from backup
