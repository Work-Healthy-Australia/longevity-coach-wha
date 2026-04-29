"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { runRiskNarrativePipeline } from "@/lib/ai/pipelines/risk-narrative";
import { runSupplementProtocolPipeline } from "@/lib/ai/pipelines/supplement-protocol";

type RegenerateState = {
  error?: string;
  success?: boolean;
};

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

export async function triggerSupplementProtocol(): Promise<{ status: 'generating' | 'error'; message: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { status: 'error', message: 'Not authenticated' };

  const base = process.env.NEXT_PUBLIC_SITE_URL;
  const secret = process.env.PIPELINE_SECRET;

  if (base && secret) {
    fetch(`${base}/api/pipelines/supplement-protocol`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-pipeline-secret': secret },
      body: JSON.stringify({ userId: user.id }),
    }).catch((err: unknown) =>
      console.warn('[supplement-protocol action] fire-and-forget failed:', err)
    );
  }

  return {
    status: 'generating',
    message: 'Generating your protocol — this takes about a minute.',
  };
}
