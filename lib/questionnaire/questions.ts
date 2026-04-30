// Onboarding questions ported from the Base44 reference repo
// (src/pages/Onboarding.jsx). Single source of truth for both the form
// renderer and the risk engine inputs.
//
// Deferred for Sunday with James:
//   - File uploads (blood, imaging, genetic, microbiome, hormonal, other)
//     - needs Supabase Storage bucket + RLS decision
//   - Payment step - handled by /api/stripe/checkout, not part of this form

import type { QuestionnaireDef } from "./schema";

export const RELATIVES = [
  "Mother",
  "Father",
  "Sister",
  "Brother",
  "Maternal grandmother",
  "Maternal grandfather",
  "Paternal grandmother",
  "Paternal grandfather",
  "Aunt or uncle",
  "None",
] as const;

// Progressive disclosure: Y/N → type chips → per-type relatives + onset.
// Curated list pending James's clinical sub-type review; "Other" + "Don't know
// specific type" are escape hatches so members aren't forced into false precision.
export const CANCER_TYPES = [
  "Breast",
  "Colorectal",
  "Lung",
  "Prostate",
  "Ovarian",
  "Pancreatic",
  "Melanoma / skin",
  "Leukaemia / lymphoma",
  "Don't know specific type",
  "Other",
] as const;

export const onboardingQuestionnaire: QuestionnaireDef = {
  steps: [
    {
      id: "basics",
      label: "About you",
      description:
        "Let's start with the basics. This helps us calibrate your risk scores and personalise your protocols.",
      fields: [
        { id: "date_of_birth", label: "Date of birth", type: "date" },
        {
          id: "sex_at_birth",
          label: "Sex assigned at birth",
          type: "select",
          options: ["Male", "Female", "Intersex", "Prefer not to say"],
          helpText:
            "Used by the risk engine for sex-specific clinical scoring (cardiovascular, cancer, hormonal). FHIR-aligned.",
        },
        {
          id: "gender_identity",
          label: "Gender identity",
          type: "select",
          optional: true,
          options: ["Man", "Woman", "Non-binary", "Other", "Prefer not to say"],
          helpText: "How you identify. Used for respectful communication.",
        },
        { id: "height_cm", label: "Height", type: "number", placeholder: "178", suffix: "cm" },
        { id: "weight_kg", label: "Weight", type: "number", placeholder: "82", suffix: "kg" },
        {
          id: "waist_circumference_cm",
          label: "Waist circumference",
          type: "number",
          optional: true,
          placeholder: "92",
          suffix: "cm",
          min: 40,
          max: 200,
          step: 1,
          helpText:
            "Measured at the level of the navel, after a normal exhale. Used as a proxy for visceral fat when no DEXA scan is available.",
        },
        {
          id: "systolic_bp_mmHg",
          label: "Recent systolic BP reading",
          type: "number",
          optional: true,
          placeholder: "120",
          suffix: "mmHg",
          min: 70,
          max: 250,
          step: 1,
          helpText:
            "If you have a recent reading from a clinic, home monitor, or pharmacy. Skip if you don't have one. The top number on a BP reading.",
        },
        {
          id: "ethnicity",
          label: "Ethnicity",
          type: "select",
          options: [
            "Caucasian",
            "African",
            "Asian",
            "Hispanic/Latino",
            "Middle Eastern",
            "South Asian",
            "Pacific Islander",
            "Mixed",
            "Other",
          ],
        },
        {
          id: "phone_mobile",
          label: "Mobile phone",
          type: "text",
          placeholder: "+61 4XX XXX XXX",
        },
        {
          id: "address_postal",
          label: "Postal address",
          type: "textarea",
          placeholder: "Street, city, state, postcode, country",
        },
      ],
    },
    {
      id: "medical",
      label: "Medical history",
      description:
        "Your medical history helps us identify existing conditions and medication interactions.",
      fields: [
        {
          id: "conditions",
          label: "Current conditions",
          type: "multiselect",
          options: [
            "None",
            "Hypertension",
            "Type 2 diabetes",
            "Pre-diabetes",
            "High cholesterol",
            "Heart disease",
            "Thyroid disorder",
            "Autoimmune condition",
            "Anxiety/depression",
            "Sleep apnoea",
            "Other",
          ],
        },
        {
          id: "medications",
          label: "Current medications",
          type: "text",
          optional: true,
          placeholder: "e.g. lisinopril, metformin",
        },
        {
          id: "surgeries",
          label: "Previous surgeries",
          type: "text",
          optional: true,
          placeholder: "e.g. appendectomy 2015, knee arthroscopy 2020",
        },
        {
          id: "allergies",
          label: "Allergies",
          type: "allergy_list",
          optional: true,
          helpText:
            "Capture each allergy with its category and severity. High-severity allergies are flagged to your clinician.",
        },
      ],
    },
    {
      id: "family",
      label: "Family history",
      description:
        "Add each family member you know about. Mark which conditions they had and at what age. The richest data feeds the most accurate risk picture.",
      fields: [
        {
          id: "family_members",
          label: "Family members",
          type: "family_members",
          optional: true,
          helpText:
            "Add parents, siblings, grandparents, aunts, and uncles. Skip any you don't know about.",
        },
        {
          id: "cancer_history",
          label: "Cancer in your family",
          type: "cancer_history",
          optional: true,
          helpText:
            "Cancer type, age, and which relatives are the strongest signals for inherited risk. Skip anything you don't know.",
        },
      ],
    },
    {
      id: "lifestyle",
      label: "Lifestyle",
      description:
        "Lifestyle factors are the most modifiable part of your risk profile - this is where we can make the biggest impact.",
      fields: [
        {
          id: "smoking",
          label: "Smoking status",
          type: "select",
          options: [
            "Never",
            "Former (>10 years ago)",
            "Former (<10 years ago)",
            "Current",
          ],
        },
        {
          id: "alcohol",
          label: "Alcohol intake",
          type: "select",
          options: [
            "None",
            "1–7 units/week",
            "8–14 units/week",
            "15–21 units/week",
            "21+ units/week",
          ],
        },
        {
          id: "exercise_volume",
          label: "Exercise volume",
          type: "select",
          options: [
            "None",
            "Light (<75 min/week)",
            "Moderate (75–150 min/week)",
            "Active (150–300 min/week)",
            "Very active (300+ min/week)",
          ],
        },
        {
          id: "exercise_type",
          label: "Exercise type",
          type: "multiselect",
          options: [
            "None",
            "Cardio",
            "Weights",
            "Sport/activity based",
          ],
        },
        {
          id: "sleep_hours",
          label: "Average sleep",
          type: "number",
          placeholder: "7",
          suffix: "hrs/night",
          min: 1,
          max: 12,
          step: 1,
        },
        {
          id: "sleep_quality",
          label: "Sleep quality",
          type: "select",
          options: ["Excellent", "Good", "Fair", "Poor"],
        },
        {
          id: "stress",
          label: "Stress level",
          type: "select",
          options: ["Low", "Moderate", "High", "Chronic/severe"],
        },
        {
          id: "diet",
          label: "Diet type",
          type: "select",
          options: [
            "Mediterranean",
            "Whole food plant-based",
            "Paleo/ancestral",
            "Keto/low-carb",
            "Standard Western",
            "Vegetarian",
            "Vegan",
            "Other",
          ],
        },
        {
          id: "vo2max_estimated",
          label: "VO₂max",
          type: "number",
          optional: true,
          placeholder: "42",
          suffix: "mL/kg/min",
          min: 10,
          max: 90,
          step: 1,
          helpText:
            "If you know your VO₂max from a clinical assessment or a wearable (Apple Watch, Garmin, Whoop), enter it here. This is the single biggest mortality predictor in the bio-age model. Skip if unknown.",
        },
      ],
    },
    {
      id: "goals",
      label: "Your goals",
      description:
        "Select your top priorities. We'll weight your protocols and coach sessions towards these goals.",
      fields: [
        {
          id: "priorities",
          label: "Top priorities (up to 5)",
          type: "chips",
          maxSelect: 5,
          options: [
            "Reduce cardiovascular risk",
            "Lose weight / improve body composition",
            "Optimise metabolic health",
            "Improve sleep quality",
            "Increase energy levels",
            "Build muscle / strength",
            "Reduce inflammation",
            "Cognitive performance",
            "Slow biological ageing",
            "Cancer risk reduction",
            "Bone density / joint health",
            "Hormonal optimisation",
          ],
        },
        {
          id: "notes",
          label: "Anything else you'd like to share?",
          type: "textarea",
          optional: true,
          placeholder: "Additional context about your health goals, concerns, or priorities…",
        },
      ],
    },
    {
      id: "consent",
      label: "Consent",
      description:
        "Before we generate your risk scores we need four confirmations. Please read the linked Personal information collection notice — it lists every third party we share your data with and your rights under the Australian Privacy Principles.",
      fields: [
        {
          id: "data_processing",
          label:
            "I have read the Personal information collection notice and consent to my health data being processed (including disclosure to overseas processors named in the notice) to generate personalised risk scores and recommendations.",
          type: "toggle",
          helpText: "Required. Acceptance is recorded against the notice version shown on that page.",
        },
        {
          id: "not_medical_advice",
          label:
            "I understand this service is informational and is not a substitute for medical advice, diagnosis or treatment from a qualified health practitioner.",
          type: "toggle",
        },
        {
          id: "data_no_training",
          label:
            "I understand Longevity Coach does not train AI models on my personal data.",
          type: "toggle",
          helpText:
            "Required. See the data handling page for details on how we work with AI providers.",
        },
        {
          id: "terms",
          label: "I agree to the privacy policy and terms of service.",
          type: "toggle",
        },
      ],
    },
  ],
};
