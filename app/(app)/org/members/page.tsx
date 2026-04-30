import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loose } from "@/lib/supabase/loose-table";
import { MembersClient } from "./MembersClient";
import { OrgNav } from "../_components/org-nav";
import "../org.css";
import "./members.css";

export const dynamic = "force-dynamic";

export default async function OrgMembersPage() {
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
    .select("id, name, b2b_plan_id")
    .eq("id", orgId)
    .single();

  if (!orgRaw) redirect("/dashboard");

  const org = orgRaw as { id: string; name: string; b2b_plan_id: string | null };

  const [
    allocationsResult,
    productInclusionsResult,
    membersResult,
    memberProductsResult,
    tierPlansResult,
    productsResult,
  ] = await Promise.all([
    org.b2b_plan_id
      ? db
          .schema("billing")
          .from("b2b_plan_tier_allocations")
          .select("id, b2b_plan_id, plan_id, seat_count")
          .eq("b2b_plan_id", org.b2b_plan_id)
      : Promise.resolve({ data: [] }),
    org.b2b_plan_id
      ? db
          .schema("billing")
          .from("b2b_plan_product_inclusions")
          .select("id, b2b_plan_id, allocation_id, product_id, quantity, frequency")
          .eq("b2b_plan_id", org.b2b_plan_id)
      : Promise.resolve({ data: [] }),
    db
      .schema("billing")
      .from("organisation_members")
      .select("org_id, user_uuid, role, tier_allocation_id")
      .eq("org_id", orgId),
    db
      .schema("billing")
      .from("organisation_member_products")
      .select("id, org_id, user_uuid, inclusion_id, is_enabled")
      .eq("org_id", orgId),
    db
      .schema("billing")
      .from("plans")
      .select("id, name, tier")
      .in("tier", ["core", "clinical", "elite"]),
    db
      .schema("billing")
      .from("products")
      .select("id, name")
      .eq("is_active", true),
  ]);

  type Member = { org_id: string; user_uuid: string; role: string; tier_allocation_id: string | null };
  const members = (membersResult.data ?? []) as Member[];
  const allUserUuids = [...new Set(members.map((m) => m.user_uuid))];

  const memberNames: Record<string, string> = {};
  const userEmails: Record<string, string> = {};

  if (allUserUuids.length > 0) {
    const [profilesResult, usersPage] = await Promise.all([
      admin.from("profiles").select("id, full_name").in("id", allUserUuids),
      admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);

    for (const p of profilesResult.data ?? []) {
      if (p.full_name) memberNames[p.id] = p.full_name;
    }
    for (const u of usersPage.data?.users ?? []) {
      if (u.email) userEmails[u.id] = u.email;
    }
  }

  type Allocation = { id: string; b2b_plan_id: string; plan_id: string; seat_count: number };
  type ProductInclusion = { id: string; b2b_plan_id: string; allocation_id: string; product_id: string; quantity: number; frequency: string };
  type TierPlan = { id: string; name: string; tier: string };
  type Product = { id: string; name: string };
  type MemberProduct = { id: string; org_id: string; user_uuid: string; inclusion_id: string; is_enabled: boolean };

  return (
    <>
    <OrgNav orgName={org.name} />
    <MembersClient
      orgName={org.name}
      members={members}
      allocations={(allocationsResult.data ?? []) as Allocation[]}
      productInclusions={(productInclusionsResult.data ?? []) as ProductInclusion[]}
      products={(productsResult.data ?? []) as Product[]}
      tierPlans={(tierPlansResult.data ?? []) as TierPlan[]}
      memberProducts={(memberProductsResult.data ?? []) as MemberProduct[]}
      memberNames={memberNames}
      userEmails={userEmails}
    />
    </>
  );
}
