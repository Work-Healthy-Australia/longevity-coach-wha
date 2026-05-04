"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { safeRedirect } from "@/lib/auth/safe-redirect";

type State = {
  error?: string;
  success?: string;
  // Echo back submitted values so the form can repopulate inputs after a
  // server-side validation error (without storing the password).
  values?: { email?: string; full_name?: string };
};

const SIGNUP_FALLBACK = "/dashboard";

function originFromHeaders(h: Headers): string {
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("x-forwarded-host") ?? h.get("host");
  return `${proto}://${host}`;
}

export async function signIn(_: State, formData: FormData): Promise<State> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const redirectParam = formData.get("redirect");
  const values = { email };

  if (!email || !password)
    return { error: "Email and password are required.", values };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message, values };

  revalidatePath("/", "layout");
  redirect(safeRedirect(typeof redirectParam === "string" ? redirectParam : null));
}

export async function signUp(_: State, formData: FormData): Promise<State> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();
  const redirectParam = formData.get("redirect");
  const values = { email, full_name: fullName };

  if (!email || !password)
    return { error: "Email and password are required.", values };
  if (password.length < 8)
    return { error: "Password must be at least 8 characters.", values };

  const rawRedirect =
    typeof redirectParam === "string" ? redirectParam : null;
  const target = safeRedirect(rawRedirect, SIGNUP_FALLBACK);
  const hasRedirect =
    rawRedirect !== null && rawRedirect.length > 0 && target !== SIGNUP_FALLBACK;

  const supabase = await createClient();
  const origin = originFromHeaders(await headers());

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(target)}`,
      data: { full_name: fullName },
    },
  });
  if (error) return { error: error.message, values };

  let verifyUrl = `/verify-email?email=${encodeURIComponent(email)}`;
  if (hasRedirect) verifyUrl += `&redirect=${encodeURIComponent(target)}`;
  redirect(verifyUrl);
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

export async function requestPasswordReset(
  _: State,
  formData: FormData,
): Promise<State> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Email is required." };

  const supabase = await createClient();
  const origin = originFromHeaders(await headers());

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });
  if (error) return { error: error.message };

  return { success: "If an account exists for that email, a reset link is on its way." };
}

export async function updatePassword(
  _: State,
  formData: FormData,
): Promise<State> {
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) return { error: "Password must be at least 8 characters." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  redirect("/dashboard");
}
