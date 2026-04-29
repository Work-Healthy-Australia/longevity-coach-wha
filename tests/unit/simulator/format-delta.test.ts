import { describe, it, expect } from "vitest";
import { formatDelta } from "@/lib/simulator/format-delta";

describe("formatDelta", () => {
  it("renders a decrease with an en-dash minus (U+2212)", () => {
    const out = formatDelta(45, 38);
    expect(out).toBe("45 → 38 (−7)");
    // Direct literal check: must NOT use ASCII hyphen-minus (U+002D).
    expect(out).toBe("45 → 38 (−7)");
    expect(out.includes("-")).toBe(false);
    expect(out.includes("−")).toBe(true);
  });

  it("renders an increase with a plus sign", () => {
    expect(formatDelta(45, 50)).toBe("45 → 50 (+5)");
  });

  it("renders zero delta with no sign", () => {
    expect(formatDelta(45, 45)).toBe("45 → 45 (0)");
  });

  it("rounds floats to integers before formatting", () => {
    expect(formatDelta(45.7, 38.2)).toBe("46 → 38 (−8)");
  });
});
