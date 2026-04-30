import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { createPipelineAgent } from '@/lib/ai/agent-factory';

// Web search for real-world recipe URLs is deferred to Phase 3.
// The chef agent's system prompt references recipes from training data.

const MealSchema = z.object({
  name: z.string(),
  meal_type: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  // Anthropic structured-output rejects `integer` schemas with implicit
  // min/max bounds added by Zod's `.int()`. Accept any number, coerce to int
  // at write time below.
  day_of_week: z.number(),
  macros: z.object({
    calories: z.number(),
    protein_g: z.number(),
    carbs_g: z.number(),
    fat_g: z.number(),
  }),
  ingredients: z.array(z.object({ item: z.string(), quantity: z.number(), unit: z.string() })),
  instructions: z.array(z.string()),
  source_url: z.string().url().optional(),
  is_bloodwork_optimised: z.boolean(),
});

const MealPlanOutputSchema = z.object({
  week_start: z.string(),
  calorie_target: z.number(),
  macros_target: z.object({ protein_g: z.number(), carbs_g: z.number(), fat_g: z.number() }),
  meals: z.array(MealSchema),
  shopping_list: z.array(z.object({
    item: z.string(),
    quantity: z.number(),
    unit: z.string(),
    category: z.string(),
  })),
  notes: z.string().optional(),
  generated_at: z.string(),
});

type MealPlanOutput = z.infer<typeof MealPlanOutputSchema>;

function getWeekStart(override?: string): string {
  if (override) return override;
  const d = new Date();
  const day = d.getDay(); // 0=Sun, 1=Mon...
  const diff = day === 0 ? 1 : (8 - day) % 7 || 7; // next Monday
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function deriveCalorieTarget(weightKg: number | null, activityLevel: string | null): number {
  const weight = weightKg ?? 75;
  const bmr = 10 * weight + 6.25 * 170 - 5 * 40 + 5; // rough defaults: 170cm, 40yr, male
  const multiplier =
    activityLevel === 'sedentary' ? 1.2
    : activityLevel === 'lightly_active' ? 1.375
    : activityLevel === 'moderately_active' ? 1.55
    : 1.725;
  return Math.round(bmr * multiplier);
}

export function buildChefPrompt(params: {
  calorieTarget: number;
  dietaryPattern: string | null;
  allergies: unknown;
  foodStaples: unknown;
  cvRisk: number | null;
  metabolicRisk: number | null;
  mskRisk: number | null;
  confidenceLevel: string | null;
  uploadSummaries: string[];
  weekStart: string;
}): string {
  const parts: string[] = [];

  parts.push(`## Meal plan parameters\nWeek starting: ${params.weekStart}\nCalorie target: ${params.calorieTarget} kcal/day`);

  // Macro split: ~30% protein, 40% carbs, 30% fat
  const proteinG = Math.round((params.calorieTarget * 0.30) / 4);
  const carbsG = Math.round((params.calorieTarget * 0.40) / 4);
  const fatG = Math.round((params.calorieTarget * 0.30) / 9);
  parts.push(`Macro targets: protein ${proteinG}g / carbs ${carbsG}g / fat ${fatG}g`);

  if (params.dietaryPattern) parts.push(`Dietary pattern: ${params.dietaryPattern}`);

  if (params.allergies && Array.isArray(params.allergies) && params.allergies.length > 0) {
    parts.push(`Allergies / intolerances: ${(params.allergies as string[]).join(', ')}`);
  }

  if (params.foodStaples && Array.isArray(params.foodStaples) && params.foodStaples.length > 0) {
    parts.push(`Preferred food staples: ${(params.foodStaples as string[]).join(', ')}`);
  }

  parts.push(`\n## Risk profile\nCV=${params.cvRisk ?? '?'} Metabolic=${params.metabolicRisk ?? '?'} MSK=${params.mskRisk ?? '?'} (confidence: ${params.confidenceLevel ?? 'unknown'})`);

  // Bloodwork-derived food rules
  const foodRules: string[] = [];
  if (params.cvRisk !== null && params.cvRisk >= 3) {
    foodRules.push('High LDL risk → include oats, fatty fish, nuts, avocado, olive oil, legumes, berries');
  }
  if (params.metabolicRisk !== null && params.metabolicRisk >= 3) {
    foodRules.push('High fasting glucose risk → include high-fibre foods, leafy greens, legumes, whole grains');
  }
  if (params.uploadSummaries.some(s => /CRP|inflammation/i.test(s))) {
    foodRules.push('Elevated hs-CRP → include turmeric, ginger, fatty fish, leafy greens, berries');
  }

  if (foodRules.length > 0) {
    parts.push(`\n## Bloodwork-optimised food rules\n${foodRules.join('\n')}`);
  }

  if (params.uploadSummaries.length > 0) {
    parts.push(`\n## Pathology and imaging findings\n${params.uploadSummaries.join('\n\n')}`);
  } else {
    parts.push(`\n## Pathology: none uploaded yet. Base plan on questionnaire data only.`);
  }

  parts.push(
    '\n## Task\nGenerate a personalised 7-day meal plan (days 1–7). Include at least 3 meals per day (breakfast, lunch, dinner); snacks are optional. Mark meals as is_bloodwork_optimised=true when they directly address the food rules above. Generate a consolidated shopping list grouped by category. Return as structured JSON matching the schema exactly.',
  );

  return parts.join('\n');
}

async function _run(userId: string, weekStart?: string): Promise<void> {
  const admin = createAdminClient();
  const weekStartDate = getWeekStart(weekStart);

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
      .select('cv_risk, metabolic_risk, msk_risk, confidence_level')
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

  const health = healthResult.data;
  const risk = riskResult.data;
  const uploads = uploadsResult.data ?? [];

  const responses = (health?.responses as Record<string, unknown>) ?? {};
  const lifestyle = (responses.lifestyle ?? {}) as Record<string, unknown>;

  const weightKg = typeof lifestyle.weight_kg === 'number' ? lifestyle.weight_kg : null;
  const activityLevel = typeof lifestyle.activity_level === 'string' ? lifestyle.activity_level : null;
  const dietaryPattern = typeof lifestyle.dietary_pattern === 'string' ? lifestyle.dietary_pattern : null;
  const allergies = lifestyle.allergies ?? null;
  const foodStaples = lifestyle.food_staples ?? null;

  const calorieTarget = deriveCalorieTarget(weightKg, activityLevel);

  const uploadSummaries = uploads.map(
    (u) =>
      `${u.original_filename} [${u.janet_category}]: ${u.janet_summary}` +
      (u.janet_findings ? `\nFindings: ${JSON.stringify(u.janet_findings)}` : ''),
  );

  const agent = createPipelineAgent('chef');

  const prompt = buildChefPrompt({
    calorieTarget,
    dietaryPattern,
    allergies,
    foodStaples,
    cvRisk: risk?.cv_risk ?? null,
    metabolicRisk: risk?.metabolic_risk ?? null,
    mskRisk: risk?.msk_risk ?? null,
    confidenceLevel: risk?.confidence_level ?? null,
    uploadSummaries,
    weekStart: weekStartDate,
  });

  let output: MealPlanOutput;
  try {
    output = await agent.run(MealPlanOutputSchema, prompt);
  } catch (err) {
    console.error(`[meal-plan pipeline] First LLM attempt failed for user ${userId}:`, err);
    // Retry once
    try {
      output = await agent.run(MealPlanOutputSchema, prompt);
    } catch (retryErr) {
      console.error(`[meal-plan pipeline] Retry failed for user ${userId}:`, retryErr);
      // Write failure status — use any cast as meal_plans is added by migration 0046
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any).from('meal_plans').upsert(
        {
          patient_uuid: userId,
          created_by_role: 'ai',
          status: 'active',
          valid_from: weekStartDate,
          calorie_target: calorieTarget,
          last_run_at: new Date().toISOString(),
          last_run_status: 'failed',
        },
        { onConflict: 'patient_uuid,valid_from' },
      );
      return;
    }
  }

  const now = new Date().toISOString();

  // 1. Supersede old active plans (different week_start)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any).from('meal_plans')
    .update({ status: 'superseded', updated_at: now })
    .eq('patient_uuid', userId)
    .eq('status', 'active')
    .neq('valid_from', weekStartDate);

  // 2. Upsert meal_plans row
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: planRow, error: planError } = await (admin as any).from('meal_plans').upsert(
    {
      patient_uuid: userId,
      created_by_role: 'ai',
      status: 'active',
      valid_from: weekStartDate,
      calorie_target: output.calorie_target,
      last_run_at: now,
      last_run_status: 'completed',
    },
    { onConflict: 'patient_uuid,valid_from' },
  ).select('id').single();

  const mealPlanId = planRow?.id;
  if (!mealPlanId) {
    console.error(
      `[meal-plan pipeline] Failed to upsert meal_plans for user ${userId}:`,
      planError ?? 'no row returned',
    );
    return;
  }

  // 3. Delete existing recipes for this plan (full replacement on re-run)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any).from('recipes').delete().eq('meal_plan_id', mealPlanId);

  // 4. Bulk insert recipes
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: recipesError } = await (admin as any).from('recipes').insert(
    output.meals.map((meal) => ({
      meal_plan_id: mealPlanId,
      patient_uuid: userId,
      name: meal.name,
      meal_type: meal.meal_type,
      day_of_week: Math.max(0, Math.min(6, Math.round(meal.day_of_week))),
      macros: meal.macros as unknown as import('@/lib/supabase/database.types').Json,
      ingredients: meal.ingredients as unknown as import('@/lib/supabase/database.types').Json,
      instructions: meal.instructions,
      source_url: meal.source_url ?? null,
      is_bloodwork_optimised: meal.is_bloodwork_optimised,
    })),
  );

  if (recipesError) {
    console.error(`[meal-plan pipeline] Failed to insert recipes for user ${userId}:`, recipesError);
  }

  // 5. Upsert shopping list
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: shoppingError } = await (admin as any).from('shopping_lists').upsert(
    {
      meal_plan_id: mealPlanId,
      patient_uuid: userId,
      week_start: weekStartDate,
      items: output.shopping_list as unknown as import('@/lib/supabase/database.types').Json,
      generated_at: now,
    },
    { onConflict: 'meal_plan_id' },
  );

  if (shoppingError) {
    console.error(`[meal-plan pipeline] Failed to upsert shopping_lists for user ${userId}:`, shoppingError);
  }

  // Non-blocking: write a complete plan summary to conversation history so the
  // chat client can pick it up after detecting the new meal plan and render it
  // as a Janet message in the thread.
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const mealOrder: Record<string, number> = { breakfast: 0, lunch: 1, dinner: 2, snack: 3 };
  const byDay = new Map<number, typeof output.meals>();
  for (const m of output.meals) {
    const d = Math.max(0, Math.min(6, Math.round(m.day_of_week)));
    const list = byDay.get(d) ?? [];
    list.push(m);
    byDay.set(d, list);
  }
  const dayLines: string[] = [];
  for (const d of [...byDay.keys()].sort((a, b) => a - b)) {
    dayLines.push(`\n**${days[d]}**`);
    const meals = (byDay.get(d) ?? []).slice().sort(
      (a, b) => (mealOrder[a.meal_type] ?? 99) - (mealOrder[b.meal_type] ?? 99),
    );
    for (const m of meals) {
      const kcal = m.macros?.calories ? ` — ${Math.round(m.macros.calories)} kcal` : '';
      const star = m.is_bloodwork_optimised ? ' ⭐' : '';
      dayLines.push(`- _${m.meal_type}_: ${m.name}${kcal}${star}`);
    }
  }

  const shoppingByCat = new Map<string, string[]>();
  for (const item of output.shopping_list) {
    const cat = item.category || 'other';
    const list = shoppingByCat.get(cat) ?? [];
    list.push(`${item.item} (${item.quantity}${item.unit ?? ''})`.trim());
    shoppingByCat.set(cat, list);
  }
  const shoppingLines: string[] = [];
  for (const [cat, items] of shoppingByCat) {
    shoppingLines.push(`- **${cat}**: ${items.join(', ')}`);
  }

  const pushMessage =
    `Your 7-day meal plan is ready — **${output.meals.length} meals** built around a ${output.calorie_target} kcal/day target.\n` +
    dayLines.join('\n') +
    (shoppingLines.length > 0
      ? `\n\n**Shopping list (${output.shopping_list.length} items)**\n${shoppingLines.join('\n')}`
      : '') +
    `\n\nMeals marked ⭐ are optimised for your bloodwork. Ask me about any specific meal, swap, or ingredient.`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (admin as any).schema('agents').from('agent_conversations').insert({
    user_uuid: userId,
    agent: 'janet',
    role: 'assistant',
    content: pushMessage,
  }).then(({ error: msgErr }: { error: unknown }) => {
    if (msgErr) console.warn('[meal-plan pipeline] Failed to write push message:', msgErr);
  });
}

export async function runMealPlanPipeline(userId: string, weekStart?: string): Promise<void> {
  try {
    await _run(userId, weekStart);
  } catch (err) {
    console.error(`[meal-plan pipeline] Unhandled error for user ${userId}:`, err);
  }
}
