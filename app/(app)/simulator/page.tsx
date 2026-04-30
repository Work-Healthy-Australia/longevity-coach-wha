// Server-component page for the risk simulator. The full PatientInput is
// serialised into the client HTML payload (__next_f) when passed as a prop
// to <SimulatorClient>. This is de-identified data (no name, no DOB, no
// email — questionnaire + biomarker JSON only) but member-level information.
// A future change can trim this to a SimulatorPatient slice if profiling
// shows the payload bloating beyond ~50 KB.

import { createClient } from "@/lib/supabase/server";
import { assemblePatientFromDB } from "@/lib/risk/assemble";
import { scoreRisk, getOverallCompleteness } from "@/lib/risk/scorer";
import type { SimulatorMetric, SliderConfig } from "@/lib/simulator";
import Link from "next/link";
import { SimulatorClient } from "./_components/simulator-client";
import "./simulator.css";

export const metadata = { title: "Risk simulator · Janet Cares" };

const POPULATION_DEFAULTS: Record<SimulatorMetric, number> = {
  ldl: 130,
  hba1c: 5.4,
  hsCRP: 1.5,
  systolic_bp_mmHg: 125,
  weight_kg: 75,
};

const SLIDERS: SliderConfig[] = [
  {
    metric: "ldl",
    label: "LDL Cholesterol",
    unit: "mg/dL",
    min: 40,
    max: 250,
    step: 1,
    defaultValue: 130,
    optimalText: "Optimal: < 100 mg/dL",
  },
  {
    metric: "hba1c",
    label: "HbA1c",
    unit: "%",
    min: 4.0,
    max: 12.0,
    step: 0.1,
    defaultValue: 5.4,
    optimalText: "Optimal: < 5.4%",
  },
  {
    metric: "hsCRP",
    label: "hsCRP",
    unit: "mg/L",
    min: 0.1,
    max: 10,
    step: 0.1,
    defaultValue: 1.5,
    optimalText: "Optimal: < 1.0 mg/L",
  },
  {
    metric: "systolic_bp_mmHg",
    label: "Systolic BP",
    unit: "mmHg",
    min: 90,
    max: 200,
    step: 1,
    defaultValue: 125,
    optimalText: "Optimal: < 120 mmHg",
  },
  {
    metric: "weight_kg",
    label: "Weight",
    unit: "kg",
    min: 40,
    max: 200,
    step: 0.5,
    defaultValue: 75,
    optimalText: "Healthy BMI 18.5–24.9 (depends on height)",
  },
];

export default async function SimulatorPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const patient = await assemblePatientFromDB(supabase, user.id);
  const baseline = scoreRisk(patient);
  const completeness = getOverallCompleteness(
    Object.values(baseline.domains),
  );

  if (completeness < 0.10) {
    return (
      <div className="lc-sim">
        <header className="lc-sim-header">
          <h1>Risk simulator</h1>
          <p className="lc-sim-subtitle">
            Move the sliders. See how each one shifts your risk and domain scores.
          </p>
        </header>
        <div className="lc-sim-empty">
          <h2>Complete your assessment to use the simulator</h2>
          <p>
            The simulator works off your current baseline. Once you've completed
            the questionnaire and uploaded a recent panel, you'll be able to see
            how a change in your numbers shifts your risk profile.
          </p>
          <Link href="/onboarding" className="lc-sim-empty-cta">
            Start the assessment →
          </Link>
        </div>
      </div>
    );
  }

  const bp = patient.biomarkers?.blood_panel;
  const dem = patient.demographics;
  const initialValues: Record<SimulatorMetric, number> = {
    ldl: bp?.ldl ?? POPULATION_DEFAULTS.ldl,
    hba1c: bp?.hba1c ?? POPULATION_DEFAULTS.hba1c,
    hsCRP: bp?.hsCRP ?? POPULATION_DEFAULTS.hsCRP,
    systolic_bp_mmHg: dem?.systolic_bp_mmHg ?? POPULATION_DEFAULTS.systolic_bp_mmHg,
    weight_kg: dem?.weight_kg ?? POPULATION_DEFAULTS.weight_kg,
  };

  const isPopulationDefault: Record<SimulatorMetric, boolean> = {
    ldl: bp?.ldl == null,
    hba1c: bp?.hba1c == null,
    hsCRP: bp?.hsCRP == null,
    systolic_bp_mmHg: dem?.systolic_bp_mmHg == null,
    weight_kg: dem?.weight_kg == null,
  };

  return (
    <div className="lc-sim">
      <header className="lc-sim-header">
        <h1>Risk simulator</h1>
        <p className="lc-sim-subtitle">
          Move the sliders. See how each one shifts your risk and domain scores.
        </p>
      </header>
      <SimulatorClient
        patient={patient}
        baseline={baseline}
        initialValues={initialValues}
        isPopulationDefault={isPopulationDefault}
        sliders={SLIDERS}
      />
    </div>
  );
}
