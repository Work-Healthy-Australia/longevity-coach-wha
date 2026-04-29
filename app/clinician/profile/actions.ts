"use server";

import { redirect } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { loose } from "@/lib/supabase/loose-table";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { error?: string; success?: string };

const DAY_LOOKUP: Record<string, number> = {
  sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tuesday: 2, wed: 3, wednesday: 3,
  thu: 4, thursday: 4, fri: 5, friday: 5, sat: 6, saturday: 6,
};

function csvToArray(raw: string): string[] {
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

function csvToDays(raw: string): number[] {
  return csvToArray(raw)
    .map((s) => DAY_LOOKUP[s.toLowerCase()] ?? Number.parseInt(s, 10))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
}

function emptyToNull(s: FormDataEntryValue | null): string | null {
  const v = (s ?? "").toString().trim();
  return v === "" ? null : v;
}

export async function saveProfile(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();

  const row = {
    user_uuid: user.id,
    title: emptyToNull(formData.get("title")),
    full_name: String(formData.get("full_name") ?? "").trim(),
    qualifications: emptyToNull(formData.get("qualifications")),
    specialties: csvToArray(String(formData.get("specialties") ?? "")),
    interests: csvToArray(String(formData.get("interests") ?? "")),
    bio: emptyToNull(formData.get("bio")),
    contact_email: emptyToNull(formData.get("contact_email")),
    contact_phone: emptyToNull(formData.get("contact_phone")),
    languages: csvToArray(String(formData.get("languages") ?? "")),
    video_link: emptyToNull(formData.get("video_link")),
    available_days: csvToDays(String(formData.get("available_days") ?? "")),
    available_from: emptyToNull(formData.get("available_from")),
    available_to: emptyToNull(formData.get("available_to")),
    lunch_break_from: emptyToNull(formData.get("lunch_break_from")),
    lunch_break_to: emptyToNull(formData.get("lunch_break_to")),
    session_duration_minutes: Number(formData.get("session_duration_minutes") ?? 30),
    timezone: String(formData.get("timezone") ?? "Australia/Sydney").trim() || "Australia/Sydney",
    is_active: String(formData.get("is_active") ?? "true") === "true",
  };

  if (!row.full_name) return { error: "Full name is required." };

  const { error } = await loose(admin)
    .from("clinician_profiles")
    .upsert(row, { onConflict: "user_uuid" });
  if (error) return { error: error.message ?? "Failed to save." };

  return { success: "Profile saved." };
}
