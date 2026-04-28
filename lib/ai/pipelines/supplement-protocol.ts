import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

const client = new Anthropic();

const SYSTEM_PROMPT = `You are Sage, a longevity medicine AI that generates personalised supplement protocols.

You receive de-identified patient data: demographic summary (age, sex), questionnaire responses (medical history, medications, allergies, lifestyle), risk score summary, and pathology findings extracted from uploaded documents.

Your job is to produce a complete, safe, evidence-based daily supplement protocol.

Priority tiers:
- critical: Acute deficiencies (Vit D < 30 ng/mL, B12 < 400 pg/mL) or urgent clinical signals
- high: Major domain risk (cardiovascular, metabolic, inflammatory markers)
- recommended: Longevity optimisation (NAD+, mitochondrial support, adaptogens)
- performance: Goal-specific (muscle, cognition, sleep, energy)

Hard rules:
1. Flag every known drug-nutrient interaction in the "note" field. Never omit.
2. If any biomarker is critically abnormal, prepend a medical attention flag in data_completeness_note.
3. No duplicate supplements.
4. If no bloodwork is available, base protocol on questionnaire risk profile alone and note this in data_completeness_note.
5. Baseline without bloodwork: set interactions_checked to false.
6. Never recommend supplements contraindicated with disclosed medications.

Always respond with valid JSON matching the exact schema. No text outside the JSON.`;

const SupplementItemSchema = z.object({
  name: z.string(),
  form: z.string(),
  dosage: z.string(),
  timing: z.string(),
  priority: z.enum(["critical", "high", "recommended", "performance"]),
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

  if (params.ageYears) {
    parts.push(`Patient age: ${params.ageYears} years`);
  }

  if (params.riskSummary) {
    parts.push(`\n## Risk profile\n${params.riskSummary}`);
  }

  if (Object.keys(params.responses).length > 0) {
    parts.push(
      `\n## Questionnaire responses\n${JSON.stringify(params.responses, null, 2)}`,
    );
  }

  if (params.uploadSummaries.length > 0) {
    parts.push(
      `\n## Pathology and imaging findings\n${params.uploadSummaries.join("\n\n")}`,
    );
  } else {
    parts.push(`\n## Pathology: none uploaded yet. Base protocol on questionnaire data.`);
  }

  parts.push(`\n## Output format
Respond with JSON matching this schema exactly:
{
  "supplements": [
    {
      "name": string,
      "form": string (e.g. "softgel", "capsule", "powder"),
      "dosage": string (e.g. "2000 IU"),
      "timing": string (e.g. "morning with food"),
      "priority": "critical" | "high" | "recommended" | "performance",
      "domains": string[] (which risk domains this addresses),
      "rationale": string (1–2 sentences citing specific data),
      "note": string (optional — drug interactions, contraindications)
    }
  ],
  "generated_at": ISO timestamp string,
  "data_completeness_note": string,
  "interactions_checked": boolean
}`);

  return parts.join("\n");
}

async function callSage(prompt: string, isRetry = false): Promise<SupplementOutput> {
  const retryInstruction = isRetry
    ? "\n\nPREVIOUS RESPONSE DID NOT MATCH THE REQUIRED JSON SCHEMA. Return valid JSON only — no prose, no markdown, no code blocks."
    : "";

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 3000,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: prompt + retryInstruction,
      },
    ],
  });

  const text = message.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");

  const parsed = JSON.parse(text);
  return SupplementOutputSchema.parse(parsed);
}

export async function runSupplementProtocolPipeline(userId: string): Promise<void> {
  const admin = createAdminClient();

  // Load only the fields this pipeline needs
  const [profileResult, healthResult, riskResult, uploadsResult] = await Promise.all([
    admin
      .from("profiles")
      .select("date_of_birth")
      .eq("id", userId)
      .single(),

    admin
      .from("health_profiles")
      .select("responses")
      .eq("user_uuid", userId)
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),

    admin
      .from("risk_scores")
      .select("cv_risk, metabolic_risk, neuro_risk, onco_risk, msk_risk, narrative, confidence_level")
      .eq("user_uuid", userId)
      .order("assessment_date", { ascending: false })
      .limit(1)
      .maybeSingle(),

    admin
      .from("patient_uploads")
      .select("original_filename, janet_category, janet_summary, janet_findings")
      .eq("user_uuid", userId)
      .eq("janet_status", "done"),
  ]);

  const profile = profileResult.data;
  const health = healthResult.data;
  const risk = riskResult.data;
  const uploads = uploadsResult.data ?? [];

  const ageYears = profile?.date_of_birth
    ? Math.floor(
        (Date.now() - new Date(profile.date_of_birth).getTime()) /
          (365.25 * 24 * 60 * 60 * 1000),
      )
    : null;

  const responses = (health?.responses as Record<string, unknown>) ?? {};

  const riskSummary = risk
    ? `CV=${risk.cv_risk ?? "?"} Metabolic=${risk.metabolic_risk ?? "?"} Neuro=${risk.neuro_risk ?? "?"} Onco=${risk.onco_risk ?? "?"} MSK=${risk.msk_risk ?? "?"} (confidence: ${risk.confidence_level ?? "unknown"})`
    : null;

  const uploadSummaries = uploads.map(
    (u) =>
      `${u.original_filename} [${u.janet_category}]: ${u.janet_summary}` +
      (u.janet_findings
        ? `\nFindings: ${JSON.stringify(u.janet_findings)}`
        : ""),
  );

  const prompt = buildPrompt({ ageYears, responses, riskSummary, uploadSummaries });

  let output: SupplementOutput;
  try {
    output = await callSage(prompt);
  } catch {
    try {
      output = await callSage(prompt, true);
    } catch (retryErr) {
      console.error(
        `[Sage] Supplement protocol pipeline failed for user ${userId}:`,
        retryErr,
      );
      return;
    }
  }

  // Mark any existing active plans as superseded, then insert new active plan
  const now = new Date().toISOString();

  await admin
    .from("supplement_plans")
    .update({ status: "superseded", updated_at: now })
    .eq("patient_uuid", userId)
    .eq("status", "active");

  const { error } = await admin.from("supplement_plans").insert({
    patient_uuid: userId,
    created_by_role: "ai",
    status: "active",
    valid_from: now.split("T")[0],
    items: output.supplements as unknown as import("@/lib/supabase/database.types").Json,
    notes: `${output.data_completeness_note} | interactions_checked=${output.interactions_checked}`,
  });

  if (error) {
    console.error(
      `[Sage] Failed to insert supplement_plans for user ${userId}:`,
      error,
    );
  }
}
