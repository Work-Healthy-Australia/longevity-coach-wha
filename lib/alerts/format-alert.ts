import type { AlertDraft, AlertSeverity } from "./evaluate-lab-alerts";

export type ChipPayload = {
  tone: AlertSeverity;
  title: string;
  body: string;
  link_href: string | null;
};

/**
 * Pure helper used by the dashboard chip renderer. Maps any alert-shaped
 * input (an `AlertDraft` or a persisted `member_alerts` row) onto the chip
 * presentation payload.
 */
export function chipPayload(
  alert: Pick<AlertDraft, "severity" | "title" | "body" | "link_href">,
): ChipPayload {
  return {
    tone: alert.severity,
    title: alert.title,
    body: alert.body,
    link_href: alert.link_href ?? null,
  };
}
