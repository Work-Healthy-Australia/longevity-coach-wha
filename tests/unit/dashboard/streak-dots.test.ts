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
});
