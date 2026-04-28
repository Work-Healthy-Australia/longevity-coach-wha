import type { JanetResult } from "@/lib/uploads/janet";

export const BLOOD_WORK_TWO_BIOMARKERS: JanetResult = {
  category: "blood_work",
  summary: "Lipid panel results.",
  findings: {
    document_type: "Lipid Panel",
    date_of_test: "2026-04-28",
    ordering_provider: "Dr Smith",
    biomarkers: [
      {
        biomarker: "HDL Cholesterol",
        value: 60,
        unit: "mg/dL",
        reference_min: 40,
        reference_max: 80,
        test_date: "2026-04-28",
        panel_name: "Lipid Panel",
        lab_provider: "Quest Diagnostics",
      },
      {
        biomarker: "LDL Cholesterol",
        value: 180,
        unit: "mg/dL",
        reference_min: 50,
        reference_max: 130,
        test_date: "2026-04-28",
        panel_name: "Lipid Panel",
        lab_provider: "Quest Diagnostics",
      },
    ],
  },
};

export const BLOOD_WORK_NO_BIOMARKERS: JanetResult = {
  category: "blood_work",
  summary: "Could not parse biomarker rows.",
  findings: {
    document_type: "Unstructured Lab Note",
  },
};

export const IMAGING: JanetResult = {
  category: "imaging",
  summary: "Lumbar MRI report.",
  findings: {
    document_type: "Lumbar MRI",
    notable_findings: ["L4-L5 mild disc bulge"],
  },
};

export const BLOOD_WORK_CRITICAL: JanetResult = {
  category: "blood_work",
  summary: "Critical glucose reading.",
  findings: {
    document_type: "Metabolic Panel",
    biomarkers: [
      {
        biomarker: "Glucose (fasting)",
        value: 320, // > 1.5 * 180 = 270 → critical
        unit: "mg/dL",
        reference_min: 70,
        reference_max: 100,
        test_date: "2026-04-28",
        panel_name: "Comprehensive Metabolic Panel",
        lab_provider: "LabCorp",
      },
    ],
  },
};

export const BLOOD_WORK_NAN_VALUE: JanetResult = {
  category: "blood_work",
  summary: "Bad value.",
  findings: {
    document_type: "Lipid Panel",
    biomarkers: [
      {
        biomarker: "Triglycerides",
        // Force a non-finite value through the type system
        value: Number.NaN,
        unit: "mg/dL",
        reference_min: 0,
        reference_max: 150,
        test_date: "2026-04-28",
        panel_name: "Lipid Panel",
        lab_provider: "Quest Diagnostics",
      },
    ],
  },
};

export const BLOOD_WORK_ZERO_VALUE: JanetResult = {
  category: "blood_work",
  summary: "Detection-limit zero reading.",
  findings: {
    document_type: "Hormone Panel",
    biomarkers: [
      {
        biomarker: "Beta-HCG",
        value: 0,
        unit: "mIU/mL",
        reference_min: 0,
        reference_max: 5,
        test_date: "2026-04-28",
        panel_name: "Hormone Panel",
        lab_provider: "Quest Diagnostics",
      },
    ],
  },
};

export const BLOOD_WORK_SWAPPED_BOUNDS: JanetResult = {
  category: "blood_work",
  summary: "Swapped reference bounds.",
  findings: {
    document_type: "Lipid Panel",
    biomarkers: [
      {
        biomarker: "LDL Cholesterol",
        value: 100,
        unit: "mg/dL",
        reference_min: 200, // swapped intentionally
        reference_max: 70,
        test_date: "2026-04-28",
        panel_name: "Lipid Panel",
        lab_provider: "Quest Diagnostics",
      },
    ],
  },
};

export const BLOOD_WORK_TEST_DATE_FROM_FINDINGS: JanetResult = {
  category: "blood_work",
  summary: "Biomarker test_date null; falls back to findings.date_of_test.",
  findings: {
    document_type: "Lipid Panel",
    date_of_test: "2026-01-15",
    biomarkers: [
      {
        biomarker: "HDL Cholesterol",
        value: 55,
        unit: "mg/dL",
        reference_min: 40,
        reference_max: 80,
        test_date: null,
        panel_name: "Lipid Panel",
        lab_provider: "Quest Diagnostics",
      },
    ],
  },
};

export const BLOOD_WORK_NO_DATE: JanetResult = {
  category: "blood_work",
  summary: "No date anywhere; falls back to today.",
  findings: {
    document_type: "Lipid Panel",
    biomarkers: [
      {
        biomarker: "HDL Cholesterol",
        value: 55,
        unit: "mg/dL",
        reference_min: 40,
        reference_max: 80,
        test_date: null,
        panel_name: "Lipid Panel",
        lab_provider: "Quest Diagnostics",
      },
    ],
  },
};
