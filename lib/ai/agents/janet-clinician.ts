import { type UIMessage } from "ai";

import { createStreamingAgent } from "@/lib/ai/agent-factory";
import { loadPatientContext, summariseContext } from "@/lib/ai/patient-context";
import { submitProgramTool } from "@/lib/ai/tools/submit-program-tool";
import { createAdminClient } from "@/lib/supabase/admin";
import { loose } from "@/lib/supabase/loose-table";

type Review = {
  id: string;
  patient_uuid: string;
  janet_brief: string | null;
  wins: string[];
  next_goals: string[];
  adherence_score: number | null;
  adherence_notes: string | null;
  stress_level: number | null;
  stress_notes: string | null;
  support_needed: string | null;
  open_space: string | null;
  overall_sentiment: string | null;
};

function summariseReview(r: Review): string {
  const lines: string[] = [];
  lines.push("## Patient under review (Janet brief + structured check-in)");
  if (r.janet_brief) lines.push(`Janet's monthly brief:\n${r.janet_brief}`);
  if (r.overall_sentiment) lines.push(`Overall sentiment: ${r.overall_sentiment}`);
  if (r.adherence_score !== null) {
    lines.push(`Adherence: ${r.adherence_score}/100${r.adherence_notes ? ` — ${r.adherence_notes}` : ""}`);
  }
  if (r.stress_level !== null) {
    lines.push(`Stress: ${r.stress_level}/10${r.stress_notes ? ` — ${r.stress_notes}` : ""}`);
  }
  if (r.wins.length) lines.push(`Wins: ${r.wins.join("; ")}`);
  if (r.next_goals.length) lines.push(`Next goals: ${r.next_goals.join("; ")}`);
  if (r.support_needed) lines.push(`Support needed: ${r.support_needed}`);
  if (r.open_space) lines.push(`Open space: ${r.open_space}`);
  return lines.join("\n");
}

export async function streamClinicianTurn(reviewId: string, messages: UIMessage[]) {
  const t0 = Date.now();
  const admin = createAdminClient();

  const { data: review, error } = await loose(admin)
    .from("periodic_reviews")
    .select(
      "id, patient_uuid, janet_brief, wins, next_goals, adherence_score, adherence_notes, stress_level, stress_notes, support_needed, open_space, overall_sentiment"
    )
    .eq("id", reviewId)
    .maybeSingle();

  if (error || !review) {
    throw new Error(`Review ${reviewId} not found.`);
  }

  const r = review as Review;

  // Patient context is the same loader Janet uses for patient-facing chat —
  // domain risk, supplement plan, recent labs etc. Conversation history is
  // intentionally not pulled (clinician chat history lives elsewhere).
  const ctx = await loadPatientContext(r.patient_uuid, {
    includeConversation: false,
    agent: "janet_clinician",
  });

  const ctxMs = Date.now() - t0;

  const agent = createStreamingAgent("janet_clinician");
  return agent.stream(messages, {
    systemSuffix: `\n\n${summariseReview(r)}\n\n${summariseContext(ctx)}`,
    tools: {
      submit_30_day_program: submitProgramTool(reviewId),
    },
    onFinish: async () => {
      const totalMs = Date.now() - t0;
      console.log(
        JSON.stringify({
          event: "janet_clinician_turn",
          review_id: reviewId,
          patient_context_ms: ctxMs,
          total_ms: totalMs,
        })
      );
    },
  });
}
