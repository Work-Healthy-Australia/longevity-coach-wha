import { describe, expect, it } from "vitest";
import { parseCheckInForm } from "@/app/(app)/check-in/validation";

function buildForm(overrides: Record<string, string> = {}): FormData {
  const defaults: Record<string, string> = {
    mood: "5",
    energy: "5",
    sleep_hours: "7",
    exercise_minutes: "30",
    steps: "8000",
    water_glasses: "6",
    notes: "ok",
  };
  const merged = { ...defaults, ...overrides };
  const fd = new FormData();
  for (const [key, value] of Object.entries(merged)) {
    fd.set(key, value);
  }
  return fd;
}

describe("parseCheckInForm", () => {
  it("rejects negative steps", () => {
    const result = parseCheckInForm(buildForm({ steps: "-5" }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/steps/i);
    }
  });

  it("rejects steps above the 60000 cap", () => {
    const result = parseCheckInForm(buildForm({ steps: "200000" }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/steps/i);
    }
  });

  it("rejects water_glasses above the 20 cap", () => {
    const result = parseCheckInForm(buildForm({ water_glasses: "99" }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/water/i);
    }
  });

  it("returns clean record for a valid submission and converts glasses to ml at 250 each", () => {
    const result = parseCheckInForm(
      buildForm({
        mood: "5",
        energy: "5",
        sleep_hours: "7",
        exercise_minutes: "30",
        steps: "8000",
        water_glasses: "6",
        notes: "ok",
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toMatchObject({
        mood: 5,
        energy: 5,
        sleep_hours: 7,
        exercise_minutes: 30,
        steps: 8000,
        water_ml: 1500,
        notes: "ok",
      });
    }
  });

  it("rejects mood outside the 1-10 range", () => {
    const result = parseCheckInForm(buildForm({ mood: "0" }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/mood/i);
    }
  });

  it("rejects non-numeric (NaN) steps", () => {
    const result = parseCheckInForm(buildForm({ steps: "not-a-number" }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/steps/i);
    }
  });
});
