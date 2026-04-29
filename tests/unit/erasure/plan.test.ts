import { describe, expect, it } from "vitest";
import {
  ERASURE_PLAN,
  summariseCounts,
  type ErasurePlanEntry,
} from "@/lib/erasure/plan";

describe("ERASURE_PLAN", () => {
  it("contains exactly 24 entries", () => {
    expect(ERASURE_PLAN).toHaveLength(24);
  });

  it("has unique (schema, table) pairs", () => {
    const keys = ERASURE_PLAN.map((e) => `${e.schema}.${e.table}`);
    const unique = new Set(keys);
    expect(unique.size).toBe(keys.length);
  });

  it("never sets scrubFields on a `delete` entry", () => {
    const deletes = ERASURE_PLAN.filter((e) => e.strategy === "delete");
    expect(deletes.length).toBeGreaterThan(0);
    for (const entry of deletes) {
      expect(
        entry.scrubFields,
        `${entry.schema}.${entry.table} is delete but has scrubFields`,
      ).toBeUndefined();
    }
  });

  it("always defines scrubFields on `scrub` and `retain_anonymised` entries", () => {
    const nonDelete = ERASURE_PLAN.filter((e) => e.strategy !== "delete");
    expect(nonDelete.length).toBeGreaterThan(0);
    for (const entry of nonDelete) {
      expect(
        entry.scrubFields,
        `${entry.schema}.${entry.table} (${entry.strategy}) is missing scrubFields`,
      ).toBeDefined();
      // Must be an array (may be empty for patient_assignments).
      expect(Array.isArray(entry.scrubFields)).toBe(true);
    }
  });

  it("treats audit-trail tables as retain_anonymised, never delete", () => {
    // Hard-coded list — flipping any of these to `delete` in a future plan
    // change would silently destroy AHPRA / GDPR audit trails. Lock it.
    const auditTables: Array<{ schema: string; table: string }> = [
      { schema: "public", table: "consent_records" },
      { schema: "public", table: "export_log" },
      { schema: "public", table: "care_notes" },
      { schema: "public", table: "periodic_reviews" },
      { schema: "public", table: "patient_assignments" },
    ];

    for (const { schema, table } of auditTables) {
      const entry = ERASURE_PLAN.find(
        (e) => e.schema === schema && e.table === table,
      );
      expect(
        entry,
        `audit-trail table ${schema}.${table} missing from ERASURE_PLAN`,
      ).toBeDefined();
      expect(
        (entry as ErasurePlanEntry).strategy,
        `audit-trail table ${schema}.${table} must be retain_anonymised`,
      ).toBe("retain_anonymised");
    }
  });

  it("uses `id` as the user column for the profiles entry", () => {
    const profiles = ERASURE_PLAN.find(
      (e) => e.schema === "public" && e.table === "profiles",
    );
    expect(profiles).toBeDefined();
    expect(profiles!.userColumn).toBe("id");
  });

  it("never uses mode='null' on a column known to be NOT NULL", () => {
    // Hard-coded against the migrations. If you add a new scrub field whose
    // column is NOT NULL in the DB, you MUST use 'erased_sentinel' (text) or
    // 'empty_jsonb' (jsonb), never 'null' — Postgres will reject the UPDATE.
    const notNullColumns: Array<{
      schema: string;
      table: string;
      column: string;
    }> = [
      { schema: "public", table: "support_tickets", column: "summary" },
      { schema: "public", table: "care_notes", column: "content" },
      { schema: "public", table: "journal_entries", column: "body" },
      { schema: "public", table: "agent_conversations", column: "content" },
    ];

    for (const { schema, table, column } of notNullColumns) {
      const entry = ERASURE_PLAN.find(
        (e) => e.schema === schema && e.table === table,
      );
      const field = entry?.scrubFields?.find((f) => f.column === column);
      if (field) {
        expect(
          field.mode,
          `${schema}.${table}.${column} is NOT NULL — mode must not be 'null'`,
        ).not.toBe("null");
      }
    }
  });
});

describe("summariseCounts", () => {
  it("sums duplicates and omits zero-count tables", () => {
    const result = summariseCounts([
      { table: "a", count: 3 },
      { table: "a", count: 2 },
      { table: "b", count: 0 },
      { table: "c", count: 5 },
    ]);
    expect(result).toEqual({ a: 5, c: 5 });
  });

  it("returns an empty object for empty input", () => {
    expect(summariseCounts([])).toEqual({});
  });

  it("returns an empty object when every input count is zero", () => {
    expect(
      summariseCounts([
        { table: "a", count: 0 },
        { table: "b", count: 0 },
      ]),
    ).toEqual({});
  });
});
