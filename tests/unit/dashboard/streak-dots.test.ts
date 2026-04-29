import { describe, expect, it } from "vitest";
import { streakDots } from "@/app/(app)/dashboard/page";

const NOW = new Date("2026-04-28T12:00:00Z");

describe("streakDots", () => {
  it("returns 7 entries with all unfilled when log set is empty", () => {
    const dots = streakDots(new Set<string>(), NOW);
    expect(dots).toHaveLength(7);
    expect(dots.every((d) => d.filled === false)).toBe(true);
    expect(dots[6].isToday).toBe(true);
    expect(dots.slice(0, 6).every((d) => d.isToday === false)).toBe(true);
  });

  it("marks today filled when today is logged", () => {
    const dots = streakDots(new Set(["2026-04-28"]), NOW);
    expect(dots[6].filled).toBe(true);
    expect(dots[6].isToday).toBe(true);
    expect(dots[6].date).toBe("2026-04-28");
    expect(dots.slice(0, 6).every((d) => d.filled === false)).toBe(true);
  });

  it("marks last two filled when today and yesterday logged", () => {
    const dots = streakDots(new Set(["2026-04-28", "2026-04-27"]), NOW);
    expect(dots[6].filled).toBe(true);
    expect(dots[5].filled).toBe(true);
    expect(dots[5].date).toBe("2026-04-27");
    expect(dots.slice(0, 5).every((d) => d.filled === false)).toBe(true);
  });

  it("uses UTC date even when clock is past noon UTC", () => {
    const skewed = new Date("2026-04-28T13:30:00Z");
    const dots = streakDots(new Set<string>(), skewed);
    expect(dots[6].date).toBe("2026-04-28");
    expect(dots[0].date).toBe("2026-04-22");
  });

  it("returns dates in oldest -> newest order", () => {
    const dots = streakDots(new Set<string>(), NOW);
    const dates = dots.map((d) => d.date);
    expect(dates).toEqual([
      "2026-04-22",
      "2026-04-23",
      "2026-04-24",
      "2026-04-25",
      "2026-04-26",
      "2026-04-27",
      "2026-04-28",
    ]);
  });

  it("spans a Sunday->Monday week boundary without off-by-one", () => {
    // 2026-04-27 is a Monday, 2026-04-26 is a Sunday.
    // A 7-day window ending Monday must contain the prior Sunday and Saturday.
    const monday = new Date("2026-04-27T12:00:00Z");
    const dots = streakDots(
      new Set(["2026-04-26", "2026-04-25", "2026-04-27"]),
      monday,
    );
    expect(dots).toHaveLength(7);
    expect(dots.map((d) => d.date)).toEqual([
      "2026-04-21",
      "2026-04-22",
      "2026-04-23",
      "2026-04-24",
      "2026-04-25",
      "2026-04-26",
      "2026-04-27",
    ]);
    // The three logged days are filled, others empty.
    expect(dots[6].filled).toBe(true); // Mon 2026-04-27
    expect(dots[5].filled).toBe(true); // Sun 2026-04-26
    expect(dots[4].filled).toBe(true); // Sat 2026-04-25
    expect(dots.slice(0, 4).every((d) => d.filled === false)).toBe(true);
    expect(dots[6].isToday).toBe(true);
  });

  it("marks 1–2 consecutive missed days as rest within an active streak", () => {
    // NOW = 2026-04-28 (Tuesday). Logged Apr 23 (Thu) and Apr 27 (Mon).
    // Gap from Apr 27 going backward: Apr 26 (1st miss → rest), Apr 25 (2nd miss → rest),
    // Apr 24 (3rd miss → MISSED, breaks run). Algorithm counts from the nearest active day.
    const dots = streakDots(new Set(["2026-04-23", "2026-04-27"]), NOW);
    expect(dots[5].date).toBe("2026-04-27");
    expect(dots[5].filled).toBe(true);   // Mon Apr 27 logged
    expect(dots[5].isRest).toBe(false);
    expect(dots[4].date).toBe("2026-04-26");
    expect(dots[4].isRest).toBe(true);   // 1st miss from Apr 27 → rest
    expect(dots[4].filled).toBe(false);
    expect(dots[3].date).toBe("2026-04-25");
    expect(dots[3].isRest).toBe(true);   // 2nd miss from Apr 27 → rest
    expect(dots[3].filled).toBe(false);
    expect(dots[2].date).toBe("2026-04-24");
    expect(dots[2].isRest).toBe(false);  // 3rd consecutive miss → breaks run, not rest
    expect(dots[2].filled).toBe(false);
  });

  it("1-day gap between two logged days is marked rest", () => {
    // Logged today (2026-04-28) and 2 days ago (2026-04-26); yesterday is a rest day.
    const dots = streakDots(new Set(["2026-04-28", "2026-04-26"]), NOW);
    expect(dots[6].filled).toBe(true);  // today logged
    expect(dots[5].date).toBe("2026-04-27");
    expect(dots[5].filled).toBe(false);
    expect(dots[5].isRest).toBe(true);  // 1-day gap = rest
    expect(dots[4].filled).toBe(true);  // 2026-04-26 logged
    expect(dots[4].isRest).toBe(false);
  });

  it("3+ consecutive missed days produce no rest dots — streak broken", () => {
    // Logged today only; 3+ days back are all missed or rest then missed.
    const dots = streakDots(new Set(["2026-04-28"]), NOW);
    expect(dots[6].filled).toBe(true);  // today
    // Days 3+ behind today (Apr 25 and earlier) must NOT all be rest
    // The 3rd consecutive miss (Apr 25) breaks the run — isRest=false.
    const thirdBack = dots.find((d) => d.date === "2026-04-25");
    expect(thirdBack?.isRest).toBe(false);
    expect(thirdBack?.filled).toBe(false);
  });
});
