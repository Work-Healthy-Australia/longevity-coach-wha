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
  | "allergy_list"; // FHIR AllergyIntolerance — list of {substance, category, criticality, reaction}

// Shape of a single allergy entry in `allergy_list` field values.
// Aligned with FHIR AllergyIntolerance.category + criticality value sets.
export type AllergyEntry = {
  substance: string;
  category: "medication" | "food" | "environment" | "biologic" | "other";
  criticality: "low" | "high" | "unable-to-assess";
  reaction?: string;
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
