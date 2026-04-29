import { createAdminClient } from "@/lib/supabase/admin";
import { loose } from "@/lib/supabase/loose-table";

import { CliniciansClient, type ClinicianRow, type InviteRow } from "./CliniciansClient";

export const metadata = { title: "Clinicians · Admin · Longevity Coach" };
export const dynamic = "force-dynamic";

export default async function AdminCliniciansPage() {
  const admin = createAdminClient();

  const [{ data: profiles }, { data: invites }] = await Promise.all([
    admin
      .from("profiles")
      .select("id, full_name, role")
      .in("role", ["clinician", "coach"])
      .order("full_name", { ascending: true }),
    loose(admin)
      .from("clinician_invites")
      .select("id, email, full_name, role, status, expires_at, created_at")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  // Pair active clinician profiles to expose specialties + active flag.
  const ids = (profiles ?? []).map((p) => p.id);
  let profileRows: { user_uuid: string; specialties: string[]; is_active: boolean; contact_email: string | null }[] = [];
  if (ids.length > 0) {
    const { data } = await loose(admin)
      .from("clinician_profiles")
      .select("user_uuid, specialties, is_active, contact_email")
      .in("user_uuid", ids);
    profileRows = data ?? [];
  }

  const rows: ClinicianRow[] = (profiles ?? []).map((p) => {
    const cp = profileRows.find((r) => r.user_uuid === p.id);
    return {
      id: p.id,
      full_name: p.full_name ?? "—",
      role: p.role,
      contact_email: cp?.contact_email ?? null,
      specialties: cp?.specialties ?? [],
      is_active: cp?.is_active ?? true,
    };
  });

  const inviteRows: InviteRow[] = ((invites ?? []) as InviteRow[]).map((i) => ({
    id: i.id,
    email: i.email,
    full_name: i.full_name,
    role: i.role,
    status: i.status,
    expires_at: i.expires_at,
    created_at: i.created_at,
  }));

  return (
    <div>
      <h1>Clinicians</h1>
      <p className="muted">
        Invite a clinician by email. If they already have a Longevity Coach account, their
        role is updated immediately. Otherwise a Supabase invite is sent and access is
        granted automatically on sign-up.
      </p>
      <CliniciansClient initialRows={rows} invites={inviteRows} />
    </div>
  );
}
