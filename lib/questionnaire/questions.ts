// Onboarding questions ported from the Base44 reference repo
// (src/pages/Onboarding.jsx). Single source of truth for both the form
// renderer and the risk engine inputs.
//
// Deferred for Sunday with James:
//   - File uploads (blood, imaging, genetic, microbiome, hormonal, other)
//     - needs Supabase Storage bucket + RLS decision
//   - Detailed family-history sub-fields (age of onset, cancer types)
//     - start with a simple yes/no per category, deepen later
//   - Payment step - handled by /api/stripe/checkout, not part of this form

import type { QuestionnaireDef } from "./schema";

export const onboardingQuestionnaire: QuestionnaireDef = {
  steps: [
    {
      id: "basics",
      label: "About you",
      description:
        "Let's start with the basics. This helps us calibrate your risk scores and personalise your protocols.",
      fields: [
        { id: "first_name", label: "First name", type: "text", placeholder: "James" },
        { id: "last_name", label: "Last name", type: "text", placeholder: "Smith" },
        { id: "age", label: "Age", type: "number", placeholder: "42", suffix: "years" },
        {
          id: "sex",
          label: "Sex",
          type: "select",
          options: ["Male", "Female", "Prefer not to say"],
        },
        { id: "height_cm", label: "Height", type: "number", placeholder: "178", suffix: "cm" },
        { id: "weight_kg", label: "Weight", type: "number", placeholder: "82", suffix: "kg" },
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
          type: "text",
          optional: true,
          placeholder: "e.g. penicillin, shellfish",
        },
      ],
    },
    {
      id: "family",
      label: "Family history",
      description:
        "Toggle on any conditions present in first-degree relatives (parents, siblings).",
      fields: [
        { id: "cardiovascular", label: "Heart disease or stroke", type: "toggle" },
        { id: "cancer", label: "Cancer", type: "toggle" },
        { id: "neurodegenerative", label: "Neurodegenerative (Alzheimer's, Parkinson's)", type: "toggle" },
        { id: "diabetes", label: "Type 2 diabetes", type: "toggle" },
        { id: "osteoporosis", label: "Osteoporosis or fractures", type: "toggle" },
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
          type: "select",
          options: [
            "None",
            "Cardio only",
            "Weights only",
            "Mixed cardio + weights",
            "Sport/activity based",
          ],
        },
        {
          id: "sleep_hours",
          label: "Average sleep",
          type: "number",
          placeholder: "7",
          suffix: "hrs/night",
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
        "Confirm you understand how we'll use your data and that this isn't a substitute for medical advice.",
      fields: [
        {
          id: "data_processing",
          label:
            "I consent to my health data being processed to generate personalised risk scores and recommendations.",
          type: "toggle",
        },
        {
          id: "not_medical_advice",
          label:
            "I understand this is not a substitute for medical advice and should be used alongside professional healthcare.",
          type: "toggle",
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
