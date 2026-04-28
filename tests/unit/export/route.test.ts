import { describe, it, expect } from "vitest";
import {
  buildExportPayload,
  buildManifest,
  ROW_CAP,
  type ExportPayload,
} from "@/app/api/export/route";

// Minimal Supabase mock — chainable thenable that resolves to { data }.
type Canned = {
  profiles?: Record<string, unknown> | null;
  health_profiles?: Record<string, unknown>[];
  risk_scores?: Record<string, unknown>[];
  supplement_plans?: Record<string, unknown>[];
  lab_results?: Record<string, unknown>[];
  daily_logs?: Record<string, unknown>[];
  consent_records?: Record<string, unknown>[];
};

function makeMockClient(canned: Canned, currentSchema = "public") {
  const builder = (table: string, schema: string) => {
    const result = (() => {
      if (schema === "biomarkers" && table === "lab_results")
        return canned.lab_results ?? [];
      if (schema === "biomarkers" && table === "daily_logs")
        return canned.daily_logs ?? [];
      if (table === "profiles") return canned.profiles ?? null;
      if (table === "health_profiles") return canned.health_profiles ?? [];
      if (table === "risk_scores") return canned.risk_scores ?? [];
      if (table === "supplement_plans") return canned.supplement_plans ?? [];
      if (table === "consent_records") return canned.consent_records ?? [];
      return [];
    })();

    const chain: Record<string, unknown> = {};
    chain.select = () => chain;
    chain.eq = () => chain;
    chain.order = () => chain;
    chain.limit = () => chain;
    chain.maybeSingle = () => Promise.resolve({ data: result });
    chain.then = (
      onFulfilled: (v: { data: unknown }) => unknown,
      onRejected?: (e: unknown) => unknown,
    ) => Promise.resolve({ data: result }).then(onFulfilled, onRejected);
    return chain;
  };

  const client = {
    from: (table: string) => builder(table, currentSchema),
    schema: (s: string) => makeMockClient(canned, s),
  };
  return client;
}

describe("buildExportPayload", () => {
  it("returns object with all expected top-level keys", async () => {
    const client = makeMockClient({
      profiles: { id: "u1", full_name: "Test User" },
      health_profiles: [{ id: "h1" }],
      risk_scores: [{ id: "r1" }],
      supplement_plans: [{ id: "p1", status: "active" }],
      lab_results: [{ id: "l1" }],
      daily_logs: [{ id: "d1" }],
      consent_records: [{ id: "c1" }],
    });

    const payload = await buildExportPayload(client, "u1");

    expect(Object.keys(payload).sort()).toEqual(
      [
        "consent_records",
        "daily_logs",
        "health_profiles",
        "lab_results",
        "profile",
        "risk_scores",
        "supplement_plans",
      ].sort(),
    );
    expect(payload.profile).toMatchObject({ id: "u1" });
    expect(payload.health_profiles).toHaveLength(1);
    expect(payload.lab_results).toHaveLength(1);
    expect(payload.daily_logs).toHaveLength(1);
  });
});

describe("buildManifest", () => {
  const baseEmpty: ExportPayload = {
    profile: null,
    health_profiles: [],
    risk_scores: [],
    supplement_plans: [],
    lab_results: [],
    daily_logs: [],
    consent_records: [],
  };

  it("truncates user UUID to first 8 chars", () => {
    const userId = "12345678-aaaa-bbbb-cccc-dddddddddddd";
    const m = buildManifest(baseEmpty, userId, "2026-04-28T00:00:00.000Z");
    expect(m.user_uuid_prefix).toBe("12345678");
    expect(m.user_uuid_prefix).toHaveLength(8);
    // Full UUID must NOT appear anywhere in the manifest.
    expect(JSON.stringify(m)).not.toContain(userId);
  });

  it("flags truncated: true for tables that hit the row cap", () => {
    const cappedRows = Array.from({ length: ROW_CAP }, (_, i) => ({ id: i }));
    const payload: ExportPayload = {
      ...baseEmpty,
      daily_logs: cappedRows,
      lab_results: [{ id: 1 }],
    };
    const m = buildManifest(payload, "uuuuuuuu-1111-2222-3333-444444444444", "2026-04-28T00:00:00.000Z");
    expect(m.tables.daily_logs.rows).toBe(ROW_CAP);
    expect(m.tables.daily_logs.truncated).toBe(true);
    expect(m.tables.lab_results.truncated).toBe(false);
    expect(m.tables.health_profiles.truncated).toBe(false);
  });

  it("includes archive_version 1 and exported_at ISO timestamp", () => {
    const ts = "2026-04-28T13:30:00.000Z";
    const m = buildManifest(baseEmpty, "abcdefgh-0000-0000-0000-000000000000", ts);
    expect(m.archive_version).toBe(1);
    expect(m.exported_at).toBe(ts);
  });
});
