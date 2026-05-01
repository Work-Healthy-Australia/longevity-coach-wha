"use client";
import { useActionState, useState } from "react";
import { saveCheckIn, type CheckInState } from "../actions";
import { ScaleInput } from "./scale-input";

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
  const [showAdvanced, setShowAdvanced] = useState(
    Boolean(
      todayEntry?.hrv ||
        todayEntry?.resting_heart_rate ||
        todayEntry?.deep_sleep_pct,
    ),
  );

  return (
    <form action={action} className="lc-checkin-form">
      {/* TODAY · How you feel */}
      <section className="lc-checkin-section">
        <div className="lc-checkin-section-headline">
          <span className="lc-checkin-section-eyebrow">Today</span>
          <h2>How are you feeling?</h2>
        </div>

        <div className="lc-checkin-field">
          <span className="lc-checkin-field-label">Mood</span>
          <ScaleInput
            name="mood"
            defaultValue={todayEntry?.mood ?? 5}
            lowLabel="Rough"
            highLabel="Great"
          />
        </div>

        <div className="lc-checkin-field">
          <span className="lc-checkin-field-label">Energy</span>
          <ScaleInput
            name="energy"
            defaultValue={todayEntry?.energy_level ?? 5}
            lowLabel="Exhausted"
            highLabel="Energised"
          />
        </div>

        <label className="lc-checkin-field">
          <span className="lc-checkin-field-label">Notes</span>
          <textarea
            name="notes"
            defaultValue={todayEntry?.notes ?? ""}
            rows={3}
            placeholder="Anything worth noting today…"
          />
        </label>
      </section>

      {/* RECOVERY · Sleep */}
      <section className="lc-checkin-section">
        <div className="lc-checkin-section-headline">
          <span className="lc-checkin-section-eyebrow">Recovery</span>
          <h2>Sleep</h2>
        </div>

        <label className="lc-checkin-field">
          <span className="lc-checkin-field-label">Hours last night</span>
          <input
            type="number"
            name="sleep_hours"
            defaultValue={todayEntry?.sleep_hours ?? 7}
            min={0}
            max={24}
            step={0.5}
          />
        </label>
      </section>

      {/* MOVEMENT · Activity */}
      <section className="lc-checkin-section">
        <div className="lc-checkin-section-headline">
          <span className="lc-checkin-section-eyebrow">Movement</span>
          <h2>Activity</h2>
        </div>

        <div className="lc-checkin-field-row">
          <label className="lc-checkin-field">
            <span className="lc-checkin-field-label">Steps</span>
            <input
              type="number"
              name="steps"
              defaultValue={todayEntry?.steps ?? 0}
              min={0}
              max={60000}
              step={100}
            />
          </label>

          <label className="lc-checkin-field">
            <span className="lc-checkin-field-label">Exercise (min)</span>
            <input
              type="number"
              name="exercise_minutes"
              defaultValue={todayEntry?.workout_duration_min ?? 0}
              min={0}
              max={600}
              step={5}
            />
          </label>
        </div>
      </section>

      {/* HYDRATION · Water */}
      <section className="lc-checkin-section">
        <div className="lc-checkin-section-headline">
          <span className="lc-checkin-section-eyebrow">Hydration</span>
          <h2>Water</h2>
        </div>

        <label className="lc-checkin-field">
          <span className="lc-checkin-field-label">Glasses (~250ml each)</span>
          <input
            type="number"
            name="water_glasses"
            defaultValue={Math.round((todayEntry?.water_ml ?? 0) / 250)}
            min={0}
            max={20}
            step={1}
          />
        </label>
      </section>

      {/* SIGNALS · Heart (collapsed by default) */}
      <section className="lc-checkin-section">
        <div className="lc-checkin-section-headline">
          <span className="lc-checkin-section-eyebrow">Signals</span>
          <h2>Wearable metrics</h2>
        </div>

        {!showAdvanced ? (
          <button
            type="button"
            className="lc-checkin-advanced-toggle"
            onClick={() => setShowAdvanced(true)}
          >
            + Show advanced metrics (HRV, resting HR, deep sleep)
          </button>
        ) : (
          <div className="lc-checkin-advanced-content">
            <div className="lc-checkin-field-row">
              <label className="lc-checkin-field">
                <span className="lc-checkin-field-label">HRV (ms)</span>
                <input
                  type="number"
                  name="hrv"
                  defaultValue={todayEntry?.hrv ?? ""}
                  min={5}
                  max={200}
                  step={1}
                  placeholder="e.g. 45"
                />
              </label>

              <label className="lc-checkin-field">
                <span className="lc-checkin-field-label">Resting HR (bpm)</span>
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
            </div>

            <label className="lc-checkin-field">
              <span className="lc-checkin-field-label">Deep sleep (%)</span>
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
          </div>
        )}
      </section>

      {/* SUBMIT + CONFIRMATION (at the bottom — where the eyes are) */}
      <div className="lc-checkin-submit-row">
        {state.success && (
          <div className="lc-checkin-banner lc-checkin-banner-success">
            Saved. Your scoreboard above is up to date.
          </div>
        )}
        {state.error && (
          <div className="lc-checkin-banner lc-checkin-banner-error">
            {state.error}
          </div>
        )}
        <div className="lc-checkin-submit-row-actions">
          <button
            type="submit"
            disabled={isPending}
            className="btn btn-primary btn-lg"
          >
            {isPending
              ? "Saving…"
              : todayEntry
                ? "Update today's log"
                : "Save today's log"}
          </button>
        </div>
      </div>
    </form>
  );
}
