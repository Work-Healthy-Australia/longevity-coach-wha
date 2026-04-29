import { createAdminClient } from "@/lib/supabase/admin";
import { loose } from "@/lib/supabase/loose-table";
import { PlanBuilderClient } from "./PlanBuilderClient";
import type {
  Org,
  B2BPlan,
  Allocation,
  ProductInclusion,
  TierPlan,
  Product,
  AuditRow,
  OrgMember,
  OrgMemberProduct,
  PlatformSetting,
} from "./types";
import "./plan-builder.css";

export const dynamic = "force-dynamic";

export default async function PlanBuilderPage() {
  const admin = createAdminClient();
  const db = loose(admin);

  const [
    orgsResult,
    b2bPlansResult,
    allocationsResult,
    productInclusionsResult,
    plansResult,
    productsResult,
    settingsResult,
    flaggedAuditResult,
    membersResult,
    memberProductsResult,
  ] = await Promise.all([
    db.schema("billing").from("organisations").select("id, name").order("name"),
    db.schema("billing").from("b2b_plans").select("*").order("created_at", { ascending: false }),
    db.schema("billing").from("b2b_plan_tier_allocations").select("*"),
    db.schema("billing").from("b2b_plan_product_inclusions").select("*"),
    db
      .schema("billing")
      .from("plans")
      .select("id, name, tier, base_price_cents")
      .in("tier", ["core", "clinical", "elite"]),
    db
      .schema("billing")
      .from("products")
      .select(
        "id, name, product_code, category, supplier_id, retail_cents, wholesale_cents, subscription_type, is_active"
      )
      .eq("is_active", true),
    db.schema("billing").from("platform_settings").select("key, value"),
    db
      .schema("billing")
      .from("b2b_plan_seat_audit")
      .select("*")
      .eq("is_flagged", true)
      .is("reviewed_at", null),
    db
      .schema("billing")
      .from("organisation_members")
      .select("org_id, user_uuid, role, tier_allocation_id"),
    db
      .schema("billing")
      .from("organisation_member_products")
      .select("id, org_id, user_uuid, inclusion_id, is_enabled"),
  ]);

  const allUserUuids = [
    ...new Set(((membersResult.data ?? []) as OrgMember[]).map((m) => m.user_uuid)),
  ];

  const userEmails: Record<string, string> = {};

  if (allUserUuids.length > 0) {
    const { data: usersPage } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    for (const u of usersPage?.users ?? []) {
      if (u.email) userEmails[u.id] = u.email;
    }
  }

  return (
    <PlanBuilderClient
      orgs={(orgsResult.data ?? []) as Org[]}
      b2bPlans={(b2bPlansResult.data ?? []) as B2BPlan[]}
      allocations={(allocationsResult.data ?? []) as Allocation[]}
      productInclusions={(productInclusionsResult.data ?? []) as ProductInclusion[]}
      tierPlans={(plansResult.data ?? []) as TierPlan[]}
      products={(productsResult.data ?? []) as Product[]}
      platformSettings={(settingsResult.data ?? []) as PlatformSetting[]}
      flaggedAudit={(flaggedAuditResult.data ?? []) as AuditRow[]}
      orgMembers={(membersResult.data ?? []) as OrgMember[]}
      orgMemberProducts={(memberProductsResult.data ?? []) as OrgMemberProduct[]}
      userEmails={userEmails}
    />
  );
}
