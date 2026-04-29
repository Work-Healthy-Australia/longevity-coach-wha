// Types for the deterministic risk engine. Ported from base-44.
// All scorers consume `PatientInput` and return `DomainResult`.
// `EngineOutput` is the contract for downstream consumers (Atlas, dashboard, PDF).

export type Sex = "male" | "female";

export type SmokingStatus =
  | "never"
  | "former_over_10y"
  | "former"
  | "former_under_10y"
  | "current";

export type DietType =
  | "mediterranean"
  | "paleo"
  | "keto"
  | "vegan"
  | "vegetarian"
  | "pescatarian"
  | "omnivore"
  | "standard_western"
  | "other";

export type StressLevel = "low" | "moderate" | "high" | "chronic";

export type ApoeStatus = "e2/e2" | "e2/e3" | "e3/e3" | "e3/e4" | "e4/e4";

export type DomainName =
  | "cardiovascular"
  | "metabolic"
  | "neurodegenerative"
  | "oncological"
  | "musculoskeletal";

export type RiskLevel = "very_low" | "low" | "moderate" | "high" | "very_high";

export type ConfidenceLevel = "high" | "moderate" | "low" | "insufficient";

export interface BloodPanel {
  apoB?: number;
  lp_a?: number;
  ldl?: number;
  hdl?: number;
  triglycerides?: number;
  hsCRP?: number;
  homocysteine?: number;
  hba1c?: number;
  fasting_insulin?: number;
  HOMA_IR?: number;
  fasting_glucose?: number;
  uric_acid?: number;
  ALT?: number;
  GGT?: number;
  vitamin_B12?: number;
  vitamin_D?: number;
  omega3_index?: number;
  testosterone_total?: number;
  magnesium_rbc?: number;
  neutrophil_lymphocyte_ratio?: number;
  [k: string]: number | undefined;
}

export interface Imaging {
  coronary_calcium_score?: number;
  carotid_IMT?: number;
  liver_fat_fraction?: number;
  visceral_fat_area_cm2?: number;
  DEXA_t_score_spine?: number;
  DEXA_t_score_hip?: number;
}

export interface Genetic {
  APOE_status?: ApoeStatus;
  BRCA1?: "positive" | "negative" | "VUS";
  BRCA2?: "positive" | "negative" | "VUS";
  Lynch_syndrome?: "positive" | "negative";
  polygenic_risk_scores?: {
    cardiovascular?: number;
    type2_diabetes?: number;
    alzheimers?: number;
    colorectal_cancer?: number;
  };
}

export interface Hormonal {
  IGF1?: number;
  estradiol?: number;
}

export interface Microbiome {
  diversity_index?: number;
}

export interface Biomarkers {
  blood_panel?: BloodPanel;
  imaging?: Imaging;
  genetic?: Genetic;
  hormonal?: Hormonal;
  microbiome?: Microbiome;
}

export interface FamilyHistoryCondition {
  first_degree?: boolean;
  second_degree?: boolean;
  age_onset?: number;
  multiple?: boolean;
}

export interface FamilyHistoryCancer extends FamilyHistoryCondition {
  types?: string[];
}

export interface FamilyHistory {
  cardiovascular?: FamilyHistoryCondition;
  cancer?: FamilyHistoryCancer;
  neurodegenerative?: FamilyHistoryCondition;
  diabetes?: FamilyHistoryCondition;
  osteoporosis?: FamilyHistoryCondition;
}

export interface Lifestyle {
  smoking_status?: SmokingStatus;
  exercise_minutes_weekly?: number;
  exercise_type?: string;
  sleep_hours?: number;
  diet_type?: DietType;
  stress_level?: StressLevel;
  alcohol_units_weekly?: number;
}

export interface MedicalHistory {
  conditions?: string[];
  medications?: string[];
  allergies?: string[];
  surgeries?: string[];
}

export interface WearableData {
  resting_hr?: number;
  hrv_rmssd?: number;
  vo2max_estimated?: number;
  avg_daily_steps?: number;
  avg_sleep_duration?: number;
  avg_deep_sleep_pct?: number;
}

export interface Demographics {
  age?: number;
  sex?: Sex;
  height_cm?: number;
  weight_kg?: number;
  systolic_bp_mmHg?: number;  // NEW — vital sign, optional
}

export interface PatientInput {
  patient_id?: string;
  demographics?: Demographics;
  family_history?: FamilyHistory;
  medical_history?: MedicalHistory;
  lifestyle?: Lifestyle;
  biomarkers?: Biomarkers;
  wearable_data?: WearableData;
  adherence_rate?: number;
}

export interface Factor {
  name: string;
  raw_value: unknown;
  unit?: string;
  score: number;
  weight: number;
  modifiable: boolean;
  optimal_range?: string;
  standard_range?: string;
  note?: string | null;
}

export interface ModifiableRisk extends Factor {
  domain: DomainName;
}

export interface DomainResult {
  domain: DomainName;
  score: number;
  risk_level: RiskLevel;
  factors: Factor[];
  top_modifiable_risks: Factor[];
  data_completeness: number;
}

export interface DomainsRecord {
  cardiovascular: DomainResult;
  metabolic: DomainResult;
  neurodegenerative: DomainResult;
  oncological: DomainResult;
  musculoskeletal: DomainResult;
}

export type DomainWeights = Record<DomainName, number>;

export interface ProjectedImprovement {
  factor: string;
  domain: DomainName;
  current_score: number;
  projected_score: number;
  improvement: number;
  confidence: "high" | "moderate";
  optimal_range?: string;
}

export interface TrajectoryResult {
  current_longevity_score: number;
  projected_longevity_score: number;
  projected_improvement: number;
  improvements: ProjectedImprovement[];
  timeframe_months: number;
  assumptions: string;
}

export interface ScoreConfidence {
  level: ConfidenceLevel;
  note: string;
}

export interface EngineOutput {
  longevity_score: number;
  longevity_label: "Optimal" | "Good" | "Needs Attention" | "Concerning" | "Critical";
  composite_risk: number;
  biological_age: number;
  // NOTE: chronological_age and age_delta are NOT included — they are derived at read time
  risk_level: RiskLevel;
  trajectory_6month: TrajectoryResult;
  domains: DomainsRecord;
  domain_weights: DomainWeights;
  top_risks: ModifiableRisk[];
  data_completeness: number;
  score_confidence: ConfidenceLevel;
  last_calculated: string;
  next_recommended_tests: string[];
}

// ------------------------------------------------------------
// Spec-alias types (consumed by questionnaire adapter and Atlas)
// ------------------------------------------------------------

/** Alias for Demographics — age is computed at call time, never stored */
export type PatientDemographics = Required<Pick<Demographics, "age" | "sex" | "height_cm" | "weight_kg">>;

/** Alias for Factor — used by questionnaire adapter and downstream consumers */
export type FactorResult = Factor;

/** Alias for DomainsRecord */
export type DomainScores = DomainsRecord;

/** Trajectory projection shape expected by downstream consumers */
export interface TrajectoryProjection {
  current_longevity_score: number;
  projected_longevity_score: number;
  projected_improvement: number;
  improvement_factors: Array<{
    name: string;
    current_score: number;
    projected_score: number;
    improvement: number;
  }>;
}
