import { describe, expect, it } from 'vitest';
import { generateWeeklyInsights } from '@/lib/insights/weekly';
import type { DailyLogRow } from '@/lib/insights/weekly';

// Helper: build a date string for a given day offset from a known Monday
// 2024-01-01 is a Monday
function dateForDay(dayOfWeek: number, weekOffset: number = 0): string {
  // dayOfWeek: 0=Sun, 1=Mon, ..., 6=Sat
  // Base Monday: 2024-01-01
  const base = new Date('2024-01-01'); // Monday
  const diff = (weekOffset * 7) + (dayOfWeek === 0 ? 6 : dayOfWeek - 1);
  base.setDate(base.getDate() + diff);
  return base.toISOString().slice(0, 10);
}

describe('generateWeeklyInsights', () => {
  it('returns empty array for empty logs', () => {
    expect(generateWeeklyInsights([])).toEqual([]);
  });

  describe('Pattern 1: low energy on Mondays', () => {
    it('emits low-energy-mondays warning when 2+ Mondays have energy <= 2', () => {
      const logs: DailyLogRow[] = [
        { log_date: dateForDay(1, 0), energy_level: 1, sleep_hours: 7, steps: 5000, mood: 3 }, // Mon week 0
        { log_date: dateForDay(2, 0), energy_level: 7, sleep_hours: 7.5, steps: 8000, mood: 7 },
        { log_date: dateForDay(1, 1), energy_level: 2, sleep_hours: 7, steps: 4000, mood: 3 }, // Mon week 1
        { log_date: dateForDay(2, 1), energy_level: 6, sleep_hours: 8, steps: 9000, mood: 8 },
      ];
      const insights = generateWeeklyInsights(logs);
      const ids = insights.map(i => i.id);
      expect(ids).toContain('low-energy-mondays');
      const insight = insights.find(i => i.id === 'low-energy-mondays')!;
      expect(insight.type).toBe('warning');
      expect(insight.message).toContain('2');
    });

    it('does not emit low-energy-mondays when only 1 Monday has low energy', () => {
      const logs: DailyLogRow[] = [
        { log_date: dateForDay(1, 0), energy_level: 1, sleep_hours: 7, steps: 5000, mood: 3 },
        { log_date: dateForDay(1, 1), energy_level: 5, sleep_hours: 7.5, steps: 8000, mood: 7 },
      ];
      const insights = generateWeeklyInsights(logs);
      expect(insights.map(i => i.id)).not.toContain('low-energy-mondays');
    });
  });

  describe('Pattern 2: sleep average', () => {
    it('emits low-sleep-avg warning when avg sleep is below target', () => {
      const logs: DailyLogRow[] = [
        { log_date: '2024-01-01', energy_level: 5, sleep_hours: 5.0, steps: 8000, mood: 5 },
        { log_date: '2024-01-02', energy_level: 5, sleep_hours: 6.0, steps: 8000, mood: 5 },
        { log_date: '2024-01-03', energy_level: 5, sleep_hours: 6.5, steps: 8000, mood: 5 },
      ];
      // avg = (5+6+6.5)/3 = 5.83 < 7.5
      const insights = generateWeeklyInsights(logs);
      const ids = insights.map(i => i.id);
      expect(ids).toContain('low-sleep-avg');
      const insight = insights.find(i => i.id === 'low-sleep-avg')!;
      expect(insight.type).toBe('warning');
      expect(insight.message).toContain('5.8');
    });

    it('emits good-sleep-avg positive when avg sleep meets target', () => {
      const logs: DailyLogRow[] = [
        { log_date: '2024-01-01', energy_level: 7, sleep_hours: 8.0, steps: 8000, mood: 7 },
        { log_date: '2024-01-02', energy_level: 7, sleep_hours: 7.5, steps: 8000, mood: 7 },
        { log_date: '2024-01-03', energy_level: 7, sleep_hours: 8.0, steps: 8000, mood: 7 },
      ];
      // avg = 7.83 >= 7.5
      const insights = generateWeeklyInsights(logs);
      const ids = insights.map(i => i.id);
      expect(ids).toContain('good-sleep-avg');
      const insight = insights.find(i => i.id === 'good-sleep-avg')!;
      expect(insight.type).toBe('positive');
    });

    it('skips sleep insight when all sleep_hours are null', () => {
      const logs: DailyLogRow[] = [
        { log_date: '2024-01-01', energy_level: 5, sleep_hours: null, steps: 8000, mood: 5 },
      ];
      const insights = generateWeeklyInsights(logs);
      const ids = insights.map(i => i.id);
      expect(ids).not.toContain('low-sleep-avg');
      expect(ids).not.toContain('good-sleep-avg');
    });
  });

  describe('Pattern 3: step goal hits', () => {
    it('emits step-goal-hits with positive type when 5+ days hit goal', () => {
      const logs: DailyLogRow[] = Array.from({ length: 7 }, (_, i) => ({
        log_date: `2024-01-0${i + 1}`,
        energy_level: 6,
        sleep_hours: 7.5,
        steps: i < 5 ? 8000 : 7000, // 5 days hit goal
        mood: 6,
      }));
      const insights = generateWeeklyInsights(logs, 8000);
      const insight = insights.find(i => i.id === 'step-goal-hits')!;
      expect(insight).toBeDefined();
      expect(insight.type).toBe('positive');
      expect(insight.message).toContain('5 out of 7');
    });

    it('emits step-goal-hits with neutral type when fewer than 5 days hit goal', () => {
      const logs: DailyLogRow[] = Array.from({ length: 7 }, (_, i) => ({
        log_date: `2024-01-0${i + 1}`,
        energy_level: 6,
        sleep_hours: 7.5,
        steps: i < 3 ? 8000 : 5000, // 3 days hit goal
        mood: 6,
      }));
      const insights = generateWeeklyInsights(logs, 8000);
      const insight = insights.find(i => i.id === 'step-goal-hits')!;
      expect(insight).toBeDefined();
      expect(insight.type).toBe('neutral');
    });

    it('does not emit step-goal-hits when no days hit goal', () => {
      const logs: DailyLogRow[] = [
        { log_date: '2024-01-01', energy_level: 5, sleep_hours: 7.5, steps: 3000, mood: 5 },
      ];
      const insights = generateWeeklyInsights(logs, 8000);
      expect(insights.map(i => i.id)).not.toContain('step-goal-hits');
    });

    it('respects custom stepGoal parameter', () => {
      const logs: DailyLogRow[] = [
        { log_date: '2024-01-01', energy_level: 5, sleep_hours: 7.5, steps: 6500, mood: 5 },
      ];
      // With custom goal of 6000, this day hits it
      const insights = generateWeeklyInsights(logs, 6000);
      expect(insights.map(i => i.id)).toContain('step-goal-hits');
    });
  });
});
