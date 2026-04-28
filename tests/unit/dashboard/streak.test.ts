import { describe, expect, it } from "vitest";
import { computeStreak } from "@/app/(app)/dashboard/page";

// Anchor "now" at noon UTC on a specific date so tests are deterministic
// regardless of the host machine's timezone.
const NOW = new Date("2026-04-28T12:00:00Z");

describe("computeStreak", () => {
  it("returns 0 for no logs", () => {
    expect(computeStreak([], NOW)).toBe(0);
  });

  it("counts a single log on today", () => {
    expect(computeStreak(["2026-04-28"], NOW)).toBe(1);
  });

  it("counts consecutive days ending today", () => {
    expect(
      computeStreak(["2026-04-28", "2026-04-27", "2026-04-26"], NOW),
    ).toBe(3);
  });

  it("counts streak ending yesterday (preserves grace day)", () => {
    expect(computeStreak(["2026-04-27", "2026-04-26"], NOW)).toBe(2);
  });

  it("returns 0 if the most recent log is two days ago", () => {
    expect(computeStreak(["2026-04-26", "2026-04-25"], NOW)).toBe(0);
  });

  it("breaks the streak on a gap", () => {
    expect(
      computeStreak(["2026-04-28", "2026-04-27", "2026-04-25"], NOW),
    ).toBe(2);
  });

  it("dedupes duplicate dates", () => {
    expect(
      computeStreak(["2026-04-28", "2026-04-28", "2026-04-27"], NOW),
    ).toBe(2);
  });

  it("handles month boundary correctly", () => {
    const apr1 = new Date("2026-04-01T12:00:00Z");
    expect(
      computeStreak(["2026-04-01", "2026-03-31", "2026-03-30"], apr1),
    ).toBe(3);
  });

  it("handles year boundary correctly", () => {
    const jan1 = new Date("2026-01-01T12:00:00Z");
    expect(
      computeStreak(["2026-01-01", "2025-12-31", "2025-12-30"], jan1),
    ).toBe(3);
  });

  it("ignores logs after today (clock-skew defence)", () => {
    expect(
      computeStreak(["2026-04-29", "2026-04-28", "2026-04-27"], NOW),
    ).toBe(2);
  });
});
