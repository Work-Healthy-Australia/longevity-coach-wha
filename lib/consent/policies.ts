// Versioned consent policies. Bump the version string whenever the wording
// or scope of a policy changes — that's what makes the audit trail useful.
// Versions use date-prefix `YYYY-MM-DD-N` so they sort chronologically and
// you can read the date of the change at a glance.

export const CONSENT_POLICIES = {
  data_processing: { version: "2026-04-27-1" },
  not_medical_advice: { version: "2026-04-27-1" },
  terms: { version: "2026-04-27-1" },
  app5_collection_notice: { version: "2026-04-27-1" },
  // Care-team access: AHPRA-required record of patient nominating a clinician
  // (or revoking) — one row per acceptance, paired with the patient_assignments row.
  care_team_access: { version: "2026-04-29-1" },
  // "We never train AI models on your personal data" — positive commitment
  // surfaced in the consent step and on /account.
  data_no_training: { version: "2026-04-29-1" },
} as const;

export type PolicyId = keyof typeof CONSENT_POLICIES;

export function policyVersion(id: PolicyId): string {
  return CONSENT_POLICIES[id].version;
}
