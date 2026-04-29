import { describe, expect, it } from "vitest";
import { calculateStreak } from "@/lib/streaks";

// Anchor all tests to a fixed date so they're deterministic.
const TODAY = "2026-04-29";

describe("calculateStreak — rest-day mechanic", () => {
  it("returns 0 for empty log list", () => {
    const result = calculateStreak([], TODAY);
    expect(result.currentStreak).toBe(0);
    expect(result.longestStreak).toBe(0);
  });

  it("active days build the streak", () => {
    const result = calculateStreak(
      ["2026-04-29", "2026-04-28", "2026-04-27"],
      TODAY,
    );
    expect(result.currentStreak).toBe(3);
    expect(result.longestStreak).toBe(3);
  });

  it("1 consecutive missed day is treated as rest — streak continues", () => {
    // Gap on 2026-04-28 (1 day), then active on 2026-04-27
    const result = calculateStreak(
      ["2026-04-29", "2026-04-27"],
      TODAY,
    );
    expect(result.currentStreak).toBe(2);
    // The gap day should be marked rest
    const gapDay = result.days.find((d) => d.date === "2026-04-28");
    expect(gapDay?.state).toBe("rest");
  });

  it("2 consecutive missed days are treated as rest — streak continues", () => {
    // Gaps on 2026-04-28 and 2026-04-27, active on 2026-04-26
    const result = calculateStreak(
      ["2026-04-29", "2026-04-26"],
      TODAY,
    );
    expect(result.currentStreak).toBe(2);
    expect(result.days.find((d) => d.date === "2026-04-28")?.state).toBe("rest");
    expect(result.days.find((d) => d.date === "2026-04-27")?.state).toBe("rest");
  });

  it("3 consecutive missed days break the streak", () => {
    // Gaps on 2026-04-28, 2026-04-27, 2026-04-26 → streak resets after today
    const result = calculateStreak(
      ["2026-04-29", "2026-04-25"],
      TODAY,
    );
    // currentStreak: only the single active day today (1), because the run
    // breaks after 3 missed days before 2026-04-25 is reached
    expect(result.currentStreak).toBe(1);
    // The third missed day should be flagged as missed
    expect(result.days.find((d) => d.date === "2026-04-26")?.state).toBe("missed");
  });

  it("streak is 0 when today is not logged and there are 3+ consecutive missed days", () => {
    const result = calculateStreak(
      ["2026-04-25", "2026-04-24"],
      TODAY,
    );
    expect(result.currentStreak).toBe(0);
  });

  it("longestStreak tracks the maximum unbroken active-day run in the window", () => {
    // Run of 3 ending today, with a broken run of 2 further back
    const result = calculateStreak(
      [
        "2026-04-29",
        "2026-04-28",
        "2026-04-27",
        // 3-day gap breaks the earlier run
        "2026-04-22",
        "2026-04-21",
      ],
      TODAY,
    );
    expect(result.currentStreak).toBe(3);
    expect(result.longestStreak).toBe(3);
  });

  it("days array is returned oldest-first", () => {
    const result = calculateStreak(["2026-04-29"], TODAY, 7);
    expect(result.days[0].date < result.days[result.days.length - 1].date).toBe(
      true,
    );
    expect(result.days[result.days.length - 1].date).toBe(TODAY);
  });

  it("windowDays controls the number of entries returned", () => {
    const result = calculateStreak(["2026-04-29"], TODAY, 7);
    expect(result.days).toHaveLength(7);
  });
});
