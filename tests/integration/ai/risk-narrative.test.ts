import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// vi.mock is hoisted to the top of the file, so variables used inside the
// factory must be declared with vi.hoisted().
const { mockRun } = vi.hoisted(() => ({
  mockRun: vi.fn(),
}));

vi.mock("@/lib/ai/agent-factory", () => ({
  createPipelineAgent: vi.fn(() => ({ run: mockRun })),
}));

// ── Supabase admin mock ──────────────────────────────────────────────────────
const mockProfilesSingle = vi.fn();
const mockHealthMaybeSingle = vi.fn();
const mockUploadsQuery = vi.fn();
const mockRiskUpsert = vi.fn(() => Promise.resolve({ error: null }));

const mockFrom = vi.fn((table: string) => {
  if (table === "profiles") {
    return {
      select: () => ({ eq: () => ({ single: mockProfilesSingle }) }),
    };
  }
  if (table === "health_profiles") {
    return {
      select: () => ({
        eq: () => ({
          not: () => ({
            order: () => ({
              limit: () => ({ maybeSingle: mockHealthMaybeSingle }),
            }),
          }),
        }),
      }),
    };
  }
  if (table === "patient_uploads") {
    return {
      select: () => ({
        eq: () => ({ eq: () => mockUploadsQuery() }),
      }),
    };
  }
  if (table === "risk_scores") {
    return { upsert: mockRiskUpsert };
  }
  return {};
});

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: mockFrom }),
}));

import { createPipelineAgent } from "@/lib/ai/agent-factory";
import { runRiskNarrativePipeline } from "@/lib/ai/pipelines/risk-narrative";

// ── Fixtures ─────────────────────────────────────────────────────────────────
const fakeOutput = {
  biological_age: 38,
  cv_risk: 25,
  metabolic_risk: 18,
  neuro_risk: 12,
  onco_risk: 8,
  msk_risk: 15,
  longevity_score: 72,
  narrative:
    "Your overall cardiovascular health is good. Focus on metabolic health to reduce your biological age.",
  top_risk_drivers: ["Sedentary lifestyle", "Elevated fasting glucose"],
  top_protective_levers: ["Increase HIIT frequency", "Reduce refined carbs"],
  recommended_screenings: ["Annual HbA1c", "DEXA scan"],
  confidence_level: "high" as const,
  data_gaps: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockProfilesSingle.mockResolvedValue({
    data: { date_of_birth: "1985-06-15" },
    error: null,
  });
  mockHealthMaybeSingle.mockResolvedValue({
    data: { responses: { basics: { sex: "Male", height_cm: 180 } } },
    error: null,
  });
  mockUploadsQuery.mockResolvedValue({ data: [], error: null });
  mockRun.mockResolvedValue(fakeOutput);
});
afterEach(() => vi.resetAllMocks());

describe("runRiskNarrativePipeline", () => {
  it("creates the atlas pipeline agent", async () => {
    await runRiskNarrativePipeline("user-123");
    expect(createPipelineAgent).toHaveBeenCalledWith("atlas");
  });

  it("calls agent.run with the correct schema and a prompt string", async () => {
    await runRiskNarrativePipeline("user-123");
    expect(mockRun).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
    );
  });

  it("includes chronological age in the prompt when DOB is present", async () => {
    await runRiskNarrativePipeline("user-123");
    const prompt = mockRun.mock.calls[0]![1] as string;
    expect(prompt).toMatch(/Chronological age:/);
  });

  it("omits chronological age from the prompt when profile has no DOB", async () => {
    mockProfilesSingle.mockResolvedValueOnce({
      data: { date_of_birth: null },
      error: null,
    });
    await runRiskNarrativePipeline("user-123");
    const prompt = mockRun.mock.calls[0]![1] as string;
    expect(prompt).not.toMatch(/Chronological age:/);
  });

  it("includes questionnaire responses in the prompt", async () => {
    await runRiskNarrativePipeline("user-123");
    const prompt = mockRun.mock.calls[0]![1] as string;
    expect(prompt).toMatch(/Questionnaire responses/);
  });

  it("upserts risk_scores with the full output from the LLM", async () => {
    await runRiskNarrativePipeline("user-123");
    expect(mockRiskUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_uuid: "user-123",
        biological_age: fakeOutput.biological_age,
        cv_risk: fakeOutput.cv_risk,
        metabolic_risk: fakeOutput.metabolic_risk,
        neuro_risk: fakeOutput.neuro_risk,
        onco_risk: fakeOutput.onco_risk,
        msk_risk: fakeOutput.msk_risk,
        longevity_score: fakeOutput.longevity_score,
        confidence_level: fakeOutput.confidence_level,
        narrative: fakeOutput.narrative,
      }),
      { onConflict: "user_uuid" },
    );
  });

  it("uses the user_uuid from the argument in the upsert", async () => {
    await runRiskNarrativePipeline("specific-user-456");
    const [row] = mockRiskUpsert.mock.calls[0]!;
    expect((row as { user_uuid: string }).user_uuid).toBe("specific-user-456");
  });

  it("does not upsert risk_scores when agent.run throws (non-fatal failure)", async () => {
    mockRun.mockRejectedValueOnce(new Error("LLM unavailable"));
    await expect(runRiskNarrativePipeline("user-123")).resolves.toBeUndefined();
    expect(mockRiskUpsert).not.toHaveBeenCalled();
  });

  it("includes upload summaries in the prompt when pathology uploads exist", async () => {
    mockUploadsQuery.mockResolvedValueOnce({
      data: [
        {
          original_filename: "blood-test.pdf",
          janet_category: "pathology",
          janet_summary: "HbA1c 6.1%, borderline elevated",
          janet_findings: null,
        },
      ],
      error: null,
    });
    await runRiskNarrativePipeline("user-123");
    const prompt = mockRun.mock.calls[0]![1] as string;
    expect(prompt).toMatch(/blood-test\.pdf/);
    expect(prompt).toMatch(/pathology/);
  });
});
