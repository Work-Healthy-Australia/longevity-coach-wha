import { createAdminClient } from "@/lib/supabase/admin";
import { loose } from "@/lib/supabase/loose-table";
import { createClient } from "@/lib/supabase/server";

import { ProfileForm, type ProfileRow } from "./_form";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data } = await loose(admin)
    .from("clinician_profiles")
    .select(
      "user_uuid, title, full_name, qualifications, specialties, interests, bio, contact_email, contact_phone, languages, video_link, available_days, available_from, available_to, lunch_break_from, lunch_break_to, session_duration_minutes, timezone, is_active"
    )
    .eq("user_uuid", user.id)
    .maybeSingle();

  const profile: ProfileRow | null = data ?? null;

  return (
    <div>
      <h1>Profile</h1>
      <p className="muted" style={{ marginBottom: 16 }}>
        Patients see your name, specialties, and bio when nominating a clinician for care-team access.
      </p>
      <ProfileForm initial={profile} />
    </div>
  );
}
