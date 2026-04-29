import { describe, expect, it } from "vitest";

import {
  calculateOrgTotal,
  calculateTotal,
  centsToDollarsString,
} from "@/lib/pricing/calculate";

const indivPlan = { base_price_cents: 4900, annual_discount_pct: 20 };
const corpPlan = { base_price_cents: 19900, annual_discount_pct: 0 };

const addonA = { price_monthly_cents: 900, price_annual_cents: 9000 };
const addonB = { price_monthly_cents: 1500, price_annual_cents: 15000 };

describe("calculateTotal (standalone)", () => {
  it("monthly with no add-ons returns plan base price", () => {
    expect(calculateTotal(indivPlan, [], "month")).toBe(4900);
  });

  it("annual applies annual_discount_pct over 12 months", () => {
    // 4900 * 12 = 58_800; minus 20% = 47_040
    expect(calculateTotal(indivPlan, [], "year")).toBe(47040);
  });

  it("monthly add-ons sum into total", () => {
    expect(calculateTotal(indivPlan, [addonA, addonB], "month")).toBe(4900 + 900 + 1500);
  });

  it("annual add-ons use the annual price column directly", () => {
    expect(calculateTotal(indivPlan, [addonA, addonB], "year")).toBe(47040 + 9000 + 15000);
  });

  it("zero-discount plan annual = base × 12", () => {
    const free = { base_price_cents: 0, annual_discount_pct: 0 };
    expect(calculateTotal(free, [], "year")).toBe(0);
  });
});

describe("calculateOrgTotal (corporate, FLAT per D2)", () => {
  it("flat-priced: does NOT multiply by seat count", () => {
    expect(calculateOrgTotal(corpPlan, [], 1, "month")).toBe(19900);
    expect(calculateOrgTotal(corpPlan, [], 50, "month")).toBe(19900);
    expect(calculateOrgTotal(corpPlan, [], 9999, "month")).toBe(19900);
  });

  it("annual interval applies discount once, not per seat", () => {
    const plan = { base_price_cents: 19900, annual_discount_pct: 25 };
    // 19900 * 12 * 0.75 = 179_100
    expect(calculateOrgTotal(plan, [], 10, "year")).toBe(179100);
  });

  it("add-ons add flat (one item per add-on, not per seat) per D4", () => {
    expect(calculateOrgTotal(corpPlan, [addonA, addonB], 100, "month")).toBe(19900 + 900 + 1500);
  });
});

describe("centsToDollarsString", () => {
  it("formats whole dollars", () => {
    expect(centsToDollarsString(4900)).toBe("$49.00");
  });
  it("formats partial cents", () => {
    expect(centsToDollarsString(47040)).toBe("$470.40");
  });
  it("handles zero", () => {
    expect(centsToDollarsString(0)).toBe("$0.00");
  });
});
