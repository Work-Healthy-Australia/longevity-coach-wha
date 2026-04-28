import { describe, expect, it } from "vitest";
import {
  computeMrr,
  countActiveMembers,
  countChurn30d,
  countNewSignups,
  countPipelineRuns24h,
  countUploads24h,
  formatMrr,
  parseRange,
} from "@/lib/admin/metrics";

const NOW = new Date("2026-04-28T12:00:00Z");

const daysAgo = (n: number): string =>
  new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString();

describe("computeMrr", () => {
  it("returns 0 for an empty subscriptions array", () => {
    expect(computeMrr([])).toBe(0);
  });

  it("sums monthly + annual: $20/mo + $200/yr = $36/mo (3600 cents)", () => {
    const subs = [
      { unit_amount: 2000, interval: "month" as const, status: "active" },
      { unit_amount: 20000, interval: "year" as const, status: "active" },
    ];
    // 2000 + 20000/12 = 2000 + 1666.66... ≈ 3667 cents
    expect(computeMrr(subs)).toBe(3667);
  });

  it("excludes canceled subs from MRR", () => {
    const subs = [
      { unit_amount: 2000, interval: "month" as const, status: "canceled" },
      { unit_amount: 5000, interval: "month" as const, status: "active" },
    ];
    expect(computeMrr(subs)).toBe(5000);
  });

  it("includes trialing and past_due in MRR", () => {
    const subs = [
      { unit_amount: 1000, interval: "month" as const, status: "trialing" },
      { unit_amount: 1000, interval: "month" as const, status: "past_due" },
    ];
    expect(computeMrr(subs)).toBe(2000);
  });
});

describe("countActiveMembers", () => {
  it("excludes canceled and incomplete statuses", () => {
    const subs = [
      { user_uuid: "a", status: "active" },
      { user_uuid: "b", status: "trialing" },
      { user_uuid: "c", status: "canceled" },
      { user_uuid: "d", status: "incomplete" },
      { user_uuid: "e", status: "past_due" },
    ];
    expect(countActiveMembers(subs)).toBe(3);
  });

  it("counts a user once even if they have multiple active rows", () => {
    const subs = [
      { user_uuid: "a", status: "active" },
      { user_uuid: "a", status: "trialing" },
    ];
    expect(countActiveMembers(subs)).toBe(1);
  });
});

describe("countChurn30d", () => {
  it("excludes cancellations older than 30 days", () => {
    const subs = [
      { status: "canceled", ended_at: daysAgo(5) },
      { status: "canceled", ended_at: daysAgo(45) },
      { status: "canceled", ended_at: daysAgo(29) },
    ];
    expect(countChurn30d(subs, NOW)).toBe(2);
  });

  it("ignores non-cancelled rows and null ended_at", () => {
    const subs = [
      { status: "active", ended_at: daysAgo(1) },
      { status: "canceled", ended_at: null },
      { status: "canceled", ended_at: daysAgo(1) },
    ];
    expect(countChurn30d(subs, NOW)).toBe(1);
  });
});

describe("countPipelineRuns24h", () => {
  it("only counts rows with computed_at within 24h", () => {
    const rows = [
      { computed_at: new Date(NOW.getTime() - 1 * 60 * 60 * 1000).toISOString() }, // 1h ago
      { computed_at: new Date(NOW.getTime() - 23 * 60 * 60 * 1000).toISOString() }, // 23h ago
      { computed_at: new Date(NOW.getTime() - 25 * 60 * 60 * 1000).toISOString() }, // 25h ago
      { computed_at: daysAgo(3) },
    ];
    expect(countPipelineRuns24h(rows, NOW)).toBe(2);
  });
});

describe("countUploads24h", () => {
  it("only counts uploads within the last 24h", () => {
    const rows = [
      { created_at: new Date(NOW.getTime() - 60 * 60 * 1000).toISOString() },
      { created_at: daysAgo(2) },
    ];
    expect(countUploads24h(rows, NOW)).toBe(1);
  });
});

describe("countNewSignups", () => {
  it("returns total when range is 'all'", () => {
    const profiles = [
      { created_at: daysAgo(1) },
      { created_at: daysAgo(120) },
    ];
    expect(countNewSignups(profiles, "all", NOW)).toBe(2);
  });

  it("filters to the 7d window", () => {
    const profiles = [
      { created_at: daysAgo(1) },
      { created_at: daysAgo(8) },
      { created_at: daysAgo(3) },
    ];
    expect(countNewSignups(profiles, "7d", NOW)).toBe(2);
  });
});

describe("parseRange", () => {
  it("defaults to 30d for missing or invalid values", () => {
    expect(parseRange(undefined)).toBe("30d");
    expect(parseRange("nonsense")).toBe("30d");
  });

  it("accepts valid options", () => {
    expect(parseRange("7d")).toBe("7d");
    expect(parseRange("quarter")).toBe("quarter");
    expect(parseRange("all")).toBe("all");
  });
});

describe("formatMrr", () => {
  it("formats cents as dollars per month", () => {
    expect(formatMrr(123400)).toBe("$1,234/mo");
    expect(formatMrr(0)).toBe("$0/mo");
  });
});
