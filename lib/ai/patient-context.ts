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
  recentConversation: ConversationTurn[];
  knowledgeChunks: string[];
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

  const [profileResult, riskResult, healthResult, uploadsResult, supplementResult, conversationResult, knowledgeChunks] =
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
    ]);

  const profile = profileResult.data;
  const risk = riskResult.data;
  const health = healthResult.data;
  const uploads = uploadsResult.data ?? [];
  const supplement = supplementResult.data;
  const conversation = conversationResult.data ?? [];

  return {
    userId,

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

    // Conversation is returned in chronological order (reversed from query)
    recentConversation: [...conversation].reverse() as ConversationTurn[],

    knowledgeChunks,
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

  if (ctx.knowledgeChunks.length) {
    lines.push(`\n## Relevant health knowledge`);
    ctx.knowledgeChunks.forEach((chunk) => lines.push(chunk));
  }

  return lines.join("\n");
}
