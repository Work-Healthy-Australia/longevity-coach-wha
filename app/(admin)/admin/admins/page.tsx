import { createAdminClient } from "@/lib/supabase/admin";
import { AdminAdminsUI } from "./_components/AdminAdminsUI";

export const metadata = { title: "Admins · Admin · Janet Cares" };
export const dynamic = "force-dynamic";

export default async function AdminAdminsPage() {
  const admin = createAdminClient();

  const [adminsRes, invitesRes] = await Promise.all([
    admin.from("profiles").select("id, full_name").eq("is_admin", true),
    admin
      .from("admin_invites")
      .select("email, invited_at, accepted_at")
      .order("invited_at", { ascending: false }),
  ]);

  const admins = adminsRes.data ?? [];
  const pending = (invitesRes.data ?? []).filter((i) => !i.accepted_at);

  return <AdminAdminsUI admins={admins} pendingInvites={pending} />;
}
