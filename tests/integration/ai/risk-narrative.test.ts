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
const mockDailyLogsQuery = vi.fn();

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
  if (table === "risk_assessment_standards") {
    return {
      select: () => ({
        eq: () => ({
          in: () => ({
            order: () => ({
              order: () => Promise.resolve({ data: [], error: null }),
            }),
          }),
        }),
      }),
    };
  }
  return {};
});

const mockBiomarkersFrom = vi.fn((table: string) => {
  if (table === "daily_logs") {
    return {
      select: () => ({
        eq: () => ({ gte: () => mockDailyLogsQuery() }),
      }),
    };
  }
  return {};
});

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: mockFrom,
    schema: (s: string) =>
      s === "biomarkers" ? { from: mockBiomarkersFrom } : { from: vi.fn() },
  }),
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
  mockDailyLogsQuery.mockResolvedValue({ data: [], error: null });
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

  it("resolves without throwing when the daily_logs query rejects (non-fatal failure)", async () => {
    mockDailyLogsQuery.mockRejectedValueOnce(new Error("DB timeout"));
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

  it("includes daily trends in the prompt when recent logs exist", async () => {
    mockDailyLogsQuery.mockResolvedValueOnce({
      data: [
        { mood: 7, energy_level: 6, sleep_hours: 7.5, workout_duration_min: 30, steps: 8000, water_ml: 2000 },
        { mood: 5, energy_level: 5, sleep_hours: 6.0, workout_duration_min: 0, steps: 5000, water_ml: 1500 },
      ],
      error: null,
    });
    await runRiskNarrativePipeline("user-123");
    const prompt = mockRun.mock.calls[0]![1] as string;
    expect(prompt).toMatch(/Recent daily trends/);
    expect(prompt).toMatch(/Days logged: 2 of last 14/);
  });

  it("omits daily trends section when no recent logs exist", async () => {
    await runRiskNarrativePipeline("user-123");
    const prompt = mockRun.mock.calls[0]![1] as string;
    expect(prompt).not.toMatch(/Recent daily trends/);
  });
});
