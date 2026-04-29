import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { loose } from "@/lib/supabase/loose-table";

export const dynamic = "force-dynamic";

const ReviewSchema = z.object({
  approved: z.boolean(),
});

type AuditRow = {
  id: string;
  allocation_id: string | null;
  new_seat_count: number;
};

// POST /api/admin/b2b-plans/[id]/seat-audit/[auditId]/review
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; auditId: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id: b2bPlanId, auditId } = await params;

  const body = await request.json().catch(() => ({}));
  const parsed = ReviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "approved (boolean) is required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const db = loose(admin);

  const { data: auditRaw, error: auditErr } = await db
    .schema("billing")
    .from("b2b_plan_seat_audit")
    .select("id, allocation_id, new_seat_count")
    .eq("id", auditId)
    .eq("b2b_plan_id", b2bPlanId)
    .single();

  if (auditErr || !auditRaw) {
    return NextResponse.json({ error: "Audit row not found" }, { status: 404 });
  }

  const audit = auditRaw as AuditRow;

  if (parsed.data.approved && audit.allocation_id) {
    await db
      .schema("billing")
      .from("b2b_plan_tier_allocations")
      .update({ seat_count: audit.new_seat_count })
      .eq("id", audit.allocation_id);
  }

  await db
    .schema("billing")
    .from("b2b_plan_seat_audit")
    .update({
      reviewed_by: auth.userId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", auditId);

  await db
    .schema("billing")
    .from("b2b_plans")
    .update({ is_flagged_suspicious: false })
    .eq("id", b2bPlanId);

  return NextResponse.json({ ok: true });
}
