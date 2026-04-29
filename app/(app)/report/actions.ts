"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { runRiskNarrativePipeline } from "@/lib/ai/pipelines/risk-narrative";
import { runSupplementProtocolPipeline } from "@/lib/ai/pipelines/supplement-protocol";

type RegenerateState = {
  error?: string;
  success?: boolean;
};

/**
 * Regenerate the patient's report by running both pipeline workers sequentially:
 *   1. risk_analyzer → writes risk_scores (biological age, domain scores, narrative)
 *   2. supplement_advisor → reads risk_scores, writes supplement_plans
 *
 * Risk must complete first because the supplement pipeline uses risk scores as input.
 * Each pipeline is internally non-fatal (logs and continues on LLM errors), so partial
 * results are possible — the user will see whatever succeeded.
 */
export async function regenerateReport(
  _prev: RegenerateState | null,
): Promise<RegenerateState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  try {
    // Risk narrative first — supplement pipeline reads risk_scores
    await runRiskNarrativePipeline(user.id);
    await runSupplementProtocolPipeline(user.id);
  } catch (err) {
    console.error("[regenerateReport] Pipeline error:", err);
    return { error: "Report generation failed. Please try again." };
  }

  revalidatePath("/report");
  return { success: true };
}
