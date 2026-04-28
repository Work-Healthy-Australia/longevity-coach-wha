import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { createPipelineAgent } from '@/lib/ai/agent-factory';

const RiskNarrativeOutputSchema = z.object({
  biological_age: z.number().min(18).max(120),
  cv_risk: z.number().min(0).max(100),
  metabolic_risk: z.number().min(0).max(100),
  neuro_risk: z.number().min(0).max(100),
  onco_risk: z.number().min(0).max(100),
  msk_risk: z.number().min(0).max(100),
  longevity_score: z.number().min(0).max(100),
  narrative: z.string().min(50).max(800),
  top_risk_drivers: z.array(z.string()).max(7),
  top_protective_levers: z.array(z.string()).max(5),
  recommended_screenings: z.array(z.string()),
  confidence_level: z.enum(['low', 'moderate', 'high', 'insufficient']),
  data_gaps: z.array(z.string()),
});

type RiskNarrativeOutput = z.infer<typeof RiskNarrativeOutputSchema>;

function buildPrompt(params: {
  ageYears: number | null;
  responses: Record<string, unknown>;
  uploadSummaries: string[];
  standardsContext?: string;
}): string {
  const parts: string[] = [];
  if (params.standardsContext) {
    parts.push(`## Clinical scoring standards\n${params.standardsContext}`);
  }
  if (params.ageYears) parts.push(`Chronological age: ${params.ageYears} years`);
  if (Object.keys(params.responses).length > 0) {
    parts.push(`\n## Questionnaire responses\n${JSON.stringify(params.responses, null, 2)}`);
  }
  if (params.uploadSummaries.length > 0) {
    parts.push(`\n## Pathology and imaging findings (extracted by Janet)\n${params.uploadSummaries.join('\n\n')}`);
  }
  return parts.join('\n');
}

export async function runRiskNarrativePipeline(userId: string): Promise<void> {
  const admin = createAdminClient();

  const [profileResult, healthResult, uploadsResult] = await Promise.all([
    admin.from('profiles').select('date_of_birth').eq('id', userId).single(),
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
      .select('original_filename, janet_category, janet_summary, janet_findings')
      .eq('user_uuid', userId)
      .eq('janet_status', 'done'),
  ]);

  const profile = profileResult.data;
  const health = healthResult.data;
  const uploads = uploadsResult.data ?? [];

  const ageYears = profile?.date_of_birth
    ? Math.floor((Date.now() - new Date(profile.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null;

  const responses = (health?.responses as Record<string, unknown>) ?? {};

  const uploadSummaries = uploads.map(
    (u) =>
      `${u.original_filename} [${u.janet_category}]: ${u.janet_summary}` +
      (u.janet_findings ? `\nFindings: ${JSON.stringify(u.janet_findings)}` : ''),
  );

  // Load clinical scoring standards for context injection
  let standardsContext = '';
  try {
    const { data: standards } = await admin
      .from('risk_assessment_standards')
      .select('domain, framework_name, risk_tier, clinical_threshold, key_risk_factors, clinical_guidance, source_citation')
      .eq('active', true)
      .in('domain', ['cv', 'metabolic', 'neuro', 'onco', 'msk'])
      .order('domain')
      .order('internal_score_min');

    if (standards?.length) {
      const byDomain = standards.reduce<Record<string, typeof standards>>((acc, row) => {
        (acc[row.domain] ??= []).push(row);
        return acc;
      }, {});
      standardsContext = Object.entries(byDomain)
        .map(([domain, rows]) =>
          `### ${domain.toUpperCase()}\n` +
          rows.map(r =>
            `[${r.risk_tier}] ${r.clinical_threshold ?? ''} — ${r.clinical_guidance ?? ''} (${r.source_citation})`
          ).join('\n')
        )
        .join('\n\n');
    }
  } catch {
    // Standards unavailable — proceed without; prompt still contains framework names
  }

  const agent = createPipelineAgent('atlas');

  let output: RiskNarrativeOutput;
  try {
    output = await agent.run(RiskNarrativeOutputSchema, buildPrompt({ ageYears, responses, uploadSummaries, standardsContext }));
  } catch (err) {
    console.error(`[Atlas] Risk narrative pipeline failed for user ${userId}:`, err);
    return;
  }

  const now = new Date().toISOString();
  const { error } = await admin.from('risk_scores').upsert(
    {
      user_uuid: userId,
      biological_age: output.biological_age,
      cv_risk: output.cv_risk,
      metabolic_risk: output.metabolic_risk,
      neuro_risk: output.neuro_risk,
      onco_risk: output.onco_risk,
      msk_risk: output.msk_risk,
      longevity_score: output.longevity_score,
      narrative: output.narrative,
      top_risk_drivers: output.top_risk_drivers,
      top_protective_levers: output.top_protective_levers,
      recommended_screenings: output.recommended_screenings,
      confidence_level: output.confidence_level,
      data_gaps: output.data_gaps,
      assessment_date: now.split('T')[0],
      computed_at: now,
    },
    { onConflict: 'user_uuid' },
  );

  if (error) console.error(`[Atlas] Failed to upsert risk_scores for user ${userId}:`, error);
}
