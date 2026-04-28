# Plan: Simple Features (No AI Layer)

**Who runs this:** Anyone with Claude Code. No deep technical knowledge required.  
**Branch to start from:** `qa/patient-uploads`  
**Conflicts with Plan Heavy:** None. These files do not overlap.  
**Estimated time:** 1–2 days for all five items.

---

## Before you start — run these two commands

```sh
# 1. Make sure the database is up to date
supabase db push

# 2. Rebuild the TypeScript types so the code knows about the latest tables
supabase gen types typescript --linked \
  | grep -v "^Initialising\|^A new version\|^We recommend" \
  > lib/supabase/database.types.ts
```

If `supabase` is not installed: `brew install supabase/tap/supabase`.

---

## Item 1 — Dashboard: show the supplement protocol

**What this does:** The dashboard already shows risk scores. This adds a new section below the risk profile card that shows the member's active supplement protocol — the top supplements with their dose, timing, and priority tier.

**What already exists:** The `supplement_plans` table is already in the database. It has an `items` column (JSONB) that holds an array of supplement objects. The risk scores are already wired up in `app/(app)/dashboard/page.tsx`. We just need to read `supplement_plans` and display the items.

---

### Step 1a — Add the supplement query to the dashboard

**EDIT** `app/(app)/dashboard/page.tsx`

Find the block that queries `risk_scores` (around line 20). After it, add a new query for the supplement plan. The full block to look for and the line to add after:

```typescript
// Find this existing query:
const { data: risk } = await supabase
  .from("risk_scores")
  .select("biological_age, cv_risk, metabolic_risk, neuro_risk, onco_risk, msk_risk")
  .eq("user_uuid", user!.id)
  .order("created_at", { ascending: false })
  .limit(1)
  .maybeSingle();

// ADD THIS directly after:
const { data: supplement } = await supabase
  .from("supplement_plans")
  .select("items, status, created_at")
  .eq("patient_uuid", user!.id)
  .eq("status", "active")
  .order("created_at", { ascending: false })
  .limit(1)
  .maybeSingle();
```

---

### Step 1b — Add the supplement types

At the top of the same file, after the imports, add a type for the supplement items:

```typescript
type SupplementItem = {
  name: string;
  dose: string;
  timing?: string;
  tier?: "critical" | "high" | "recommended" | "performance";
  note?: string;
};
```

---

### Step 1c — Add the supplement card to the JSX

In the same file, find the last `</div>` that closes the risk scores card, then add the new card directly after it (before the closing `</div className="lc-dash">`):

```typescript
{/* Supplement protocol */}
{supplement?.items && (
  <div className="card">
    <div className="head">
      <h2>Supplement protocol</h2>
      <span className="badge primary">Active</span>
    </div>
    <p style={{ marginBottom: "16px", color: "var(--lc-muted)" }}>
      Your personalised protocol based on your risk profile and uploaded pathology.
    </p>
    <div className="supplement-list">
      {(supplement.items as SupplementItem[]).slice(0, 6).map((item, i) => (
        <div className="supplement-row" key={i}>
          <div className="supplement-name">
            <strong>{item.name}</strong>
            {item.tier && (
              <span className={`badge tier-${item.tier}`}>{item.tier}</span>
            )}
          </div>
          <div className="supplement-details">
            {item.dose}{item.timing ? ` · ${item.timing}` : ""}
          </div>
          {item.note && (
            <div className="supplement-note">{item.note}</div>
          )}
        </div>
      ))}
    </div>
    <a href="/report" className="btn btn-ghost" style={{ marginTop: "16px" }}>
      View full protocol →
    </a>
  </div>
)}
```

---

### Step 1d — Add CSS for the supplement card

**EDIT** `app/(app)/dashboard/dashboard.css`

Add these classes at the end of the file:

```css
.supplement-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.supplement-row {
  padding: 12px;
  background: var(--lc-surface, #F4F7F9);
  border-radius: 8px;
}

.supplement-name {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.supplement-details {
  font-size: 13px;
  color: var(--lc-muted, #6B7C85);
}

.supplement-note {
  font-size: 12px;
  color: var(--lc-muted, #6B7C85);
  margin-top: 4px;
  font-style: italic;
}

.tier-critical { background: #FEE2E2; color: #991B1B; }
.tier-high     { background: #FEF3C7; color: #92400E; }
.tier-recommended { background: #D1FAE5; color: #065F46; }
.tier-performance { background: #DBEAFE; color: #1E40AF; }
```

---

### Step 1e — Check it builds

```sh
pnpm build
```

Fix any TypeScript errors before continuing. Common issue: if `supplement_plans` is not in `database.types.ts`, the query will show a type error. Run `supabase db push` then regenerate types (Step 0 above) and retry.

---

## Item 2 — Admin: user detail page

**What this does:** The admin users table already has a "View →" link for each user that goes to `/admin/users/[id]`. That page does not exist yet. This creates it — a read-only detail view showing the user's full profile, subscription history, risk scores, and uploaded documents.

---

### Step 2a — Create the file

**CREATE** `app/(admin)/admin/users/[id]/page.tsx`

This is a server component. It reads all data server-side and renders it. No client code needed.

```typescript
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";

// Force dynamic so admin always sees latest data
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdminClient();
  const { data } = await admin.from("profiles").select("full_name").eq("id", id).single();
  return { title: `${data?.full_name ?? "User"} · Admin · Longevity Coach` };
}

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = createAdminClient();

  // Load all user data in parallel
  const [profileResult, subResult, riskResult, uploadsResult] = await Promise.all([
    admin.from("profiles").select("*").eq("id", id).single(),
    admin
      .from("subscriptions")
      .select("status, price_id, current_period_start, current_period_end, cancel_at_period_end, created_at")
      .eq("user_uuid", id)
      .order("created_at", { ascending: false }),
    admin
      .from("risk_scores")
      .select("biological_age, cv_risk, metabolic_risk, neuro_risk, onco_risk, msk_risk, assessment_date, created_at")
      .eq("user_uuid", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single(),
    admin
      .from("patient_uploads")
      .select("id, original_filename, status, created_at")
      .eq("user_uuid", id)
      .order("created_at", { ascending: false }),
  ]);

  if (profileResult.error) notFound();

  const profile = profileResult.data;
  const subscriptions = subResult.data ?? [];
  const risk = riskResult.data ?? null;
  const uploads = uploadsResult.data ?? [];

  return (
    <div className="admin-content">
      <div style={{ marginBottom: "24px" }}>
        <a href="/admin/users" style={{ color: "var(--lc-teal)", textDecoration: "none", fontSize: "14px" }}>
          ← Back to users
        </a>
      </div>

      {/* Profile header */}
      <div className="admin-card" style={{ marginBottom: "24px" }}>
        <h2 className="admin-card-title">{profile.full_name ?? "Unknown"}</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px", marginTop: "16px" }}>
          <div>
            <div style={{ fontSize: "12px", color: "var(--lc-muted)", marginBottom: "4px" }}>User ID</div>
            <div style={{ fontFamily: "monospace", fontSize: "13px" }}>{profile.id}</div>
          </div>
          <div>
            <div style={{ fontSize: "12px", color: "var(--lc-muted)", marginBottom: "4px" }}>Signed up</div>
            <div>{formatDate(profile.created_at)}</div>
          </div>
          <div>
            <div style={{ fontSize: "12px", color: "var(--lc-muted)", marginBottom: "4px" }}>Role</div>
            <div>{profile.is_admin ? "Admin" : "Member"}</div>
          </div>
          {profile.date_of_birth && (
            <div>
              <div style={{ fontSize: "12px", color: "var(--lc-muted)", marginBottom: "4px" }}>Date of birth</div>
              <div>{profile.date_of_birth}</div>
            </div>
          )}
        </div>
      </div>

      {/* Risk scores */}
      <div className="admin-card" style={{ marginBottom: "24px" }}>
        <h3 className="admin-card-title">Risk profile</h3>
        {risk ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginTop: "16px" }}>
            {[
              ["Biological age", risk.biological_age != null ? `${Math.round(risk.biological_age)} yrs` : "—"],
              ["Cardiovascular", risk.cv_risk ?? "—"],
              ["Metabolic", risk.metabolic_risk ?? "—"],
              ["Neurological", risk.neuro_risk ?? "—"],
              ["Oncological", risk.onco_risk ?? "—"],
              ["Musculoskeletal", risk.msk_risk ?? "—"],
            ].map(([label, value]) => (
              <div key={label as string}>
                <div style={{ fontSize: "12px", color: "var(--lc-muted)", marginBottom: "4px" }}>{label as string}</div>
                <div style={{ fontWeight: 600 }}>{value as string | number}</div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: "var(--lc-muted)", marginTop: "12px" }}>No risk scores yet.</p>
        )}
      </div>

      {/* Subscriptions */}
      <div className="admin-card" style={{ marginBottom: "24px" }}>
        <h3 className="admin-card-title">Subscriptions</h3>
        {subscriptions.length > 0 ? (
          <table className="admin-table" style={{ marginTop: "16px" }}>
            <thead>
              <tr>
                <th>Status</th>
                <th>Plan</th>
                <th>Started</th>
                <th>Renews / ends</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.map((sub, i) => (
                <tr key={i}>
                  <td>
                    <span className={`status-badge status-${sub.status}`}>{sub.status}</span>
                  </td>
                  <td style={{ fontFamily: "monospace", fontSize: "12px" }}>{sub.price_id ?? "—"}</td>
                  <td>{formatDate(sub.current_period_start)}</td>
                  <td>
                    {formatDate(sub.current_period_end)}
                    {sub.cancel_at_period_end && (
                      <span style={{ marginLeft: "8px", fontSize: "12px", color: "var(--lc-muted)" }}>
                        (cancels)
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p style={{ color: "var(--lc-muted)", marginTop: "12px" }}>No subscriptions.</p>
        )}
      </div>

      {/* Uploads */}
      <div className="admin-card">
        <h3 className="admin-card-title">Uploaded documents</h3>
        {uploads.length > 0 ? (
          <table className="admin-table" style={{ marginTop: "16px" }}>
            <thead>
              <tr>
                <th>Filename</th>
                <th>Status</th>
                <th>Uploaded</th>
              </tr>
            </thead>
            <tbody>
              {uploads.map((u) => (
                <tr key={u.id}>
                  <td>{u.original_filename}</td>
                  <td><span className="badge">{u.status}</span></td>
                  <td>{formatDate(u.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p style={{ color: "var(--lc-muted)", marginTop: "12px" }}>No uploads.</p>
        )}
      </div>
    </div>
  );
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-AU", {
    year: "numeric", month: "short", day: "numeric",
  });
}
```

> **Gotcha:** `params` in Next.js 16 is a `Promise` — you must `await params` before destructuring. The code above already does this correctly. Do not remove the `await`.

---

### Step 2b — Check it builds

```sh
pnpm build
```

---

## Item 3 — Daily check-in form

**What this does:** Adds a `/check-in` page where members can log how they feel each day — mood, sleep hours, energy, and exercise minutes. Saves one entry per day. Shows the last 7 days below the form.

**Prerequisite:** Migration `0010_biomarkers_daily_logs.sql` must be applied. Run `supabase db push` and check there are no errors before starting this item.

> **Important:** This table is in the `biomarkers` schema, not `public`. When querying it with Supabase, you must call `.schema('biomarkers')` before `.from('daily_logs')`. The code below does this correctly — do not change that part.

---

### Step 3a — Create the page directory

```sh
mkdir -p app/\(app\)/check-in
```

---

### Step 3b — Create the server action

**CREATE** `app/(app)/check-in/actions.ts`

```typescript
"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type CheckInState = {
  error?: string;
  success?: boolean;
};

export async function saveCheckIn(
  _prev: CheckInState,
  formData: FormData,
): Promise<CheckInState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const mood = Number(formData.get("mood"));
  const energy = Number(formData.get("energy"));
  const sleepHours = Number(formData.get("sleep_hours"));
  const exerciseMinutes = Number(formData.get("exercise_minutes"));
  const notes = (formData.get("notes") as string | null)?.trim() ?? null;

  // Validate ranges
  if (mood < 1 || mood > 5) return { error: "Mood must be between 1 and 5" };
  if (energy < 1 || energy > 5) return { error: "Energy must be between 1 and 5" };
  if (sleepHours < 0 || sleepHours > 24) return { error: "Invalid sleep hours" };

  const today = new Date().toISOString().slice(0, 10); // "2026-04-28"

  const { error } = await supabase
    .schema("biomarkers")
    .from("daily_logs")
    .upsert(
      {
        user_uuid: user.id,
        logged_at: today,
        mood,
        energy,
        sleep_hours: sleepHours,
        exercise_minutes: exerciseMinutes,
        notes,
      },
      { onConflict: "user_uuid,logged_at" }, // one entry per user per day
    );

  if (error) return { error: error.message };

  revalidatePath("/check-in");
  return { success: true };
}
```

---

### Step 3c — Create the page

**CREATE** `app/(app)/check-in/page.tsx`

```typescript
import { createClient } from "@/lib/supabase/server";
import { CheckInForm } from "./_components/check-in-form";

export const metadata = { title: "Daily check-in · Longevity Coach" };

export default async function CheckInPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Load last 7 days of entries for this user
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data: recentLogs } = await supabase
    .schema("biomarkers")
    .from("daily_logs")
    .select("logged_at, mood, energy, sleep_hours, exercise_minutes, notes")
    .eq("user_uuid", user!.id)
    .gte("logged_at", sevenDaysAgo.toISOString().slice(0, 10))
    .order("logged_at", { ascending: false });

  // Check if today's entry already exists
  const today = new Date().toISOString().slice(0, 10);
  const todayEntry = recentLogs?.find((l) => l.logged_at === today) ?? null;

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto", padding: "32px 16px" }}>
      <h1 style={{ marginBottom: "8px" }}>Daily check-in</h1>
      <p style={{ color: "var(--lc-muted)", marginBottom: "32px" }}>
        A quick log each day helps Janet track your progress.
      </p>

      <CheckInForm todayEntry={todayEntry} />

      {recentLogs && recentLogs.length > 0 && (
        <div style={{ marginTop: "40px" }}>
          <h2 style={{ fontSize: "16px", marginBottom: "16px" }}>Recent logs</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {recentLogs.map((log) => (
              <div
                key={log.logged_at}
                style={{
                  padding: "12px 16px",
                  background: "var(--lc-surface, #F4F7F9)",
                  borderRadius: "8px",
                  display: "grid",
                  gridTemplateColumns: "120px 1fr",
                  gap: "8px",
                  alignItems: "start",
                }}
              >
                <div style={{ fontWeight: 600, fontSize: "14px" }}>
                  {new Date(log.logged_at).toLocaleDateString("en-AU", {
                    weekday: "short", month: "short", day: "numeric",
                  })}
                </div>
                <div style={{ fontSize: "14px", color: "var(--lc-muted)" }}>
                  Mood {log.mood}/5 · Energy {log.energy}/5 ·{" "}
                  {log.sleep_hours}h sleep
                  {log.exercise_minutes
                    ? ` · ${log.exercise_minutes}min exercise`
                    : ""}
                  {log.notes && (
                    <div style={{ marginTop: "4px", fontStyle: "italic" }}>
                      {log.notes}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

---

### Step 3d — Create the form component

The form uses a client component so it can show loading state while submitting.

```sh
mkdir -p app/\(app\)/check-in/_components
```

**CREATE** `app/(app)/check-in/_components/check-in-form.tsx`

```typescript
"use client";
import { useActionState } from "react";
import { saveCheckIn, type CheckInState } from "../actions";

type LogEntry = {
  logged_at: string;
  mood: number | null;
  energy: number | null;
  sleep_hours: number | null;
  exercise_minutes: number | null;
  notes: string | null;
};

export function CheckInForm({ todayEntry }: { todayEntry: LogEntry | null }) {
  const [state, action, isPending] = useActionState<CheckInState, FormData>(
    saveCheckIn,
    {},
  );

  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {state.success && (
        <div style={{ padding: "12px 16px", background: "#D1FAE5", borderRadius: "8px", color: "#065F46" }}>
          Saved! Keep it up.
        </div>
      )}
      {state.error && (
        <div style={{ padding: "12px 16px", background: "#FEE2E2", borderRadius: "8px", color: "#991B1B" }}>
          {state.error}
        </div>
      )}

      <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <span style={{ fontWeight: 600 }}>Mood (1 = rough · 5 = great)</span>
        <select name="mood" defaultValue={todayEntry?.mood ?? 3} style={inputStyle}>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </label>

      <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <span style={{ fontWeight: 600 }}>Energy (1 = exhausted · 5 = energised)</span>
        <select name="energy" defaultValue={todayEntry?.energy ?? 3} style={inputStyle}>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </label>

      <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <span style={{ fontWeight: 600 }}>Sleep last night (hours)</span>
        <input
          type="number"
          name="sleep_hours"
          defaultValue={todayEntry?.sleep_hours ?? 7}
          min={0}
          max={24}
          step={0.5}
          style={inputStyle}
        />
      </label>

      <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <span style={{ fontWeight: 600 }}>Exercise today (minutes)</span>
        <input
          type="number"
          name="exercise_minutes"
          defaultValue={todayEntry?.exercise_minutes ?? 0}
          min={0}
          max={600}
          step={5}
          style={inputStyle}
        />
      </label>

      <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <span style={{ fontWeight: 600 }}>Notes (optional)</span>
        <textarea
          name="notes"
          defaultValue={todayEntry?.notes ?? ""}
          rows={3}
          placeholder="Anything worth noting today…"
          style={{ ...inputStyle, resize: "vertical" }}
        />
      </label>

      <button
        type="submit"
        disabled={isPending}
        style={{
          padding: "12px 24px",
          background: "var(--lc-teal, #2F6F8F)",
          color: "#fff",
          border: "none",
          borderRadius: "8px",
          fontWeight: 600,
          fontSize: "15px",
          cursor: isPending ? "not-allowed" : "pointer",
          opacity: isPending ? 0.7 : 1,
        }}
      >
        {isPending ? "Saving…" : todayEntry ? "Update today's log" : "Save today's log"}
      </button>
    </form>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  border: "1px solid var(--lc-border, #D4E0E8)",
  borderRadius: "8px",
  fontSize: "15px",
  background: "#fff",
};
```

> **Note:** `useActionState` is imported from `react` (not `react-dom`). This is a React 19 change already handled by the project. Do not change the import.

---

### Step 3e — Add the route to proxy protection

**EDIT** `lib/supabase/proxy.ts`

Find this line:
```typescript
const PROTECTED_PREFIXES = ["/dashboard", "/onboarding", "/admin", "/uploads"];
```

Change it to:
```typescript
const PROTECTED_PREFIXES = ["/dashboard", "/onboarding", "/admin", "/uploads", "/check-in", "/report", "/account"];
```

This protects the new `/check-in` page (and also adds `/report` and `/account` which were missing).

---

### Step 3f — Check it builds

```sh
pnpm build
```

---

## Item 4 — Drip email cron

**What this does:** Sends three automated follow-up emails to members — on Day 1, Day 3, and Day 7 after signup. The email templates (`lib/email/drip.ts`) already exist. This item creates the cron job that triggers them on a schedule.

**How it works:**
1. Vercel runs the cron at 09:00 UTC every day
2. The cron route queries users whose signup date was exactly 1, 3, or 7 days ago
3. It checks a `drip_events` table to make sure the email hasn't already been sent
4. It sends the email and records the event

**Prerequisite:** Migration `0018_drip_tracking.sql` must be applied. Run `supabase db push` and check there are no errors.

---

### Step 4a — Add CRON_SECRET to .env.example

**EDIT** `.env.example`

Add at the end:
```
# Cron job authentication — set this in Vercel dashboard and locally
CRON_SECRET=your-random-secret-here
```

Also add it to your local `.env.local`:
```
CRON_SECRET=any-random-string-here-for-local-testing
```

---

### Step 4b — Create the cron route

**CREATE** `app/api/cron/drip/route.ts`

```typescript
import { createAdminClient } from "@/lib/supabase/admin";
import { sendDripEmail } from "@/lib/email/drip";

// Vercel allows up to 60 seconds for cron jobs
export const maxDuration = 60;

const DRIP_DAYS = [1, 3, 7] as const;

export async function GET(req: Request) {
  // Reject requests without the correct secret
  // This prevents anyone from triggering the cron manually
  const authHeader = req.headers.get("Authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const admin = createAdminClient();
  const appUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://longevity-coach.io";
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const day of DRIP_DAYS) {
    // Find users who signed up exactly N days ago
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() - day);
    const dateStr = targetDate.toISOString().slice(0, 10); // "2026-04-21"

    // Fetch users who signed up on that date
    const { data: profiles, error: profileError } = await admin
      .from("profiles")
      .select("id, full_name")
      .gte("created_at", `${dateStr}T00:00:00Z`)
      .lt("created_at", `${dateStr}T23:59:59Z`);

    if (profileError) {
      errors.push(`Day ${day} profile query: ${profileError.message}`);
      continue;
    }

    for (const profile of profiles ?? []) {
      // Check if we already sent this drip to this user
      const { data: existing } = await admin
        .from("drip_events")
        .select("id")
        .eq("user_uuid", profile.id)
        .eq("drip_day", day)
        .maybeSingle();

      if (existing) {
        skipped++;
        continue; // already sent — skip
      }

      // Get the user's email from Supabase Auth
      const { data: authUser, error: authError } = await admin.auth.admin.getUserById(profile.id);
      if (authError || !authUser.user.email) {
        errors.push(`User ${profile.id}: could not get email`);
        continue;
      }

      // Send the email
      const firstName = profile.full_name?.split(" ")[0] ?? null;
      const { error: emailError } = await sendDripEmail({
        to: authUser.user.email,
        firstName,
        appUrl,
        day,
      });

      if (emailError) {
        errors.push(`User ${profile.id} day ${day}: ${String(emailError)}`);
        continue;
      }

      // Record that we sent it so we don't send it again
      await admin.from("drip_events").insert({
        user_uuid: profile.id,
        drip_day: day,
        sent_at: new Date().toISOString(),
      });

      sent++;
    }
  }

  // Return a summary — useful for debugging in Vercel logs
  return Response.json({ sent, skipped, errors, timestamp: new Date().toISOString() });
}
```

---

### Step 4c — Add the cron schedule to vercel.json

**EDIT** `vercel.json` (in the repo root). If the file does not exist, create it.

Add or update the `crons` section:

```json
{
  "crons": [
    {
      "path": "/api/cron/drip",
      "schedule": "0 9 * * *"
    }
  ]
}
```

This runs at 09:00 UTC every day. If the file already has other content, add the `"crons"` key alongside the existing keys — do not overwrite them.

> **Gotcha:** Vercel only runs crons in production deployments. To test locally, call the endpoint manually with the Authorization header:
> ```sh
> curl -H "Authorization: Bearer your-cron-secret" http://localhost:3000/api/cron/drip
> ```

---

### Step 4d — Check it builds

```sh
pnpm build
```

---

## Item 5 — PDF download

**What this does:** Adds a "Download PDF" button to the report page. Clicking it streams a branded PDF of the member's biological age, risk scores, and supplement protocol. The PDF component (`lib/pdf/report-doc.tsx`) already exists — this item wires it to real data and adds the download route and button.

---

### Step 5a — Create the PDF download route

**CREATE** `app/(app)/report/pdf/route.ts`

```typescript
import { createClient } from "@/lib/supabase/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { ReportDoc } from "@/lib/pdf/report-doc";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Load the data the PDF needs
  const [riskResult, supplementResult, profileResult] = await Promise.all([
    supabase
      .from("risk_scores")
      .select("biological_age, cv_risk, metabolic_risk, neuro_risk, onco_risk, msk_risk, narrative, assessment_date")
      .eq("user_uuid", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("supplement_plans")
      .select("items, notes")
      .eq("patient_uuid", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("full_name, date_of_birth")
      .eq("id", user.id)
      .single(),
  ]);

  const reportData = {
    patientName: profileResult.data?.full_name ?? null,
    dateOfBirth: profileResult.data?.date_of_birth ?? null,
    risk: riskResult.data ?? null,
    supplement: supplementResult.data ?? null,
    generatedAt: new Date().toISOString(),
  };

  // Render the PDF to a Buffer
  const buffer = await renderToBuffer(createElement(ReportDoc, { data: reportData }));

  const filename = `longevity-report-${new Date().toISOString().slice(0, 10)}.pdf`;

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
```

---

### Step 5b — Update ReportDoc to accept the data prop

Open `lib/pdf/report-doc.tsx`. Find the component export (likely `export function ReportDoc`) and check what props it currently accepts. If it does not have a `data` prop yet, add one.

The data shape to accept:

```typescript
// Add this type near the top of lib/pdf/report-doc.tsx
type SupplementItem = {
  name: string;
  dose: string;
  timing?: string;
  tier?: string;
  note?: string;
};

type ReportData = {
  patientName: string | null;
  dateOfBirth: string | null;
  risk: {
    biological_age: number | null;
    cv_risk: number | null;
    metabolic_risk: number | null;
    neuro_risk: number | null;
    onco_risk: number | null;
    msk_risk: number | null;
    narrative: string | null;
    assessment_date: string | null;
  } | null;
  supplement: {
    items: unknown;
    notes: string | null;
  } | null;
  generatedAt: string;
};
```

Then update the component signature:
```typescript
export function ReportDoc({ data }: { data: ReportData }) {
  // Use data.patientName, data.risk, data.supplement inside the PDF layout
}
```

Inside the PDF, display:
- `data.patientName` on the cover page
- `data.risk.biological_age` prominently
- Each of the 5 domain scores as a labelled row
- `data.risk.narrative` as a paragraph
- `(data.supplement.items as SupplementItem[])` as a table (name, dose, timing, tier)

> **Note:** `@react-pdf/renderer` uses its own layout system — no HTML tags, no Tailwind. Use `<View>`, `<Text>`, and `<StyleSheet.create({})>`. The file already has this set up. Just add the data display inside the existing layout structure.

---

### Step 5c — Add the download button to the report page

**EDIT** `app/(app)/report/page.tsx`

Find where the report content ends (near the bottom of the JSX). Add the download button:

```typescript
{/* Download PDF button — only show if risk scores exist */}
{risk && (
  <div style={{ marginTop: "32px", textAlign: "center" }}>
    <a
      href="/report/pdf"
      download
      style={{
        display: "inline-block",
        padding: "12px 28px",
        background: "var(--lc-teal, #2F6F8F)",
        color: "#fff",
        textDecoration: "none",
        borderRadius: "8px",
        fontWeight: 600,
        fontSize: "15px",
      }}
    >
      Download PDF report
    </a>
  </div>
)}
```

> **Gotcha:** Check how `risk` is named in `report/page.tsx` — it may be a different variable name. Look at how the page currently reads risk scores and use that variable name.

---

### Step 5d — Check it builds

```sh
pnpm build
```

If `renderToBuffer` causes a type error, check that `@react-pdf/renderer` is in `package.json`. If not: `pnpm add @react-pdf/renderer`.

---

## Final check — run everything together

After all five items are done:

```sh
pnpm build
```

The build must pass with no TypeScript errors. Fix any errors before merging. Do not merge with a broken build.

---

## Definition of done

- [ ] Dashboard shows supplement protocol section when a protocol exists
- [ ] `/admin/users/[id]` loads without error for any user ID in the system
- [ ] `/check-in` form saves today's entry and shows last 7 days
- [ ] Drip cron at `/api/cron/drip` returns `{ sent, skipped, errors }` when called with the correct secret
- [ ] `/report/pdf` downloads a PDF when called as a signed-in user
- [ ] `pnpm build` is clean — no TypeScript errors
