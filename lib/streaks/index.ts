export type DayState = "active" | "rest" | "missed" | "future";

export interface StreakDay {
  date: string; // YYYY-MM-DD
  state: DayState;
}

export interface StreakResult {
  currentStreak: number;
  longestStreak: number;
  days: StreakDay[]; // last 14 days, oldest first
}

/**
 * Calculates streak with rest-day tolerance.
 *
 * Rules:
 * - A day is "active" if a log entry exists for it.
 * - 1–2 consecutive days without a log = "rest" (streak continues, not counted).
 * - 3+ consecutive days without a log = "missed" (streak resets).
 * - Future dates are marked "future" and ignored.
 *
 * The algorithm walks backward from today. It stays in the current streak
 * run while seeing active days or short rest gaps (≤ 2). As soon as it
 * encounters a third consecutive non-active day the current run ends.
 *
 * `currentStreak` counts only active days in the current unbroken run.
 * `longestStreak` is the maximum active-day run in the window.
 */
export function calculateStreak(
  logDates: string[], // YYYY-MM-DD strings, any order
  today: string = new Date().toISOString().slice(0, 10),
  windowDays: number = 14,
): StreakResult {
  const logSet = new Set(logDates);

  // Build window newest-first: window[0] = today, window[windowDays-1] = oldest
  const window: StreakDay[] = [];
  for (let i = 0; i < windowDays; i++) {
    const d = new Date(today + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    window.push({
      date: dateStr,
      state: logSet.has(dateStr) ? "active" : "missed",
    });
  }

  // Walk backward from today to assign rest/missed and compute streaks
  let consecutiveMissed = 0;
  let inCurrentRun = true; // still connected to today's run
  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0; // active-day count for the run currently being walked

  for (let i = 0; i < window.length; i++) {
    const day = window[i];

    if (day.state === "active") {
      consecutiveMissed = 0;
      tempStreak++;
      if (inCurrentRun) currentStreak = tempStreak;
      if (tempStreak > longestStreak) longestStreak = tempStreak;
    } else {
      consecutiveMissed++;
      if (consecutiveMissed <= 2) {
        // Tolerated rest gap — mark as rest, streak continues
        day.state = "rest";
      } else {
        // Third consecutive missed day — run is broken
        day.state = "missed";
        if (inCurrentRun) {
          // Lock in the current streak total; don't update it further
          inCurrentRun = false;
        }
        // Reset for any earlier independent run in the window
        tempStreak = 0;
        consecutiveMissed = 0;
      }
    }
  }

  return {
    currentStreak,
    longestStreak,
    // Display oldest → newest
    days: [...window].reverse(),
  };
}
