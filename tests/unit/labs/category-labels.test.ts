import { describe, expect, it } from "vitest";
import { CATEGORY_LABELS, categoryLabel } from "@/lib/labs/category-labels";

const KNOWN_CATEGORIES = [
  "metabolic",
  "cardiovascular",
  "hormonal",
  "inflammatory",
  "haematology",
  "vitamins",
  "kidney",
  "liver",
  "thyroid",
  "other",
] as const;

describe("CATEGORY_LABELS", () => {
  it("has a non-empty display label for every known DB category", () => {
    for (const key of KNOWN_CATEGORIES) {
      expect(CATEGORY_LABELS[key]).toBeTruthy();
      expect(CATEGORY_LABELS[key].length).toBeGreaterThan(0);
    }
  });

  it("returns 'Other' for null", () => {
    expect(categoryLabel(null)).toBe("Other");
  });

  it("returns 'Other' for an unrecognised category", () => {
    expect(categoryLabel("genomic")).toBe("Other");
  });

  it("returns the mapped label for a known category", () => {
    expect(categoryLabel("cardiovascular")).toBe("Cardiovascular");
    expect(categoryLabel("haematology")).toBe("Haematology");
  });
});
