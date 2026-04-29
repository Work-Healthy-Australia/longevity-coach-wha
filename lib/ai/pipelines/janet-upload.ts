import { createAdminClient } from '@/lib/supabase/admin';
import { analyzeUpload } from '@/lib/uploads/janet';
import { persistLabResults } from '@/lib/uploads/persist-lab-results';
import { triggerPipeline } from '@/lib/ai/trigger';
import { evaluateLabAlerts } from '@/lib/alerts';
import type { LabRow } from '@/lib/labs';

/**
 * Async pipeline worker for a single patient upload.
 *
 * Triggered fire-and-forget by the recordUpload server action so the upload
 * response returns immediately. Runs as its own Vercel function invocation.
 *
 * Write target: patient_uploads (janet_status, janet_category, janet_summary,
 *               janet_findings, janet_processed_at) — sole writer for these columns.
 * Side-effects: biomarkers.lab_results, member_alerts, supplement-protocol trigger.
 */
export async function runJanetUploadPipeline(uploadId: string): Promise<void> {
  const admin = createAdminClient();

  // Fetch the upload row so we have storage path, mime type, and user
  const { data: upload, error: fetchError } = await admin
    .from('patient_uploads')
    .select('user_uuid, storage_path, mime_type, original_filename, janet_status')
    .eq('id', uploadId)
    .single();

  if (fetchError || !upload) {
    console.error(`[janet-upload] upload ${uploadId} not found:`, fetchError?.message);
    return;
  }

  // Guard against duplicate runs (e.g. cron retry while first run is still live)
  if (upload.janet_status === 'done' || upload.janet_status === 'error') {
    console.warn(`[janet-upload] upload ${uploadId} already ${upload.janet_status} — skipping`);
    return;
  }

  // Download the file via the admin storage client (bypasses RLS)
  const { data: fileData, error: downloadError } = await admin.storage
    .from('patient-uploads')
    .download(upload.storage_path);

  if (downloadError || !fileData) {
    await admin
      .from('patient_uploads')
      .update({
        janet_status: 'error',
        janet_error: downloadError?.message ?? 'Download failed',
        janet_processed_at: new Date().toISOString(),
      })
      .eq('id', uploadId);
    return;
  }

  // ── Janet analysis ────────────────────────────────────────────────────
  try {
    const buffer = await fileData.arrayBuffer();
    const result = await analyzeUpload(buffer, upload.mime_type, upload.original_filename);

    await admin
      .from('patient_uploads')
      .update({
        janet_status: 'done',
        janet_category: result.category,
        janet_summary: result.summary,
        janet_findings: result.findings as unknown as import('@/lib/supabase/database.types').Json,
        janet_processed_at: new Date().toISOString(),
      })
      .eq('id', uploadId);

    // ── Persist extracted biomarkers → biomarkers.lab_results ─────────
    try {
      const { inserted, skipped } = await persistLabResults(admin, result, upload.user_uuid, uploadId);
      if (inserted > 0 || skipped > 0) {
        console.info(`[lab-results] upload=${uploadId} inserted=${inserted} skipped=${skipped}`);
      }
    } catch (err) {
      console.error('[lab-results] persistence failed:', err);
    }

    // ── Re-run supplement protocol with updated upload data ───────────
    triggerPipeline('supplement-protocol', upload.user_uuid);

    // ── Evaluate lab alerts ───────────────────────────────────────────
    try {
      const { data: labRows } = await admin
        .schema('biomarkers' as never)
        .from('lab_results')
        .select(
          'id, biomarker, value, unit, reference_min, reference_max, optimal_min, optimal_max, status, category, trend, panel_name, lab_provider, test_date, user_uuid, upload_id, notes, created_at',
        )
        .eq('user_uuid', upload.user_uuid);

      const drafts = evaluateLabAlerts(((labRows ?? []) as unknown) as LabRow[]);
      if (drafts.length > 0) {
        const { data: openRows } = await admin
          .from('member_alerts')
          .select('source_id')
          .eq('user_uuid', upload.user_uuid)
          .eq('alert_type', 'lab_out_of_range')
          .eq('status', 'open');

        const openSourceIds = new Set((openRows ?? []).map((r) => r.source_id as string));
        const fresh = drafts.filter((d) => !openSourceIds.has(d.source_id));

        if (fresh.length > 0) {
          await admin.from('member_alerts').insert(
            fresh.map((d) => ({
              alert_type: d.alert_type,
              severity: d.severity,
              source_id: d.source_id,
              title: d.title,
              body: d.body,
              link_href: d.link_href,
              user_uuid: upload.user_uuid,
            })),
          );
        }
      }
    } catch (err) {
      console.error('[B7] lab-alert evaluation failed:', err);
    }
  } catch (err) {
    await admin
      .from('patient_uploads')
      .update({
        janet_status: 'error',
        janet_error: err instanceof Error ? err.message : 'Analysis failed',
        janet_processed_at: new Date().toISOString(),
      })
      .eq('id', uploadId);
  }
}
