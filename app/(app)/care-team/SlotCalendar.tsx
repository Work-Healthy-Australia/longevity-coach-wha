"use client";

import { useState, useTransition } from "react";
import { requestBooking } from "@/app/(app)/care-team/actions";

type Slot = { dateTime: string; label: string };

type Props = {
  availableSlots: Slot[];
  clinicianUuid: string;
};

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addWeeks(date: Date, weeks: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + weeks * 7);
  return d;
}

function formatWeekLabel(weekStart: Date): string {
  return weekStart.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getDayKey(dt: Date): string {
  return dt.toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function isInWeek(slotDate: Date, weekStart: Date): boolean {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  return slotDate >= weekStart && slotDate < weekEnd;
}

export default function SlotCalendar({ availableSlots, clinicianUuid }: Props) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, startTransition] = useTransition();
  const [confirmedSlots, setConfirmedSlots] = useState<Set<string>>(new Set());
  const [confirmationMessage, setConfirmationMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (availableSlots.length === 0) {
    return (
      <div className="lc-care__calendar">
        <p className="lc-care__no-slots">No upcoming availability — check back soon.</p>
      </div>
    );
  }

  const now = new Date();
  const baseWeekStart = getWeekStart(now);
  const currentWeekStart = addWeeks(baseWeekStart, weekOffset);
  const currentWeekEnd = addWeeks(currentWeekStart, 1);

  const slotsInWeek = availableSlots.filter((slot) => {
    const d = new Date(slot.dateTime);
    return isInWeek(d, currentWeekStart) && !confirmedSlots.has(slot.dateTime);
  });

  // Group slots by day
  const dayMap = new Map<string, Slot[]>();
  for (const slot of slotsInWeek) {
    const key = getDayKey(new Date(slot.dateTime));
    const existing = dayMap.get(key) ?? [];
    existing.push(slot);
    dayMap.set(key, existing);
  }

  function handleSelectSlot(slot: Slot) {
    if (selectedSlot?.dateTime === slot.dateTime) {
      setSelectedSlot(null);
      setNotes("");
      setErrorMessage(null);
    } else {
      setSelectedSlot(slot);
      setNotes("");
      setErrorMessage(null);
      setConfirmationMessage(null);
    }
  }

  function handleCancel() {
    setSelectedSlot(null);
    setNotes("");
    setErrorMessage(null);
    setConfirmationMessage(null);
  }

  function handleSubmit() {
    if (!selectedSlot) return;
    const slotToBook = selectedSlot;
    setErrorMessage(null);

    startTransition(async () => {
      const result = await requestBooking(clinicianUuid, slotToBook.dateTime, notes);
      if ("error" in result) {
        setErrorMessage(result.error);
        return;
      }
      // Success
      setConfirmedSlots((prev) => new Set([...prev, slotToBook.dateTime]));
      setSelectedSlot(null);
      setNotes("");
      setConfirmationMessage("Request sent — your clinician will confirm shortly.");
    });
  }

  const weekLabel = `Week of ${formatWeekLabel(currentWeekStart)}`;

  return (
    <div className="lc-care__calendar">
      <div className="lc-care__week-nav">
        <button
          type="button"
          onClick={() => {
            setWeekOffset((o) => o - 1);
            setSelectedSlot(null);
            setErrorMessage(null);
          }}
          disabled={weekOffset <= 0}
          aria-label="Previous week"
        >
          &larr; Previous week
        </button>
        <span className="lc-care__week-label">{weekLabel}</span>
        <button
          type="button"
          onClick={() => {
            setWeekOffset((o) => o + 1);
            setSelectedSlot(null);
            setErrorMessage(null);
          }}
          aria-label="Next week"
        >
          Next week &rarr;
        </button>
      </div>

      {confirmationMessage && (
        <div className="lc-care__confirm-card">{confirmationMessage}</div>
      )}

      {slotsInWeek.length === 0 ? (
        <p className="lc-care__no-slots">
          No availability this week.{" "}
          <button
            type="button"
            className="lc-care__cancel-link"
            onClick={() => setWeekOffset((o) => o + 1)}
          >
            Try the next week &rarr;
          </button>
        </p>
      ) : (
        <div className="lc-care__days">
          {Array.from(dayMap.entries()).map(([dayKey, slots]) => (
            <div key={dayKey} className="lc-care__day-col">
              <p className="lc-care__day-heading">{dayKey}</p>
              {slots.map((slot) => {
                const isSelected = selectedSlot?.dateTime === slot.dateTime;
                return (
                  <button
                    key={slot.dateTime}
                    type="button"
                    className={`lc-care__slot-pill${isSelected ? " lc-care__slot-pill--selected" : ""}`}
                    onClick={() => handleSelectSlot(slot)}
                  >
                    {slot.label.split(",").slice(-1)[0]?.trim() ?? slot.label}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {selectedSlot && (
        <div className="lc-care__booking-panel">
          <p className="lc-care__booking-panel-slot">
            Selected: <strong>{selectedSlot.label}</strong>
          </p>
          <label>
            Reason for booking (optional)
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              placeholder="Briefly describe what you would like to discuss..."
              rows={3}
            />
          </label>
          {errorMessage && (
            <div className="lc-care__booking-error">{errorMessage}</div>
          )}
          <div className="lc-care__booking-panel-actions">
            <button
              type="button"
              className="lc-care__submit-btn"
              disabled={submitting}
              onClick={handleSubmit}
            >
              {submitting ? "Requesting..." : "Request session"}
            </button>
            <button
              type="button"
              className="lc-care__cancel-link"
              onClick={handleCancel}
              disabled={submitting}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
