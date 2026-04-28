"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { analyzeUpload } from "@/lib/uploads/janet";
import { triggerPipeline } from "@/lib/ai/trigger";
import { evaluateLabAlerts } from "@/lib/alerts";
import type { LabRow } from "@/lib/labs";

export interface RecordUploadResult {
  ok?: true;
  id?: string;
  error?: string;
}

export interface DeleteUploadResult {
  ok?: true;
  error?: string;
}

/**
 * Called after the client has finished uploading a file to Supabase Storage.
 * Records the metadata row, kicks off Janet analysis, and writes results back.
 */
export async function recordUpload(params: {
  storagePath: string;
  originalFilename: string;
  mimeType: string;
  fileSizeBytes: number;
}): Promise<RecordUploadResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  // Insert metadata row (janet_status = 'pending' by default)
  const { data: row, error: insertError } = await supabase
    .from("patient_uploads")
    .insert({
      user_uuid: user.id,
      storage_path: params.storagePath,
      original_filename: params.originalFilename,
      mime_type: params.mimeType,
      file_size_bytes: params.fileSizeBytes,
      janet_status: "processing",
    })
    .select("id")
    .single();

  if (insertError || !row) {
    return { error: insertError?.message ?? "Failed to record upload" };
  }

  // Download file via admin client (bypasses RLS on storage)
  const admin = createAdminClient();
  const { data: fileData, error: downloadError } = await admin.storage
    .from("patient-uploads")
    .download(params.storagePath);

  if (downloadError || !fileData) {
    await admin
      .from("patient_uploads")
      .update({
        janet_status: "error",
        janet_error: downloadError?.message ?? "Download failed",
        janet_processed_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    revalidatePath("/uploads");
    return { ok: true, id: row.id };
  }

  // Run Janet analysis
  try {
    const buffer = await fileData.arrayBuffer();
    const result = await analyzeUpload(buffer, params.mimeType, params.originalFilename);

    await admin
      .from("patient_uploads")
      .update({
        janet_status: "done",
        janet_category: result.category,
        janet_summary: result.summary,
        janet_findings: result.findings as unknown as import("@/lib/supabase/database.types").Json,
        janet_processed_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    // Re-run supplement protocol with updated upload data (non-blocking)
    triggerPipeline("supplement-protocol", user.id);

    // B7 alerts hook: evaluate lab alerts off the user's lab_results rows.
    // Best-effort — failure must not block the upload response.
    // Today this is a defensive no-op for most users because Janet writes
    // findings as JSONB into patient_uploads, not as structured rows in
    // biomarkers.lab_results. The moment that converter exists, alerts will
    // fire here with no further code change.
    try {
      const adminClient = createAdminClient();
      const { data: labRows } = await adminClient
        .schema("biomarkers" as never)
        .from("lab_results")
        .select(
          "id, biomarker, value, unit, reference_min, reference_max, optimal_min, optimal_max, status, category, trend, panel_name, lab_provider, test_date, user_uuid, upload_id, notes, created_at",
        )
        .eq("user_uuid", user.id);

      const drafts = evaluateLabAlerts(((labRows ?? []) as unknown) as LabRow[]);
      if (drafts.length > 0) {
        // Pre-filter against existing open alerts (addendum #4 — deterministic
        // conflict handling, not the fictitious onConflict:'ignore').
        const { data: openRows } = await adminClient
          .from("member_alerts")
          .select("source_id")
          .eq("user_uuid", user.id)
          .eq("alert_type", "lab_out_of_range")
          .eq("status", "open");
        const openSourceIds = new Set(
          (openRows ?? []).map((r) => r.source_id as string),
        );
        const fresh = drafts.filter((d) => !openSourceIds.has(d.source_id));
        if (fresh.length > 0) {
          await adminClient.from("member_alerts").insert(
            fresh.map((d) => ({
              alert_type: d.alert_type,
              severity: d.severity,
              source_id: d.source_id,
              title: d.title,
              body: d.body,
              link_href: d.link_href,
              user_uuid: user.id,
            })),
          );
        }
      }
    } catch (err) {
      console.error("[B7] lab-alert evaluation failed:", err);
    }
  } catch (err) {
    await admin
      .from("patient_uploads")
      .update({
        janet_status: "error",
        janet_error: err instanceof Error ? err.message : "Analysis failed",
        janet_processed_at: new Date().toISOString(),
      })
      .eq("id", row.id);
  }

  revalidatePath("/uploads");
  revalidatePath("/dashboard");
  return { ok: true, id: row.id };
}

export async function deleteUpload(uploadId: string): Promise<DeleteUploadResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { data: upload, error: fetchError } = await supabase
    .from("patient_uploads")
    .select("id, storage_path, user_uuid")
    .eq("id", uploadId)
    .eq("user_uuid", user.id)
    .single();

  if (fetchError || !upload) return { error: "Upload not found" };

  const admin = createAdminClient();
  const { error: storageError } = await admin.storage
    .from("patient-uploads")
    .remove([upload.storage_path]);

  if (storageError) return { error: storageError.message };

  const { error: deleteError } = await supabase
    .from("patient_uploads")
    .delete()
    .eq("id", uploadId)
    .eq("user_uuid", user.id);

  if (deleteError) return { error: deleteError.message };

  revalidatePath("/uploads");
  revalidatePath("/dashboard");
  return { ok: true };
}
