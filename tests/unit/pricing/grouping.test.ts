import { describe, expect, it } from "vitest";
import { TIER_RANK, planKey } from "@/lib/pricing/grouping";

describe("TIER_RANK", () => {
  it("orders core < clinical < elite", () => {
    expect(TIER_RANK.core).toBe(0);
    expect(TIER_RANK.clinical).toBe(1);
    expect(TIER_RANK.elite).toBe(2);
    expect(TIER_RANK.core).toBeLessThan(TIER_RANK.clinical);
    expect(TIER_RANK.clinical).toBeLessThan(TIER_RANK.elite);
  });
});

describe("planKey", () => {
  it("returns tier::name for a plain name", () => {
    expect(planKey({ tier: "core", name: "Core" })).toBe("core::Core");
  });

  it("strips trailing ' Annual' so monthly+annual rows share a key", () => {
    expect(planKey({ tier: "core", name: "Core" })).toBe("core::Core");
    expect(planKey({ tier: "core", name: "Core Annual" })).toBe("core::Core");
  });

  it("strips trailing ' Monthly'", () => {
    expect(planKey({ tier: "clinical", name: "Clinical Monthly" })).toBe("clinical::Clinical");
  });

  it("is case-insensitive on the suffix", () => {
    expect(planKey({ tier: "elite", name: "Elite ANNUAL" })).toBe("elite::Elite");
    expect(planKey({ tier: "elite", name: "Elite monthly" })).toBe("elite::Elite");
  });

  it("trims trailing whitespace after stripping the suffix", () => {
    expect(planKey({ tier: "core", name: "Core   Annual" })).toBe("core::Core");
  });
});

describe("grouping integration — 6 seed rows produce 3 groups in tier order", () => {
  type Row = { tier: "core" | "clinical" | "elite"; name: string; billing_interval: "month" | "year" };

  const rows: Row[] = [
    { tier: "elite", name: "Elite", billing_interval: "year" },
    { tier: "core", name: "Core", billing_interval: "month" },
    { tier: "clinical", name: "Clinical", billing_interval: "year" },
    { tier: "elite", name: "Elite", billing_interval: "month" },
    { tier: "core", name: "Core", billing_interval: "year" },
    { tier: "clinical", name: "Clinical", billing_interval: "month" },
  ];

  it("collapses to 3 unique keys", () => {
    const keys = new Set(rows.map((r) => planKey(r)));
    expect(keys.size).toBe(3);
    expect([...keys].sort()).toEqual(["clinical::Clinical", "core::Core", "elite::Elite"]);
  });

  it("sorts by TIER_RANK ascending", () => {
    const groups = Array.from(new Set(rows.map((r) => r.tier)));
    const sorted = groups.sort((a, b) => TIER_RANK[a] - TIER_RANK[b]);
    expect(sorted).toEqual(["core", "clinical", "elite"]);
  });
});
