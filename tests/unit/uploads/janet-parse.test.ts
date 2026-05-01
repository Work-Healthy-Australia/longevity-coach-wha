import { describe, it, expect } from "vitest";
import { parseJanetResult, SYSTEM_PROMPT } from "@/lib/uploads/janet";

const oneObjectPayload = {
  category: "blood_work",
  summary: "Lipid panel within range.",
  findings: {
    document_type: "Lipid Panel",
    date_of_test: "2025-06-15",
    ordering_provider: "Dr. Smith",
    biomarkers: [
      {
        biomarker: "LDL Cholesterol",
        value: 3.2,
        unit: "mmol/L",
        reference_min: 0,
        reference_max: 3.5,
        test_date: "2025-06-15",
        panel_name: "Lipid Panel",
        lab_provider: "Acme Lab",
      },
    ],
  },
};

describe("parseJanetResult — single-object passthrough", () => {
  it("parses a single top-level object unchanged", () => {
    const result = parseJanetResult(JSON.stringify(oneObjectPayload));
    expect(result.category).toBe("blood_work");
    expect(result.summary).toBe("Lipid panel within range.");
    expect(result.findings.biomarkers).toBeDefined();
    expect(result.findings.biomarkers!.length).toBe(1);
    expect(result.findings.biomarkers![0].biomarker).toBe("LDL Cholesterol");
  });
});

describe("parseJanetResult — array healing", () => {
  it("unwraps an array of length 1", () => {
    const result = parseJanetResult(JSON.stringify([oneObjectPayload]));
    expect(result.category).toBe("blood_work");
    expect(result.findings.document_type).toBe("Lipid Panel");
    expect(result.findings.biomarkers!.length).toBe(1);
    expect(result.findings.biomarkers![0].biomarker).toBe("LDL Cholesterol");
  });

  it("merges multi-entry arrays, biomarker concat with most-recent canonical", () => {
    const oldEntry = {
      category: "blood_work",
      summary: "Old summary.",
      findings: {
        document_type: "Old Lipid Panel",
        date_of_test: "2024-01-01",
        biomarkers: [
          {
            biomarker: "LDL Cholesterol",
            value: 4.0,
            unit: "mmol/L",
            reference_min: 0,
            reference_max: 3.5,
            test_date: "2024-01-01",
          },
        ],
      },
    };

    const newEntry = {
      category: "blood_work",
      summary: "Current summary.",
      findings: {
        document_type: "Current Lipid Panel",
        date_of_test: "2025-06-15",
        biomarkers: [
          {
            biomarker: "LDL Cholesterol",
            value: 3.2,
            unit: "mmol/L",
            reference_min: 0,
            reference_max: 3.5,
            test_date: "2025-06-15",
          },
        ],
      },
    };

    const result = parseJanetResult(JSON.stringify([oldEntry, newEntry]));

    expect(result.findings.biomarkers).toBeDefined();
    expect(result.findings.biomarkers!.length).toBe(2);
    expect(result.findings.date_of_test).toBe("2025-06-15");
    expect(result.findings.document_type).toBe("Current Lipid Panel");
    expect(result.category).toBe("blood_work");
    expect(result.summary).toBe("Current summary.");

    const ldlValues = result.findings.biomarkers!.map((b) => b.value).sort();
    expect(ldlValues).toEqual([3.2, 4.0]);
  });

  it("falls back to the first entry as canonical when no dates are present", () => {
    const entryA = {
      category: "blood_work",
      summary: "Summary A.",
      findings: {
        document_type: "Panel A",
        biomarkers: [
          {
            biomarker: "HDL",
            value: 1.2,
            unit: "mmol/L",
            reference_min: 1.0,
            reference_max: 2.0,
          },
        ],
      },
    };

    const entryB = {
      category: "blood_work",
      summary: "Summary B.",
      findings: {
        document_type: "Panel B",
        biomarkers: [
          {
            biomarker: "LDL",
            value: 3.2,
            unit: "mmol/L",
            reference_min: 0,
            reference_max: 3.5,
          },
        ],
      },
    };

    const result = parseJanetResult(JSON.stringify([entryA, entryB]));

    expect(result.findings.document_type).toBe("Panel A");
    expect(result.summary).toBe("Summary A.");
    expect(result.findings.biomarkers!.length).toBe(2);
    const names = result.findings.biomarkers!.map((b) => b.biomarker).sort();
    expect(names).toEqual(["HDL", "LDL"]);
  });

  it("throws when given an empty array", () => {
    expect(() => parseJanetResult("[]")).toThrow(/empty array/);
  });
});

describe("Janet SYSTEM_PROMPT — array prohibition", () => {
  it("contains the literal substring 'Never return an array'", () => {
    expect(SYSTEM_PROMPT).toContain("Never return an array");
  });
});
