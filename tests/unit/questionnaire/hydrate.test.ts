import { describe, expect, it } from "vitest";
import { stripUnknownKeys } from "@/lib/questionnaire/hydrate";
import type { QuestionnaireDef } from "@/lib/questionnaire/schema";

const fixture: QuestionnaireDef = {
  steps: [
    {
      id: "basics",
      label: "Basics",
      fields: [
        { id: "sex", label: "Sex", type: "select", options: ["Male", "Female"] },
        { id: "height_cm", label: "Height", type: "number" },
      ],
    },
    {
      id: "goals",
      label: "Goals",
      fields: [{ id: "notes", label: "Notes", type: "textarea" }],
    },
  ],
};

describe("stripUnknownKeys", () => {
  it("drops fields removed from the schema", () => {
    const result = stripUnknownKeys(
      {
        basics: {
          sex: "Male",
          height_cm: 180,
          age: 42, // ← removed in newer schema
          first_name: "James", // ← removed in newer schema
        },
      },
      fixture,
    );
    expect(result).toEqual({ basics: { sex: "Male", height_cm: 180 } });
  });

  it("drops entire steps that no longer exist", () => {
    const result = stripUnknownKeys(
      { basics: { sex: "Male" }, ancient_step: { foo: "bar" } },
      fixture,
    );
    expect(result.ancient_step).toBeUndefined();
    expect(result.basics).toEqual({ sex: "Male" });
  });

  it("drops empty step objects entirely", () => {
    const result = stripUnknownKeys({ basics: { age: 42 } }, fixture);
    expect(result.basics).toBeUndefined();
  });

  it("does not mutate input", () => {
    const input = { basics: { sex: "Male", age: 42 } };
    const before = JSON.parse(JSON.stringify(input));
    stripUnknownKeys(input, fixture);
    expect(input).toEqual(before);
  });

  it("ignores non-object step values defensively", () => {
    const result = stripUnknownKeys(
      { basics: null as unknown as Record<string, unknown> },
      fixture,
    );
    expect(result).toEqual({});
  });
});
