import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/guard";
import { createAdminClient } from "@/lib/supabase/admin";

const PlanCreateSchema = z.object({
  name: z.string().min(1),
  tier: z.string().min(1),
  base_price_cents: z.number().int().min(0).default(0),
  annual_discount_pct: z.number().min(0).max(100).default(0),
});

export async function POST(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => null);
  const parsed = PlanCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const { name, tier, base_price_cents, annual_discount_pct } = parsed.data;
  const admin = createAdminClient();
  const { data, error } = await admin
    .schema("billing")
    .from("plans")
    .insert({
      name,
      tier,
      base_price_cents,
      annual_discount_pct,
      billing_interval: "month",
      stripe_price_id: `price_${tier.toUpperCase()}_PLACEHOLDER`,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
