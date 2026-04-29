import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { loose } from "@/lib/supabase/loose-table";

export const dynamic = "force-dynamic";

const AddSchema = z.object({
  allocation_id: z.string().uuid(),
  product_id: z.string().uuid(),
  quantity: z.number().int().min(1).default(1),
  frequency: z.enum(["monthly", "quarterly", "annually"]).default("annually"),
  wholesale_cost_cents: z.number().int().min(0),
  client_price_cents: z.number().int().min(0).default(0),
  is_visible_to_client: z.boolean().default(true),
});

// POST /api/admin/b2b-plans/[id]/product-inclusions — add product inclusion
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id: b2bPlanId } = await params;

  const body = await request.json().catch(() => ({}));
  const parsed = AddSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { data, error } = await loose(admin)
    .schema("billing")
    .from("b2b_plan_product_inclusions")
    .upsert(
      {
        b2b_plan_id: b2bPlanId,
        allocation_id: parsed.data.allocation_id,
        product_id: parsed.data.product_id,
        quantity: parsed.data.quantity,
        frequency: parsed.data.frequency,
        wholesale_cost_cents: parsed.data.wholesale_cost_cents,
        client_price_cents: parsed.data.client_price_cents,
        is_visible_to_client: parsed.data.is_visible_to_client,
      },
      { onConflict: "b2b_plan_id,allocation_id,product_id" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}

// DELETE /api/admin/b2b-plans/[id]/product-inclusions?inclusion_id=... — remove inclusion
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id: b2bPlanId } = await params;
  const inclusionId = request.nextUrl.searchParams.get("inclusion_id");

  if (!inclusionId) {
    return NextResponse.json(
      { error: "inclusion_id query parameter is required" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { error } = await loose(admin)
    .schema("billing")
    .from("b2b_plan_product_inclusions")
    .delete()
    .eq("id", inclusionId)
    .eq("b2b_plan_id", b2bPlanId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
