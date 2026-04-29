/**
 * Right-to-Erasure cascade plan.
 *
 * Pure data + types. Declares every patient-data table touched by an
 * erasure request, the strategy applied to each, and per-column scrub
 * modes for `scrub` / `retain_anonymised` strategies.
 *
 * The orchestrator (Task 2.2) consumes ERASURE_PLAN and executes the
 * SQL — this module performs no I/O.
 */

export type ScrubMode = "null" | "erased_sentinel" | "empty_jsonb";

export type ScrubField = {
  column: string;
  mode: ScrubMode;
};

export type ErasureStrategy = "delete" | "scrub" | "retain_anonymised";

export type ErasurePlanEntry = {
  schema: "public" | "biomarkers" | "billing" | "agents";
  table: string;
  userColumn: "user_uuid" | "patient_uuid" | "id";
  strategy: ErasureStrategy;
  /** Required for `scrub` and `retain_anonymised`. May be an empty array
   *  when the entry exists for orchestrator-side handling (e.g. status
   *  flips) but no columns need column-level scrubbing. */
  scrubFields?: ScrubField[];
};

/** Sentinel string written to text columns when a row is retained but
 *  the field carried PII or free-text patient content. */
export const ERASED_SENTINEL = "[ERASED]";

/** Sentinel value for JSONB columns — postgres-side this is cast as
 *  `'{}'::jsonb`. */
export const EMPTY_JSONB = "{}";

export const ERASURE_PLAN: ErasurePlanEntry[] = [
  // 1
  {
    schema: "public",
    table: "profiles",
    userColumn: "id",
    strategy: "scrub",
    scrubFields: [
      { column: "full_name", mode: "erased_sentinel" },
      { column: "date_of_birth", mode: "null" },
      { column: "phone", mode: "null" },
      { column: "address_postal", mode: "null" },
    ],
  },
  // 2
  {
    schema: "public",
    table: "health_profiles",
    userColumn: "user_uuid",
    strategy: "scrub",
    scrubFields: [{ column: "responses", mode: "empty_jsonb" }],
  },
  // 3
  {
    schema: "public",
    table: "risk_scores",
    userColumn: "user_uuid",
    strategy: "delete",
  },
  // 4
  {
    schema: "public",
    table: "subscriptions",
    userColumn: "user_uuid",
    strategy: "delete",
  },
  // 5
  {
    schema: "public",
    table: "consent_records",
    userColumn: "user_uuid",
    strategy: "retain_anonymised",
    scrubFields: [
      { column: "ip_address", mode: "null" },
      { column: "user_agent", mode: "null" },
    ],
  },
  // 6
  {
    schema: "public",
    table: "patient_uploads",
    userColumn: "user_uuid",
    strategy: "scrub",
    scrubFields: [
      { column: "original_filename", mode: "erased_sentinel" },
      { column: "janet_findings", mode: "empty_jsonb" },
    ],
  },
  // 7
  {
    schema: "public",
    table: "family_members",
    userColumn: "user_uuid",
    strategy: "delete",
  },
  // 8
  {
    schema: "public",
    table: "agent_conversations",
    userColumn: "user_uuid",
    strategy: "scrub",
    scrubFields: [{ column: "content", mode: "erased_sentinel" }],
  },
  // 9
  {
    schema: "public",
    table: "support_tickets",
    userColumn: "user_uuid",
    strategy: "scrub",
    scrubFields: [{ column: "summary", mode: "erased_sentinel" }],
  },
  // 10
  {
    schema: "public",
    table: "appointments",
    userColumn: "patient_uuid",
    strategy: "delete",
  },
  // 11
  {
    schema: "public",
    table: "care_notes",
    userColumn: "patient_uuid",
    strategy: "retain_anonymised",
    scrubFields: [{ column: "content", mode: "erased_sentinel" }],
  },
  // 12 — status flip handled in Task 2.2; no column scrubs here
  {
    schema: "public",
    table: "patient_assignments",
    userColumn: "patient_uuid",
    strategy: "retain_anonymised",
    scrubFields: [],
  },
  // 13
  {
    schema: "public",
    table: "periodic_reviews",
    userColumn: "patient_uuid",
    strategy: "retain_anonymised",
    scrubFields: [
      { column: "wins", mode: "null" },
      { column: "stress_notes", mode: "null" },
      { column: "ai_summary", mode: "null" },
      { column: "program_30_day", mode: "empty_jsonb" },
    ],
  },
  // 14
  {
    schema: "public",
    table: "coach_suggestions",
    userColumn: "patient_uuid",
    strategy: "delete",
  },
  // 15
  {
    schema: "public",
    table: "journal_entries",
    userColumn: "user_uuid",
    strategy: "scrub",
    scrubFields: [{ column: "body", mode: "erased_sentinel" }],
  },
  // 16
  {
    schema: "public",
    table: "member_alerts",
    userColumn: "user_uuid",
    strategy: "delete",
  },
  // 17
  {
    schema: "public",
    table: "export_log",
    userColumn: "user_uuid",
    strategy: "retain_anonymised",
    scrubFields: [{ column: "request_ip", mode: "null" }],
  },
  // 18
  {
    schema: "biomarkers",
    table: "lab_results",
    userColumn: "user_uuid",
    strategy: "delete",
  },
  // 19
  {
    schema: "biomarkers",
    table: "biological_age_tests",
    userColumn: "user_uuid",
    strategy: "delete",
  },
  // 20
  {
    schema: "biomarkers",
    table: "daily_logs",
    userColumn: "user_uuid",
    strategy: "delete",
  },
  // 21
  {
    schema: "billing",
    table: "subscription_addons",
    userColumn: "user_uuid",
    strategy: "delete",
  },
  // 22
  {
    schema: "billing",
    table: "test_orders",
    userColumn: "user_uuid",
    strategy: "delete",
  },
  // 23
  {
    schema: "billing",
    table: "organisation_members",
    userColumn: "user_uuid",
    strategy: "delete",
  },
  // 24
  {
    schema: "agents",
    table: "conversation_summaries",
    userColumn: "user_uuid",
    strategy: "scrub",
    scrubFields: [{ column: "summary", mode: "erased_sentinel" }],
  },
];

/**
 * Collapse per-table row counts into a flat record for the audit JSONB.
 * Sums duplicates (e.g. if the orchestrator visits a table twice) and
 * omits zero-count entries so the audit blob stays compact.
 */
export function summariseCounts(
  results: { table: string; count: number }[],
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const { table, count } of results) {
    totals[table] = (totals[table] ?? 0) + count;
  }
  // Drop zero-count entries (and any negatives that may slip in).
  for (const key of Object.keys(totals)) {
    if (totals[key] <= 0) delete totals[key];
  }
  return totals;
}
