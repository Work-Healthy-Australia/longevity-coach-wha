import { describe, expect, it } from "vitest";
import { requiredMissing } from "@/lib/questionnaire/validation";
import type { StepDef } from "@/lib/questionnaire/schema";

const step: StepDef = {
  id: "test",
  label: "Test",
  fields: [
    {
      id: "sleep_hours",
      label: "Average sleep",
      type: "number",
      min: 1,
      max: 12,
      step: 1,
    },
  ],
};

describe("requiredMissing — number range / step", () => {
  it("rejects negative values", () => {
    expect(requiredMissing(step, { sleep_hours: -3 })).toBe("Average sleep");
  });

  it("rejects zero (below min=1)", () => {
    expect(requiredMissing(step, { sleep_hours: 0 })).toBe("Average sleep");
  });

  it("rejects values above max", () => {
    expect(requiredMissing(step, { sleep_hours: 13 })).toBe("Average sleep");
  });

  it("rejects fractional values when step=1", () => {
    expect(requiredMissing(step, { sleep_hours: 7.5 })).toBe("Average sleep");
  });

  it("rejects NaN / non-finite", () => {
    expect(requiredMissing(step, { sleep_hours: NaN })).toBe("Average sleep");
    expect(requiredMissing(step, { sleep_hours: Infinity })).toBe("Average sleep");
  });

  it("accepts valid values at the boundaries", () => {
    expect(requiredMissing(step, { sleep_hours: 1 })).toBeNull();
    expect(requiredMissing(step, { sleep_hours: 12 })).toBeNull();
    expect(requiredMissing(step, { sleep_hours: 7 })).toBeNull();
  });

  it("treats empty value as missing (required check)", () => {
    expect(requiredMissing(step, { sleep_hours: "" })).toBe("Average sleep");
    expect(requiredMissing(step, {})).toBe("Average sleep");
  });

  it("optional number with bad value is still rejected", () => {
    const optStep: StepDef = {
      id: "test",
      label: "Test",
      fields: [
        {
          id: "sleep_hours",
          label: "Average sleep",
          type: "number",
          optional: true,
          min: 1,
          max: 12,
          step: 1,
        },
      ],
    };
    expect(requiredMissing(optStep, { sleep_hours: -1 })).toBe("Average sleep");
    expect(requiredMissing(optStep, { sleep_hours: 7 })).toBeNull();
    // Empty optional is fine
    expect(requiredMissing(optStep, {})).toBeNull();
  });

  it("number without min/max constraints is unconstrained", () => {
    const looseStep: StepDef = {
      id: "test",
      label: "Test",
      fields: [{ id: "weight_kg", label: "Weight", type: "number" }],
    };
    expect(requiredMissing(looseStep, { weight_kg: 1000 })).toBeNull();
    expect(requiredMissing(looseStep, { weight_kg: 0.5 })).toBeNull();
  });
});
