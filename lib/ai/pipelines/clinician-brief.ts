import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { createPipelineAgent } from '@/lib/ai/agent-factory';

const DomainHighlightSchema = z.object({
  domain: z.string(),
  score: z.number(),
  trend: z.enum(['improving', 'stable', 'worsening', 'unknown']),
  note: z.string(),
});

const ClinicianBriefOutputSchema = z.object({
  janet_brief: z.string().min(100).max(1200),
  domain_highlights: z.array(DomainHighlightSchema).max(5),
  suggested_focus: z.array(z.string()).max(5),
  adherence_signals: z.string().max(400),
  data_coverage_note: z.string().max(300),
});

type ClinicianBriefOutput = z.infer<typeof ClinicianBriefOutputSchema>;

function buildClinicianBriefPrompt(params: {
  ageYears: number | null;
  responses: Record<string, unknown>;
  riskNarrative: string | null;
  riskScores: string | null;
  topRiskDrivers: unknown;
  confidenceLevel: string | null;
  uploadSummaries: string[];
  supplementSummary: string | null;
  dailyLogSummary: string;
}): string {
  const parts: string[] = [];

  if (params.ageYears) parts.push(`Patient age: ${params.ageYears} years`);

  if (params.riskScores) {
    parts.push(`\n## Domain risk scores\n${params.riskScores}`);
  }
  if (params.confidenceLevel) {
    parts.push(`Risk assessment confidence: ${params.confidenceLevel}`);
  }
  if (params.riskNarrative) {
    parts.push(`\n## Risk narrative\n${params.riskNarrative}`);
  }
  if (params.topRiskDrivers) {
    parts.push(`\n## Top risk drivers\n${JSON.stringify(params.topRiskDrivers, null, 2)}`);
  }

  if (Object.keys(params.responses).length > 0) {
    parts.push(`\n## Questionnaire responses\n${JSON.stringify(params.responses, null, 2)}`);
  }

  if (params.uploadSummaries.length > 0) {
    parts.push(`\n## Uploaded documents and findings\n${params.uploadSummaries.join('\n\n')}`);
  } else {
    parts.push(`\n## Uploaded documents: none on file.`);
  }

  if (params.supplementSummary) {
    parts.push(`\n## Active supplement plan\n${params.supplementSummary}`);
  } else {
    parts.push(`\n## Supplement plan: not yet generated.`);
  }

  parts.push(`\n## Daily activity log (last 30 days)\n${params.dailyLogSummary}`);

  return parts.join('\n');
}

export async function runClinicianBriefPipeline(userId: string): Promise<void> {
  try {
    const admin = createAdminClient();

    const [
      profileResult,
      riskResult,
      healthResult,
      uploadsResult,
      supplementResult,
      dailyLogsResult,
    ] = await Promise.all([
      admin
        .from('profiles')
        .select('date_of_birth, full_name')
        .eq('id', userId)
        .single(),
      admin
        .from('risk_scores')
        .select('cv_risk, metabolic_risk, neuro_risk, onco_risk, msk_risk, narrative, top_risk_drivers, confidence_level')
        .eq('user_uuid', userId)
        .order('assessment_date', { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from('health_profiles')
        .select('responses')
        .eq('user_uuid', userId)
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from('patient_uploads')
        .select('original_filename, janet_category, janet_summary')
        .eq('user_uuid', userId)
        .eq('janet_status', 'done'),
      admin
        .from('supplement_plans')
        .select('items, created_at')
        .eq('patient_uuid', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .schema('biomarkers')
        .from('daily_logs')
        .select('log_date, steps, sleep_hours, energy_level, mood')
        .eq('user_uuid', userId)
        .gte('log_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
        .order('log_date', { ascending: false }),
    ]);

    const profile = profileResult.data;
    const risk = riskResult.data;
    const health = healthResult.data;
    const uploads = uploadsResult.data ?? [];
    const supplement = supplementResult.data;
    const dailyLogs = dailyLogsResult.data ?? [];

    // Compute age from DOB — do NOT pass name or DOB to LLM
    const ageYears = profile?.date_of_birth
      ? Math.floor(
          (Date.now() - new Date(profile.date_of_birth).getTime()) /
            (365.25 * 24 * 60 * 60 * 1000),
        )
      : null;

    const responses = (health?.responses as Record<string, unknown>) ?? {};

    const riskScores = risk
      ? `CV=${risk.cv_risk ?? '?'} Metabolic=${risk.metabolic_risk ?? '?'} Neuro=${risk.neuro_risk ?? '?'} Onco=${risk.onco_risk ?? '?'} MSK=${risk.msk_risk ?? '?'}`
      : null;

    const uploadSummaries = uploads.map(
      (u) => `${u.original_filename} [${u.janet_category}]: ${u.janet_summary}`,
    );

    const supplementSummary = supplement
      ? `Generated ${supplement.created_at?.slice(0, 10) ?? 'unknown date'}. Items: ${JSON.stringify(supplement.items)}`
      : null;

    let dailyLogSummary: string;
    if (dailyLogs.length === 0) {
      dailyLogSummary = 'No daily logs recorded in the past 30 days.';
    } else {
      const avgSteps =
        dailyLogs.filter((l) => l.steps != null).length > 0
          ? Math.round(
              dailyLogs.reduce((s, l) => s + (l.steps ?? 0), 0) /
                dailyLogs.filter((l) => l.steps != null).length,
            )
          : null;
      const avgSleep =
        dailyLogs.filter((l) => l.sleep_hours != null).length > 0
          ? (
              dailyLogs.reduce((s, l) => s + (l.sleep_hours ?? 0), 0) /
              dailyLogs.filter((l) => l.sleep_hours != null).length
            ).toFixed(1)
          : null;
      const avgEnergy =
        dailyLogs.filter((l) => l.energy_level != null).length > 0
          ? (
              dailyLogs.reduce((s, l) => s + (l.energy_level ?? 0), 0) /
              dailyLogs.filter((l) => l.energy_level != null).length
            ).toFixed(1)
          : null;
      const avgMood =
        dailyLogs.filter((l) => l.mood != null).length > 0
          ? (
              dailyLogs.reduce((s, l) => s + (l.mood ?? 0), 0) /
              dailyLogs.filter((l) => l.mood != null).length
            ).toFixed(1)
          : null;

      dailyLogSummary =
        `${dailyLogs.length} log entries over 30 days. ` +
        (avgSteps != null ? `Avg steps: ${avgSteps}. ` : '') +
        (avgSleep != null ? `Avg sleep: ${avgSleep}h. ` : '') +
        (avgEnergy != null ? `Avg energy: ${avgEnergy}/10. ` : '') +
        (avgMood != null ? `Avg mood: ${avgMood}/10.` : '');
    }

    const agent = createPipelineAgent('janet');

    let output: ClinicianBriefOutput;
    try {
      output = await agent.run(
        ClinicianBriefOutputSchema,
        buildClinicianBriefPrompt({
          ageYears,
          responses,
          riskNarrative: risk?.narrative ?? null,
          riskScores,
          topRiskDrivers: risk?.top_risk_drivers ?? null,
          confidenceLevel: risk?.confidence_level ?? null,
          uploadSummaries,
          supplementSummary,
          dailyLogSummary,
        }),
      );
    } catch (err) {
      console.error(`[clinician-brief pipeline] LLM call failed for user ${userId}:`, err);
      return;
    }

    const reviewMonth = new Date().toISOString().slice(0, 8) + '01';

    const { error } = await admin.from('periodic_reviews').upsert(
      {
        patient_uuid: userId,
        review_date: reviewMonth,
        review_type: 'clinician_brief',
        review_month: reviewMonth,
        review_status: 'awaiting_clinician',
        janet_brief: output.janet_brief,
        domain_highlights: output.domain_highlights as unknown as import('@/lib/supabase/database.types').Json,
        suggested_focus: output.suggested_focus as unknown as import('@/lib/supabase/database.types').Json,
        adherence_signals: output.adherence_signals,
        data_coverage_note: output.data_coverage_note,
      },
      { onConflict: 'patient_uuid,review_month' },
    );

    if (error) {
      console.error(`[clinician-brief pipeline] Failed to upsert periodic_reviews for user ${userId}:`, error);
    }
  } catch (err) {
    console.error(`[clinician-brief pipeline] Unhandled error for user ${userId}:`, err);
  }
}
