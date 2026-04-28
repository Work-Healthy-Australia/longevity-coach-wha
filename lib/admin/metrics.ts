// This is the only file outside webhook/pipeline routes that uses the admin
// client. See .claude/rules/security.md exception for admin-CRM analytics.
// All admin-client usage is confined here; the page imports only the wrapper
// functions below, never the admin client directly.
import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DateRange = "7d" | "30d" | "quarter" | "all";

export type SubscriptionForMrr = {
  unit_amount: number; // cents
  interval: "month" | "year";
  status: string;
};

export type SubscriptionForActive = {
  user_uuid: string;
  status: string;
};

export type SubscriptionForChurn = {
  status: string;
  ended_at: string | null;
};

export type RiskScoreRow = {
  computed_at: string;
};

export type UploadRow = {
  created_at: string;
};

export type ProfileRow = {
  created_at: string;
};

export type DashboardMetrics = {
  mrrCents: number;
  activeMembers: number;
  newSignups: number;
  churn30d: number;
  pipelineRuns24h: number;
  uploads24h: number;
  recentSignups: RecentSignup[];
  range: DateRange;
};

export type RecentSignup = {
  id: string;
  fullName: string;
  email: string | null;
  createdAt: string | null;
  subscriptionStatus: string | null;
  hasAssessment: boolean;
};

const ACTIVE_STATUSES = new Set(["active", "trialing", "past_due"]);

// ---------------------------------------------------------------------------
// Pure functions — unit-testable
// ---------------------------------------------------------------------------

/** Sum of MRR in cents. Annual subs normalised to per-month. */
export function computeMrr(subs: SubscriptionForMrr[]): number {
  let totalCents = 0;
  for (const s of subs) {
    if (!ACTIVE_STATUSES.has(s.status)) continue;
    if (typeof s.unit_amount !== "number" || s.unit_amount <= 0) continue;
    if (s.interval === "year") {
      totalCents += s.unit_amount / 12;
    } else if (s.interval === "month") {
      totalCents += s.unit_amount;
    }
  }
  return Math.round(totalCents);
}

/** Distinct count of active member user_uuids. */
export function countActiveMembers(subs: SubscriptionForActive[]): number {
  const seen = new Set<string>();
  for (const s of subs) {
    if (ACTIVE_STATUSES.has(s.status)) seen.add(s.user_uuid);
  }
  return seen.size;
}

/** Count of profiles created in the date-range window. */
export function countNewSignups(profiles: ProfileRow[], range: DateRange, now: Date): number {
  const cutoff = rangeCutoff(range, now);
  if (cutoff === null) return profiles.length;
  return profiles.filter((p) => {
    if (!p.created_at) return false;
    return new Date(p.created_at).getTime() >= cutoff;
  }).length;
}

/** Cancellations within the last 30 days. */
export function countChurn30d(subs: SubscriptionForChurn[], now: Date): number {
  const cutoff = now.getTime() - 30 * 24 * 60 * 60 * 1000;
  return subs.filter((s) => {
    if (s.status !== "canceled" && s.status !== "cancelled") return false;
    if (!s.ended_at) return false;
    return new Date(s.ended_at).getTime() > cutoff;
  }).length;
}

/** Risk-score rows computed within the last 24h. */
export function countPipelineRuns24h(rows: RiskScoreRow[], now: Date): number {
  const cutoff = now.getTime() - 24 * 60 * 60 * 1000;
  return rows.filter((r) => {
    if (!r.computed_at) return false;
    return new Date(r.computed_at).getTime() > cutoff;
  }).length;
}

/** Upload rows created within the last 24h. */
export function countUploads24h(rows: UploadRow[], now: Date): number {
  const cutoff = now.getTime() - 24 * 60 * 60 * 1000;
  return rows.filter((r) => {
    if (!r.created_at) return false;
    return new Date(r.created_at).getTime() > cutoff;
  }).length;
}

export function rangeCutoff(range: DateRange, now: Date): number | null {
  switch (range) {
    case "7d":
      return now.getTime() - 7 * 24 * 60 * 60 * 1000;
    case "30d":
      return now.getTime() - 30 * 24 * 60 * 60 * 1000;
    case "quarter":
      return now.getTime() - 90 * 24 * 60 * 60 * 1000;
    case "all":
      return null;
  }
}

export function parseRange(value: string | string[] | undefined): DateRange {
  const v = Array.isArray(value) ? value[0] : value;
  if (v === "7d" || v === "30d" || v === "quarter" || v === "all") return v;
  return "30d";
}

export function formatMrr(cents: number): string {
  const dollars = Math.round(cents / 100);
  return `$${dollars.toLocaleString("en-US")}/mo`;
}

// ---------------------------------------------------------------------------
// Wrappers — fetch from supabase admin client and call the pure functions.
// All queries run in parallel via Promise.all.
//
// SCHEMA NOTE: The current `public.subscriptions` table (migration 0001) does
// not have `unit_amount`, `interval`, or `ended_at` columns. We adapt:
//   - interval/unit_amount inferred from `price_id` matching the
//     STRIPE_PRICE_MONTHLY / STRIPE_PRICE_ANNUAL env vars. Unit amounts come
//     from STRIPE_PRICE_MONTHLY_AMOUNT / STRIPE_PRICE_ANNUAL_AMOUNT (cents),
//     defaulting to 0 if absent (silent no-op per project convention).
//   - ended_at is approximated by `updated_at` for rows whose status is
//     'canceled' / 'cancelled'.
// ---------------------------------------------------------------------------

export async function getDashboardMetrics(range: DateRange): Promise<DashboardMetrics> {
  const admin = createAdminClient();
  const now = new Date();

  const monthlyPriceId = process.env.STRIPE_PRICE_MONTHLY ?? "";
  const annualPriceId = process.env.STRIPE_PRICE_ANNUAL ?? "";
  const monthlyAmount = parseInt(process.env.STRIPE_PRICE_MONTHLY_AMOUNT ?? "0", 10);
  const annualAmount = parseInt(process.env.STRIPE_PRICE_ANNUAL_AMOUNT ?? "0", 10);

  const [profilesRes, subsRes, risksRes, uploadsRes] = await Promise.all([
    admin
      .from("profiles")
      .select("id, full_name, created_at")
      .order("created_at", { ascending: false }),
    admin
      .from("subscriptions")
      .select("user_uuid, status, price_id, updated_at"),
    admin.from("risk_scores").select("user_uuid, computed_at"),
    admin.from("patient_uploads").select("created_at"),
  ]);

  const profiles = profilesRes.data ?? [];
  const subsRaw = subsRes.data ?? [];
  const risks = risksRes.data ?? [];
  const uploads = uploadsRes.data ?? [];

  // Derive subscription shape used by pure helpers.
  const subsForMrr: SubscriptionForMrr[] = subsRaw.map((s) => {
    const isAnnual = s.price_id && s.price_id === annualPriceId;
    const isMonthly = s.price_id && s.price_id === monthlyPriceId;
    return {
      status: s.status ?? "",
      interval: isAnnual ? "year" : "month",
      unit_amount: isAnnual ? annualAmount : isMonthly ? monthlyAmount : 0,
    };
  });

  const subsForActive: SubscriptionForActive[] = subsRaw.map((s) => ({
    user_uuid: s.user_uuid,
    status: s.status ?? "",
  }));

  const subsForChurn: SubscriptionForChurn[] = subsRaw.map((s) => ({
    status: s.status ?? "",
    // updated_at is the best proxy we have for ended_at in current schema
    ended_at: (s as { updated_at: string | null }).updated_at ?? null,
  }));

  // Recent signups: top 10 with email + sub status + assessment flag
  const recentProfiles = profiles.slice(0, 10);
  const subStatusByUser = new Map<string, string>();
  for (const s of subsRaw) {
    if (!subStatusByUser.has(s.user_uuid)) {
      subStatusByUser.set(s.user_uuid, s.status ?? "");
    }
  }
  const usersWithRisk = new Set(risks.map((r) => r.user_uuid));

  // Email comes from auth.users via admin auth API.
  // Note: listUsers paginates at 50/page by default. For a 10-user recent
  // list we only need the first page sorted by created_at desc, which is the
  // default ordering.
  let emailByUser = new Map<string, string>();
  try {
    const { data: authList } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    emailByUser = new Map((authList?.users ?? []).map((u) => [u.id, u.email ?? ""]));
  } catch {
    // silent no-op — admin email lookup is non-fatal
  }

  const recentSignups: RecentSignup[] = recentProfiles.map((p) => ({
    id: p.id,
    fullName: p.full_name ?? "—",
    email: emailByUser.get(p.id) ?? null,
    createdAt: p.created_at,
    subscriptionStatus: subStatusByUser.get(p.id) ?? null,
    hasAssessment: usersWithRisk.has(p.id),
  }));

  return {
    mrrCents: computeMrr(subsForMrr),
    activeMembers: countActiveMembers(subsForActive),
    newSignups: countNewSignups(profiles, range, now),
    churn30d: countChurn30d(subsForChurn, now),
    pipelineRuns24h: countPipelineRuns24h(risks, now),
    uploads24h: countUploads24h(uploads, now),
    recentSignups,
    range,
  };
}
