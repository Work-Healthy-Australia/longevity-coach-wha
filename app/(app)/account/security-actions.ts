"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

import {
  type EmailState,
  type PasswordState,
  emailSchema,
  passwordSchema,
} from "./security-schema";

function originFromHeaders(h: Headers): string {
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("x-forwarded-host") ?? h.get("host");
  return `${proto}://${host}`;
}

export async function changePassword(
  _prev: PasswordState | null,
  formData: FormData,
): Promise<PasswordState> {
  try {
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
  } catch (err) {
    console.error("[changePassword] uncaught error:", err);
    const message =
      err instanceof Error ? err.message : "Unexpected error updating password.";
    return { error: `Update failed: ${message}` };
  }
}

export async function changeEmail(
  _prev: EmailState | null,
  formData: FormData,
): Promise<EmailState> {
  const submitted = String(formData.get("new_email") ?? "");

  try {
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
    if (!user)
      return { error: "Not signed in.", values: { new_email: submitted } };

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
  } catch (err) {
    console.error("[changeEmail] uncaught error:", err);
    const message =
      err instanceof Error ? err.message : "Unexpected error updating email.";
    return {
      error: `Update failed: ${message}`,
      values: { new_email: submitted },
    };
  }
}
