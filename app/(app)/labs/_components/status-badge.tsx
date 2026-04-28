import { STATUS_LABELS, type StatusTone } from "@/lib/labs";

/**
 * Small pill badge for lab status. Pure presentational.
 */
export function StatusBadge({ tone }: { tone: StatusTone }) {
  return (
    <span className={`lc-status lc-status-${tone}`}>{STATUS_LABELS[tone]}</span>
  );
}
