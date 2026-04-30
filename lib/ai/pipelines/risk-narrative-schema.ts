// Pure Zod schema for the risk-narrative pipeline output. Lives in its own
// module so test/diagnostic code can import it without dragging in the
// providers / agent-factory module graph (which captures env at init time).

import { z } from 'zod';

// Bounds expressed via `.describe()` rather than `.min()/.max()`. Anthropic's
// structured-output endpoint rejects `minimum`/`maximum` on number types,
// causing every Atlas call to fail. We tell the model the range in prose
// and enforce it post-parse via `clampAtlasOutput()` in the pipeline.
// Permissive list — accepts strings or any other shape (the model often
// returns `{ name, score }` for risk drivers despite the schema asking for
// strings). z.unknown() avoids producing JSON-schema constraints Anthropic
// rejects (`propertyNames`, `additionalProperties` on records, etc.).
// Stringification happens post-parse via `coerceStringList()`.
const StringList = z.array(z.unknown());

export const RiskNarrativeOutputSchema = z.object({
  biological_age: z.number().describe('Estimated biological age in years (expected 18–120).'),
  cv_risk: z.number().describe('Cardiovascular risk score 0–100 (higher = more risk).'),
  metabolic_risk: z.number().describe('Metabolic risk score 0–100.'),
  neuro_risk: z.number().describe('Neurodegenerative risk score 0–100.'),
  onco_risk: z.number().describe('Oncological risk score 0–100.'),
  msk_risk: z.number().describe('Musculoskeletal risk score 0–100.'),
  longevity_score: z.number().describe('Composite longevity score 0–100 (higher = better).'),
  // No min/max on narrative either — the model overruns 800 frequently and
  // truncating mid-JSON breaks downstream array fields. We trim post-parse.
  narrative: z.string().describe('1–3 short paragraphs explaining the score and top drivers in patient-friendly language.'),
  top_risk_drivers: StringList.describe('Up to 5 short strings naming the top modifiable risk drivers.'),
  top_protective_levers: StringList,
  recommended_screenings: StringList,
  confidence_level: z.enum(['low', 'moderate', 'high', 'insufficient']),
  data_gaps: StringList,
});

// Raw shape after Zod parse (arrays may contain objects). Use this only as
// the input to `clampAtlasOutput()`.
export type RiskNarrativeRaw = z.infer<typeof RiskNarrativeOutputSchema>;

// Cleaned shape after `clampAtlasOutput()` runs — what the DB write expects.
export type RiskNarrativeOutput = {
  biological_age: number;
  cv_risk: number;
  metabolic_risk: number;
  neuro_risk: number;
  onco_risk: number;
  msk_risk: number;
  longevity_score: number;
  narrative: string;
  top_risk_drivers: string[];
  top_protective_levers: string[];
  recommended_screenings: string[];
  confidence_level: 'low' | 'moderate' | 'high' | 'insufficient';
  data_gaps: string[];
};

export const ATLAS_NUMBER_BOUNDS: Record<keyof RiskNarrativeOutput, [number, number] | null> = {
  biological_age: [18, 120],
  cv_risk: [0, 100],
  metabolic_risk: [0, 100],
  neuro_risk: [0, 100],
  onco_risk: [0, 100],
  msk_risk: [0, 100],
  longevity_score: [0, 100],
  narrative: null,
  top_risk_drivers: null,
  top_protective_levers: null,
  recommended_screenings: null,
  confidence_level: null,
  data_gaps: null,
};

// Coerce object entries (e.g. { name: 'High LDL', score: 75 }) into short
// strings so downstream code that expects `text[]` columns sees plain text.
function coerceStringList(list: unknown[]): string[] {
  return list.map((item) => {
    if (typeof item === 'string') return item;
    if (item == null) return '';
    if (typeof item !== 'object') return String(item);
    const obj = item as Record<string, unknown>;
    const name = obj.name ?? obj.label ?? obj.title ?? obj.driver;
    if (typeof name === 'string' && name.length > 0) {
      const score = obj.score ?? obj.value;
      return typeof score === 'number' ? `${name} (${score})` : name;
    }
    return JSON.stringify(item);
  }).filter((s) => s.length > 0);
}

const NARRATIVE_MAX_CHARS = 2400;

// Soft validation: log a warning if any number is out of bounds, then clamp
// to the bound so a slightly-off LLM response still produces a usable row
// rather than silently dropping the whole narrative. Also coerces array
// fields to plain strings and trims absurdly long narratives.
export function clampAtlasOutput(out: RiskNarrativeRaw): RiskNarrativeOutput {
  const clamped: RiskNarrativeOutput = {
    biological_age: out.biological_age,
    cv_risk: out.cv_risk,
    metabolic_risk: out.metabolic_risk,
    neuro_risk: out.neuro_risk,
    onco_risk: out.onco_risk,
    msk_risk: out.msk_risk,
    longevity_score: out.longevity_score,
    narrative:
      out.narrative.length > NARRATIVE_MAX_CHARS
        ? `${out.narrative.slice(0, NARRATIVE_MAX_CHARS - 1)}…`
        : out.narrative,
    top_risk_drivers: coerceStringList(out.top_risk_drivers),
    top_protective_levers: coerceStringList(out.top_protective_levers),
    recommended_screenings: coerceStringList(out.recommended_screenings),
    confidence_level: out.confidence_level,
    data_gaps: coerceStringList(out.data_gaps),
  };

  for (const [key, bounds] of Object.entries(ATLAS_NUMBER_BOUNDS)) {
    if (!bounds) continue;
    const k = key as keyof RiskNarrativeOutput;
    const v = clamped[k] as number;
    if (typeof v !== 'number' || Number.isNaN(v)) continue;
    const [lo, hi] = bounds;
    if (v < lo || v > hi) {
      console.warn(
        JSON.stringify({
          event: 'atlas_out_of_bounds',
          field: k,
          value: v,
          bounds: { lo, hi },
        }),
      );
      (clamped as Record<string, unknown>)[k] = Math.max(lo, Math.min(hi, v));
    }
  }
  return clamped;
}
