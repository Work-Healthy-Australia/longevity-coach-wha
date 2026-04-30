import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loose } from "@/lib/supabase/loose-table";
import { InviteClient } from "./_components/invite-client";
import "./invite.css";

export const dynamic = "force-dynamic";

export default async function OrgInvitePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const admin = createAdminClient();
  const db = loose(admin);

  // Check caller is a health_manager in an org
  const { data: managerRaw } = await db
    .schema("billing")
    .from("organisation_members")
    .select("org_id")
    .eq("user_uuid", user.id)
    .eq("role", "health_manager")
    .maybeSingle();

  if (!managerRaw) redirect("/dashboard");

  const orgId = (managerRaw as { org_id: string }).org_id;

  const { data: orgRaw } = await db
    .schema("billing")
    .from("organisations")
    .select("name")
    .eq("id", orgId)
    .single();

  const orgName = (orgRaw as { name: string } | null)?.name ?? "Organisation";

  return (
    <div className="inv-page">
      <div className="inv-header">
        <Link href="/org/members" className="inv-back">
          &larr; Back to members
        </Link>
        <h1 className="inv-title">Invite Members</h1>
        <p className="inv-subtitle">Upload a CSV to invite people to {orgName}</p>
      </div>
      <InviteClient />
    </div>
  );
}
