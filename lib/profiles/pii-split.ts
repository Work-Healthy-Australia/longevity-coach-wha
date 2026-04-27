// Splits onboarding form state into the PII patch (writes to `profiles`)
// and the de-identified questionnaire payload (writes to
// `health_profiles.responses`). Keeps the form code unaware of the storage
// boundary while preserving the rule: PII lives on profiles only.

import type { ResponsesByStep } from "@/lib/questionnaire/schema";

export type ProfilePatch = {
  date_of_birth?: string | null;
  phone?: string | null;
  address_postal?: string | null;
};

export type SplitResult = {
  profilePatch: ProfilePatch;
  cleanedResponses: ResponsesByStep;
};

const PII_FIELDS = ["date_of_birth", "phone_mobile", "address_postal"] as const;

export function splitPii(responses: ResponsesByStep): SplitResult {
  const basics = (responses.basics ?? {}) as Record<string, unknown>;

  const dob = strOrNull(basics.date_of_birth);
  const phone = strOrNull(basics.phone_mobile);
  const address = strOrNull(basics.address_postal);

  const profilePatch: ProfilePatch = {};
  if (dob !== undefined) profilePatch.date_of_birth = dob;
  if (phone !== undefined) profilePatch.phone = phone;
  if (address !== undefined) profilePatch.address_postal = address;

  const cleanedBasics: Record<string, unknown> = { ...basics };
  for (const k of PII_FIELDS) delete cleanedBasics[k];

  const cleanedResponses: ResponsesByStep = { ...responses, basics: cleanedBasics };
  return { profilePatch, cleanedResponses };
}

function strOrNull(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;        // not touched by user this session
  if (v === null || v === "") return null;       // user cleared
  if (typeof v === "string") return v.trim() || null;
  return String(v);
}
