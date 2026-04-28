// Public contract for the deterministic risk engine.
// Atlas (the AI risk-narrative pipeline) consumes this barrel.

export { scoreRisk } from "./scorer";
export { assemblePatientFromDB, buildPatientInput } from "./assemble";

export type {
  EngineOutput,
  PatientInput,
  DomainResult,
  DomainsRecord,
  DomainName,
  DomainWeights,
  Factor,
  ModifiableRisk,
  TrajectoryResult,
  ScoreConfidence,
  ConfidenceLevel,
  RiskLevel,
  Sex,
  BloodPanel,
  Imaging,
  Genetic,
  Hormonal,
  Microbiome,
  Biomarkers,
  FamilyHistory,
  FamilyHistoryCondition,
  FamilyHistoryCancer,
  Lifestyle,
  MedicalHistory,
  WearableData,
  Demographics,
} from "./types";
