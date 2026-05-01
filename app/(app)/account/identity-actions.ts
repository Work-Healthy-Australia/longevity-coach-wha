"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

import {
  type IdentityState,
  type IdentityValues,
  identitySchema,
} from "./identity-schema";

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
