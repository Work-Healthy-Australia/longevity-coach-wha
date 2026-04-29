import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/guard";
import { createAdminClient } from "@/lib/supabase/admin";

const PlanUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  base_price_cents: z.number().int().min(0).optional(),
  annual_discount_pct: z.number().min(0).max(100).optional(),
  annual_price_cents: z.number().int().min(0).nullable().optional(),
  stripe_price_id_monthly: z.string().nullable().optional(),
  stripe_price_id_annual: z.string().nullable().optional(),
  setup_fee_cents: z.number().int().min(0).nullable().optional(),
  minimum_commitment_months: z.number().int().min(0).nullable().optional(),
  public_description: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = PlanUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .schema("billing")
    .from("plans")
    .update(parsed.data)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
