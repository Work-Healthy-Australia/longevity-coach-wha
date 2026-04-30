"use client";

import { useState } from "react";

import { deleteAvailabilitySlot, upsertAvailabilitySlot } from "./actions";

type Slot = {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
};

type Props = { initialSlots: Slot[] };

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Generate 30-minute increments from 06:00 to 20:00
function buildTimeOptions(): string[] {
  const times: string[] = [];
  for (let h = 6; h <= 20; h++) {
    times.push(`${String(h).padStart(2, "0")}:00`);
    if (h < 20) {
      times.push(`${String(h).padStart(2, "0")}:30`);
    }
  }
  return times;
}

const TIME_OPTIONS = buildTimeOptions();

function DayColumn({
  day,
  slots,
  onDelete,
  onAdd,
}: {
  day: number;
  slots: Slot[];
  onDelete: (slot: Slot) => void;
  onAdd: (day: number, startTime: string, endTime: string) => Promise<string | null>;
}) {
  const [showForm, setShowForm] = useState(false);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setFormError(null);
    const err = await onAdd(day, startTime, endTime);
    setSaving(false);
    if (err) {
      setFormError(err);
    } else {
      setShowForm(false);
      setStartTime("09:00");
      setEndTime("10:00");
    }
  }

  return (
    <div className="sched-avail__day-col">
      <div className="sched-avail__day-heading">{DAY_NAMES[day]}</div>

      {slots.map((slot) => (
        <SlotPill key={slot.id} slot={slot} onDelete={onDelete} />
      ))}

      {showForm ? (
        <div className="sched-avail__add-form">
          <div className="sched-avail__add-form-row">
            <label className="sched-avail__add-label">
              From
              <select
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="sched-avail__select"
              >
                {TIME_OPTIONS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>
            <label className="sched-avail__add-label">
              To
              <select
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="sched-avail__select"
              >
                {TIME_OPTIONS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>
          </div>
          {formError && <div className="sched-avail__form-error">{formError}</div>}
          <div className="sched-avail__add-form-actions">
            <button
              type="button"
              className="sched-avail__btn-save"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              className="sched-avail__btn-cancel"
              onClick={() => {
                setShowForm(false);
                setFormError(null);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="sched-avail__add-btn"
          onClick={() => setShowForm(true)}
        >
          + Add slot
        </button>
      )}
    </div>
  );
}

function SlotPill({
  slot,
  onDelete,
}: {
  slot: Slot;
  onDelete: (slot: Slot) => void;
}) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    onDelete(slot); // optimistic remove
    const result = await deleteAvailabilitySlot(slot.id);
    if ("error" in result) {
      // restore is handled by parent via error callback
      setDeleting(false);
    }
  }

  return (
    <div className={`sched-avail__slot-pill${deleting ? " sched-avail__slot-pill--deleting" : ""}`}>
      <span className="sched-avail__slot-time">
        {slot.start_time}–{slot.end_time}
      </span>
      <button
        type="button"
        className="sched-avail__slot-delete"
        onClick={handleDelete}
        aria-label="Delete slot"
      >
        ×
      </button>
    </div>
  );
}

export function AvailabilityGrid({ initialSlots }: Props) {
  const [slots, setSlots] = useState<Slot[]>(initialSlots);

  function handleDelete(slot: Slot) {
    // Optimistic: remove immediately
    setSlots((prev) => prev.filter((s) => s.id !== slot.id));
  }

  async function handleAdd(
    day: number,
    startTime: string,
    endTime: string
  ): Promise<string | null> {
    const result = await upsertAvailabilitySlot(day, startTime, endTime);
    if ("error" in result) {
      return result.error;
    }
    // Reload from server is ideal; for now optimistically add with a temp id
    // The page is force-dynamic so a hard refresh will show the real id.
    const tempId = `temp-${Date.now()}`;
    setSlots((prev) => [
      ...prev,
      { id: tempId, day_of_week: day, start_time: startTime, end_time: endTime },
    ]);
    return null;
  }

  return (
    <div className="sched-avail">
      <div className="sched-avail__grid">
        {[0, 1, 2, 3, 4, 5, 6].map((day) => (
          <DayColumn
            key={day}
            day={day}
            slots={slots.filter((s) => s.day_of_week === day)}
            onDelete={handleDelete}
            onAdd={handleAdd}
          />
        ))}
      </div>
    </div>
  );
}
