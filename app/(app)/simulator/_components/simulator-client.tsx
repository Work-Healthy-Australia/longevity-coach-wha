"use client";

// Client imports skip the @/lib/risk barrel (addendum #1) — the barrel
// re-exports assemblePatientFromDB which pulls in @supabase/supabase-js.
import { useMemo, useState, useDeferredValue } from "react";
import { scoreRisk } from "@/lib/risk/scorer";
import type { PatientInput, EngineOutput, DomainName } from "@/lib/risk/types";
import { applyOverrides, formatDelta } from "@/lib/simulator";
import type {
  SimulatorMetric,
  SimulatorOverrides,
  SliderConfig,
} from "@/lib/simulator";

type Props = {
  patient: PatientInput;
  baseline: EngineOutput;
  initialValues: Record<SimulatorMetric, number>;
  isPopulationDefault: Record<SimulatorMetric, boolean>;
  sliders: SliderConfig[];
};

const DOMAIN_ORDER: DomainName[] = [
  "cardiovascular",
  "metabolic",
  "neurodegenerative",
  "oncological",
  "musculoskeletal",
];

const DOMAIN_LABELS: Record<DomainName, string> = {
  cardiovascular: "Cardiovascular",
  metabolic: "Metabolic",
  neurodegenerative: "Neurological",
  oncological: "Oncological",
  musculoskeletal: "Musculoskeletal",
};

function tone(baselineN: number, simulatedN: number): "down" | "up" | "equal" {
  const b = Math.round(baselineN);
  const s = Math.round(simulatedN);
  if (s < b) return "down";
  if (s > b) return "up";
  return "equal";
}

function arrowSymbol(t: "down" | "up" | "equal"): string {
  if (t === "down") return "↓";
  if (t === "up") return "↑";
  return "→";
}

function formatValue(metric: SimulatorMetric, n: number): string {
  if (metric === "hba1c" || metric === "hsCRP") return n.toFixed(1);
  if (metric === "weight_kg") {
    return Number.isInteger(n) ? String(n) : n.toFixed(1);
  }
  return String(Math.round(n));
}

export function SimulatorClient({
  patient,
  baseline,
  initialValues,
  isPopulationDefault,
  sliders,
}: Props) {
  const [values, setValues] =
    useState<Record<SimulatorMetric, number>>(initialValues);
  const deferredValues = useDeferredValue(values);

  const simulated = useMemo<EngineOutput>(
    () =>
      scoreRisk(applyOverrides(patient, deferredValues as SimulatorOverrides)),
    [deferredValues, patient],
  );

  const isDirty = useMemo(
    () =>
      (Object.keys(values) as SimulatorMetric[]).some(
        (k) => values[k] !== initialValues[k],
      ),
    [values, initialValues],
  );

  const compositeTone = tone(baseline.composite_risk, simulated.composite_risk);

  return (
    <div className="lc-sim-grid">
      {/* Left column — sliders */}
      <div className="lc-sim-sliders">
        {sliders.map((slider) => {
          const metric = slider.metric;
          const value = values[metric];
          const ariaLabel = `${slider.label} in ${slider.unit}`;
          return (
            <div className="lc-sim-slider-row" key={metric}>
              <div className="lc-sim-slider-head">
                <label
                  htmlFor={`lc-sim-${metric}`}
                  className="lc-sim-slider-label"
                >
                  {slider.label}
                </label>
                <div className="lc-sim-slider-value">
                  <span className="lc-sim-slider-number">
                    {formatValue(metric, value)}
                  </span>
                  <span className="lc-sim-slider-unit">{slider.unit}</span>
                </div>
              </div>
              <input
                id={`lc-sim-${metric}`}
                type="range"
                aria-label={ariaLabel}
                min={slider.min}
                max={slider.max}
                step={slider.step}
                value={value}
                onChange={(e) =>
                  setValues((prev) => ({
                    ...prev,
                    [metric]: parseFloat(e.target.value),
                  }))
                }
                className="lc-sim-range"
              />
              <div className="lc-sim-slider-caption">
                <span>{slider.optimalText}</span>
                {isPopulationDefault[metric] && (
                  <span className="lc-sim-pop-default">
                    (population default)
                  </span>
                )}
              </div>
            </div>
          );
        })}

        <button
          type="button"
          className="lc-sim-reset"
          onClick={() => setValues(initialValues)}
          disabled={!isDirty}
        >
          Reset to current
        </button>
      </div>

      {/* Right column — score display */}
      <div className="lc-sim-scores">
        <div className="lc-sim-composite">
          <div className="lc-sim-composite-head">
            <div className="lc-sim-composite-label">Composite risk</div>
            <span
              className={`lc-sim-arrow lc-sim-arrow-${compositeTone}`}
              aria-hidden="true"
            >
              {arrowSymbol(compositeTone)}
            </span>
          </div>
          <div className="lc-sim-composite-value">
            {formatDelta(baseline.composite_risk, simulated.composite_risk)}
          </div>
          <div className="lc-sim-composite-sub">
            Drag a slider to see live impact on your risk profile.
          </div>
        </div>

        <div className="lc-sim-domains">
          {DOMAIN_ORDER.map((d) => {
            const baseScore = baseline.domains[d]?.score ?? 0;
            const simScore = simulated.domains[d]?.score ?? 0;
            const t = tone(baseScore, simScore);
            return (
              <div className="lc-sim-domain-row" key={d}>
                <div className="lc-sim-domain-label">{DOMAIN_LABELS[d]}</div>
                <div className="lc-sim-domain-delta">
                  {formatDelta(baseScore, simScore)}
                </div>
                <span
                  className={`lc-sim-arrow lc-sim-arrow-${t}`}
                  aria-hidden="true"
                >
                  {arrowSymbol(t)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
