/**
 * Fires a pipeline trigger as a separate Vercel function invocation (fire-and-forget).
 * The API route handles the full pipeline run independently of the triggering request.
 * Never awaited — server actions return immediately after calling this.
 */
export function triggerPipeline(
  pipeline: "risk-narrative" | "supplement-protocol",
  userId: string,
): void {
  const base = process.env.NEXT_PUBLIC_SITE_URL;
  const secret = process.env.PIPELINE_SECRET;

  if (!base || !secret) {
    console.warn(`[trigger] NEXT_PUBLIC_SITE_URL or PIPELINE_SECRET not set — skipping ${pipeline}`);
    return;
  }

  fetch(`${base}/api/pipelines/${pipeline}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-pipeline-secret": secret,
    },
    body: JSON.stringify({ userId }),
  }).catch((err) => {
    console.error(`[trigger] Failed to fire pipeline ${pipeline} for user ${userId}:`, err);
  });
}
