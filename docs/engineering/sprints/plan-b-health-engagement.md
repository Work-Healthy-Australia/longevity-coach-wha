# Plan B — Health Engagement & Reporting

**Owner:** Engineer B  
**Can start:** Immediately from current `qa/patient-uploads` branch  
**Depends on Plan A:** No  
**Plan A depends on this:** No

## Summary

Five independent items. Each can be built in any order — they all read from existing tables written by the risk engine and supplement pipelines.

| # | Item | Touches |
|---|---|---|
| 1 | Consumer dashboard — health summary UI | `app/(app)/dashboard/`, `lib/risk/` |
| 2 | Daily check-in | new migration + `app/(app)/check-in/` |
| 3 | Email drip automation | `lib/email/drip.ts`, `app/api/cron/` |
| 4 | Admin CRM | `app/(admin)/admin/users/` |
| 5 | Branded PDF report | `lib/pdf/`, `app/(app)/report/` |

No AI layer changes. Plan A engineers will not conflict.

---

## Pre-flight

```sh
# Confirm pending migrations are applied
supabase db push

# Regen types if not already done by Plan A
supabase gen types typescript --linked \
  | grep -v "^Initialising\|^A new version\|^We recommend" \
  > lib/supabase/database.types.ts
```

---

## Item 1 — Consumer dashboard health summary

The dashboard currently shows placeholder content. Wire it to live data from `risk_scores` and `supplement_protocols`.

### 1a. `lib/risk/summary.ts`

Server-side helper — loads the latest risk scores and supplement protocol for a user:

```typescript
import { createServerClient } from '@/lib/supabase/server';

export async function loadHealthSummary(userId: string) {
  const supabase = await createServerClient();
  const [riskResult, supplementResult] = await Promise.all([
    supabase
      .from('risk_scores')
      .select('domain, score, biological_age, narrative, updated_at')
      .eq('user_uuid', userId)
      .order('updated_at', { ascending: false })
      .limit(5),
    supabase
      .from('supplement_protocols')
      .select('protocol, generated_at')
      .eq('user_uuid', userId)
      .order('generated_at', { ascending: false })
      .limit(1)
      .single(),
  ]);
  return {
    domains: riskResult.data ?? [],
    supplement: supplementResult.data ?? null,
  };
}
```

### 1b. `app/(app)/dashboard/page.tsx` — wire live data

Replace placeholder with server component that calls `loadHealthSummary`. Pass data to:
- `<BioAgeDisplay />` — shows calculated biological age vs chronological age
- `<RiskDomainChart />` — 5-domain bar chart (CV, Metabolic, Neuro, Onco, MSK)
- `<SupplementSummary />` — top 3 supplements from the active protocol
- `<NextActions />` — derived from highest-risk domain

### 1c. Components — `app/(app)/dashboard/_components/`

| Component | What it renders |
|---|---|
| `bio-age-display.tsx` | Large number + delta vs chronological age |
| `risk-domain-chart.tsx` | 5 horizontal bars 0–100 with colour bands |
| `supplement-summary.tsx` | Top supplements with tier badge (critical / high / recommended) |
| `next-actions.tsx` | 3 action items generated from highest-risk domain narrative |

Use Recharts (already available in the stack) for the risk domain chart. All components are server components — no client needed unless interactive.

### 1d. Loading states

The dashboard data fetch can be slow on first load. Wrap each section in a `<Suspense>` boundary with a skeleton placeholder.

---

## Item 2 — Daily check-in

A lightweight daily form so members can log symptoms, mood, sleep, and exercise. Data feeds into Janet's context (via Plan A integration) and future trend charts.

### 2a. Migration

Check if `0010_biomarkers_daily_logs.sql` is already applied:

```sh
supabase db diff   # should show no diff for this table
```

If not applied: `supabase db push`.

The `biomarkers.daily_logs` table schema (from migration 0010):
- `user_uuid uuid` — RLS scoped
- `logged_at timestamptz` — one entry per day per user
- `mood int CHECK (1–5)` — 1 = very bad, 5 = excellent
- `sleep_hours numeric(3,1)` — hours slept
- `energy int CHECK (1–5)`
- `exercise_minutes int`
- `notes text` — free text

### 2b. `app/(app)/check-in/page.tsx`

Simple form. One page, no multi-step. Submits server action. Shows last 7 days of entries below the form.

```
┌──────────────────────────────┐
│  Daily Check-In              │
│                              │
│  How are you feeling? ★★★☆☆  │
│  Sleep last night  [7.5] hrs │
│  Energy level      ★★★★☆     │
│  Exercise today    [30] min  │
│  Notes             [......] │
│                              │
│           [Save today's log] │
│                              │
│  Past 7 days ─────────────── │
│  2026-04-27  😊  7h  ⚡⚡⚡⚡  │
│  2026-04-26  😐  6h  ⚡⚡⚡   │
└──────────────────────────────┘
```

### 2c. `app/(app)/check-in/actions.ts`

```typescript
'use server';
import { createServerClient } from '@/lib/supabase/server';

export async function saveCheckIn(formData: FormData) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { error } = await supabase
    .schema('biomarkers')
    .from('daily_logs')
    .upsert({
      user_uuid: user.id,
      logged_at: new Date().toISOString().slice(0, 10), // date-only key
      mood: Number(formData.get('mood')),
      sleep_hours: Number(formData.get('sleep_hours')),
      energy: Number(formData.get('energy')),
      exercise_minutes: Number(formData.get('exercise_minutes')),
      notes: formData.get('notes') as string,
    }, { onConflict: 'user_uuid,logged_at' });

  return error ? { error: error.message } : { success: true };
}
```

### 2d. Nav — add Check-in link

Add `/check-in` to the signed-in app nav. Register in `proxy.ts` protected routes if not already covered.

---

## Item 3 — Email drip automation

Three-email onboarding sequence: Day 1 (welcome + what's next), Day 3 (nudge to view report), Day 7 (trial-to-paid conversion).

### 3a. `lib/email/drip.ts` — drip definitions

```typescript
export const DRIP_SEQUENCE = [
  { day: 1, templateId: 'onboarding-day1', subject: 'Your longevity journey starts now' },
  { day: 3, templateId: 'onboarding-day3', subject: 'Have you seen your biological age?' },
  { day: 7, templateId: 'onboarding-day7', subject: 'Your 7-day health snapshot is ready' },
];
```

Migration `0018_drip_tracking.sql` (already written) creates `drip_events` table to track sent emails. Apply if not already applied.

### 3b. `app/api/cron/drip/route.ts` — cron handler

Runs daily. Queries users who should receive each drip email today.

```typescript
export const maxDuration = 60;

export async function GET(req: Request) {
  // Verify cron secret
  if (req.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  // For each drip step, find users at day N who haven't received it yet
  // Send via Resend, record in drip_events
}
```

### 3c. `vercel.json` — cron schedule

```json
{
  "crons": [
    { "path": "/api/cron/drip", "schedule": "0 9 * * *" }
  ]
}
```

Runs at 09:00 UTC daily. Add `CRON_SECRET` to `.env.example`.

### 3d. Email templates — `lib/email/templates/`

Three template files: `onboarding-day1.tsx`, `onboarding-day3.tsx`, `onboarding-day7.tsx`. Use the existing Resend + React Email setup. Mirror the welcome email structure.

---

## Item 4 — Admin CRM

### 4a. `app/(admin)/admin/users/page.tsx`

Table of all members. Columns: email, name, plan, signup date, report status (generated / pending), subscription status (trial / active / cancelled).

Data source: join `profiles` + `subscriptions` + `risk_scores` via admin Supabase client.

```typescript
// Server component — uses admin client to bypass RLS
import { createAdminClient } from '@/lib/supabase/admin';

const admin = createAdminClient();
const { data: users } = await admin
  .from('profiles')
  .select(`
    id, full_name, created_at,
    subscriptions(status, plan, current_period_end),
    risk_scores(biological_age, updated_at)
  `)
  .order('created_at', { ascending: false })
  .limit(100);
```

### 4b. `app/(admin)/admin/users/[id]/page.tsx`

User detail view:
- Profile summary (name, DOB-derived age, signup date)
- Subscription history
- Risk score summary (5 domain scores + biological age)
- Drip emails sent (from `drip_events`)
- Uploads list (from `patient_uploads`)

Read-only. No editing from admin (edits go through the member's own account flow).

### 4c. `app/(admin)/admin/page.tsx` — analytics dashboard

Key metrics:
- Total members (count of `profiles`)
- Active subscriptions (count of `subscriptions WHERE status = 'active'`)
- Reports generated (count of `risk_scores` with distinct user_uuid)
- MRR (sum of plan prices for active subscriptions)

Use simple server-rendered numbers — no charting library needed for MVP.

### 4d. Admin nav — wire user links

In `app/(admin)/layout.tsx`, add nav links:
- `/admin` → Overview
- `/admin/users` → Members
- (Plan A adds `/admin/agents` → Agents)

---

## Item 5 — Branded PDF report

The branded PDF must include: biological age, 5-domain risk scores, risk narrative, full supplement protocol with dosing, and a "what to do next" section.

### 5a. `lib/pdf/report-doc.tsx` — update layout

The `@react-pdf/renderer` component already exists. Verify and complete:
- **Cover page:** biological age (large), patient first name, report date, logo
- **Risk summary page:** 5 domain scores as labelled bars, biological vs chronological age delta
- **Risk narrative page:** Atlas-generated narrative text, formatted paragraphs
- **Supplement protocol pages:** table of supplements with tier, dose, timing, notes
- **Next steps page:** 3 action items from highest-risk domain

### 5b. `app/(app)/report/pdf/route.ts` — PDF download endpoint

```typescript
import { renderToBuffer } from '@react-pdf/renderer';
import { ReportDoc } from '@/lib/pdf/report-doc';
import { loadHealthSummary } from '@/lib/risk/summary';

export async function GET(req: Request) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const summary = await loadHealthSummary(user.id);
  const buffer = await renderToBuffer(<ReportDoc data={summary} />);

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="longevity-report.pdf"',
    },
  });
}
```

### 5c. Download button on report page

Add a `<a href="/report/pdf" download>Download PDF</a>` button to the existing report page. Style to match the report page design system.

### 5d. Register route in `proxy.ts`

Add `/report/pdf` to the protected routes list if not already covered by the `/report` catch.

---

## Build sequence

Items are independent — build in whichever order makes sense for the engineer. Suggested order for fastest visible progress:

```
1. lib/risk/summary.ts
2. app/(app)/dashboard/* (wire live data)
3. app/(admin)/admin/* (CRM — James needs this most)
4. lib/email/drip.ts + templates + cron route
5. vercel.json cron + CRON_SECRET env var
6. app/(app)/check-in/* (form + server action)
7. lib/pdf/report-doc.tsx (complete layout)
8. app/(app)/report/pdf/route.ts (download endpoint)
9. pnpm build — must be clean before merge
```

---

## Definition of done

- [ ] `pnpm build` clean
- [ ] Dashboard shows live bio-age, 5-domain scores, and supplement summary
- [ ] Daily check-in form saves to `biomarkers.daily_logs` and shows last 7 entries
- [ ] Drip cron fires correctly for Day 1 / 3 / 7 (verify with Resend test sends)
- [ ] Admin CRM lists all members with subscription status and report status
- [ ] Admin analytics page shows MRR, total members, and reports generated
- [ ] PDF downloads from `/report/pdf` with all sections populated
- [ ] `.env.example` updated with `CRON_SECRET`
