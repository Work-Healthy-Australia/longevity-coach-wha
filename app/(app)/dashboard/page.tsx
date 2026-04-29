import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { calculateStreak } from "@/lib/streaks";
import { dismissAlert } from "./_actions/dismiss-alert";
import "./dashboard.css";

export const metadata = { title: "Dashboard · Longevity Coach" };

const ACTIVE_SUB_STATUSES = new Set(["trialing", "active", "past_due"]);

type SupplementItem = {
  name: string;
  dose: string;
  timing?: string;
  tier?: "critical" | "high" | "recommended" | "performance";
  note?: string;
};

type DailyLog = {
  log_date: string;
  sleep_hours: number | null;
  energy_level: number | null;
  mood: number | null;
  steps: number | null;
  water_ml: number | null;
  workout_duration_min: number | null;
  supplements_taken: string[] | null;
};

const RISK_DOMAINS = [
  { key: "cv_risk", label: "Cardiovascular" },
  { key: "metabolic_risk", label: "Metabolic" },
  { key: "neuro_risk", label: "Neurological" },
  { key: "onco_risk", label: "Oncological" },
  { key: "msk_risk", label: "Musculoskeletal" },
] as const;

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: assessment } = await supabase
    .from("health_profiles")
    .select("id, completed_at, updated_at, responses")
    .eq("user_uuid", user!.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: risk } = await supabase
    .from("risk_scores")
    .select(
      "biological_age, cv_risk, metabolic_risk, neuro_risk, onco_risk, msk_risk, narrative, computed_at",
    )
    .eq("user_uuid", user!.id)
    .order("computed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: supplement } = await supabase
    .from("supplement_plans")
    .select("items, status, created_at")
    .eq("patient_uuid", user!.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { count: uploadCount } = await supabase
    .from("patient_uploads")
    .select("id", { count: "exact", head: true })
    .eq("user_uuid", user!.id);

  // Lab summary for dashboard tile: total rows, distinct biomarker count,
  // and latest test_date. Per-user lab data is small, so a single column-
  // projection fetch is cheaper than three round-trips and PostgREST
  // doesn't expose distinct counts cleanly anyway.
  const { data: rawLabRows } = await supabase
    .schema("biomarkers" as never)
    .from("lab_results")
    .select("biomarker, test_date")
    .eq("user_uuid", user!.id)
    .order("test_date", { ascending: false });
  const labRows =
    (rawLabRows ?? []) as unknown as { biomarker: string; test_date: string }[];
  const labCount = labRows.length;
  const biomarkerCount = new Set(labRows.map((r) => r.biomarker)).size;
  const latestLabDate = labRows[0]?.test_date ?? null;

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("status, current_period_end, cancel_at_period_end")
    .eq("user_uuid", user!.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const { data: rawLogs } = await supabase
    .schema("biomarkers" as never)
    .from("daily_logs")
    .select(
      "log_date, sleep_hours, energy_level, mood, steps, water_ml, workout_duration_min, supplements_taken",
    )
    .eq("user_uuid", user!.id)
    .gte("log_date", thirtyDaysAgo.toISOString().slice(0, 10))
    .order("log_date", { ascending: false });
  const logs = (rawLogs ?? []) as unknown as DailyLog[];

  const { data: latestAlert } = await supabase
    .from("member_alerts")
    .select("id, alert_type, severity, title, body, link_href, created_at")
    .eq("user_uuid", user!.id)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: healthUpdate } = await supabase
    .from("health_updates")
    .select("title, content, category, source, posted_date")
    .order("posted_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const firstName =
    (user!.user_metadata?.full_name as string | undefined)?.split(" ")[0] ??
    (assessment?.responses as { basics?: { first_name?: string } } | null)?.basics?.first_name ??
    null;

  const assessmentState: "none" | "draft" | "complete" = !assessment
    ? "none"
    : assessment.completed_at
      ? "complete"
      : "draft";

  const subActive = subscription && ACTIVE_SUB_STATUSES.has(subscription.status);
  const supplementItems =
    Array.isArray(supplement?.items) ? (supplement!.items as SupplementItem[]) : [];

  // Streak: rest-day tolerant — 1–2 consecutive missed days count as rest
  // (streak continues); 3+ consecutive missed days reset the streak.
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayLog = logs.find((l) => l.log_date === todayStr) ?? null;
  const streakResult = calculateStreak(logs.map((l) => l.log_date), todayStr);
  const streak = streakResult.currentStreak;

  // Sleep summary: "slept well N of last 7 nights" — well = 7+ hours.
  const lastSeven = logs.slice(0, 7);
  const wellSleptCount = lastSeven.filter((l) => (l.sleep_hours ?? 0) >= 7).length;

  // Adherence: % of last 7 days with at least one supplement logged.
  const adherenceDays = lastSeven.filter(
    (l) => Array.isArray(l.supplements_taken) && l.supplements_taken.length > 0,
  ).length;
  const adherencePct =
    supplementItems.length > 0 && lastSeven.length > 0
      ? Math.round((adherenceDays / 7) * 100)
      : null;

  // Top risk domain: the highest numeric value across the five domains.
  const topRisk = risk
    ? RISK_DOMAINS.map((d) => ({ ...d, value: risk[d.key as keyof typeof risk] as number | null }))
        .filter((d) => typeof d.value === "number")
        .sort((a, b) => (b.value as number) - (a.value as number))[0] ?? null
    : null;

  // Pick the single most-important next action.
  const action = pickAction({
    assessmentState,
    hasRisk: !!risk,
    hasSupplement: supplementItems.length > 0,
    hasTodayLog: !!todayLog,
    uploadCount: uploadCount ?? 0,
    streak,
  });

  const greeting = greetingFor(new Date());

  return (
    <div className="lc-dash">
      {/* Hero */}
      <header className="lc-hero">
        <div className="lc-hero-row">
          <div>
            <p className="lc-hero-eyebrow">{greeting}</p>
            <h1>Welcome{firstName ? `, ${firstName}` : ""}.</h1>
          </div>
          <div className="lc-hero-streak">
            <div className="lc-hero-streak-value">{streak}</div>
            <div className="lc-hero-streak-label">
              day{streak === 1 ? "" : "s"} of check-ins
            </div>
          </div>
        </div>
        <div className="lc-streak-dots" aria-label="Last 7 days check-ins">
          {streakDots(new Set(logs.map((l) => l.log_date)), new Date()).map((d) => (
            <div
              key={d.date}
              className={`lc-streak-dot ${d.filled ? "filled" : ""} ${d.isToday ? "today" : ""}`}
              aria-label={`${d.date}${d.filled ? " logged" : " not logged"}`}
            >
              <span className="lc-streak-day">{d.dayLetter}</span>
            </div>
          ))}
        </div>
        <p className="lc-hero-summary">
          {summaryLine({ assessmentState, todayLog, wellSleptCount, lastSevenLength: lastSeven.length })}
        </p>
      </header>

      {/* Member alert chip — most recent open alert, dismissable */}
      {latestAlert && (
        <section className={`lc-alert-chip lc-alert-${latestAlert.severity}`}>
          <div className="lc-alert-body">
            <div className="lc-alert-title">{latestAlert.title}</div>
            <div className="lc-alert-text">{latestAlert.body}</div>
          </div>
          <div className="lc-alert-actions">
            {latestAlert.link_href && (
              <Link href={latestAlert.link_href} className="lc-alert-view">
                View →
              </Link>
            )}
            <form action={dismissAlert}>
              <input type="hidden" name="id" value={latestAlert.id} />
              <button type="submit" className="lc-alert-dismiss" aria-label="Dismiss alert">
                Dismiss
              </button>
            </form>
          </div>
        </section>
      )}

      {/* Today strip */}
      <section className="lc-today">
        <TodayTile
          label="Sleep"
          value={todayLog?.sleep_hours ?? null}
          unit="hrs"
          target={8}
          icon="sleep"
        />
        <TodayTile
          label="Energy"
          value={todayLog?.energy_level ?? null}
          unit="/10"
          target={10}
          icon="energy"
        />
        <TodayTile
          label="Steps"
          value={todayLog?.steps ?? null}
          unit=""
          target={8000}
          icon="steps"
        />
        <TodayTile
          label="Water"
          value={
            todayLog?.water_ml != null ? Math.round(todayLog.water_ml / 250) : null
          }
          unit="/10"
          target={10}
          icon="water"
        />
      </section>

      {/* Single most important action */}
      <section className="lc-action">
        <div className="lc-action-tag">Today</div>
        <h2>{action.title}</h2>
        <p>{action.body}</p>
        <Link href={action.href} className="lc-action-cta">
          {action.cta} →
        </Link>
      </section>

      {/* Three big numbers */}
      <section className="lc-numbers">
        <BigNumber
          label="Biological age"
          value={
            risk?.biological_age != null ? `${Math.round(risk.biological_age)}` : "—"
          }
          sub={
            risk?.biological_age != null
              ? `vs chronological ${chronologicalAge(assessment)}`
              : "Complete your assessment"
          }
          href="/report"
        />
        <BigNumber
          label="Top risk"
          value={topRisk?.label ?? "—"}
          sub={topRisk ? `Score ${topRisk.value} · view detail` : "No scores yet"}
          href="/report"
        />
        <BigNumber
          label="Supplement adherence"
          value={adherencePct != null ? `${adherencePct}%` : "—"}
          sub={
            adherencePct != null
              ? `${adherenceDays} of last 7 days`
              : supplementItems.length === 0
                ? "No active protocol"
                : "Log your daily check-in"
          }
          href="/check-in"
        />
      </section>

      {/* Supplement protocol */}
      {supplementItems.length > 0 && (
        <section className="lc-supplement">
          <div className="lc-section-head">
            <h2>Today's protocol</h2>
            <Link href="/report" className="lc-section-link">
              Full protocol →
            </Link>
          </div>
          <div className="lc-supplement-list">
            {supplementItems.slice(0, 6).map((item, i) => (
              <div className="lc-supplement-row" key={i}>
                <div className="lc-supplement-check" aria-hidden="true">
                  ○
                </div>
                <div className="lc-supplement-main">
                  <div className="lc-supplement-name">
                    <strong>{item.name}</strong>
                    {item.tier && (
                      <span className={`lc-tier lc-tier-${item.tier}`}>{item.tier}</span>
                    )}
                  </div>
                  <div className="lc-supplement-meta">
                    {item.dose}
                    {item.timing ? ` · ${item.timing}` : ""}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* What's new */}
      <section className="lc-whatsnew">
        <article className="lc-whatsnew-card lc-whatsnew-janet">
          <div className="lc-whatsnew-eyebrow">Janet's insight</div>
          <p>
            {risk?.narrative
              ? firstSentence(risk.narrative)
              : assessmentState === "complete"
                ? "Risk narrative is being generated. Check back shortly."
                : "Complete your assessment for personalised insights."}
          </p>
          <Link href="/report" className="lc-whatsnew-link">
            Read more →
          </Link>
        </article>
        <article className="lc-whatsnew-card lc-whatsnew-update">
          <div className="lc-whatsnew-eyebrow">
            {healthUpdate?.category ?? "Research"}
          </div>
          {healthUpdate ? (
            <>
              <p className="lc-whatsnew-title">{healthUpdate.title}</p>
              <p className="lc-whatsnew-source">— {healthUpdate.source}</p>
            </>
          ) : (
            <p>Curated research from longevity literature appears here weekly.</p>
          )}
        </article>
      </section>

      {/* Quick links */}
      <section className="lc-quick">
        <QuickTile href="/uploads" label="Documents" sub={uploadCount ? `${uploadCount} files` : "Upload your panels"} icon="📄" />
        <QuickTile
          href="/labs"
          label="Lab Results"
          sub={
            labCount === 0
              ? "Upload your first panel"
              : `${biomarkerCount} biomarker${biomarkerCount === 1 ? "" : "s"} · latest ${formatDate(latestLabDate)}`
          }
          icon="🔬"
        />
        <QuickTile href="/report" label="Report" sub="Risk + supplements" icon="📊" />
        <QuickTile href="/check-in" label="Check-in" sub={todayLog ? "Today logged" : "Log today"} icon="✏️" />
        <QuickTile href="/trends" label="Trends" sub="30-day patterns" icon="📈" />
        <QuickTile href="/simulator" label="Simulator" sub="Slide and see" icon="🎚️" />
        <QuickTile href="/onboarding" label="Update profile" sub="Refresh your answers" icon="👤" />
        <QuickTile href="/legal/collection-notice" label="Privacy" sub="What we store" icon="🔒" />
        <QuickTile href="mailto:hello@longevity-coach.io" label="Get help" sub="Reach support" icon="💬" />
      </section>

      {/* Coming soon shelf */}
      <section className="lc-coming">
        <div className="lc-section-head">
          <h2>Coming soon</h2>
          <span className="lc-section-note">In development across the next two phases</span>
        </div>
        <div className="lc-coming-grid">
          <ComingTile
            icon="🩸"
            title="Glucose Tracker"
            stat="Avg fasting · 5.4 mmol/L"
            sub="Time-in-range 81% · CGM not connected"
          />
          <ComingTile
            icon="🏃"
            title="Training Log"
            stat="Zone 2 this week · 142 min"
            sub="VO₂ max 47 · Last session Tuesday"
          />
          <ComingTile
            icon="💊"
            title="Medications"
            stat="Active prescriptions · 2"
            sub="Atorvastatin 20mg · Metformin 500mg"
          />
          <ComingTile
            icon="🤝"
            title="Care Team"
            stat="Your GP · Dr Patel"
            sub="Last review 14 Apr · Next due 14 Oct"
          />
          <ComingTile
            icon="📓"
            title="Journal"
            stat="Entries this month · 12"
            sub="Avg purpose 8/10 · Last entry Sunday"
          />
          <ComingTile
            icon="🧠"
            title="Cognitive Fitness"
            stat="Reaction time · 312 ms"
            sub="7% faster than 30 days ago · Memory 92%"
          />
          <ComingTile
            icon="👥"
            title="Community"
            stat="Your cohort · 138 members"
            sub="3 in your suburb · 12 in your age band"
          />
        </div>
      </section>

      {/* Subscription footnote */}
      {subscription && (
        <footer className="lc-footnote">
          {subActive
            ? `Subscription active · renews ${formatDate(subscription.current_period_end)}`
            : `Subscription is ${subscription.status}. Contact support if this is an error.`}
        </footer>
      )}
    </div>
  );
}

function TodayTile({
  label,
  value,
  unit,
  target,
  icon,
}: {
  label: string;
  value: number | null;
  unit: string;
  target: number;
  icon: "sleep" | "energy" | "steps" | "water";
}) {
  const pct = value != null && target ? Math.min(100, Math.round((value / target) * 100)) : 0;
  const display = value != null ? formatNumber(value) : "—";
  return (
    <div className="lc-today-tile">
      <div className={`lc-today-icon lc-today-icon-${icon}`} aria-hidden="true" />
      <div className="lc-today-value">{display}<span className="lc-today-unit">{unit}</span></div>
      <div className="lc-today-label">{label}</div>
      <div className="lc-today-bar"><div className="lc-today-bar-fill" style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

function BigNumber({
  label,
  value,
  sub,
  href,
}: {
  label: string;
  value: string;
  sub: string;
  href: string;
}) {
  return (
    <Link href={href} className="lc-number">
      <div className="lc-number-label">{label}</div>
      <div className="lc-number-value">{value}</div>
      <div className="lc-number-sub">{sub}</div>
    </Link>
  );
}

function QuickTile({
  href,
  label,
  sub,
  icon,
}: {
  href: string;
  label: string;
  sub: string;
  icon: string;
}) {
  return (
    <Link href={href} className="lc-quick-tile">
      <span className="lc-quick-icon" aria-hidden="true">{icon}</span>
      <div>
        <div className="lc-quick-label">{label}</div>
        <div className="lc-quick-sub">{sub}</div>
      </div>
    </Link>
  );
}

function ComingTile({
  icon,
  title,
  stat,
  sub,
}: {
  icon: string;
  title: string;
  stat: string;
  sub: string;
}) {
  return (
    <div className="lc-coming-tile" aria-disabled="true">
      <div className="lc-coming-head">
        <span className="lc-coming-icon" aria-hidden="true">{icon}</span>
        <span className="lc-coming-pill">Coming soon</span>
      </div>
      <div className="lc-coming-title">{title}</div>
      <div className="lc-coming-stat">{stat}</div>
      <div className="lc-coming-sub">{sub}</div>
    </div>
  );
}

function pickAction(args: {
  assessmentState: "none" | "draft" | "complete";
  hasRisk: boolean;
  hasSupplement: boolean;
  hasTodayLog: boolean;
  uploadCount: number;
  streak: number;
}) {
  if (args.assessmentState === "none") {
    return {
      title: "Start your assessment",
      body: "Ten minutes of questions across six areas calibrate your risk scores and protocol.",
      cta: "Begin",
      href: "/onboarding",
    };
  }
  if (args.assessmentState === "draft") {
    return {
      title: "Pick up your assessment",
      body: "You have a draft in progress. Finish it to unlock your bio-age and risk profile.",
      cta: "Resume",
      href: "/onboarding",
    };
  }
  if (!args.hasRisk) {
    return {
      title: "Risk engine running",
      body: "Your assessment is in. Scores will appear within minutes — refresh shortly.",
      cta: "View report",
      href: "/report",
    };
  }
  if (!args.hasTodayLog) {
    return {
      title: "Take today's check-in",
      body: args.streak > 0
        ? `You're on a ${args.streak}-day streak. A 30-second log keeps it alive.`
        : "Two minutes a day is all Janet needs to track your progress.",
      cta: "Open check-in",
      href: "/check-in",
    };
  }
  if (args.uploadCount === 0) {
    return {
      title: "Upload your latest panel",
      body: "Real biomarker data sharpens your risk scores. Drop a recent blood test or DEXA in.",
      cta: "Upload now",
      href: "/uploads",
    };
  }
  if (!args.hasSupplement) {
    return {
      title: "Your protocol is being prepared",
      body: "Your supplement protocol is being generated from your latest risk scores. Back shortly.",
      cta: "View report",
      href: "/report",
    };
  }
  return {
    title: "You're set for today",
    body: "Check-in logged, panel on file, protocol active. Janet will surface insights as your data updates.",
    cta: "Open report",
    href: "/report",
  };
}

function summaryLine(args: {
  assessmentState: "none" | "draft" | "complete";
  todayLog: DailyLog | null;
  wellSleptCount: number;
  lastSevenLength: number;
}): string {
  if (args.assessmentState === "none") {
    return "Two minutes to set up · ten minutes to complete your assessment.";
  }
  if (args.lastSevenLength >= 3) {
    return `You've slept well ${args.wellSleptCount} of the last ${args.lastSevenLength} nights.`;
  }
  if (args.todayLog) {
    return "Today's check-in is in. Keep it up — consistency is what moves your bio-age.";
  }
  return "Log a check-in today to start tracking your trends.";
}

// Streak = number of consecutive UTC days ending on today (or yesterday, if
// today isn't logged yet — preserves the "save your streak by logging today"
// pattern). All math runs in UTC because the writer (check-in actions.ts)
// stores `log_date` as `new Date().toISOString().slice(0, 10)`, which is the
// UTC date. Mixing local-timezone Date objects here previously caused an
// off-by-one around midnight in non-UTC zones.
export function computeStreak(logDates: string[], now: Date = new Date()): number {
  if (logDates.length === 0) return 0;
  const dateSet = new Set(logDates);
  const todayStr = now.toISOString().slice(0, 10);
  const yesterdayStr = shiftDate(todayStr, -1);

  let cursor: string;
  if (dateSet.has(todayStr)) cursor = todayStr;
  else if (dateSet.has(yesterdayStr)) cursor = yesterdayStr;
  else return 0;

  let streak = 0;
  while (dateSet.has(cursor)) {
    streak++;
    cursor = shiftDate(cursor, -1);
  }
  return streak;
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export type StreakDot = {
  date: string;
  dayLetter: string;
  filled: boolean;
  isToday: boolean;
};

// Returns 7 entries oldest -> newest (6 days ago through today, UTC).
// dayLetter is the one-letter UTC weekday label for the date itself.
export function streakDots(
  logDates: Set<string>,
  now: Date = new Date(),
): StreakDot[] {
  const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"]; // Sun..Sat
  const todayStr = now.toISOString().slice(0, 10);
  const out: StreakDot[] = [];
  for (let i = 6; i >= 0; i--) {
    const date = shiftDate(todayStr, -i);
    const d = new Date(date + "T00:00:00Z");
    out.push({
      date,
      dayLetter: DAY_LETTERS[d.getUTCDay()],
      filled: logDates.has(date),
      isToday: i === 0,
    });
  }
  return out;
}

function chronologicalAge(
  assessment: { responses?: unknown } | null,
): string {
  const dob = (
    assessment?.responses as { basics?: { date_of_birth?: string } } | undefined
  )?.basics?.date_of_birth;
  if (!dob) return "—";
  const born = new Date(dob);
  if (isNaN(born.getTime())) return "—";
  const ageMs = Date.now() - born.getTime();
  return `${Math.floor(ageMs / (365.25 * 24 * 60 * 60 * 1000))}`;
}

function firstSentence(text: string): string {
  const trimmed = text.trim();
  const idx = trimmed.search(/[.!?](\s|$)/);
  if (idx === -1) return trimmed.slice(0, 200);
  return trimmed.slice(0, idx + 1);
}

function greetingFor(d: Date): string {
  const h = d.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function formatNumber(n: number): string {
  if (n >= 1000) return n.toLocaleString();
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(1);
}

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
