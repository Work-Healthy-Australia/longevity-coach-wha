import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loose } from "@/lib/supabase/loose-table";

export const dynamic = "force-dynamic";

const ToggleSchema = z.object({
  user_uuid: z.string().uuid(),
  inclusion_id: z.string().uuid(),
  is_enabled: z.boolean(),
});

// POST /api/org/member-products — health manager toggles a product for a member
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = ToggleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const db = loose(admin);

  // Verify caller is a health_manager in an org
  const { data: managerRow } = await db
    .schema("billing")
    .from("organisation_members")
    .select("org_id")
    .eq("user_uuid", user.id)
    .eq("role", "health_manager")
    .maybeSingle();

  if (!managerRow) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const orgId = (managerRow as { org_id: string }).org_id;

  // Verify target user belongs to the same org
  const { data: targetRow } = await db
    .schema("billing")
    .from("organisation_members")
    .select("org_id")
    .eq("user_uuid", parsed.data.user_uuid)
    .eq("org_id", orgId)
    .maybeSingle();

  if (!targetRow) {
    return NextResponse.json(
      { error: "Target user not in your organisation" },
      { status: 403 }
    );
  }

  const { error } = await db
    .schema("billing")
    .from("organisation_member_products")
    .upsert(
      {
        org_id: orgId,
        user_uuid: parsed.data.user_uuid,
        inclusion_id: parsed.data.inclusion_id,
        is_enabled: parsed.data.is_enabled,
      },
      { onConflict: "org_id,user_uuid,inclusion_id" }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
