// @vitest-environment node
// One-shot backfill script. Re-runs runRiskNarrativePipeline against the live
// Supabase + Anthropic for the two users whose risk_scores rows have
// narrative=null (the silent-failure window before the schema fix landed).
//
// Calls the same code path the production /api/pipelines/risk-narrative
// endpoint uses, just bypassing the HTTP gateway so we don't need the prod
// PIPELINE_SECRET on this machine.
//
// Run with:
//   BACKFILL_NARRATIVES=1 pnpm exec vitest run tests/integration/_backfill-narratives.test.ts

import "./_env-from-main";
import { describe, it, expect } from "vitest";

const USER_IDS = [
  "c32699e1-e6d8-4626-a763-a942aa68b416", // 2026-04-30 assessment
  "865cbc5c-50f1-4d5d-b2cd-ecee3b399bd0", // 2026-04-29 assessment
];

const SHOULD_RUN = process.env.BACKFILL_NARRATIVES === "1";

describe.skipIf(!SHOULD_RUN)("narrative backfill", () => {
  it(
    "rebuilds narratives for the 2 affected users",
    async () => {
      const { runRiskNarrativePipeline } = await import("@/lib/ai/pipelines/risk-narrative");
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const admin = createAdminClient();

      for (const userId of USER_IDS) {
        process.stderr.write(`[backfill] running pipeline for ${userId}…\n`);
        const t0 = Date.now();
        await runRiskNarrativePipeline(userId);
        process.stderr.write(`[backfill] pipeline done in ${Date.now() - t0}ms\n`);

        const { data, error } = await admin
          .from("risk_scores")
          .select("user_uuid, assessment_date, narrative, top_risk_drivers")
          .eq("user_uuid", userId)
          .order("assessment_date", { ascending: false })
          .limit(1)
          .single();

        expect(error).toBeNull();
        expect(data?.narrative).toBeTruthy();
        expect((data?.narrative ?? "").length).toBeGreaterThan(50);
        process.stderr.write(
          `[backfill] ${userId}: narrative ${data?.narrative?.length ?? 0} chars, ` +
          `${(data?.top_risk_drivers as unknown[] | undefined)?.length ?? 0} risk drivers\n`,
        );
      }
    },
    180_000,
  );
});
