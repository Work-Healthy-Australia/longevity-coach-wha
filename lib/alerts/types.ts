// Re-exports for the alerts module.
//
// TODO: once migration 0031_member_alerts.sql is applied and
// `lib/supabase/database.types.ts` is regenerated, re-export the row type:
//   export type MemberAlertRow = Database["public"]["Tables"]["member_alerts"]["Row"];
// Until then, helpers accept structurally-typed inputs and we don't redeclare
// the row shape here (single source of truth = the generated types).

export type { AlertSeverity, AlertDraft } from "./evaluate-lab-alerts";
