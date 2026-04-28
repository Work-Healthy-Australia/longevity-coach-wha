import { describe, expect, it } from "vitest";
import { formatRange } from "@/lib/labs/format-range";

describe("formatRange", () => {
  it("returns em-dash placeholder when both bounds are null", () => {
    expect(formatRange(null, null, "mg/dL")).toBe("—");
  });

  it("formats lower-bound-only as ≥", () => {
    expect(formatRange(70, null, "mg/dL")).toBe("≥ 70 mg/dL");
  });

  it("formats upper-bound-only as ≤", () => {
    expect(formatRange(null, 100, "mg/dL")).toBe("≤ 100 mg/dL");
  });

  it("uses an en-dash (U+2013) between min and max", () => {
    const out = formatRange(70, 100, "mg/dL");
    expect(out).toBe("70–100 mg/dL");
    // Belt-and-braces: literal en-dash, not ASCII hyphen.
    expect(out).toContain("–");
    expect(out).not.toContain("-");
  });
});
