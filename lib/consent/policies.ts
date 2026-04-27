// Versioned consent policies. Bump the version string whenever the wording
// or scope of a policy changes — that's what makes the audit trail useful.
// Versions use date-prefix `YYYY-MM-DD-N` so they sort chronologically and
// you can read the date of the change at a glance.

export const CONSENT_POLICIES = {
  data_processing: { version: "2026-04-27-1" },
  not_medical_advice: { version: "2026-04-27-1" },
  terms: { version: "2026-04-27-1" },
  app5_collection_notice: { version: "2026-04-27-1" },
} as const;

export type PolicyId = keyof typeof CONSENT_POLICIES;

export function policyVersion(id: PolicyId): string {
  return CONSENT_POLICIES[id].version;
}
