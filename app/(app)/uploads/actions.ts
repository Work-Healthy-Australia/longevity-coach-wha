"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { analyzeUpload } from "@/lib/uploads/janet";
import { triggerPipeline } from "@/lib/ai/trigger";

export interface CheckDuplicateResult {
  duplicate: boolean;
  originalFilename?: string;
  uploadedAt?: string;
}

export async function checkDuplicate(fileHash: string): Promise<CheckDuplicateResult> {
  if (!/^[0-9a-f]{64}$/.test(fileHash)) return { duplicate: false };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { duplicate: false };

  const { data } = await supabase
    .from("patient_uploads")
    .select("original_filename, created_at")
    .eq("user_uuid", user.id)
    .eq("file_hash", fileHash)
    .single();

  if (!data) return { duplicate: false };
  return { duplicate: true, originalFilename: data.original_filename, uploadedAt: data.created_at };
}

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
  fileHash: string;
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
      file_hash: params.fileHash,
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
