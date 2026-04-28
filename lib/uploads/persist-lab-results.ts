import type { SupabaseClient } from "@supabase/supabase-js";
import type { JanetResult } from "./janet";

export type LabStatus = "low" | "optimal" | "high" | "critical";

/** Status derivation. Pure. Returns null when either bound is unknown or invalid. */
export function deriveStatus(
  value: number,
  reference_min: number | null,
  reference_max: number | null,
): LabStatus | null {
  if (reference_min == null || reference_max == null) return null;
  if (reference_max <= 0 || reference_min < 0) return null;
  if (reference_min > reference_max) return null; // swapped bounds — sanity guard
  if (value > reference_max * 1.5) return "critical";
  if (value < reference_min * 0.5) return "critical";
  if (value > reference_max) return "high";
  if (value < reference_min) return "low";
  return "optimal";
}

export type LabRowDraft = {
  user_uuid: string;
  upload_id: string;
  test_date: string;
  panel_name: string | null;
  lab_provider: string | null;
  biomarker: string;
  value: number;
  unit: string;
  reference_min: number | null;
  reference_max: number | null;
  optimal_min: null;
  optimal_max: null;
  status: LabStatus | null;
  category: null;
  trend: null;
  notes: null;
};

function todayUtcDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Build the row drafts. Pure. Returns [] for non-blood_work or empty biomarkers. */
export function extractLabResults(
  janet: JanetResult,
  userId: string,
  uploadId: string,
): LabRowDraft[] {
  if (janet.category !== "blood_work") return [];
  const biomarkers = janet.findings.biomarkers;
  if (!biomarkers || biomarkers.length === 0) return [];

  const drafts: LabRowDraft[] = [];
  for (const b of biomarkers) {
    const name = typeof b.biomarker === "string" ? b.biomarker.trim() : "";
    if (!name) continue;
    if (!Number.isFinite(b.value)) continue;
    const unit = typeof b.unit === "string" ? b.unit.trim() : "";
    if (!unit) continue;

    const test_date = b.test_date || janet.findings.date_of_test || todayUtcDate();
    const status = deriveStatus(b.value, b.reference_min, b.reference_max);

    drafts.push({
      user_uuid: userId,
      upload_id: uploadId,
      test_date,
      panel_name: b.panel_name ?? null,
      lab_provider: b.lab_provider ?? null,
      biomarker: name,
      value: b.value,
      unit,
      reference_min: b.reference_min ?? null,
      reference_max: b.reference_max ?? null,
      optimal_min: null,
      optimal_max: null,
      status,
      category: null,
      trend: null,
      notes: null,
    });
  }
  return drafts;
}

/**
 * Persist Janet's extracted biomarkers to biomarkers.lab_results.
 * Idempotent against the (user_uuid, biomarker, test_date) unique partial
 * index added in 0032_lab_results_idempotency.sql.
 *
 * Returns counts; never throws on row-level conflicts.
 */
export async function persistLabResults(
  admin: SupabaseClient,
  janet: JanetResult,
  userId: string,
  uploadId: string,
): Promise<{ inserted: number; skipped: number }> {
  const drafts = extractLabResults(janet, userId, uploadId);
  if (drafts.length === 0) return { inserted: 0, skipped: 0 };

  const bulk = await admin
    .schema("biomarkers" as never)
    .from("lab_results")
    .insert(drafts)
    .select("id");

  if (!bulk.error) {
    return { inserted: bulk.data?.length ?? drafts.length, skipped: 0 };
  }

  // Bulk failed (likely 23505 unique violation from a re-upload). Fall back
  // to per-row inserts so partial overlap still inserts what's new.
  let inserted = 0;
  let skipped = 0;
  for (const draft of drafts) {
    const single = await admin
      .schema("biomarkers" as never)
      .from("lab_results")
      .insert(draft)
      .select("id");
    if (single.error) {
      skipped += 1;
      // eslint-disable-next-line no-console
      console.warn(
        `[lab-results] skipped row biomarker=${draft.biomarker} reason=${single.error.message}`,
      );
    } else {
      inserted += 1;
    }
  }
  return { inserted, skipped };
}
