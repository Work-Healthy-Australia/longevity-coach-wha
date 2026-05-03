import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { createPipelineAgent } from '@/lib/ai/agent-factory';

// z.coerce handles numeric strings ("3" → 3). .catch() on required fields means
// the whole parse never fails — a bad value becomes a safe default instead.
const PtPlanItemSchema = z.object({
  day: z.coerce.number().catch(1),
  exercise: z.string(),
  sets: z.coerce.number().optional(),
  reps: z.string().optional(),
  duration_min: z.coerce.number().optional(),
  intensity: z.enum(['low', 'moderate', 'high']).catch('moderate'),
  notes: z.string().optional(),
});

const PtPlanOutputSchema = z.object({
  plan_name: z.string(),
  // .min(7) removed — array minItems in JSON Schema is violated when the model generates
  // fewer items (e.g. sparse patients), causing a hard parse failure. Use prompt guidance instead.
  exercises: z.array(PtPlanItemSchema),
  generated_at: z.string(),
  msk_considerations: z.string(),
});

type PtPlanOutput = z.infer<typeof PtPlanOutputSchema>;

export function buildPtPlanPrompt(params: {
  ageYears: number | null;
  mskRisk: number | null;
  cvRisk: number | null;
  metabolicRisk: number | null;
  confidenceLevel: string | null;
  avgSteps: number | null;
  avgWorkoutMin: number | null;
  responses: Record<string, unknown>;
}): string {
  const parts: string[] = [];

  if (params.ageYears) parts.push(`Patient age: ${params.ageYears} years`);

  parts.push(
    `\n## Risk profile\nMSK=${params.mskRisk ?? '?'} CV=${params.cvRisk ?? '?'} Metabolic=${params.metabolicRisk ?? '?'} (confidence: ${params.confidenceLevel ?? 'unknown'})`,
  );

  if (params.avgSteps !== null) {
    parts.push(`\n## Activity (last 30 days)\nAverage daily steps: ${Math.round(params.avgSteps)}`);
  }
  if (params.avgWorkoutMin !== null) {
    parts.push(`Average workout duration: ${Math.round(params.avgWorkoutMin)} min/day`);
  }

  if (Object.keys(params.responses).length > 0) {
    parts.push(`\n## Questionnaire responses\n${JSON.stringify(params.responses, null, 2)}`);
  }

  parts.push(
    '\n## Task\nGenerate a personalised 30-day exercise program. Include at least 7 and up to 60 exercises spread across the 30 days. Account for the patient\'s MSK risk score when selecting intensity and exercise type. Return the plan as structured JSON.',
  );

  return parts.join('\n');
}

async function _run(userId: string): Promise<void> {
  const admin = createAdminClient();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [profileResult, healthResult, riskResult, logsResult] = await Promise.all([
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
      .select('msk_risk, cv_risk, metabolic_risk, confidence_level')
      .eq('user_uuid', userId)
      .order('assessment_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .schema('biomarkers' as never)
      .from('daily_logs')
      .select('steps, workout_duration_min, mood, energy_level')
      .eq('user_uuid', userId)
      .gte('log_date', thirtyDaysAgo),
  ]);

  const profile = profileResult.data;
  const health = healthResult.data;
  const risk = riskResult.data;
  const logs = (logsResult.data ?? []) as {
    steps: number | null;
    workout_duration_min: number | null;
    mood: number | null;
    energy_level: number | null;
  }[];

  const ageYears = profile?.date_of_birth
    ? Math.floor((Date.now() - new Date(profile.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null;

  const responses = (health?.responses as Record<string, unknown>) ?? {};

  const stepsValues = logs.map((l) => l.steps).filter((v): v is number => v !== null);
  const workoutValues = logs.map((l) => l.workout_duration_min).filter((v): v is number => v !== null);
  const avgSteps = stepsValues.length > 0 ? stepsValues.reduce((a, b) => a + b, 0) / stepsValues.length : null;
  const avgWorkoutMin = workoutValues.length > 0 ? workoutValues.reduce((a, b) => a + b, 0) / workoutValues.length : null;

  const agent = createPipelineAgent('pt_coach_live');

  let output: PtPlanOutput;
  try {
    output = await agent.run(
      PtPlanOutputSchema,
      buildPtPlanPrompt({
        ageYears,
        mskRisk: risk?.msk_risk ?? null,
        cvRisk: risk?.cv_risk ?? null,
        metabolicRisk: risk?.metabolic_risk ?? null,
        confidenceLevel: risk?.confidence_level ?? null,
        avgSteps,
        avgWorkoutMin,
        responses,
      }),
    );
  } catch (err) {
    console.error(`[pt-plan pipeline] LLM call failed for user ${userId}:`, err);
    return;
  }

  const planStartDate = new Date().toISOString().slice(0, 8) + '01'; // first of current month

  // Supersede old active plans for this user (except the current month's).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin.from('training_plans') as any)
    .update({ status: 'superseded' })
    .eq('patient_uuid', userId)
    .eq('status', 'active')
    .neq('plan_start_date', planStartDate);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin.from('training_plans') as any).upsert(
    {
      patient_uuid: userId,
      created_by_role: 'ai',
      status: 'active',
      valid_from: planStartDate,
      plan_name: output.plan_name,
      plan_start_date: planStartDate,
      sessions: output.exercises as unknown as import('@/lib/supabase/database.types').Json,
      notes: output.msk_considerations,
    },
    { onConflict: 'patient_uuid,plan_start_date' },
  );

  if (error) console.error(`[pt-plan pipeline] Failed to upsert training_plans for user ${userId}:`, error);
}

export async function runPtPlanPipeline(userId: string): Promise<void> {
  try {
    await _run(userId);
  } catch (err) {
    console.error(`[pt-plan pipeline] Unhandled error for user ${userId}:`, err);
  }
}
