import { zodSchema, type Tool } from "ai";
import { z } from "zod";

import { loose } from "@/lib/supabase/loose-table";
import { createAdminClient } from "@/lib/supabase/admin";

// Tool replaces the Base44 PROGRAM_READY text sentinel (per C6 in
// docs/architecture/clinician-portal-decisions.md). Janet calls this once when
// the 30-day program is ready; the tool writes the program to periodic_reviews
// and flips review_status to program_ready. The UI sees the row update on next
// reload and surfaces the program in the dedicated tab.

const SubmitSchema = z.object({
  program_30_day: z
    .string()
    .min(80)
    .describe("Full 30-day program body in markdown — rationale, weekly actions, and success metrics."),
});

export function submitProgramTool(reviewId: string): Tool {
  return {
    description:
      "Submit the finalised 30-day program for the patient under review. Call exactly once when the program is ready; do not emit the program in plain conversational text.",
    inputSchema: zodSchema(SubmitSchema),
    execute: async ({ program_30_day }: z.infer<typeof SubmitSchema>) => {
      const admin = createAdminClient();
      const { error } = await loose(admin)
        .from("periodic_reviews")
        .update({
          program_30_day,
          review_status: "program_ready",
        })
        .eq("id", reviewId);
      if (error) {
        return {
          ok: false,
          error: `Failed to save program: ${error.message ?? "unknown"}`,
        };
      }
      return {
        ok: true,
        message:
          "Program saved. The clinician now sees it in the 30-Day Program tab and can edit before approving.",
      };
    },
  };
}
