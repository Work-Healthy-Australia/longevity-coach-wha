import { describe, it, expect } from "vitest";
import { parseCheckInForm } from "@/app/(app)/check-in/validation";

function buildForm(extras: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set("mood", "5");
  fd.set("energy", "5");
  fd.set("sleep_hours", "7");
  fd.set("exercise_minutes", "30");
  fd.set("steps", "8000");
  fd.set("water_glasses", "6");
  for (const [k, v] of Object.entries(extras)) fd.set(k, v);
  return fd;
}

describe("parseCheckInForm — HRV / RHR / deep sleep optional fields", () => {
  it("accepts the form without any of the wearable fields", () => {
    const result = parseCheckInForm(buildForm());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.hrv).toBeNull();
      expect(result.data.resting_heart_rate).toBeNull();
      expect(result.data.deep_sleep_pct).toBeNull();
    }
  });

  it("captures HRV when provided", () => {
    const result = parseCheckInForm(buildForm({ hrv: "45" }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.hrv).toBe(45);
  });

  it("captures resting heart rate when provided (rounded)", () => {
    const result = parseCheckInForm(buildForm({ resting_heart_rate: "58.7" }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.resting_heart_rate).toBe(59);
  });

  it("captures deep sleep % when provided", () => {
    const result = parseCheckInForm(buildForm({ deep_sleep_pct: "18" }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.deep_sleep_pct).toBe(18);
  });

  it("rejects HRV below 5 ms or above 200 ms", () => {
    expect(parseCheckInForm(buildForm({ hrv: "3" })).ok).toBe(false);
    expect(parseCheckInForm(buildForm({ hrv: "250" })).ok).toBe(false);
  });

  it("rejects resting HR below 30 or above 150", () => {
    expect(parseCheckInForm(buildForm({ resting_heart_rate: "20" })).ok).toBe(false);
    expect(parseCheckInForm(buildForm({ resting_heart_rate: "180" })).ok).toBe(false);
  });

  it("rejects deep sleep % below 0 or above 60", () => {
    expect(parseCheckInForm(buildForm({ deep_sleep_pct: "-5" })).ok).toBe(false);
    expect(parseCheckInForm(buildForm({ deep_sleep_pct: "75" })).ok).toBe(false);
  });

  it("rejects non-numeric values for the optional fields", () => {
    expect(parseCheckInForm(buildForm({ hrv: "abc" })).ok).toBe(false);
    expect(parseCheckInForm(buildForm({ resting_heart_rate: "fast" })).ok).toBe(false);
    expect(parseCheckInForm(buildForm({ deep_sleep_pct: "not a number" })).ok).toBe(false);
  });

  it("treats empty string as null (skip)", () => {
    const result = parseCheckInForm(
      buildForm({ hrv: "", resting_heart_rate: "", deep_sleep_pct: "" }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.hrv).toBeNull();
      expect(result.data.resting_heart_rate).toBeNull();
      expect(result.data.deep_sleep_pct).toBeNull();
    }
  });
});
