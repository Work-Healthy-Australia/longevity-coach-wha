import { createAdminClient } from "@/lib/supabase/admin";
import { retrieveKnowledge } from "@/lib/ai/rag";

export interface SupplementItem {
  name: string;
  form: string;
  dosage: string;
  timing: string;
  priority: "critical" | "high" | "recommended" | "performance";
  domains: string[];
  rationale: string;
  note?: string;
}

export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface PatientContext {
  userId: string;
  profile: {
    fullName: string | null;
    dateOfBirth: string | null;
    phone: string | null;
    role: string;
  };
  recentDigests: Array<{
    title: string;
    content: string;
    category: string;
    evidence_level: string;
    created_at: string;
  }>;
  riskScores: {
    biologicalAge: number | null;
    cvRisk: number | null;
    metabolicRisk: number | null;
    neuroRisk: number | null;
    oncoRisk: number | null;
    mskRisk: number | null;
    narrative: string | null;
    topRiskDrivers: string[];
    topProtectiveLevers: string[];
    recommendedScreenings: string[];
    confidenceLevel: string | null;
    dataGaps: string[];
    createdAt: string | null;
  } | null;
  healthProfile: {
    responses: Record<string, unknown>;
    completedAt: string | null;
  } | null;
  uploads: Array<{
    id: string;
    originalFilename: string;
    janetCategory: string | null;
    janetSummary: string | null;
    janetFindings: Record<string, unknown> | null;
    createdAt: string;
  }>;
  supplementPlan: {
    items: SupplementItem[];
    createdAt: string;
  } | null;
  ptPlan: {
    planName: string | null;
    planStartDate: string | null;
    exercises: unknown[];
    notes: string | null;
  } | null;
  journalEntries: Array<{
    body: string;
    createdAt: string;
  }>;
  mealPlan: {
    id: string;
    validFrom: string | null;
    calorieTarget: number | null;
    recipes: Array<{
      name: string;
      mealType: string;
      dayOfWeek: number;
      macros: Record<string, unknown>;
      isBloodworkOptimised: boolean;
    }>;
    shoppingList: Array<{ item: string; quantity: number; unit: string; category: string }>;
  } | null;
  recentConversation: ConversationTurn[];
  knowledgeChunks: string[];
  conversationSummary: string | null;
}

/**
 * Loads all patient context in parallel via Promise.all.
 * Uses service-role client — call only from server-side pipeline or agent code.
 * Returns read-only context; no mutations inside.
 */
export async function loadPatientContext(
  userId: string,
  options: { includeConversation?: boolean; agent?: string } = {},
): Promise<PatientContext> {
  const admin = createAdminClient();

  const [profileResult, riskResult, healthResult, uploadsResult, supplementResult, ptPlanResult, journalResult, mealPlanResult, conversationResult, knowledgeChunks, recentDigestsResult, conversationSummaryResult] =
    await Promise.all([
      // Profile (PII layer — demographics only, no clinical data)
      admin
        .from("profiles")
        .select("full_name, date_of_birth, phone, role")
        .eq("id", userId)
        .single(),

      // Latest risk scores
      admin
        .from("risk_scores")
        .select("biological_age, cv_risk, metabolic_risk, neuro_risk, onco_risk, msk_risk, narrative, top_risk_drivers, top_protective_levers, recommended_screenings, confidence_level, data_gaps, assessment_date")
        .eq("user_uuid", userId)
        .order("assessment_date", { ascending: false })
        .limit(1)
        .maybeSingle(),

      // Latest completed health profile (questionnaire responses)
      admin
        .from("health_profiles")
        .select("responses, completed_at")
        .eq("user_uuid", userId)
        .not("completed_at", "is", null)
        .order("completed_at", { ascending: false })
        .limit(1)
        .maybeSingle(),

      // All successfully analysed uploads (Janet findings)
      admin
        .from("patient_uploads")
        .select("id, original_filename, janet_category, janet_summary, janet_findings, created_at")
        .eq("user_uuid", userId)
        .eq("janet_status", "done")
        .order("created_at", { ascending: false }),

      // Latest active supplement plan
      admin
        .from("supplement_plans")
        .select("items, created_at")
        .eq("patient_uuid", userId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),

      // Latest active PT plan
      admin
        .from('training_plans')
        .select('plan_name, plan_start_date, exercises, notes')
        .eq('patient_uuid', userId)
        .eq('status', 'active')
        .order('plan_start_date', { ascending: false })
        .limit(1)
        .maybeSingle(),

      // Last 3 journal entries for Janet context
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (admin as any)
        .from('journal_entries')
        .select('body, created_at')
        .eq('user_uuid', userId)
        .order('created_at', { ascending: false })
        .limit(3),

      // Latest active meal plan with nested recipes + shopping list
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (admin as any)
        .from('meal_plans')
        .select('id, valid_from, calorie_target, recipes(name, meal_type, day_of_week, macros, is_bloodwork_optimised), shopping_lists(items)')
        .eq('patient_uuid', userId)
        .eq('status', 'active')
        .order('valid_from', { ascending: false })
        .limit(1)
        .maybeSingle(),

      // Last 20 conversation turns for the specified agent
      options.includeConversation !== false
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? (admin as any)
            .schema("agents")
            .from("agent_conversations")
            .select("role, content, created_at")
            .eq("user_uuid", userId)
            .eq("agent", options.agent ?? "janet")
            .order("created_at", { ascending: false })
            .limit(20)
        : Promise.resolve({ data: [], error: null }),

      // RAG knowledge chunks — hybrid BM25 + vector search (vector falls back to BM25-only when unavailable)
      retrieveKnowledge("longevity health risk prevention assessment", 4).catch((): string[] => []),

      // Recent health_researcher digests (last 3)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (admin as any)
        .schema('agents')
        .from('health_updates')
        .select('title, content, category, evidence_level, created_at')
        .order('created_at', { ascending: false })
        .limit(3)
        .then((r: { data: unknown[] | null }) => r)
        .catch(() => ({ data: [] })),

      // Pre-compressed summary of turns outside the 20-turn window
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (admin as any)
        .schema('agents')
        .from('conversation_summaries')
        .select('summary')
        .eq('user_uuid', userId)
        .eq('agent', options.agent ?? 'janet')
        .maybeSingle()
        .then((r: { data: { summary: string } | null }) => r)
        .catch(() => ({ data: null })),
    ]);

  const profile = profileResult.data;
  const risk = riskResult.data;
  const health = healthResult.data;
  const uploads = uploadsResult.data ?? [];
  const supplement = supplementResult.data;
  const ptPlan = ptPlanResult.data;
  const journalEntries = (journalResult.data ?? []) as Array<{ body: string; created_at: string }>;
  const mealPlanData = (mealPlanResult as { data: unknown }).data as {
    id: string;
    valid_from: string | null;
    calorie_target: number | null;
    recipes: Array<{ name: string; meal_type: string; day_of_week: number; macros: unknown; is_bloodwork_optimised: boolean }> | null;
    shopping_lists: Array<{ items: unknown }> | null;
  } | null;
  const conversation = conversationResult.data ?? [];

  return {
    userId,

    recentDigests: ((recentDigestsResult as { data: unknown[] | null }).data ?? []) as Array<{
      title: string; content: string; category: string;
      evidence_level: string; created_at: string;
    }>,

    profile: {
      fullName: profile?.full_name ?? null,
      dateOfBirth: profile?.date_of_birth ?? null,
      phone: profile?.phone ?? null,
      role: profile?.role ?? "user",
    },

    riskScores: risk
      ? {
          biologicalAge: risk.biological_age ?? null,
          cvRisk: risk.cv_risk ?? null,
          metabolicRisk: risk.metabolic_risk ?? null,
          neuroRisk: risk.neuro_risk ?? null,
          oncoRisk: risk.onco_risk ?? null,
          mskRisk: risk.msk_risk ?? null,
          narrative: risk.narrative ?? null,
          topRiskDrivers: (risk.top_risk_drivers as string[]) ?? [],
          topProtectiveLevers: (risk.top_protective_levers as string[]) ?? [],
          recommendedScreenings: (risk.recommended_screenings as string[]) ?? [],
          confidenceLevel: risk.confidence_level ?? null,
          dataGaps: (risk.data_gaps as string[]) ?? [],
          createdAt: risk.assessment_date ?? null,
        }
      : null,

    healthProfile: health
      ? {
          responses: (health.responses as Record<string, unknown>) ?? {},
          completedAt: health.completed_at ?? null,
        }
      : null,

    uploads: uploads.map((u) => ({
      id: u.id,
      originalFilename: u.original_filename,
      janetCategory: u.janet_category ?? null,
      janetSummary: u.janet_summary ?? null,
      janetFindings: (u.janet_findings as Record<string, unknown> | null) ?? null,
      createdAt: u.created_at,
    })),

    supplementPlan: supplement
      ? {
          items: (supplement.items as unknown as SupplementItem[]) ?? [],
          createdAt: supplement.created_at,
        }
      : null,

    ptPlan: ptPlan
      ? {
          planName: (ptPlan as unknown as { plan_name: string | null }).plan_name ?? null,
          planStartDate: (ptPlan as unknown as { plan_start_date: string | null }).plan_start_date ?? null,
          exercises: ((ptPlan as unknown as { exercises: unknown[] }).exercises) ?? [],
          notes: (ptPlan as unknown as { notes: string | null }).notes ?? null,
        }
      : null,

    journalEntries: journalEntries.map(e => ({ body: e.body, createdAt: e.created_at })),

    mealPlan: mealPlanData
      ? {
          id: mealPlanData.id,
          validFrom: mealPlanData.valid_from ?? null,
          calorieTarget: mealPlanData.calorie_target ?? null,
          recipes: (mealPlanData.recipes ?? []).map(r => ({
            name: r.name,
            mealType: r.meal_type,
            dayOfWeek: r.day_of_week,
            macros: r.macros as Record<string, unknown>,
            isBloodworkOptimised: r.is_bloodwork_optimised,
          })),
          shoppingList: ((mealPlanData.shopping_lists?.[0]?.items ?? []) as Array<{ item: string; quantity: number; unit: string; category: string }>),
        }
      : null,

    // Conversation is returned in chronological order (reversed from query)
    recentConversation: [...conversation].reverse() as ConversationTurn[],

    knowledgeChunks,

    conversationSummary: (conversationSummaryResult as { data: { summary: string } | null }).data?.summary ?? null,
  };
}

/** Summarises PatientContext into a compact string for injection into system prompts. */
export function summariseContext(ctx: PatientContext): string {
  const age = ctx.profile.dateOfBirth
    ? Math.floor(
        (Date.now() - new Date(ctx.profile.dateOfBirth).getTime()) /
          (365.25 * 24 * 60 * 60 * 1000),
      )
    : null;

  const lines: string[] = [];

  lines.push(`## Patient context`);
  if (age) lines.push(`Age: ${age} years`);
  if (ctx.riskScores?.biologicalAge)
    lines.push(`Biological age: ${ctx.riskScores.biologicalAge}`);

  if (ctx.riskScores) {
    const r = ctx.riskScores;
    lines.push(
      `Domain risk scores (0–100, higher = worse): CV=${r.cvRisk ?? "?"} Metabolic=${r.metabolicRisk ?? "?"} Neuro=${r.neuroRisk ?? "?"} Onco=${r.oncoRisk ?? "?"} MSK=${r.mskRisk ?? "?"}`,
    );
    if (r.topRiskDrivers.length)
      lines.push(`Top risk drivers: ${r.topRiskDrivers.slice(0, 4).join(", ")}`);
    if (r.topProtectiveLevers.length)
      lines.push(`Protective levers: ${r.topProtectiveLevers.slice(0, 3).join(", ")}`);
    if (r.dataGaps.length)
      lines.push(`Data gaps: ${r.dataGaps.slice(0, 3).join(", ")}`);
    if (r.confidenceLevel)
      lines.push(`Assessment confidence: ${r.confidenceLevel}`);
  } else {
    lines.push(`Risk assessment: not yet completed`);
  }

  if (ctx.riskScores?.createdAt) {
    const daysSince = Math.floor(
      (Date.now() - new Date(ctx.riskScores.createdAt).getTime()) / (1000 * 60 * 60 * 24),
    );
    if (daysSince > 30)
      lines.push(
        `⚠ Risk scores are ${daysSince} days old — recommend patient refresh their assessment`,
      );
  }

  if (ctx.uploads.length) {
    lines.push(`Uploaded documents (${ctx.uploads.length}):`);
    ctx.uploads.slice(0, 5).forEach((u) => {
      lines.push(
        `  - ${u.originalFilename} [${u.janetCategory ?? "unknown"}]: ${u.janetSummary ?? "pending"}`,
      );
    });
  }

  if (ctx.supplementPlan?.items.length) {
    const critical = ctx.supplementPlan.items.filter((s) => s.priority === "critical");
    const high = ctx.supplementPlan.items.filter((s) => s.priority === "high");
    lines.push(
      `Supplement protocol: ${ctx.supplementPlan.items.length} supplements (${critical.length} critical, ${high.length} high priority)`,
    );
  } else {
    lines.push(`Supplement protocol: not yet generated`);
  }

  if (ctx.ptPlan) {
    lines.push(`PT plan: active from ${ctx.ptPlan.planStartDate ?? 'unknown'} — ${ctx.ptPlan.planName ?? 'unnamed'}`);
  } else {
    lines.push(`PT plan: not yet generated`);
  }

  if (ctx.mealPlan) {
    const recipeCount = ctx.mealPlan.recipes.length;
    lines.push(`Meal plan: ${recipeCount} recipes for week of ${ctx.mealPlan.validFrom ?? 'unknown'} (${ctx.mealPlan.calorieTarget ?? '?'} kcal/day target)`);
    if (ctx.mealPlan.shoppingList.length > 0) {
      lines.push(`Shopping list: ${ctx.mealPlan.shoppingList.length} items`);
    }
  } else {
    lines.push(`Meal plan: not yet generated`);
  }

  if (ctx.journalEntries.length > 0) {
    lines.push(`\n## Recent journal entries`);
    ctx.journalEntries.forEach(e => lines.push(`  [${e.createdAt.slice(0, 10)}] ${e.body.slice(0, 200)}`));
  }

  if (ctx.conversationSummary) {
    lines.push(`\n## Prior session summary`);
    lines.push(ctx.conversationSummary);
  }

  if (ctx.recentConversation.length) {
    lines.push(`\n## Previous session history`);
    ctx.recentConversation.slice(-6).forEach((t) =>
      lines.push(`${t.role === "user" ? "Patient" : "Janet"}: ${t.content.slice(0, 300)}`),
    );
  }

  if (ctx.knowledgeChunks.length) {
    lines.push(`\n## Relevant health knowledge`);
    ctx.knowledgeChunks.forEach((chunk) => lines.push(chunk));
  }

  if (ctx.recentDigests.length) {
    lines.push(`\n## Latest research digests`);
    ctx.recentDigests.forEach((d) =>
      lines.push(`[${d.category} · ${d.evidence_level}] ${d.title}`),
    );
  }

  return lines.join("\n");
}
