"use client";
import { useActionState } from "react";
import { saveCheckIn, type CheckInState } from "../actions";

export type LogEntry = {
  log_date: string;
  mood: number | null;
  energy_level: number | null;
  sleep_hours: number | null;
  workout_duration_min: number | null;
  steps: number | null;
  water_ml: number | null;
  hrv: number | null;
  resting_heart_rate: number | null;
  deep_sleep_pct: number | null;
  notes: string | null;
};

export function CheckInForm({ todayEntry }: { todayEntry: LogEntry | null }) {
  const [state, action, isPending] = useActionState<CheckInState, FormData>(
    saveCheckIn,
    {},
  );

  return (
    <form action={action} className="checkin-form">
      {state.success && (
        <div className="checkin-banner checkin-banner-success">
          Saved. Keep it up.
        </div>
      )}
      {state.error && (
        <div className="checkin-banner checkin-banner-error">{state.error}</div>
      )}

      <label className="checkin-field">
        <span>Mood (1 = rough · 10 = great)</span>
        <select name="mood" defaultValue={todayEntry?.mood ?? 5}>
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </label>

      <label className="checkin-field">
        <span>Energy (1 = exhausted · 10 = energised)</span>
        <select name="energy" defaultValue={todayEntry?.energy_level ?? 5}>
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </label>

      <label className="checkin-field">
        <span>Sleep last night (hours)</span>
        <input
          type="number"
          name="sleep_hours"
          defaultValue={todayEntry?.sleep_hours ?? 7}
          min={0}
          max={24}
          step={0.5}
        />
      </label>

      <label className="checkin-field">
        <span>Exercise today (minutes)</span>
        <input
          type="number"
          name="exercise_minutes"
          defaultValue={todayEntry?.workout_duration_min ?? 0}
          min={0}
          max={600}
          step={5}
        />
      </label>

      <label className="checkin-field">
        <span>Steps today</span>
        <input
          type="number"
          name="steps"
          defaultValue={todayEntry?.steps ?? 0}
          min={0}
          max={60000}
          step={100}
        />
      </label>

      <label className="checkin-field">
        <span>Water (glasses, ~250ml each)</span>
        <input
          type="number"
          name="water_glasses"
          defaultValue={Math.round((todayEntry?.water_ml ?? 0) / 250)}
          min={0}
          max={20}
          step={1}
        />
      </label>

      <label className="checkin-field">
        <span>Resting HRV (ms, optional)</span>
        <input
          type="number"
          name="hrv"
          defaultValue={todayEntry?.hrv ?? ""}
          min={5}
          max={200}
          step={1}
          placeholder="e.g. 45 (from your wearable)"
        />
      </label>

      <label className="checkin-field">
        <span>Resting heart rate (bpm, optional)</span>
        <input
          type="number"
          name="resting_heart_rate"
          defaultValue={todayEntry?.resting_heart_rate ?? ""}
          min={30}
          max={150}
          step={1}
          placeholder="e.g. 58"
        />
      </label>

      <label className="checkin-field">
        <span>Deep sleep last night (% of total sleep, optional)</span>
        <input
          type="number"
          name="deep_sleep_pct"
          defaultValue={todayEntry?.deep_sleep_pct ?? ""}
          min={0}
          max={60}
          step={1}
          placeholder="e.g. 18"
        />
      </label>

      <label className="checkin-field">
        <span>Notes (optional)</span>
        <textarea
          name="notes"
          defaultValue={todayEntry?.notes ?? ""}
          rows={3}
          placeholder="Anything worth noting today…"
        />
      </label>

      <button type="submit" disabled={isPending} className="checkin-submit">
        {isPending ? "Saving…" : todayEntry ? "Update today's log" : "Save today's log"}
      </button>
    </form>
  );
}
