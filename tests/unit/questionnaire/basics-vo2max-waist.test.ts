import { describe, it, expect } from "vitest";
import { onboardingQuestionnaire } from "@/lib/questionnaire/questions";
import { requiredMissing } from "@/lib/questionnaire/validation";

const basicsStep = onboardingQuestionnaire.steps.find((s) => s.id === "basics")!;
const lifestyleStep = onboardingQuestionnaire.steps.find((s) => s.id === "lifestyle")!;

const validBasics = (extras: Record<string, unknown> = {}) => ({
  date_of_birth: "1985-04-12",
  sex_at_birth: "Male",
  height_cm: 178,
  weight_kg: 80,
  ethnicity: "Other",
  phone_mobile: "0400 000 000",
  address_postal: "2000",
  ...extras,
});

const validLifestyle = (extras: Record<string, unknown> = {}) => ({
  smoking: "Never",
  alcohol: "None",
  exercise_volume: "Moderate (75–150 min/week)",
  exercise_type: ["Cardio", "Weights"],
  sleep_hours: 7,
  sleep_quality: "Good",
  stress: "Low",
  diet: "Mediterranean",
  ...extras,
});

describe("basics step — waist_circumference_cm field", () => {
  it("is present, optional, integer, with sensible bounds", () => {
    const f = basicsStep.fields.find((x) => x.id === "waist_circumference_cm")!;
    expect(f).toBeDefined();
    expect(f.type).toBe("number");
    expect(f.optional).toBe(true);
    expect(f.min).toBe(40);
    expect(f.max).toBe(200);
    expect(f.step).toBe(1);
  });

  it("rejects below 40 cm", () => {
    expect(requiredMissing(basicsStep, validBasics({ waist_circumference_cm: 30 }))).toBeTruthy();
  });

  it("rejects above 200 cm", () => {
    expect(requiredMissing(basicsStep, validBasics({ waist_circumference_cm: 250 }))).toBeTruthy();
  });

  it("accepts a valid waist value", () => {
    expect(requiredMissing(basicsStep, validBasics({ waist_circumference_cm: 95 }))).toBeNull();
  });

  it("accepts the basics step without a waist value (optional)", () => {
    expect(requiredMissing(basicsStep, validBasics())).toBeNull();
  });

  it("rejects non-integer waist values", () => {
    expect(requiredMissing(basicsStep, validBasics({ waist_circumference_cm: 95.5 }))).toBeTruthy();
  });
});

describe("lifestyle step — vo2max_estimated field", () => {
  it("is present, optional, integer, with sensible bounds", () => {
    const f = lifestyleStep.fields.find((x) => x.id === "vo2max_estimated")!;
    expect(f).toBeDefined();
    expect(f.type).toBe("number");
    expect(f.optional).toBe(true);
    expect(f.min).toBe(10);
    expect(f.max).toBe(90);
    expect(f.step).toBe(1);
  });

  it("rejects below 10 mL/kg/min", () => {
    expect(requiredMissing(lifestyleStep, validLifestyle({ vo2max_estimated: 5 }))).toBeTruthy();
  });

  it("rejects above 90 mL/kg/min", () => {
    expect(requiredMissing(lifestyleStep, validLifestyle({ vo2max_estimated: 100 }))).toBeTruthy();
  });

  it("accepts a valid VO₂max value", () => {
    expect(requiredMissing(lifestyleStep, validLifestyle({ vo2max_estimated: 42 }))).toBeNull();
  });

  it("accepts the lifestyle step without VO₂max (optional)", () => {
    expect(requiredMissing(lifestyleStep, validLifestyle())).toBeNull();
  });
});
