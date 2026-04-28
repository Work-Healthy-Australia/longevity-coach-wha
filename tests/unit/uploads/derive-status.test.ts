import { describe, it, expect } from "vitest";
import { deriveStatus } from "@/lib/uploads/persist-lab-results";

describe("deriveStatus", () => {
  it("returns null when both bounds are missing", () => {
    expect(deriveStatus(100, null, null)).toBeNull();
  });

  it("returns null when only one bound is present", () => {
    expect(deriveStatus(100, null, 200)).toBeNull();
    expect(deriveStatus(100, 70, null)).toBeNull();
  });

  it("returns 'low' when value is below reference_min but not critical", () => {
    expect(deriveStatus(50, 70, 200)).toBe("low");
  });

  it("returns 'high' when value exceeds reference_max but not critical", () => {
    expect(deriveStatus(250, 70, 200)).toBe("high");
  });

  it("returns 'critical' when value exceeds 1.5x reference_max", () => {
    expect(deriveStatus(400, 70, 200)).toBe("critical");
  });

  it("returns 'critical' when value is below 0.5x reference_min", () => {
    expect(deriveStatus(20, 70, 200)).toBe("critical");
  });

  it("returns 'optimal' for in-range values", () => {
    expect(deriveStatus(100, 70, 200)).toBe("optimal");
  });

  it("returns null for zero/negative range (sanity)", () => {
    expect(deriveStatus(100, 0, 0)).toBeNull();
    expect(deriveStatus(100, -1, 50)).toBeNull();
  });

  it("treats value === reference_max as 'optimal' (boundary inclusive)", () => {
    expect(deriveStatus(200, 70, 200)).toBe("optimal");
  });

  it("treats value === reference_min as 'optimal' (boundary inclusive)", () => {
    expect(deriveStatus(70, 70, 200)).toBe("optimal");
  });

  it("returns null for swapped bounds (min > max)", () => {
    expect(deriveStatus(100, 200, 70)).toBeNull();
  });
});
