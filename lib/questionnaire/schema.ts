// Schema-driven onboarding questionnaire. The Base44 onboarding form was
// hand-written component-per-step; this version drives all rendering from a
// declarative schema so we can add/edit/reorder questions without touching UI.
//
// Responses are stored as `health_profiles.responses` JSONB, keyed by
// `step.id` -> `field.id`. The risk engine reads from this same shape.

export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "date"
  | "select"
  | "multiselect"
  | "chips"   // multi-select with a selection limit, rendered as pill buttons
  | "toggle"
  | "allergy_list"  // FHIR AllergyIntolerance — list of {substance, category, criticality, reaction}
  | "cancer_history"; // progressive Y/N → type chips → per-type relatives + onset

// Shape of a single allergy entry in `allergy_list` field values.
// Aligned with FHIR AllergyIntolerance.category + criticality value sets.
export type AllergyEntry = {
  substance: string;
  category: "medication" | "food" | "environment" | "biologic" | "other";
  criticality: "low" | "high" | "unable-to-assess";
  reaction?: string;
};

// Shape of `cancer_history` field value. FHIR FamilyMemberHistory.condition[]-aligned.
// `status === "yes"` is the only state that surfaces type detail; "no" / "unknown"
// short-circuit the rest of the form.
export type CancerHistoryEntry = {
  type: string;          // canonical type (e.g. "Breast") or "Other"
  otherText?: string;    // free text when type === "Other" or "Don't know specific type"
  relatives?: string[];  // affected relatives (RELATIVES enum)
  onsetAge?: number;     // earliest age of onset
  onsetUnknown?: boolean; // member knows there was cancer but not the age
};

export type CancerHistoryValue = {
  status: "yes" | "no" | "unknown";
  entries?: CancerHistoryEntry[];
};

export type FieldDef = {
  id: string;
  label: string;
  type: FieldType;
  optional?: boolean;
  placeholder?: string;
  suffix?: string;       // for number inputs ("kg", "years", etc.)
  options?: string[];    // for select / multiselect / chips
  maxSelect?: number;    // for chips (limit number of choices)
  helpText?: string;
  // Numeric constraints. Applied as HTML5 attributes on number inputs and
  // enforced server-side in validation. `step: 1` => whole numbers only.
  min?: number;
  max?: number;
  step?: number;
};

export type StepDef = {
  id: string;
  label: string;
  description?: string;
  fields: FieldDef[];
};

export type ResponsesByStep = Record<string, Record<string, unknown>>;

export type QuestionnaireDef = {
  steps: StepDef[];
};
