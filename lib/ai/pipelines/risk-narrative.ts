import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

const client = new Anthropic();

const SYSTEM_PROMPT = `You are Atlas, a longevity medicine AI that analyses patient health data and produces a structured clinical risk assessment.

You receive de-identified patient data: questionnaire responses (medical history, lifestyle, family history, goals) and any uploaded pathology findings already extracted by Janet (another AI). No PII is present in the data you receive.

Your job is to:
1. Estimate domain risk scores (0–100 scale, higher = worse) across five longevity domains
2. Estimate a biological age
3. Write a calm, measured risk narrative for the patient
4. Identify modifiable risk drivers and protective levers
5. Recommend specific screenings (not vague "see your doctor" advice)

Scoring guidance:
- 0–25: very low risk / optimal
- 26–45: low risk / good
- 46–65: moderate risk / some concern
- 66–80: high risk / needs attention
- 81–100: very high risk / urgent

Biological age guidance:
- Biological age can be lower or higher than chronological age
- A highly active non-smoker with clean bloodwork may be 5–10 years younger biologically
- Chronic disease, obesity, smoking, high stress: add 3–10 years per major factor
- Cap at chronological age + 15 if evidence is limited

Always respond with valid JSON matching this exact schema. No text outside the JSON.`;

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
  confidence_level: z.enum(["low", "moderate", "high", "insufficient"]),
  data_gaps: z.array(z.string()),
});

type RiskNarrativeOutput = z.infer<typeof RiskNarrativeOutputSchema>;

function buildPrompt(params: {
  ageYears: number | null;
  responses: Record<string, unknown>;
  uploadSummaries: string[];
}): string {
  const parts: string[] = [];

  if (params.ageYears) {
    parts.push(`Chronological age: ${params.ageYears} years`);
  }

  if (Object.keys(params.responses).length > 0) {
    parts.push(
      `\n## Questionnaire responses\n${JSON.stringify(params.responses, null, 2)}`,
    );
  }

  if (params.uploadSummaries.length > 0) {
    parts.push(
      `\n## Pathology and imaging findings (extracted by Janet)\n${params.uploadSummaries.join("\n\n")}`,
    );
  }

  parts.push(`\n## Output format
Respond with a JSON object matching this schema exactly:
{
  "biological_age": number (18–120),
  "cv_risk": number (0–100),
  "metabolic_risk": number (0–100),
  "neuro_risk": number (0–100),
  "onco_risk": number (0–100),
  "msk_risk": number (0–100),
  "longevity_score": number (0–100, higher = better optimised),
  "narrative": string (150–500 words, calm and measured, for the patient to read),
  "top_risk_drivers": string[] (up to 7, modifiable factors ranked by impact),
  "top_protective_levers": string[] (up to 5, ranked by impact),
  "recommended_screenings": string[] (specific tests, not generic advice),
  "confidence_level": "low" | "moderate" | "high" | "insufficient",
  "data_gaps": string[] (specific missing data that would improve confidence)
}`);

  return parts.join("\n");
}

async function callAtlas(prompt: string, isRetry = false): Promise<RiskNarrativeOutput> {
  const retryInstruction = isRetry
    ? "\n\nPREVIOUS RESPONSE DID NOT MATCH THE REQUIRED JSON SCHEMA. Return valid JSON only — no prose, no markdown, no code blocks."
    : "";

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
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
  return RiskNarrativeOutputSchema.parse(parsed);
}

export async function runRiskNarrativePipeline(userId: string): Promise<void> {
  const admin = createAdminClient();

  // Load only the fields this pipeline needs
  const [profileResult, healthResult, uploadsResult] = await Promise.all([
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
      .from("patient_uploads")
      .select("original_filename, janet_category, janet_summary, janet_findings")
      .eq("user_uuid", userId)
      .eq("janet_status", "done"),
  ]);

  const profile = profileResult.data;
  const health = healthResult.data;
  const uploads = uploadsResult.data ?? [];

  // Compute chronological age (never stored — Rule 1)
  const ageYears = profile?.date_of_birth
    ? Math.floor(
        (Date.now() - new Date(profile.date_of_birth).getTime()) /
          (365.25 * 24 * 60 * 60 * 1000),
      )
    : null;

  const responses = (health?.responses as Record<string, unknown>) ?? {};

  const uploadSummaries = uploads.map(
    (u) =>
      `${u.original_filename} [${u.janet_category}]: ${u.janet_summary}` +
      (u.janet_findings
        ? `\nFindings: ${JSON.stringify(u.janet_findings)}`
        : ""),
  );

  const prompt = buildPrompt({ ageYears, responses, uploadSummaries });

  let output: RiskNarrativeOutput;
  try {
    output = await callAtlas(prompt);
  } catch {
    // Retry once with schema correction
    try {
      output = await callAtlas(prompt, true);
    } catch (retryErr) {
      console.error(
        `[Atlas] Risk narrative pipeline failed for user ${userId}:`,
        retryErr,
      );
      return;
    }
  }

  // Upsert risk_scores — keyed on user_uuid
  const now = new Date().toISOString();
  const { error } = await admin.from("risk_scores").upsert(
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
      assessment_date: now.split("T")[0],
      computed_at: now,
    },
    { onConflict: "user_uuid" },
  );

  if (error) {
    console.error(`[Atlas] Failed to upsert risk_scores for user ${userId}:`, error);
  }
}
