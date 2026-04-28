import { formatRange, type LabRow } from "@/lib/labs";

export type AlertSeverity = "info" | "attention" | "urgent";

export type AlertDraft = {
  alert_type: "lab_out_of_range" | "repeat_test";
  severity: AlertSeverity;
  source_id: string;
  title: string;
  body: string;
  link_href: string | null;
};

/**
 * Pure function. Groups lab rows by biomarker, picks the latest row per group
 * (sorted by `test_date desc, id desc` for a deterministic tiebreak), and
 * emits an alert draft when the latest status is `low`, `high`, or `critical`.
 *
 * `optimal`, `borderline`, and `null` statuses are suppressed.
 */
export function evaluateLabAlerts(rows: LabRow[]): AlertDraft[] {
  if (rows.length === 0) return [];

  const buckets = new Map<string, LabRow[]>();
  for (const row of rows) {
    const list = buckets.get(row.biomarker);
    if (list) list.push(row);
    else buckets.set(row.biomarker, [row]);
  }

  const drafts: AlertDraft[] = [];

  for (const [biomarker, list] of buckets) {
    const sorted = [...list].sort((a, b) => {
      if (a.test_date !== b.test_date) {
        return a.test_date < b.test_date ? 1 : -1;
      }
      // Deterministic same-day tiebreak: higher id wins.
      if (a.id !== b.id) return a.id < b.id ? 1 : -1;
      return 0;
    });
    const latest = sorted[0];
    const status = latest.status;
    if (status !== "low" && status !== "high" && status !== "critical") {
      continue;
    }

    const range = formatRange(latest.reference_min, latest.reference_max, latest.unit);
    const baseBody = `Your latest ${biomarker} reading is ${latest.value} ${latest.unit} (range ${range}). Consider a follow-up panel.`;

    if (status === "low") {
      drafts.push({
        alert_type: "lab_out_of_range",
        severity: "attention",
        source_id: biomarker,
        title: `${biomarker} is below the reference range`,
        body: baseBody,
        link_href: `/labs/${encodeURIComponent(biomarker)}`,
      });
    } else if (status === "high") {
      drafts.push({
        alert_type: "lab_out_of_range",
        severity: "attention",
        source_id: biomarker,
        title: `${biomarker} is above the reference range`,
        body: baseBody,
        link_href: `/labs/${encodeURIComponent(biomarker)}`,
      });
    } else {
      // critical
      drafts.push({
        alert_type: "lab_out_of_range",
        severity: "urgent",
        source_id: biomarker,
        title: `${biomarker} is at a critical level`,
        body: `${baseBody} Speak with your clinician.`,
        link_href: `/labs/${encodeURIComponent(biomarker)}`,
      });
    }
  }

  return drafts;
}
