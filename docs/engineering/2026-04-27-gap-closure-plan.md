# Gap Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the gap between the Base44 reference and `longevity-coach-wha` — delivering bio-age, 5-domain risk scores, a supplement protocol, a PDF report, and a usable logged-in experience.

**Architecture:** Port the deterministic risk engine from Base44 (pure arithmetic, no external deps) into `lib/risk/engine.ts`, add a patient adapter for our JSONB questionnaire shape, run the engine on `submitAssessment`, and surface results on a `/report` page. Supplement protocol is rules-based (no LLM). PDF uses `@react-pdf/renderer` rendered server-side in a route handler.

**Tech stack:** Next.js 16 App Router, TypeScript, Supabase (server client + admin client), Resend, `@react-pdf/renderer`, scoped CSS (no Tailwind utility classes in new files)

---

## Styling conventions

All new pages and CSS files follow the pattern established in `app/(app)/dashboard/dashboard.css`:

- Wrap the page in a scoped class (e.g. `.lc-report`, `.lc-account`)
- Declare CSS variables at the top of the scope block — **copy the same token set** from `dashboard.css`
- Cards: `background:#fff; border:1px solid var(--lc-line); border-radius:16px; padding:28px`
- Headings: `font-family: var(--font-lc-serif), Georgia, serif; font-weight:400`
- Buttons: use `.btn .btn-primary` / `.btn .btn-ghost` pattern
- Badges: `.badge .success / .warning / .muted / .primary` pattern
- Body copy: `color: var(--lc-ink-soft); font-size:14px; line-height:1.55`
- Page layout: `max-width:960px; margin:0 auto; padding:32px 24px` (inherited from app layout)
- **No inline styles in new page files** — use scoped CSS class names

---

## File map

| File | Action | Purpose |
|---|---|---|
| `supabase/migrations/0002_engine_columns.sql` | Create | Add `welcome_email_sent_at`, `engine_output`, `supplements_json` |
| `lib/supabase/database.types.ts` | Modify | Add new columns to type definitions |
| `app/(app)/layout.tsx` | Modify | Add Dashboard / Report / Account nav links |
| `app/(app)/report/page.tsx` | Create | Report page (bio-age, domain grid, supplements) |
| `app/(app)/report/report.css` | Create | Scoped styles for report page |
| `app/(app)/account/page.tsx` | Create | Account stub page |
| `app/(app)/account/account.css` | Create | Scoped styles for account page |
| `app/auth/callback/route.ts` | Modify | Welcome-email idempotency via DB flag |
| `lib/risk/engine.ts` | Create | Ported deterministic risk engine (5 domains + bio-age) |
| `lib/risk/adapter.ts` | Create | Maps `ResponsesByStep` → `PatientData` |
| `lib/supplements/protocol.ts` | Create | Rules-based supplement protocol generator |
| `lib/pdf/report.tsx` | Create | React PDF document component |
| `app/api/report/pdf/route.ts` | Create | Streams branded PDF for authenticated user |
| `app/(app)/onboarding/actions.ts` | Modify | Run engine + save risk_scores after `submitAssessment` |
| `app/(admin)/admin/page.tsx` | Create | Basic admin user list |
| `app/(admin)/admin/admin.css` | Create | Scoped styles for admin page |

---

## Phase 1 — Quick wins (no blockers, ~2 hours)

### Task 1: Logged-in nav

**Files:**
- Modify: `app/(app)/layout.tsx`

- [ ] **Step 1: Add nav links between logo and sign-out button**

Replace the `<header>` contents in `app/(app)/layout.tsx`:

```tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "../(auth)/actions";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div style={{ minHeight: "100dvh", background: "#F4F7F9" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 24px",
          background: "#fff",
          borderBottom: "1px solid #E3E8EC",
        }}
      >
        <Link href="/dashboard" style={{ display: "flex", alignItems: "center" }}>
          <Image
            src="/longevity-coach-horizontal-logo.png"
            alt="Longevity Coach"
            width={240}
            height={50}
            priority
          />
        </Link>
        <nav style={{ display: "flex", gap: 4 }}>
          {(
            [
              ["/dashboard", "Dashboard"],
              ["/report", "Report"],
              ["/account", "Account"],
            ] as [string, string][]
          ).map(([href, label]) => (
            <Link
              key={href}
              href={href}
              style={{
                font: "inherit",
                fontSize: 14,
                color: "#2F6F8F",
                textDecoration: "none",
                padding: "6px 12px",
                borderRadius: 6,
              }}
            >
              {label}
            </Link>
          ))}
        </nav>
        <form action={signOut}>
          <button
            type="submit"
            style={{
              font: "inherit",
              padding: "8px 14px",
              background: "transparent",
              color: "#2F6F8F",
              border: "1px solid #DDE8EE",
              borderRadius: 8,
              cursor: "pointer",
            }}
          >
            Sign out
          </button>
        </form>
      </header>
      <main style={{ maxWidth: 960, margin: "0 auto", padding: "32px 24px" }}>
        {children}
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Verify build is clean**

```bash
cd longevity-coach-wha && pnpm build
```

Expected: `✓ Compiled successfully`

- [ ] **Step 3: Commit**

```bash
git add app/\(app\)/layout.tsx
git commit -m "feat: add Dashboard / Report / Account nav links to app layout"
```

---

### Task 2: /report and /account stub pages

**Files:**
- Create: `app/(app)/report/page.tsx`
- Create: `app/(app)/report/report.css`
- Create: `app/(app)/account/page.tsx`
- Create: `app/(app)/account/account.css`

- [ ] **Step 1: Create report stub**

`app/(app)/report/page.tsx`:

```tsx
import "./report.css";

export const metadata = { title: "Report · Longevity Coach" };

export default function ReportPage() {
  return (
    <div className="lc-report">
      <h1>Your report</h1>
      <p className="subtitle">
        Complete your health assessment to generate your bio-age and risk scores.
      </p>
      <div className="card">
        <p>Your personalised report will appear here once your assessment has been processed.</p>
      </div>
    </div>
  );
}
```

`app/(app)/report/report.css` — copy the token block from `dashboard.css` and add page-specific rules:

```css
.lc-report {
  --lc-primary: #2F6F8F;
  --lc-primary-700: #245672;
  --lc-primary-50: #EEF3F6;
  --lc-line: #E3E8EC;
  --lc-line-soft: #EDF1F4;
  --lc-ink: #2B2B2B;
  --lc-ink-soft: #4B4B4B;
  --lc-grey: #8A9AA5;
  --lc-surface: #FFFFFF;
  --lc-success: #2A7A5C;
  --lc-success-50: #E6F4EE;
  --lc-warning: #B5722F;
  --lc-warning-50: #FAEFE0;
  --lc-danger: #B5452F;
  --lc-danger-50: #FBEAE5;

  font-family: var(--font-lc-sans), system-ui, sans-serif;
  color: var(--lc-ink);
}

.lc-report h1 {
  font-family: var(--font-lc-serif), Georgia, serif;
  font-weight: 400;
  font-size: 32px;
  margin: 0 0 6px;
  letter-spacing: -0.01em;
}
.lc-report .subtitle {
  color: var(--lc-ink-soft);
  margin: 0 0 32px;
  font-size: 15px;
}
.lc-report .card {
  background: var(--lc-surface);
  border: 1px solid var(--lc-line);
  border-radius: 16px;
  padding: 28px;
  margin-bottom: 20px;
}
.lc-report .card h2 {
  font-family: var(--font-lc-serif), Georgia, serif;
  font-weight: 400;
  font-size: 20px;
  margin: 0 0 12px;
}
.lc-report .card p {
  color: var(--lc-ink-soft);
  margin: 0 0 20px;
  font-size: 14px;
  line-height: 1.55;
}
.lc-report .card p:last-child { margin-bottom: 0; }

.lc-report .badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-lc-mono), ui-monospace, monospace;
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 4px 10px;
  border-radius: 999px;
  font-weight: 500;
}
.lc-report .badge.success { background: var(--lc-success-50); color: var(--lc-success); }
.lc-report .badge.warning { background: var(--lc-warning-50); color: var(--lc-warning); }
.lc-report .badge.muted   { background: var(--lc-line-soft); color: var(--lc-grey); }
.lc-report .badge.primary { background: var(--lc-primary-50); color: var(--lc-primary); }
.lc-report .badge.danger  { background: var(--lc-danger-50); color: var(--lc-danger); }

.lc-report .head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.lc-report .head h2 { margin: 0; }

.lc-report .btn {
  display: inline-block;
  font: inherit;
  font-weight: 600;
  font-size: 14px;
  padding: 11px 20px;
  border-radius: 8px;
  border: 1px solid transparent;
  cursor: pointer;
  text-decoration: none;
  transition: all 0.15s;
}
.lc-report .btn-primary { background: var(--lc-primary); color: #fff; }
.lc-report .btn-primary:hover { background: var(--lc-primary-700); }
.lc-report .btn-ghost {
  background: transparent;
  color: var(--lc-primary);
  border-color: var(--lc-primary-50);
}
.lc-report .btn-ghost:hover { background: var(--lc-primary-50); }

/* Bio-age hero */
.lc-report .bio-age-hero {
  text-align: center;
  padding: 40px 28px;
}
.lc-report .bio-age-number {
  font-family: var(--font-lc-serif), Georgia, serif;
  font-size: 72px;
  font-weight: 400;
  color: var(--lc-primary);
  line-height: 1;
  margin-bottom: 8px;
}
.lc-report .bio-age-label {
  font-family: var(--font-lc-mono), ui-monospace, monospace;
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--lc-grey);
}
.lc-report .bio-age-delta {
  margin-top: 12px;
  font-size: 14px;
  color: var(--lc-ink-soft);
}

/* Domain grid */
.lc-report .domain-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
  margin-top: 20px;
}
.lc-report .domain-cell {
  background: var(--lc-line-soft);
  border-radius: 10px;
  padding: 16px 12px;
  text-align: center;
}
.lc-report .domain-label {
  font-family: var(--font-lc-mono), ui-monospace, monospace;
  font-size: 10px;
  letter-spacing: 0.08em;
  color: var(--lc-grey);
  text-transform: uppercase;
  margin-bottom: 8px;
}
.lc-report .domain-score {
  font-size: 28px;
  font-weight: 300;
  color: var(--lc-ink);
}
.lc-report .domain-score.high   { color: var(--lc-danger); }
.lc-report .domain-score.moderate { color: var(--lc-warning); }
.lc-report .domain-score.low,
.lc-report .domain-score.very_low { color: var(--lc-success); }

/* Top risks list */
.lc-report .risk-list { list-style: none; padding: 0; margin: 0; }
.lc-report .risk-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--lc-line-soft);
  font-size: 14px;
}
.lc-report .risk-item:last-child { border-bottom: none; }
.lc-report .risk-bar-wrap {
  flex: 1;
  height: 4px;
  background: var(--lc-line-soft);
  border-radius: 2px;
  overflow: hidden;
}
.lc-report .risk-bar {
  height: 100%;
  border-radius: 2px;
  background: var(--lc-primary);
}

/* Supplement table */
.lc-report .supp-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.lc-report .supp-table th {
  font-family: var(--font-lc-mono), ui-monospace, monospace;
  font-size: 10px;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: var(--lc-grey);
  text-align: left;
  padding: 0 12px 10px 0;
  border-bottom: 1px solid var(--lc-line);
}
.lc-report .supp-table td {
  padding: 10px 12px 10px 0;
  vertical-align: top;
  border-bottom: 1px solid var(--lc-line-soft);
  color: var(--lc-ink-soft);
}
.lc-report .supp-table td:first-child { color: var(--lc-ink); font-weight: 500; }
.lc-report .supp-table tr:last-child td { border-bottom: none; }

@media (max-width: 760px) {
  .lc-report .domain-grid { grid-template-columns: repeat(2, 1fr); }
  .lc-report .supp-table { display: block; overflow-x: auto; }
}
```

- [ ] **Step 2: Create account stub**

`app/(app)/account/page.tsx`:

```tsx
import "./account.css";

export const metadata = { title: "Account · Longevity Coach" };

export default function AccountPage() {
  return (
    <div className="lc-account">
      <h1>Account</h1>
      <p className="subtitle">Profile, billing, and data settings.</p>
      <div className="card">
        <h2>Coming soon</h2>
        <p>
          Profile editing, billing portal, data export, and account deletion will
          be available here. Contact support if you need any of these now.
        </p>
      </div>
    </div>
  );
}
```

`app/(app)/account/account.css` — same token block, minimal rules:

```css
.lc-account {
  --lc-primary: #2F6F8F;
  --lc-line: #E3E8EC;
  --lc-line-soft: #EDF1F4;
  --lc-ink: #2B2B2B;
  --lc-ink-soft: #4B4B4B;
  --lc-surface: #FFFFFF;

  font-family: var(--font-lc-sans), system-ui, sans-serif;
  color: var(--lc-ink);
}
.lc-account h1 {
  font-family: var(--font-lc-serif), Georgia, serif;
  font-weight: 400;
  font-size: 32px;
  margin: 0 0 6px;
  letter-spacing: -0.01em;
}
.lc-account .subtitle {
  color: var(--lc-ink-soft);
  margin: 0 0 32px;
  font-size: 15px;
}
.lc-account .card {
  background: var(--lc-surface);
  border: 1px solid var(--lc-line);
  border-radius: 16px;
  padding: 28px;
}
.lc-account .card h2 {
  font-family: var(--font-lc-serif), Georgia, serif;
  font-weight: 400;
  font-size: 20px;
  margin: 0 0 12px;
}
.lc-account .card p {
  color: var(--lc-ink-soft);
  font-size: 14px;
  line-height: 1.55;
  margin: 0;
}
```

- [ ] **Step 3: Verify build is clean**

```bash
pnpm build
```

Expected: `✓ Compiled successfully` — two new routes appear in the output (`/report`, `/account`)

- [ ] **Step 4: Commit**

```bash
git add app/\(app\)/report app/\(app\)/account
git commit -m "feat: add /report and /account stub pages with nav links"
```

---

### Task 3: Welcome-email idempotency

**Files:**
- Create: `supabase/migrations/0002_engine_columns.sql`
- Modify: `lib/supabase/database.types.ts`
- Modify: `app/auth/callback/route.ts`

- [ ] **Step 1: Write the migration**

`supabase/migrations/0002_engine_columns.sql`:

```sql
-- Add welcome_email_sent_at to profiles for idempotent welcome emails.
-- Add engine_output + supplements_json to risk_scores for the report page.

alter table public.profiles
  add column if not exists welcome_email_sent_at timestamptz;

alter table public.risk_scores
  add column if not exists engine_output jsonb,
  add column if not exists supplements_json jsonb;
```

- [ ] **Step 2: Apply the migration to local Supabase**

```bash
npx supabase db push
```

Expected: `Applying migration 0002_engine_columns.sql... done`

(If using the Supabase dashboard directly for the hosted project, run the SQL manually in the SQL Editor.)

- [ ] **Step 3: Update database.types.ts**

In `lib/supabase/database.types.ts`, make the following changes:

In `profiles.Row`, add:
```ts
welcome_email_sent_at: string | null
```

In `profiles.Insert`, add:
```ts
welcome_email_sent_at?: string | null
```

In `profiles.Update`, add:
```ts
welcome_email_sent_at?: string | null
```

In `risk_scores.Row`, add:
```ts
engine_output: Json | null
supplements_json: Json | null
```

In `risk_scores.Insert`, add:
```ts
engine_output?: Json | null
supplements_json?: Json | null
```

In `risk_scores.Update`, add:
```ts
engine_output?: Json | null
supplements_json?: Json | null
```

- [ ] **Step 4: Update auth/callback to use the DB flag**

Replace the welcome-email block in `app/auth/callback/route.ts`:

```ts
// Replace lines 44-64 (the welcome email section) with:

const {
  data: { user },
} = await supabase.auth.getUser();

if (user?.email && user.email_confirmed_at && process.env.RESEND_API_KEY) {
  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("welcome_email_sent_at")
    .eq("id", user.id)
    .maybeSingle();

  if (!profileErr && profile && !profile.welcome_email_sent_at) {
    // Mark first to prevent double-sends on concurrent link clicks.
    const { error: markErr } = await supabase
      .from("profiles")
      .update({ welcome_email_sent_at: new Date().toISOString() })
      .eq("id", user.id)
      .is("welcome_email_sent_at", null);

    if (!markErr) {
      try {
        const firstName =
          (user.user_metadata?.full_name as string | undefined)?.split(" ")[0] ?? null;
        await sendWelcomeEmail({
          to: user.email,
          firstName,
          appUrl: process.env.NEXT_PUBLIC_SITE_URL ?? url.origin,
        });
      } catch (err) {
        console.error("Welcome email failed", err);
      }
    }
  }
}
```

- [ ] **Step 5: Build passes with no type errors**

```bash
pnpm build
```

Expected: `✓ Compiled successfully`

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0002_engine_columns.sql lib/supabase/database.types.ts app/auth/callback/route.ts
git commit -m "feat: welcome email idempotency via profiles.welcome_email_sent_at DB flag"
```

---

## Phase 2 — Risk engine (needs Sunday James call to confirm lifestyle-only path is acceptable, ~6 hours)

### Task 4: Risk engine TypeScript port

**Files:**
- Create: `lib/risk/engine.ts`

The source is `base44/functions/riskEngine/entry.ts`. The five scoring functions and the bio-age estimator are pure arithmetic with no external library dependencies. The porting steps are precise.

- [ ] **Step 1: Create lib/risk/engine.ts — types section**

```ts
// lib/risk/engine.ts
// Ported from base44/functions/riskEngine/entry.ts.
// Strips the Deno.serve wrapper and Base44 SDK imports.
// All scoring functions are pure arithmetic — no network calls.

export type PatientData = {
  demographics?: {
    age?: number;
    sex?: "male" | "female";
    height_cm?: number;
    weight_kg?: number;
  };
  family_history?: {
    cardiovascular?: { first_degree: boolean; second_degree?: boolean; age_onset?: number };
    cancer?: { first_degree: boolean; types?: string[] };
    neurodegenerative?: { first_degree: boolean; age_onset?: number };
    diabetes?: { first_degree: boolean };
    osteoporosis?: { first_degree: boolean };
  };
  medical_history?: {
    conditions: string[];
    medications: string[];
    allergies?: string[];
    surgeries?: string[];
  };
  lifestyle?: {
    smoking_status?: string;
    exercise_minutes_weekly?: number;
    exercise_type?: string;
    sleep_hours?: number;
    diet_type?: string;
    stress_level?: string;
    alcohol_units_weekly?: number;
  };
  biomarkers?: {
    blood_panel?: Record<string, number | null | undefined>;
    imaging?: Record<string, number | null | undefined>;
    genetic?: { polygenic_risk_scores?: Record<string, number> };
    hormonal?: Record<string, number | null | undefined>;
    microbiome?: Record<string, unknown>;
  };
  wearable_data?: {
    resting_hr?: number;
    hrv_rmssd?: number;
    avg_daily_steps?: number;
    avg_sleep_duration?: number;
    avg_deep_sleep_pct?: number;
    vo2max_estimated?: number;
  };
  adherence_rate?: number;
};

export type FactorResult = {
  name: string;
  score: number;
  weight: number;
  modifiable: boolean;
  raw_value?: unknown;
  unit?: string;
  optimal_range?: string;
  standard_range?: string;
  domain?: string;
};

export type DomainResult = {
  domain: string;
  score: number;
  risk_level: string;
  factors: FactorResult[];
  top_modifiable_risks: FactorResult[];
  data_completeness: number;
};

export type EngineResult = {
  longevity_score: number;
  longevity_label: string;
  composite_risk: number;
  biological_age: number;
  chronological_age: number | undefined;
  age_delta: number | null;
  risk_level: string;
  trajectory_6month: TrajectoryResult;
  domains: {
    cardiovascular: DomainResult;
    metabolic: DomainResult;
    neurodegenerative: DomainResult;
    oncological: DomainResult;
    musculoskeletal: DomainResult;
  };
  domain_weights: Record<string, number>;
  top_risks: FactorResult[];
  data_completeness: number;
  score_confidence: { level: string; message: string };
  last_calculated: string;
  next_recommended_tests: string | null;
};

type TrajectoryResult = {
  current_longevity_score: number;
  projected_longevity_score: number;
  projected_improvement: number;
  improvements: Array<{
    factor: string;
    domain: string;
    current_score: number;
    projected_score: number;
    improvement: number;
    confidence: string;
    optimal_range?: string;
  }>;
  timeframe_months: number;
  assumptions: string;
};
```

- [ ] **Step 2: Copy the five scoring functions and helpers verbatim**

Open `base44/functions/riskEngine/entry.ts` and copy the following function bodies **without modification** (only remove `Deno`/`base44` references and annotate any implicit `any` params as `(patient: PatientData)` and `(factors: FactorResult[])` etc.):

- `getRiskLevel(score: number): string` — lines 7-13
- `computeDomainResult(domain, factors, totalExpectedFactors)` — lines 19-38
- `scoreCardiovascular(patient: PatientData): DomainResult` — lines 44-223
- `scoreMetabolic(patient: PatientData): DomainResult` — lines 229-~420
- `scoreNeurodegenerative(patient: PatientData): DomainResult` — ~lines 420-600
- `scoreOncological(patient: PatientData): DomainResult` — ~lines 600-780
- `scoreMusculoskeletal(patient: PatientData): DomainResult` — ~lines 780-870
- `estimateBiologicalAge(patient, domains)` — ~lines 870-957
- `INTERVENTION_EFFECT_SIZES` constant — lines 963-982
- `getCurrentCompositeRisk(domains, weights)` — lines 984-986
- `projectTrajectory(patient, domains, weights)` — lines 988-1030
- Helper: `getTopModifiableRisks(domainsArray, n)` — find in source
- Helper: `getOverallCompleteness(domainsArray)` — find in source
- Helper: `getScoreConfidence(domainsArray)` — find in source
- Helper: `getNextRecommendedTest(domainsArray)` — find in source
- Helper: `adjustWeightsForHighRisk(defaultWeights, scores)` — find in source

Type annotation guide: replace `function foo(patient)` → `function foo(patient: PatientData)`. Replace `factors.push({...})` objects that are inline — TypeScript will infer them fine. Use `// eslint-disable-next-line @typescript-eslint/no-explicit-any` if needed for the `domains` record param.

- [ ] **Step 3: Add the main export at the bottom of lib/risk/engine.ts**

```ts
// ============================================================
// PUBLIC API
// ============================================================

export function runRiskEngine(patient: PatientData): EngineResult {
  const cvd   = scoreCardiovascular(patient);
  const meta  = scoreMetabolic(patient);
  const neuro = scoreNeurodegenerative(patient);
  const onco  = scoreOncological(patient);
  const msk   = scoreMusculoskeletal(patient);

  const domains = {
    cardiovascular: cvd,
    metabolic: meta,
    neurodegenerative: neuro,
    oncological: onco,
    musculoskeletal: msk,
  };

  const defaultWeights = {
    cardiovascular: 0.30,
    metabolic: 0.25,
    neurodegenerative: 0.15,
    oncological: 0.15,
    musculoskeletal: 0.15,
  };
  const weights = adjustWeightsForHighRisk(defaultWeights, {
    cardiovascular: cvd.score,
    metabolic: meta.score,
    neurodegenerative: neuro.score,
    oncological: onco.score,
    musculoskeletal: msk.score,
  });

  const compositeRisk = getCurrentCompositeRisk(domains, weights);
  const longevityScore = 100 - compositeRisk;
  const biologicalAge = estimateBiologicalAge(patient, domains);
  const trajectory = projectTrajectory(patient, domains, weights);
  const domainsArray = [cvd, meta, neuro, onco, msk];

  const longevityLabel =
    longevityScore >= 85 ? "Optimal" :
    longevityScore >= 70 ? "Good" :
    longevityScore >= 55 ? "Needs Attention" :
    longevityScore >= 40 ? "Concerning" : "Critical";

  return {
    longevity_score: longevityScore,
    longevity_label: longevityLabel,
    composite_risk: compositeRisk,
    biological_age: biologicalAge,
    chronological_age: patient.demographics?.age,
    age_delta: patient.demographics?.age != null
      ? Math.round((patient.demographics.age - biologicalAge) * 10) / 10
      : null,
    risk_level: getRiskLevel(compositeRisk),
    trajectory_6month: trajectory,
    domains,
    domain_weights: weights,
    top_risks: getTopModifiableRisks(domainsArray, 5),
    data_completeness: getOverallCompleteness(domainsArray),
    score_confidence: getScoreConfidence(domainsArray),
    last_calculated: new Date().toISOString(),
    next_recommended_tests: getNextRecommendedTest(domainsArray),
  };
}
```

- [ ] **Step 4: Confirm TypeScript compiles**

```bash
pnpm tsc --noEmit
```

Expected: no errors (or only harmless implicit-any notes you can suppress)

- [ ] **Step 5: Commit**

```bash
git add lib/risk/engine.ts
git commit -m "feat: port deterministic risk engine to lib/risk/engine.ts"
```

---

### Task 5: Patient adapter

**Files:**
- Create: `lib/risk/adapter.ts`

- [ ] **Step 1: Write the adapter**

```ts
// lib/risk/adapter.ts
// Maps our health_profiles.responses JSONB shape (keyed by step.id -> field.id)
// to the PatientData object the risk engine expects.

import type { ResponsesByStep } from "@/lib/questionnaire/schema";
import type { PatientData } from "./engine";

const ALCOHOL_UNITS: Record<string, number> = {
  "None": 0,
  "1–7 units/week": 4,
  "8–14 units/week": 11,
  "15–21 units/week": 18,
  "21+ units/week": 25,
};

const SMOKE_MAP: Record<string, string> = {
  "Never": "never",
  "Former (>10 years ago)": "former_over_10y",
  "Former (<10 years ago)": "former_under_10y",
  "Current": "current",
};

const STRESS_MAP: Record<string, string> = {
  "Low": "low",
  "Moderate": "moderate",
  "High": "high",
  "Chronic/severe": "chronic",
};

const EXERCISE_MINUTES: Record<string, number> = {
  "None": 0,
  "Light (<75 min/week)": 60,
  "Moderate (75–150 min/week)": 112,
  "Active (150–300 min/week)": 225,
  "Very active (300+ min/week)": 360,
};

function splitText(v: unknown): string[] {
  if (!v || typeof v !== "string" || v.trim() === "") return [];
  return v.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
}

export function adaptResponsesToPatient(responses: ResponsesByStep): PatientData {
  const basics   = (responses.basics   ?? {}) as Record<string, unknown>;
  const medical  = (responses.medical  ?? {}) as Record<string, unknown>;
  const family   = (responses.family   ?? {}) as Record<string, unknown>;
  const lifestyle = (responses.lifestyle ?? {}) as Record<string, unknown>;

  const rawSex = typeof basics.sex === "string" ? basics.sex.toLowerCase() : "";
  const sex: "male" | "female" | undefined =
    rawSex === "male" ? "male" : rawSex === "female" ? "female" : undefined;

  return {
    demographics: {
      age: typeof basics.age === "number" ? basics.age : undefined,
      sex,
      height_cm: typeof basics.height_cm === "number" ? basics.height_cm : undefined,
      weight_kg: typeof basics.weight_kg === "number" ? basics.weight_kg : undefined,
    },
    family_history: {
      cardiovascular: family.cardiovascular ? { first_degree: true } : undefined,
      cancer: family.cancer ? { first_degree: true, types: [] } : undefined,
      neurodegenerative: family.neurodegenerative ? { first_degree: true } : undefined,
      diabetes: family.diabetes ? { first_degree: true } : undefined,
      osteoporosis: family.osteoporosis ? { first_degree: true } : undefined,
    },
    medical_history: {
      conditions: Array.isArray(medical.conditions)
        ? (medical.conditions as string[]).filter((c) => c !== "None")
        : [],
      medications: splitText(medical.medications),
      allergies: splitText(medical.allergies),
      surgeries: splitText(medical.surgeries),
    },
    lifestyle: {
      smoking_status: typeof lifestyle.smoking === "string"
        ? SMOKE_MAP[lifestyle.smoking]
        : undefined,
      exercise_minutes_weekly: typeof lifestyle.exercise_volume === "string"
        ? EXERCISE_MINUTES[lifestyle.exercise_volume]
        : undefined,
      exercise_type: typeof lifestyle.exercise_type === "string"
        ? lifestyle.exercise_type
        : undefined,
      sleep_hours: typeof lifestyle.sleep_hours === "number"
        ? lifestyle.sleep_hours
        : undefined,
      diet_type: typeof lifestyle.diet === "string" ? lifestyle.diet : undefined,
      stress_level: typeof lifestyle.stress === "string"
        ? STRESS_MAP[lifestyle.stress]
        : undefined,
      alcohol_units_weekly: typeof lifestyle.alcohol === "string"
        ? ALCOHOL_UNITS[lifestyle.alcohol]
        : undefined,
    },
    biomarkers: {
      blood_panel: {},
      imaging: {},
      genetic: {},
      hormonal: {},
      microbiome: {},
    },
    wearable_data: {},
  };
}
```

- [ ] **Step 2: TypeScript check**

```bash
pnpm tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add lib/risk/adapter.ts
git commit -m "feat: add patient adapter for health_profiles.responses -> PatientData"
```

---

### Task 6: Supplement protocol generator

**Files:**
- Create: `lib/supplements/protocol.ts`

- [ ] **Step 1: Write the rules-based generator**

```ts
// lib/supplements/protocol.ts
// Deterministic supplement protocol from risk domain scores.
// No LLM required for MVP. Rules are based on domain thresholds.

export type SupplementItem = {
  name: string;
  form: string;
  dosage: string;
  timing: string;
  priority: "critical" | "high" | "recommended";
  domains: string[];
  note?: string;
};

export type SupplementProtocol = {
  supplements: SupplementItem[];
  generated_at: string;
  data_completeness_note: string;
};

type DomainScores = {
  cv_risk: number | null;
  metabolic_risk: number | null;
  neuro_risk: number | null;
  onco_risk: number | null;
  msk_risk: number | null;
};

type CatalogEntry = SupplementItem & { trigger_domains: string[]; min_score: number };

const CATALOG: CatalogEntry[] = [
  // --- Baseline (always included) ---
  {
    name: "Vitamin D3 + K2",
    form: "Softgel",
    dosage: "5000 IU D3 / 100 mcg K2 MK-7",
    timing: "With a fat-containing meal",
    priority: "recommended",
    domains: ["all"],
    trigger_domains: [],
    min_score: 0,
  },
  {
    name: "Omega-3 (EPA+DHA)",
    form: "Softgel",
    dosage: "2 g/day combined EPA+DHA",
    timing: "With meals — split morning and evening",
    priority: "recommended",
    domains: ["all"],
    trigger_domains: [],
    min_score: 0,
  },
  {
    name: "Magnesium Glycinate",
    form: "Capsule",
    dosage: "400 mg",
    timing: "30–60 min before bed",
    priority: "recommended",
    domains: ["all"],
    trigger_domains: [],
    min_score: 0,
  },
  // --- Cardiovascular ---
  {
    name: "CoQ10 (Ubiquinol)",
    form: "Softgel",
    dosage: "200 mg",
    timing: "With breakfast",
    priority: "high",
    domains: ["cardiovascular"],
    trigger_domains: ["cardiovascular"],
    min_score: 40,
  },
  {
    name: "Nattokinase",
    form: "Capsule",
    dosage: "2000 FU (100 mg)",
    timing: "On an empty stomach, away from meals",
    priority: "high",
    domains: ["cardiovascular"],
    trigger_domains: ["cardiovascular"],
    min_score: 50,
    note: "Avoid if on anticoagulants.",
  },
  // --- Cardiovascular + Metabolic ---
  {
    name: "Berberine",
    form: "Capsule",
    dosage: "500 mg 2x/day",
    timing: "With meals",
    priority: "high",
    domains: ["cardiovascular", "metabolic"],
    trigger_domains: ["cardiovascular", "metabolic"],
    min_score: 45,
  },
  // --- Metabolic ---
  {
    name: "Alpha-Lipoic Acid (R-ALA)",
    form: "Capsule",
    dosage: "300 mg",
    timing: "Before a carbohydrate-containing meal",
    priority: "high",
    domains: ["metabolic"],
    trigger_domains: ["metabolic"],
    min_score: 45,
  },
  {
    name: "Chromium Picolinate",
    form: "Capsule",
    dosage: "200 mcg",
    timing: "With largest meal",
    priority: "recommended",
    domains: ["metabolic"],
    trigger_domains: ["metabolic"],
    min_score: 40,
  },
  // --- Neurological ---
  {
    name: "Lion's Mane Extract",
    form: "Capsule",
    dosage: "1000 mg 2x/day",
    timing: "With breakfast and lunch",
    priority: "high",
    domains: ["neurological"],
    trigger_domains: ["neurodegenerative"],
    min_score: 40,
  },
  {
    name: "B-Complex (methylated)",
    form: "Capsule",
    dosage: "1 capsule/day (includes methylfolate + methylB12)",
    timing: "With breakfast",
    priority: "recommended",
    domains: ["neurological"],
    trigger_domains: ["neurodegenerative"],
    min_score: 35,
  },
  {
    name: "Phosphatidylserine",
    form: "Softgel",
    dosage: "300 mg",
    timing: "With breakfast",
    priority: "recommended",
    domains: ["neurological"],
    trigger_domains: ["neurodegenerative"],
    min_score: 45,
  },
  // --- Oncological ---
  {
    name: "Sulforaphane (Broccoli Seed Extract)",
    form: "Capsule",
    dosage: "30 mg",
    timing: "With breakfast",
    priority: "recommended",
    domains: ["oncological"],
    trigger_domains: ["oncological"],
    min_score: 40,
  },
  {
    name: "Curcumin (with piperine)",
    form: "Capsule",
    dosage: "1000 mg",
    timing: "With a fat-containing meal",
    priority: "recommended",
    domains: ["oncological"],
    trigger_domains: ["oncological"],
    min_score: 45,
  },
  // --- Musculoskeletal ---
  {
    name: "Collagen Peptides (Type I+III)",
    form: "Powder",
    dosage: "15 g/day",
    timing: "Post-exercise or with breakfast",
    priority: "recommended",
    domains: ["musculoskeletal"],
    trigger_domains: ["musculoskeletal"],
    min_score: 40,
  },
  {
    name: "Calcium Citrate",
    form: "Tablet",
    dosage: "500 mg 2x/day",
    timing: "With meals (separate from iron supplements)",
    priority: "high",
    domains: ["musculoskeletal"],
    trigger_domains: ["musculoskeletal"],
    min_score: 45,
  },
];

const PRIORITY_ORDER = { critical: 0, high: 1, recommended: 2 };

export function generateSupplementProtocol(scores: DomainScores): SupplementProtocol {
  const domainMap: Record<string, number> = {
    cardiovascular: scores.cv_risk ?? 50,
    metabolic: scores.metabolic_risk ?? 50,
    neurodegenerative: scores.neuro_risk ?? 50,
    oncological: scores.onco_risk ?? 50,
    musculoskeletal: scores.msk_risk ?? 50,
  };

  const seen = new Set<string>();
  const selected: SupplementItem[] = [];

  for (const entry of CATALOG) {
    if (seen.has(entry.name)) continue;

    const isBaseline = entry.trigger_domains.length === 0;
    const triggered = entry.trigger_domains.some(
      (d) => (domainMap[d] ?? 0) >= entry.min_score,
    );

    if (isBaseline || triggered) {
      seen.add(entry.name);
      const { trigger_domains: _td, min_score: _ms, ...item } = entry;
      selected.push(item);
    }
  }

  selected.sort(
    (a, b) =>
      PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
      a.name.localeCompare(b.name),
  );

  const hasNullScores = Object.values(scores).some((v) => v === null);

  return {
    supplements: selected,
    generated_at: new Date().toISOString(),
    data_completeness_note: hasNullScores
      ? "Scores estimated from lifestyle data only. Upload blood panel results to refine recommendations."
      : "Protocol based on full biomarker data.",
  };
}
```

- [ ] **Step 2: TypeScript check**

```bash
pnpm tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add lib/supplements/protocol.ts
git commit -m "feat: rules-based supplement protocol generator from risk domain scores"
```

---

### Task 7: Run engine on submitAssessment

**Files:**
- Modify: `app/(app)/onboarding/actions.ts`

- [ ] **Step 1: Add engine invocation after assessment save**

In `app/(app)/onboarding/actions.ts`, after the `if (existing) { ... } else { ... }` block that saves the assessment, add:

```ts
// Run risk engine and save scores — non-fatal if it errors.
try {
  const { adaptResponsesToPatient } = await import("@/lib/risk/adapter");
  const { runRiskEngine } = await import("@/lib/risk/engine");
  const { generateSupplementProtocol } = await import("@/lib/supplements/protocol");
  const { Json } = await import("@/lib/supabase/database.types");

  const patient = adaptResponsesToPatient(responses);
  const result = runRiskEngine(patient);
  const protocol = generateSupplementProtocol({
    cv_risk: result.domains.cardiovascular.score,
    metabolic_risk: result.domains.metabolic.score,
    neuro_risk: result.domains.neurodegenerative.score,
    onco_risk: result.domains.oncological.score,
    msk_risk: result.domains.musculoskeletal.score,
  });

  await supabase.from("risk_scores").insert({
    user_uuid: user.id,
    biological_age: result.biological_age,
    cv_risk: result.domains.cardiovascular.score,
    metabolic_risk: result.domains.metabolic.score,
    neuro_risk: result.domains.neurodegenerative.score,
    onco_risk: result.domains.oncological.score,
    msk_risk: result.domains.musculoskeletal.score,
    engine_output: result as unknown as Json,
    supplements_json: protocol as unknown as Json,
  });
} catch (engineErr) {
  // Engine errors must not block questionnaire submission.
  console.error("Risk engine failed, continuing without scores:", engineErr);
}
```

Note: The `Json` import at the top of the type-cast is a workaround for strict JSONB typing. Replace the `await import` of `Json` with a direct top-level import:

At the top of `actions.ts`, add:
```ts
import type { Json } from "@/lib/supabase/database.types";
```

And remove the `await import("@/lib/supabase/database.types")` line from the try block.

The dynamic imports for engine/adapter/supplements are intentional — they keep the server action bundle lean since the engine is ~1000 lines.

- [ ] **Step 2: TypeScript check**

```bash
pnpm tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Smoke test manually**

Start the dev server (`pnpm dev`), log in with a test account, complete the onboarding questionnaire, submit it, and verify:
- Redirect lands on `/dashboard?onboarding=complete`
- Dashboard shows risk scores (not all dashes)

- [ ] **Step 4: Commit**

```bash
git add app/\(app\)/onboarding/actions.ts
git commit -m "feat: run risk engine + supplement generator on assessment submit, write risk_scores"
```

---

## Phase 3 — Report page and PDF (~4 hours)

### Task 8: Full /report page

**Files:**
- Modify: `app/(app)/report/page.tsx` (replace stub)

- [ ] **Step 1: Replace stub with real report page**

```tsx
// app/(app)/report/page.tsx
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { SupplementProtocol } from "@/lib/supplements/protocol";
import type { EngineResult } from "@/lib/risk/engine";
import type { Json } from "@/lib/supabase/database.types";
import "./report.css";

export const metadata = { title: "Report · Longevity Coach" };

const DOMAINS = [
  { key: "cv_risk",         label: "Cardiovascular" },
  { key: "metabolic_risk",  label: "Metabolic" },
  { key: "neuro_risk",      label: "Neurological" },
  { key: "onco_risk",       label: "Oncological" },
  { key: "msk_risk",        label: "Musculoskeletal" },
] as const;

export default async function ReportPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: risk } = await supabase
    .from("risk_scores")
    .select(
      "biological_age, cv_risk, metabolic_risk, neuro_risk, onco_risk, msk_risk, engine_output, supplements_json, computed_at",
    )
    .eq("user_uuid", user!.id)
    .order("computed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: assessment } = await supabase
    .from("health_profiles")
    .select("completed_at")
    .eq("user_uuid", user!.id)
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!risk || !assessment) {
    return (
      <div className="lc-report">
        <h1>Your report</h1>
        <p className="subtitle">
          Complete your health assessment to generate your personalised report.
        </p>
        <div className="card">
          <p>
            Your biological age, risk scores, and supplement protocol will appear here
            once you have submitted the questionnaire.
          </p>
          <Link className="btn btn-primary" href="/onboarding">
            {assessment ? "Assessment processing" : "Start your assessment"}
          </Link>
        </div>
      </div>
    );
  }

  const engine = risk.engine_output as EngineResult | null;
  const protocol = risk.supplements_json as SupplementProtocol | null;
  const chronAge = engine?.chronological_age;
  const ageDelta = engine?.age_delta;

  const firstName =
    (user!.user_metadata?.full_name as string | undefined)?.split(" ")[0] ?? null;

  return (
    <div className="lc-report">
      <h1>{firstName ? `${firstName}'s report` : "Your report"}</h1>
      <p className="subtitle">
        Generated {formatDate(risk.computed_at)} from your health assessment.
      </p>

      {/* Bio-age hero */}
      <div className="card">
        <div className="bio-age-hero">
          <div className="bio-age-number">{risk.biological_age?.toFixed(1) ?? "–"}</div>
          <div className="bio-age-label">Biological age</div>
          {ageDelta != null && chronAge != null && (
            <div className="bio-age-delta">
              {ageDelta > 0
                ? `${Math.abs(ageDelta)} years older than your chronological age of ${chronAge}`
                : ageDelta < 0
                  ? `${Math.abs(ageDelta)} years younger than your chronological age of ${chronAge}`
                  : `Equal to your chronological age of ${chronAge}`}
            </div>
          )}
          {engine && (
            <div style={{ marginTop: 16 }}>
              <span className={`badge ${labelToBadgeClass(engine.longevity_label)}`}>
                {engine.longevity_label}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Domain risk grid */}
      <div className="card">
        <div className="head">
          <h2>Risk domains</h2>
          <span className="badge muted">Scores 0–100 · lower is better</span>
        </div>
        <div className="domain-grid">
          {DOMAINS.map(({ key, label }) => {
            const score = risk[key as keyof typeof risk] as number | null;
            const level = score != null ? getRiskLevel(score) : null;
            return (
              <div className="domain-cell" key={key}>
                <div className="domain-label">{label}</div>
                <div className={`domain-score ${level ?? ""}`}>
                  {score?.toFixed(0) ?? "–"}
                </div>
              </div>
            );
          })}
        </div>
        {engine?.score_confidence && (
          <p style={{ marginTop: 16, marginBottom: 0 }}>
            Confidence: <strong>{engine.score_confidence.level}</strong>.{" "}
            {engine.score_confidence.message}
          </p>
        )}
      </div>

      {/* Top modifiable risks */}
      {engine?.top_risks && engine.top_risks.length > 0 && (
        <div className="card">
          <div className="head">
            <h2>Top modifiable risks</h2>
          </div>
          <ul className="risk-list">
            {engine.top_risks.map((r) => (
              <li className="risk-item" key={r.name}>
                <span style={{ minWidth: 160, textTransform: "capitalize" }}>
                  {r.name.replace(/_/g, " ")}
                </span>
                <div className="risk-bar-wrap">
                  <div className="risk-bar" style={{ width: `${r.score}%` }} />
                </div>
                <span style={{ minWidth: 36, textAlign: "right", color: "#8A9AA5" }}>
                  {r.score}
                </span>
                {r.optimal_range && (
                  <span style={{ fontSize: 12, color: "#8A9AA5", minWidth: 140 }}>
                    Target: {r.optimal_range}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Supplement protocol */}
      {protocol && protocol.supplements.length > 0 && (
        <div className="card">
          <div className="head">
            <h2>Supplement protocol</h2>
            <a className="btn btn-ghost" href="/api/report/pdf" download>
              Download PDF
            </a>
          </div>
          <p>{protocol.data_completeness_note}</p>
          <table className="supp-table">
            <thead>
              <tr>
                <th>Supplement</th>
                <th>Form</th>
                <th>Dosage</th>
                <th>Timing</th>
                <th>Priority</th>
              </tr>
            </thead>
            <tbody>
              {protocol.supplements.map((s) => (
                <tr key={s.name}>
                  <td>
                    {s.name}
                    {s.note && (
                      <span style={{ display: "block", fontSize: 11, color: "#8A9AA5", marginTop: 2 }}>
                        {s.note}
                      </span>
                    )}
                  </td>
                  <td>{s.form}</td>
                  <td>{s.dosage}</td>
                  <td>{s.timing}</td>
                  <td>
                    <span className={`badge ${priorityBadgeClass(s.priority)}`}>
                      {s.priority}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function getRiskLevel(score: number): string {
  if (score <= 15) return "very_low";
  if (score <= 30) return "low";
  if (score <= 55) return "moderate";
  if (score <= 70) return "high";
  return "very_high";
}

function labelToBadgeClass(label: string): string {
  if (label === "Optimal" || label === "Good") return "success";
  if (label === "Needs Attention") return "warning";
  return "danger";
}

function priorityBadgeClass(p: string): string {
  if (p === "critical") return "danger";
  if (p === "high") return "warning";
  return "muted";
}

function formatDate(iso: string | null): string {
  if (!iso) return "–";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
```

- [ ] **Step 2: Build and verify**

```bash
pnpm build
```

Expected: clean build, `/report` route compiled

- [ ] **Step 3: Commit**

```bash
git add app/\(app\)/report/page.tsx
git commit -m "feat: full /report page — bio-age, domain grid, top risks, supplement protocol"
```

---

### Task 9: PDF generation

**Files:**
- Create: `lib/pdf/report.tsx`
- Create: `app/api/report/pdf/route.ts`

- [ ] **Step 1: Install dependency**

```bash
pnpm add @react-pdf/renderer
pnpm add -D @types/react-pdf
```

- [ ] **Step 2: Create the PDF document component**

`lib/pdf/report.tsx`:

```tsx
// lib/pdf/report.tsx
// React PDF document rendered server-side via @react-pdf/renderer renderToBuffer.
// Do NOT import this file from any client component — Node.js only.

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import type { SupplementProtocol } from "@/lib/supplements/protocol";
import type { EngineResult } from "@/lib/risk/engine";

const C = {
  primary: "#2F6F8F",
  ink: "#2B2B2B",
  inkSoft: "#4B4B4B",
  grey: "#8A9AA5",
  line: "#E3E8EC",
  lineSoft: "#EDF1F4",
  success: "#2A7A5C",
  warning: "#B5722F",
  danger: "#B5452F",
};

const styles = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 10, color: C.ink, padding: "40pt 48pt" },
  header: { marginBottom: 28 },
  logo: { fontSize: 16, color: C.primary, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  subtitle: { fontSize: 9, color: C.grey },
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: C.ink,
    marginBottom: 10,
    paddingBottom: 6,
    borderBottom: `1pt solid ${C.line}`,
  },
  bioAgeNumber: { fontSize: 48, fontFamily: "Helvetica-Bold", color: C.primary },
  bioAgeLabel: { fontSize: 9, color: C.grey, marginBottom: 4 },
  domainRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  domainCell: {
    flex: 1,
    backgroundColor: C.lineSoft,
    borderRadius: 6,
    padding: "10pt 8pt",
    alignItems: "center",
  },
  domainLabel: { fontSize: 7, color: C.grey, marginBottom: 4, textTransform: "uppercase" },
  domainScore: { fontSize: 18, fontFamily: "Helvetica-Bold", color: C.ink },
  tableHeader: {
    flexDirection: "row",
    borderBottom: `1pt solid ${C.line}`,
    paddingBottom: 6,
    marginBottom: 4,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 5,
    borderBottom: `0.5pt solid ${C.lineSoft}`,
  },
  colName: { width: "28%" },
  colForm: { width: "12%" },
  colDose: { width: "22%" },
  colTiming: { width: "26%" },
  colPrio: { width: "12%" },
  th: { fontSize: 7, color: C.grey, fontFamily: "Helvetica-Bold", textTransform: "uppercase" },
  td: { fontSize: 9, color: C.inkSoft },
  tdBold: { fontSize: 9, color: C.ink, fontFamily: "Helvetica-Bold" },
  footer: { position: "absolute", bottom: 32, left: 48, right: 48, textAlign: "center", fontSize: 8, color: C.grey },
});

type ReportProps = {
  risk: {
    biological_age: number | null;
    cv_risk: number | null;
    metabolic_risk: number | null;
    neuro_risk: number | null;
    onco_risk: number | null;
    msk_risk: number | null;
  };
  engine: EngineResult | null;
  protocol: SupplementProtocol | null;
  firstName: string | null;
  generatedAt: string;
};

const DOMAINS = [
  { label: "CV", score: (r: ReportProps["risk"]) => r.cv_risk },
  { label: "Metabolic", score: (r: ReportProps["risk"]) => r.metabolic_risk },
  { label: "Neuro", score: (r: ReportProps["risk"]) => r.neuro_risk },
  { label: "Onco", score: (r: ReportProps["risk"]) => r.onco_risk },
  { label: "MSK", score: (r: ReportProps["risk"]) => r.msk_risk },
];

export function ReportDocument({ risk, engine, protocol, firstName, generatedAt }: ReportProps) {
  const name = firstName ?? "Patient";
  const bioAge = risk.biological_age?.toFixed(1) ?? "–";
  const chronAge = engine?.chronological_age;
  const ageDelta = engine?.age_delta;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>Longevity Coach</Text>
          <Text style={styles.subtitle}>
            {name} · Generated {new Date(generatedAt).toLocaleDateString()} · Confidential
          </Text>
        </View>

        {/* Bio-age */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Biological Age</Text>
          <Text style={styles.bioAgeNumber}>{bioAge}</Text>
          <Text style={styles.bioAgeLabel}>biological age</Text>
          {ageDelta != null && chronAge != null && (
            <Text style={{ fontSize: 9, color: C.inkSoft }}>
              {ageDelta > 0
                ? `${Math.abs(ageDelta)} years older than chronological age (${chronAge})`
                : ageDelta < 0
                  ? `${Math.abs(ageDelta)} years younger than chronological age (${chronAge})`
                  : `Equal to chronological age (${chronAge})`}
            </Text>
          )}
        </View>

        {/* Domain scores */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Risk Domain Scores (0–100, lower is better)</Text>
          <View style={styles.domainRow}>
            {DOMAINS.map(({ label, score }) => (
              <View style={styles.domainCell} key={label}>
                <Text style={styles.domainLabel}>{label}</Text>
                <Text style={styles.domainScore}>{score(risk)?.toFixed(0) ?? "–"}</Text>
              </View>
            ))}
          </View>
          {engine?.score_confidence && (
            <Text style={{ fontSize: 8, color: C.grey, marginTop: 6 }}>
              Confidence: {engine.score_confidence.level}. {engine.score_confidence.message}
            </Text>
          )}
        </View>

        {/* Supplement protocol */}
        {protocol && protocol.supplements.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Supplement Protocol</Text>
            <Text style={{ fontSize: 8, color: C.grey, marginBottom: 8 }}>
              {protocol.data_completeness_note}
            </Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.th, styles.colName]}>Supplement</Text>
              <Text style={[styles.th, styles.colForm]}>Form</Text>
              <Text style={[styles.th, styles.colDose]}>Dosage</Text>
              <Text style={[styles.th, styles.colTiming]}>Timing</Text>
              <Text style={[styles.th, styles.colPrio]}>Priority</Text>
            </View>
            {protocol.supplements.map((s) => (
              <View style={styles.tableRow} key={s.name}>
                <Text style={[styles.tdBold, styles.colName]}>{s.name}</Text>
                <Text style={[styles.td, styles.colForm]}>{s.form}</Text>
                <Text style={[styles.td, styles.colDose]}>{s.dosage}</Text>
                <Text style={[styles.td, styles.colTiming]}>{s.timing}</Text>
                <Text style={[styles.td, styles.colPrio]}>{s.priority}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Footer */}
        <Text style={styles.footer} fixed>
          Longevity Coach · {new Date(generatedAt).getFullYear()} · This report is for informational purposes only and does not constitute medical advice.
        </Text>
      </Page>
    </Document>
  );
}
```

- [ ] **Step 3: Create the PDF route handler**

`app/api/report/pdf/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { createClient } from "@/lib/supabase/server";
import { ReportDocument } from "@/lib/pdf/report";
import type { EngineResult } from "@/lib/risk/engine";
import type { SupplementProtocol } from "@/lib/supplements/protocol";

export async function GET(_request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: risk } = await supabase
    .from("risk_scores")
    .select(
      "biological_age, cv_risk, metabolic_risk, neuro_risk, onco_risk, msk_risk, engine_output, supplements_json, computed_at",
    )
    .eq("user_uuid", user.id)
    .order("computed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!risk) {
    return NextResponse.json({ error: "No report available" }, { status: 404 });
  }

  const firstName =
    (user.user_metadata?.full_name as string | undefined)?.split(" ")[0] ?? null;

  const buffer = await renderToBuffer(
    createElement(ReportDocument, {
      risk,
      engine: risk.engine_output as EngineResult | null,
      protocol: risk.supplements_json as SupplementProtocol | null,
      firstName,
      generatedAt: risk.computed_at,
    }),
  );

  const dateStr = new Date().toISOString().slice(0, 10);

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="longevity-report-${dateStr}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
```

- [ ] **Step 4: Build check**

```bash
pnpm build
```

Expected: clean build. If `@react-pdf/renderer` causes a build error related to canvas or browser APIs, add to `next.config.ts`:

```ts
// next.config.ts — add if needed
const nextConfig = {
  // ... existing config
  experimental: {
    serverComponentsExternalPackages: ["@react-pdf/renderer"],
  },
};
```

- [ ] **Step 5: Commit**

```bash
git add lib/pdf/report.tsx app/api/report/pdf/route.ts next.config.ts
git commit -m "feat: branded PDF report via @react-pdf/renderer — GET /api/report/pdf"
```

---

## Phase 4 — Admin scaffold (~1 hour)

### Task 10: Basic admin page

**Files:**
- Create: `app/(admin)/admin/page.tsx`
- Create: `app/(admin)/admin/admin.css`

- [ ] **Step 1: Verify proxy.ts already gates /admin**

Read `proxy.ts` and confirm it redirects users with `role !== 'admin'` away from `/admin`. If the check is missing, add it following the same pattern used for `/dashboard`.

- [ ] **Step 2: Create the admin page**

`app/(admin)/admin/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import "./admin.css";

export const metadata = { title: "Admin · Longevity Coach" };

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Confirm admin role on current user's own profile (readable via RLS owner policy).
  const { data: myProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (myProfile?.role !== "admin") redirect("/dashboard");

  // Use service-role client for cross-user queries.
  const admin = createAdminClient();

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, full_name, role, created_at, welcome_email_sent_at")
    .order("created_at", { ascending: false })
    .limit(100);

  const { data: assessments } = await admin
    .from("health_profiles")
    .select("user_uuid, completed_at")
    .not("completed_at", "is", null);

  const { data: subscriptions } = await admin
    .from("subscriptions")
    .select("user_uuid, status");

  const completedSet = new Set((assessments ?? []).map((a) => a.user_uuid));
  const subMap = new Map(
    (subscriptions ?? []).map((s) => [s.user_uuid, s.status]),
  );

  return (
    <div className="lc-admin">
      <h1>Admin</h1>
      <p className="subtitle">{profiles?.length ?? 0} registered users</p>
      <div className="card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name / ID</th>
              <th>Registered</th>
              <th>Assessment</th>
              <th>Subscription</th>
              <th>Welcome email</th>
            </tr>
          </thead>
          <tbody>
            {(profiles ?? []).map((p) => (
              <tr key={p.id}>
                <td>
                  <span className="name">{p.full_name ?? "–"}</span>
                  <span className="uid">{p.id.slice(0, 8)}</span>
                </td>
                <td>{formatDate(p.created_at)}</td>
                <td>
                  <span className={`badge ${completedSet.has(p.id) ? "success" : "muted"}`}>
                    {completedSet.has(p.id) ? "Done" : "Pending"}
                  </span>
                </td>
                <td>
                  <SubBadge status={subMap.get(p.id) ?? null} />
                </td>
                <td>
                  <span className={`badge ${p.welcome_email_sent_at ? "success" : "muted"}`}>
                    {p.welcome_email_sent_at ? "Sent" : "Not sent"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SubBadge({ status }: { status: string | null }) {
  if (!status) return <span className="badge muted">None</span>;
  if (status === "active" || status === "trialing")
    return <span className="badge success">{status}</span>;
  if (status === "past_due") return <span className="badge warning">Past due</span>;
  return <span className="badge muted">{status}</span>;
}

function formatDate(iso: string | null): string {
  if (!iso) return "–";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
```

`app/(admin)/admin/admin.css`:

```css
.lc-admin {
  --lc-primary: #2F6F8F;
  --lc-line: #E3E8EC;
  --lc-line-soft: #EDF1F4;
  --lc-ink: #2B2B2B;
  --lc-ink-soft: #4B4B4B;
  --lc-grey: #8A9AA5;
  --lc-surface: #FFFFFF;
  --lc-success: #2A7A5C;
  --lc-success-50: #E6F4EE;
  --lc-warning: #B5722F;
  --lc-warning-50: #FAEFE0;

  font-family: var(--font-lc-sans), system-ui, sans-serif;
  color: var(--lc-ink);
}
.lc-admin h1 {
  font-family: var(--font-lc-serif), Georgia, serif;
  font-weight: 400;
  font-size: 32px;
  margin: 0 0 6px;
}
.lc-admin .subtitle { color: var(--lc-ink-soft); margin: 0 0 32px; font-size: 15px; }
.lc-admin .card {
  background: var(--lc-surface);
  border: 1px solid var(--lc-line);
  border-radius: 16px;
  padding: 28px;
  overflow-x: auto;
}
.lc-admin .badge {
  display: inline-flex;
  font-family: var(--font-lc-mono), ui-monospace, monospace;
  font-size: 10px;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  padding: 3px 8px;
  border-radius: 999px;
  font-weight: 500;
}
.lc-admin .badge.success { background: var(--lc-success-50); color: var(--lc-success); }
.lc-admin .badge.warning { background: var(--lc-warning-50); color: var(--lc-warning); }
.lc-admin .badge.muted   { background: var(--lc-line-soft); color: var(--lc-grey); }

.lc-admin .admin-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.lc-admin .admin-table th {
  font-family: var(--font-lc-mono), ui-monospace, monospace;
  font-size: 10px;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: var(--lc-grey);
  text-align: left;
  padding: 0 16px 10px 0;
  border-bottom: 1px solid var(--lc-line);
}
.lc-admin .admin-table td {
  padding: 10px 16px 10px 0;
  border-bottom: 1px solid var(--lc-line-soft);
  vertical-align: middle;
}
.lc-admin .admin-table tr:last-child td { border-bottom: none; }
.lc-admin .admin-table .name { display: block; color: var(--lc-ink); font-weight: 500; }
.lc-admin .admin-table .uid  { display: block; font-family: var(--font-lc-mono), ui-monospace, monospace; font-size: 10px; color: var(--lc-grey); }
```

- [ ] **Step 3: Build check**

```bash
pnpm build
```

Expected: clean build with `/admin` route compiled

- [ ] **Step 4: Commit**

```bash
git add app/\(admin\)/admin
git commit -m "feat: basic admin CRM page — user list with assessment/subscription/email status"
```

---

## Phase 5 — Blocked (wait on James)

These tasks cannot proceed without decisions from the product owner:

| Task | Blocker | Notes |
|---|---|---|
| File uploads | James must confirm which file types are MVP + Supabase Storage bucket + RLS policy | Blood panel upload unlocks biomarker branches in the risk engine, dramatically improving score confidence |
| Stripe UI wiring | James must confirm pricing tiers and provide real Stripe price IDs | `/api/stripe/checkout` is ready; needs a real "Upgrade" button somewhere in the app |
| Branded PDF visual spec | James must confirm font and color choices beyond the existing logo | Current PDF uses the same token set as the app |
| Family-history sub-fields | James must confirm whether MVP requires age-of-onset and cancer-type detail | Currently simple yes/no toggles |
| Footer legal pages | James must supply Privacy, Terms, Clinical governance, Contact copy | Keep all links pointing to `#` until content arrives |
| Drip email sequence | Needs sign-off on cadence and content | `triggerEmailSequence` in Base44 is not ported |

---

## Execution order

If running tasks sequentially in one session:

1. Task 1 (nav) — 20 min
2. Task 2 (stubs) — 30 min
3. Task 3 (email idempotency) — 30 min
4. Task 4 (risk engine port) — 2–3 hr
5. Task 5 (adapter) — 30 min
6. Task 6 (supplement generator) — 45 min
7. Task 7 (engine invocation in submitAssessment) — 30 min
8. Task 8 (/report page) — 45 min
9. Task 9 (PDF) — 45 min
10. Task 10 (admin) — 45 min

**Total:** ~8–9 hours. Tasks 1–3 can ship independently. Tasks 4–7 must land together (engine, adapter, supplement, invocation). Tasks 8–9 depend on Tasks 4–7.
