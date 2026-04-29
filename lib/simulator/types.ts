import type { PatientInput } from "@/lib/risk/types";

export type SimulatorMetric = "ldl" | "hba1c" | "hsCRP" | "weight_kg";

export type SimulatorOverrides = Partial<Record<SimulatorMetric, number>>;

export type SliderConfig = {
  metric: SimulatorMetric;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  optimalText: string;
};

export type BaselineSnapshot = {
  patient: PatientInput;
  values: Record<SimulatorMetric, number | null>;
  hasEnoughData: boolean;
};
