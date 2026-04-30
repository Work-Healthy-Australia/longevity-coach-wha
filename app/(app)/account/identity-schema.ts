import { z } from "zod";

export type IdentityValues = {
  full_name?: string;
  date_of_birth?: string;
  phone?: string;
  address_postal?: string;
};

export type IdentityState = {
  error?: string;
  success?: string;
  values?: IdentityValues;
};

const MIN_AGE_YEARS = 13;

const emptyToNull = (v: unknown): unknown =>
  typeof v === "string" && v.trim() === "" ? null : v;

const trimmedOrNull = (v: unknown): unknown => {
  if (typeof v !== "string") return v;
  const trimmed = v.trim();
  return trimmed === "" ? null : trimmed;
};

export const identitySchema = z.object({
  full_name: z
    .string()
    .transform((v) => v.trim())
    .pipe(
      z
        .string()
        .min(2, "Name must be at least 2 characters")
        .max(120, "Name must be 120 characters or fewer"),
    ),
  date_of_birth: z.preprocess(
    emptyToNull,
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Use format YYYY-MM-DD")
      .refine((s) => {
        const d = new Date(s);
        return !Number.isNaN(d.getTime()) && d < new Date();
      }, "Date of birth must be in the past")
      .refine((s) => {
        const d = new Date(s);
        const ageMs = Date.now() - d.getTime();
        return ageMs >= MIN_AGE_YEARS * 365.25 * 24 * 60 * 60 * 1000;
      }, `You must be at least ${MIN_AGE_YEARS} years old`)
      .nullable(),
  ),
  phone: z.preprocess(
    trimmedOrNull,
    z
      .string()
      .min(5, "Phone must be at least 5 characters")
      .max(30, "Phone must be 30 characters or fewer")
      .nullable(),
  ),
  address_postal: z.preprocess(
    trimmedOrNull,
    z
      .string()
      .min(2, "Address must be at least 2 characters")
      .max(200, "Address must be 200 characters or fewer")
      .nullable(),
  ),
});
