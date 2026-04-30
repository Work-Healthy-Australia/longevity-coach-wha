"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

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

export async function updateIdentity(
  _prev: IdentityState | null,
  formData: FormData,
): Promise<IdentityState> {
  const submitted: IdentityValues = {
    full_name: String(formData.get("full_name") ?? ""),
    date_of_birth: String(formData.get("date_of_birth") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    address_postal: String(formData.get("address_postal") ?? ""),
  };

  const parsed = identitySchema.safeParse(submitted);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      error: first?.message ?? "Invalid input.",
      values: submitted,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Not signed in.", values: submitted };
  }

  const { full_name, date_of_birth, phone, address_postal } = parsed.data;

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name,
      date_of_birth,
      phone,
      address_postal,
    })
    .eq("id", user.id);

  if (error) {
    return { error: error.message, values: submitted };
  }

  revalidatePath("/", "layout");

  return {
    success: "Saved.",
    values: {
      full_name,
      date_of_birth: date_of_birth ?? "",
      phone: phone ?? "",
      address_postal: address_postal ?? "",
    },
  };
}
