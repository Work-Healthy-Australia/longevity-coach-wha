import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { createPipelineAgent } from '@/lib/ai/agent-factory';

const SupplementItemSchema = z.object({
  name: z.string(),
  form: z.string(),
  dosage: z.string(),
  timing: z.string(),
  priority: z.enum(['critical', 'high', 'recommended', 'performance']),
  domains: z.array(z.string()),
  rationale: z.string(),
  note: z.string().optional(),
});

const SupplementOutputSchema = z.object({
  supplements: z.array(SupplementItemSchema).min(1).max(20),
  generated_at: z.string(),
  data_completeness_note: z.string(),
  interactions_checked: z.boolean(),
});

type SupplementOutput = z.infer<typeof SupplementOutputSchema>;

function buildPrompt(params: {
  ageYears: number | null;
  responses: Record<string, unknown>;
  riskSummary: string | null;
  uploadSummaries: string[];
}): string {
  const parts: string[] = [];
  if (params.ageYears) parts.push(`Patient age: ${params.ageYears} years`);
  if (params.riskSummary) parts.push(`\n## Risk profile\n${params.riskSummary}`);
  if (Object.keys(params.responses).length > 0) {
    parts.push(`\n## Questionnaire responses\n${JSON.stringify(params.responses, null, 2)}`);
  }
  if (params.uploadSummaries.length > 0) {
    parts.push(`\n## Pathology and imaging findings\n${params.uploadSummaries.join('\n\n')}`);
  } else {
    parts.push(`\n## Pathology: none uploaded yet. Base protocol on questionnaire data.`);
  }
  return parts.join('\n');
}

export async function runSupplementProtocolPipeline(userId: string): Promise<void> {
  const admin = createAdminClient();

  const [profileResult, healthResult, riskResult, uploadsResult] = await Promise.all([
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
      .from('risk_scores')
      .select('cv_risk, metabolic_risk, neuro_risk, onco_risk, msk_risk, narrative, confidence_level')
      .eq('user_uuid', userId)
      .order('assessment_date', { ascending: false })
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
  const risk = riskResult.data;
  const uploads = uploadsResult.data ?? [];

  const ageYears = profile?.date_of_birth
    ? Math.floor((Date.now() - new Date(profile.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null;

  const responses = (health?.responses as Record<string, unknown>) ?? {};

  const riskSummary = risk
    ? `CV=${risk.cv_risk ?? '?'} Metabolic=${risk.metabolic_risk ?? '?'} Neuro=${risk.neuro_risk ?? '?'} Onco=${risk.onco_risk ?? '?'} MSK=${risk.msk_risk ?? '?'} (confidence: ${risk.confidence_level ?? 'unknown'})`
    : null;

  const uploadSummaries = uploads.map(
    (u) =>
      `${u.original_filename} [${u.janet_category}]: ${u.janet_summary}` +
      (u.janet_findings ? `\nFindings: ${JSON.stringify(u.janet_findings)}` : ''),
  );

  const agent = createPipelineAgent('sage');

  let output: SupplementOutput;
  try {
    output = await agent.run(SupplementOutputSchema, buildPrompt({ ageYears, responses, riskSummary, uploadSummaries }));
  } catch (err) {
    console.error(`[Sage] Supplement protocol pipeline failed for user ${userId}:`, err);
    return;
  }

  const now = new Date().toISOString();

  await admin
    .from('supplement_plans')
    .update({ status: 'superseded', updated_at: now })
    .eq('patient_uuid', userId)
    .eq('status', 'active');

  const { error } = await admin.from('supplement_plans').insert({
    patient_uuid: userId,
    created_by_role: 'ai',
    status: 'active',
    valid_from: now.split('T')[0],
    items: output.supplements as unknown as import('@/lib/supabase/database.types').Json,
    notes: `${output.data_completeness_note} | interactions_checked=${output.interactions_checked}`,
  });

  if (error) console.error(`[Sage] Failed to insert supplement_plans for user ${userId}:`, error);
}
