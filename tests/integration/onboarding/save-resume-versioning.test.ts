// Reproduces the "is it actually saving?" user-review concern. Locks in three
// invariants the questionnaire MUST guarantee:
//
//   1. Every "Continue" press writes the latest responses to health_profiles
//      (insert on first save; update the same draft row thereafter).
//   2. Returning to /onboarding rehydrates from the saved draft (or, if no
//      draft, the latest completed assessment).
//   3. Re-submitting after a prior completion creates a NEW completed row;
//      the old completed row is preserved verbatim (audit / versioning).
//
// Uses a hand-rolled in-memory health_profiles store so we can assert the
// final DB state at the end of a multi-step flow rather than just the calls.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Row = {
  id: string;
  user_uuid: string;
  responses: Record<string, unknown>;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

let nextId = 1;
let store: Row[] = [];
let mockUserId: string | null = "user-123";
let profilesPatch: Record<string, unknown> = {};

function nowIso() {
  return new Date(2026, 3, 30, 8, nextId, 0).toISOString();
}

function makeBuilder(initialRows: Row[]) {
  const filters: Array<{ col: string; op: "eq" | "is_null" | "is_not_null"; val?: unknown }> = [];
  const orderings: Array<{ col: string; ascending: boolean }> = [];
  let limitN: number | null = null;

  const apply = () => {
    let rows = initialRows.slice();
    for (const f of filters) {
      if (f.op === "eq") rows = rows.filter((r) => (r as unknown as Record<string, unknown>)[f.col] === f.val);
      if (f.op === "is_null") rows = rows.filter((r) => (r as unknown as Record<string, unknown>)[f.col] == null);
      if (f.op === "is_not_null") rows = rows.filter((r) => (r as unknown as Record<string, unknown>)[f.col] != null);
    }
    for (const o of orderings) {
      rows = rows.slice().sort((a, b) => {
        const av = String((a as unknown as Record<string, unknown>)[o.col] ?? "");
        const bv = String((b as unknown as Record<string, unknown>)[o.col] ?? "");
        return o.ascending ? av.localeCompare(bv) : bv.localeCompare(av);
      });
    }
    if (limitN != null) rows = rows.slice(0, limitN);
    return rows;
  };

  const builder: Record<string, unknown> = {};
  builder.eq = (col: string, val: unknown) => {
    filters.push({ col, op: "eq", val });
    return builder;
  };
  builder.is = (col: string, val: unknown) => {
    if (val == null) filters.push({ col, op: "is_null" });
    return builder;
  };
  builder.not = (col: string, op: string, val: unknown) => {
    if (op === "is" && val == null) filters.push({ col, op: "is_not_null" });
    return builder;
  };
  builder.order = (col: string, opts: { ascending: boolean }) => {
    orderings.push({ col, ascending: opts.ascending });
    return builder;
  };
  builder.limit = (n: number) => {
    limitN = n;
    return builder;
  };
  builder.maybeSingle = async () => ({ data: apply()[0] ?? null, error: null });
  builder.single = async () => {
    const [r] = apply();
    return r ? { data: r, error: null } : { data: null, error: { message: "not found" } };
  };
  return builder;
}

function makeFrom(table: string) {
  if (table === "profiles") {
    return {
      update: (patch: Record<string, unknown>) => ({
        eq: (_col: string, _val: unknown) => {
          profilesPatch = { ...profilesPatch, ...patch };
          return Promise.resolve({ error: null });
        },
      }),
    };
  }
  if (table !== "health_profiles") throw new Error(`unexpected table ${table}`);
  return {
    select: (_cols: string) => makeBuilder(store),
    insert: (row: Partial<Row>) => {
      const id = `r${nextId++}`;
      const now = nowIso();
      const full: Row = {
        id,
        user_uuid: row.user_uuid ?? mockUserId!,
        responses: (row.responses as Record<string, unknown>) ?? {},
        completed_at: row.completed_at ?? null,
        created_at: now,
        updated_at: now,
      };
      store.push(full);
      return Promise.resolve({ error: null });
    },
    update: (patch: Record<string, unknown>) => ({
      eq: (col: string, val: unknown) => {
        for (const r of store) {
          if ((r as unknown as Record<string, unknown>)[col] === val) {
            Object.assign(r, patch, { updated_at: nowIso() });
          }
        }
        return Promise.resolve({ error: null });
      },
    }),
  };
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: async () => ({ data: { user: mockUserId ? { id: mockUserId } : null } }) },
    from: (table: string) => makeFrom(table),
  })),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    auth: { getUser: async () => ({ data: { user: { id: mockUserId } } }) },
    from: (table: string) => {
      if (table === "risk_scores") {
        return { upsert: async () => ({ error: null }) };
      }
      return makeFrom(table);
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    schema: () => ({ from: (t: string) => makeFrom(t) } as any),
  })),
}));

vi.mock("@/lib/risk", () => ({
  assemblePatientFromDB: async () => ({ patient_id: "x", demographics: { age: 35, sex: "male" } }),
  scoreRisk: () => ({
    biological_age: 35,
    composite_risk: 10,
    risk_level: "low",
    longevity_score: 95,
    longevity_label: "Excellent",
    score_confidence: "moderate",
    data_completeness: 0.5,
    next_recommended_tests: [],
    top_risks: [],
    trajectory_6month: {},
    domains: {
      cardiovascular: { score: 10, factors: [] },
      metabolic: { score: 10, factors: [] },
      neurodegenerative: { score: 10, factors: [] },
      oncological: { score: 10, factors: [] },
      musculoskeletal: { score: 10, factors: [] },
    },
  }),
}));

vi.mock("@/lib/ai/trigger", () => ({ triggerPipeline: vi.fn() }));

vi.mock("@/lib/consent/record", () => ({
  recordConsents: async () => ({ error: undefined }),
}));

import { saveDraft, submitAssessment } from "@/app/(app)/onboarding/actions";

beforeEach(() => {
  store = [];
  profilesPatch = {};
  nextId = 1;
  mockUserId = "user-123";
  // Pin the clock so submitAssessment's `new Date().toISOString()` is
  // deterministic across calls; advance manually between operations.
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-04-30T08:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

// Helper: simulates the page.tsx hydration query.
async function rehydrate(userId: string) {
  const drafts = store
    .filter((r) => r.user_uuid === userId && r.completed_at == null)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  if (drafts[0]) return { source: "draft" as const, responses: drafts[0].responses, isEditing: false };
  const completed = store
    .filter((r) => r.user_uuid === userId && r.completed_at != null)
    .sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""));
  if (completed[0]) return { source: "completed" as const, responses: completed[0].responses, isEditing: true };
  return { source: "empty" as const, responses: {}, isEditing: false };
}

describe("onboarding save flow — three guarantees", () => {
  it("Guarantee 1: each Continue writes the latest responses (insert then update same draft)", async () => {
    // Step 1
    expect((await saveDraft({ basics: { sex: "Male" } })).ok).toBe(true);
    expect(store).toHaveLength(1);
    expect(store[0]!.completed_at).toBeNull();
    expect((store[0]!.responses as Record<string, Record<string, unknown>>).basics!.sex).toBe("Male");

    // Step 2 — adds a new step's worth of data, MUST hit the same row
    expect((await saveDraft({
      basics: { sex: "Male" },
      medical: { conditions: ["None"] },
    })).ok).toBe(true);
    expect(store).toHaveLength(1);
    expect((store[0]!.responses as Record<string, Record<string, unknown>>).medical!.conditions).toEqual(["None"]);

    // Step 3
    expect((await saveDraft({
      basics: { sex: "Male" },
      medical: { conditions: ["None"] },
      lifestyle: { smoking_status: "never" },
    })).ok).toBe(true);
    expect(store).toHaveLength(1);
    expect((store[0]!.responses as Record<string, Record<string, unknown>>).lifestyle!.smoking_status).toBe("never");
  });

  it("Guarantee 2: returning to /onboarding rehydrates the most recent draft", async () => {
    await saveDraft({ basics: { sex: "Female", height_cm: 165 } });
    await saveDraft({
      basics: { sex: "Female", height_cm: 165 },
      medical: { conditions: ["Hypothyroidism"] },
    });

    const hyd = await rehydrate("user-123");
    expect(hyd.source).toBe("draft");
    expect(hyd.isEditing).toBe(false);
    expect((hyd.responses as Record<string, Record<string, unknown>>).basics!.height_cm).toBe(165);
    expect((hyd.responses as Record<string, Record<string, unknown>>).medical!.conditions).toEqual(["Hypothyroidism"]);
  });

  it("Guarantee 2b: returning AFTER submission hydrates from the latest completed row in editing mode", async () => {
    await saveDraft({ basics: { sex: "Male" } });
    try {
      await submitAssessment({ basics: { sex: "Male" }, lifestyle: { smoking_status: "never" } });
    } catch (err) {
      // submitAssessment redirects on success — this is expected
      expect((err as Error).message).toContain("NEXT_REDIRECT");
    }

    const hyd = await rehydrate("user-123");
    expect(hyd.source).toBe("completed");
    expect(hyd.isEditing).toBe(true);
    expect((hyd.responses as Record<string, Record<string, unknown>>).lifestyle!.smoking_status).toBe("never");
  });

  it("Guarantee 3: re-submitting after a prior completion creates a NEW completed row; old row preserved", async () => {
    // First completion
    await saveDraft({ basics: { sex: "Male", height_cm: 180 } });
    try {
      await submitAssessment({
        basics: { sex: "Male", height_cm: 180 },
        lifestyle: { smoking_status: "never" },
      });
    } catch {
      // expected redirect
    }
    expect(store).toHaveLength(1);
    const firstCompletedAt = store[0]!.completed_at;
    const firstResponses = JSON.parse(JSON.stringify(store[0]!.responses));
    expect(firstCompletedAt).not.toBeNull();
    expect((firstResponses as Record<string, Record<string, unknown>>).lifestyle!.smoking_status).toBe("never");

    // Simulate user returning some time later
    vi.advanceTimersByTime(60_000);

    // User returns and edits — clicks Continue once (creates a fresh draft)
    await saveDraft({
      basics: { sex: "Male", height_cm: 180 },
      lifestyle: { smoking_status: "former" },
    });
    expect(store).toHaveLength(2);
    expect(store[1]!.completed_at).toBeNull();

    vi.advanceTimersByTime(60_000);

    // Then submits again
    try {
      await submitAssessment({
        basics: { sex: "Male", height_cm: 180 },
        lifestyle: { smoking_status: "former" },
      });
    } catch {
      // expected redirect
    }

    // INVARIANT: two completed rows now exist, both for same user, with distinct timestamps
    const completed = store.filter((r) => r.user_uuid === "user-123" && r.completed_at != null);
    expect(completed).toHaveLength(2);

    // Old row must be preserved with its original responses
    const old = completed.find((r) => r.completed_at === firstCompletedAt);
    expect(old).toBeDefined();
    expect(JSON.parse(JSON.stringify(old!.responses))).toEqual(firstResponses);

    // New row reflects the edit
    const fresh = completed.find((r) => r.completed_at !== firstCompletedAt);
    expect(fresh).toBeDefined();
    expect((fresh!.responses as Record<string, Record<string, unknown>>).lifestyle!.smoking_status).toBe("former");
  });

  it("Guarantee 3b: re-submitting WITHOUT a Continue press still creates a NEW completed row", async () => {
    // First completion
    try {
      await submitAssessment({ basics: { sex: "Male" } });
    } catch {
      // expected redirect
    }
    expect(store.filter((r) => r.completed_at != null)).toHaveLength(1);

    vi.advanceTimersByTime(60_000);

    // Returns and submits directly without ever pressing Continue
    try {
      await submitAssessment({ basics: { sex: "Male" }, lifestyle: { smoking_status: "current" } });
    } catch {
      // expected redirect
    }

    const completed = store.filter((r) => r.user_uuid === "user-123" && r.completed_at != null);
    expect(completed).toHaveLength(2);
  });
});
