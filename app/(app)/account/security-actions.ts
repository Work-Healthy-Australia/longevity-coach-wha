"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

export type PasswordState = { error?: string; success?: string };

export type EmailState = {
  error?: string;
  success?: string;
  values?: { new_email?: string };
};

export const passwordSchema = z
  .object({
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(200, "Password must be 200 characters or fewer"),
    confirm_password: z.string(),
  })
  .refine((d) => d.password === d.confirm_password, {
    path: ["confirm_password"],
    message: "Passwords do not match",
  });

export const emailSchema = z.object({
  new_email: z
    .string()
    .trim()
    .email("Enter a valid email address")
    .max(254, "Email is too long"),
});

function originFromHeaders(h: Headers): string {
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("x-forwarded-host") ?? h.get("host");
  return `${proto}://${host}`;
}

export async function changePassword(
  _prev: PasswordState | null,
  formData: FormData,
): Promise<PasswordState> {
  const parsed = passwordSchema.safeParse({
    password: String(formData.get("password") ?? ""),
    confirm_password: String(formData.get("confirm_password") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) return { error: error.message };

  revalidatePath("/account");
  return { success: "Password updated." };
}

export async function changeEmail(
  _prev: EmailState | null,
  formData: FormData,
): Promise<EmailState> {
  const submitted = String(formData.get("new_email") ?? "");
  const parsed = emailSchema.safeParse({ new_email: submitted });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid email.",
      values: { new_email: submitted },
    };
  }

  const newEmail = parsed.data.new_email.toLowerCase();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in.", values: { new_email: submitted } };

  if (user.email && user.email.toLowerCase() === newEmail) {
    return {
      error: "That is already your current email.",
      values: { new_email: submitted },
    };
  }

  const origin = originFromHeaders(await headers());

  const { error } = await supabase.auth.updateUser(
    { email: newEmail },
    { emailRedirectTo: `${origin}/auth/callback?next=/account` },
  );
  if (error) {
    return { error: error.message, values: { new_email: submitted } };
  }

  return {
    success: `Verification email sent to ${newEmail}. Click the link to confirm the change.`,
    values: { new_email: submitted },
  };
}
