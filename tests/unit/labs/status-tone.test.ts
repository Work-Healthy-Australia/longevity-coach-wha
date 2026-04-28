import { describe, expect, it } from "vitest";
import { STATUS_LABELS, statusTone } from "@/lib/labs/status-tone";

describe("statusTone", () => {
  it("maps 'low' to low", () => {
    expect(statusTone("low")).toBe("low");
  });

  it("maps 'optimal' to optimal", () => {
    expect(statusTone("optimal")).toBe("optimal");
  });

  it("maps 'borderline' to borderline", () => {
    expect(statusTone("borderline")).toBe("borderline");
  });

  it("maps 'high' to high", () => {
    expect(statusTone("high")).toBe("high");
  });

  it("maps 'critical' to critical", () => {
    expect(statusTone("critical")).toBe("critical");
  });

  it("maps null to unknown", () => {
    expect(statusTone(null)).toBe("unknown");
  });

  it("maps unrecognised garbage strings to unknown", () => {
    expect(statusTone("banana")).toBe("unknown");
  });

  it("exposes a non-empty display label for every tone", () => {
    for (const tone of [
      "low",
      "optimal",
      "borderline",
      "high",
      "critical",
      "unknown",
    ] as const) {
      expect(STATUS_LABELS[tone]).toBeTruthy();
    }
  });
});
