import type { LabRow } from "./group-by-biomarker";

export type StatusTone =
  | "low"
  | "optimal"
  | "borderline"
  | "high"
  | "critical"
  | "unknown";

export const STATUS_LABELS: Record<StatusTone, string> = {
  low: "Low",
  optimal: "Optimal",
  borderline: "Borderline",
  high: "High",
  critical: "Critical",
  unknown: "Unknown",
};

const KNOWN_TONES: ReadonlySet<StatusTone> = new Set([
  "low",
  "optimal",
  "borderline",
  "high",
  "critical",
]);

/**
 * Map the DB `lab_results.status` column to a display tone.
 *
 * Accepts the raw `LabRow["status"]` value (`string | null`). Anything outside
 * the five recognised tones, including `null`, falls through to `"unknown"`.
 */
export function statusTone(status: LabRow["status"]): StatusTone {
  if (status == null) return "unknown";
  const normalised = status.toLowerCase();
  return KNOWN_TONES.has(normalised as StatusTone)
    ? (normalised as StatusTone)
    : "unknown";
}
