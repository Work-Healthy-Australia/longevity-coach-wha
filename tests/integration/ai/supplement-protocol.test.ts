import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockRun } = vi.hoisted(() => ({
  mockRun: vi.fn(),
}));

vi.mock("@/lib/ai/agent-factory", () => ({
  createPipelineAgent: vi.fn(() => ({ run: mockRun })),
}));

// ── Supabase admin mock ──────────────────────────────────────────────────────
const mockProfilesSingle = vi.fn();
const mockHealthMaybeSingle = vi.fn();
const mockRiskMaybeSingle = vi.fn();
const mockUploadsQuery = vi.fn();
const mockPlanSupersede = vi.fn(() => Promise.resolve({ error: null }));
const mockPlanInsert = vi.fn(() => Promise.resolve({ error: null }));

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
  if (table === "risk_scores") {
    return {
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: () => ({ maybeSingle: mockRiskMaybeSingle }),
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
  if (table === "supplement_plans") {
    return {
      update: () => ({
        eq: () => ({ eq: () => mockPlanSupersede() }),
      }),
      insert: mockPlanInsert,
    };
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

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: mockFrom,
    schema: () => ({ from: () => ({ insert: vi.fn(() => Promise.resolve({ error: null })) }) }),
  }),
}));

import { createPipelineAgent } from "@/lib/ai/agent-factory";
import { runSupplementProtocolPipeline } from "@/lib/ai/pipelines/supplement-protocol";

// ── Fixtures ─────────────────────────────────────────────────────────────────
const fakeRiskRow = {
  cv_risk: 25,
  metabolic_risk: 18,
  neuro_risk: 12,
  onco_risk: 8,
  msk_risk: 15,
  narrative: "Good overall health.",
  confidence_level: "high",
};

const fakeSupplementOutput = {
  supplements: [
    {
      name: "Magnesium Glycinate",
      form: "capsule",
      dosage: "400mg",
      timing: "evening",
      priority: "critical" as const,
      domains: ["metabolic", "neuro"],
      rationale: "Supports insulin sensitivity and sleep quality.",
    },
    {
      name: "Omega-3 (EPA/DHA)",
      form: "softgel",
      dosage: "2g",
      timing: "with meals",
      priority: "high" as const,
      domains: ["cv"],
      rationale: "Reduces cardiovascular inflammation markers.",
    },
  ],
  generated_at: "2026-04-28T10:00:00Z",
  data_completeness_note: "Protocol based on questionnaire data only.",
  interactions_checked: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockProfilesSingle.mockResolvedValue({
    data: { date_of_birth: "1980-03-10" },
    error: null,
  });
  mockHealthMaybeSingle.mockResolvedValue({
    data: { responses: { lifestyle: { exercise_days_per_week: 3 } } },
    error: null,
  });
  mockRiskMaybeSingle.mockResolvedValue({ data: fakeRiskRow, error: null });
  mockUploadsQuery.mockResolvedValue({ data: [], error: null });
  mockRun.mockResolvedValue(fakeSupplementOutput);
});
afterEach(() => vi.resetAllMocks());

describe("runSupplementProtocolPipeline", () => {
  it("creates the supplement_advisor pipeline agent", async () => {
    await runSupplementProtocolPipeline("user-123");
    expect(createPipelineAgent).toHaveBeenCalledWith("supplement_advisor");
  });

  it("calls agent.run with the correct schema and a prompt string", async () => {
    await runSupplementProtocolPipeline("user-123");
    expect(mockRun).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
    );
  });

  it("includes the risk profile summary in the prompt when risk scores exist", async () => {
    await runSupplementProtocolPipeline("user-123");
    const prompt = mockRun.mock.calls[0]![1] as string;
    expect(prompt).toMatch(/Risk profile/);
    expect(prompt).toMatch(/CV=25/);
    expect(prompt).toMatch(/Metabolic=18/);
  });

  it("notes missing pathology in the prompt when no uploads exist", async () => {
    await runSupplementProtocolPipeline("user-123");
    const prompt = mockRun.mock.calls[0]![1] as string;
    expect(prompt).toMatch(/none uploaded/i);
  });

  it("supersedes existing active supplement plans before inserting a new one", async () => {
    await runSupplementProtocolPipeline("user-123");
    expect(mockPlanSupersede).toHaveBeenCalledTimes(1);
    expect(mockPlanInsert).toHaveBeenCalledTimes(1);
    expect(
      mockPlanSupersede.mock.invocationCallOrder[0]!,
    ).toBeLessThan(mockPlanInsert.mock.invocationCallOrder[0]!);
  });

  it("inserts a new supplement_plan with status=active for the correct user", async () => {
    await runSupplementProtocolPipeline("user-abc");
    const insertArg = mockPlanInsert.mock.calls[0]![0] as {
      patient_uuid: string;
      status: string;
      created_by_role: string;
    };
    expect(insertArg.patient_uuid).toBe("user-abc");
    expect(insertArg.status).toBe("active");
    expect(insertArg.created_by_role).toBe("ai");
  });

  it("does not insert a supplement plan when agent.run throws (non-fatal failure)", async () => {
    mockRun.mockRejectedValueOnce(new Error("LLM timeout"));
    await expect(
      runSupplementProtocolPipeline("user-123"),
    ).resolves.toBeUndefined();
    expect(mockPlanInsert).not.toHaveBeenCalled();
  });

  it("includes upload summaries in the prompt when pathology uploads exist", async () => {
    mockUploadsQuery.mockResolvedValueOnce({
      data: [
        {
          original_filename: "thyroid-panel.pdf",
          janet_category: "pathology",
          janet_summary: "TSH 3.8 mIU/L — within normal range",
          janet_findings: null,
        },
      ],
      error: null,
    });
    await runSupplementProtocolPipeline("user-123");
    const prompt = mockRun.mock.calls[0]![1] as string;
    expect(prompt).toMatch(/thyroid-panel\.pdf/);
  });
});
