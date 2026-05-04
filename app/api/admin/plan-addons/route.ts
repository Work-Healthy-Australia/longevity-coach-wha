import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin/guard";

const Body = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  feature_key: z.string().min(1),
  stripe_price_id_monthly: z.string().min(1),
  stripe_price_id_annual: z.string().min(1),
  price_monthly_cents: z.number().int().min(0),
  price_annual_cents: z.number().int().min(0),
  min_tier: z.enum(["core", "clinical", "elite"]),
  is_active: z.boolean().default(true),
});

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const admin = createAdminClient();
  const { data, error } = await admin
    .schema("billing")
    .from("plan_addons")
    .select("*")
    .order("price_monthly_cents", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ addons: data ?? [] });
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const raw = await req.json().catch(() => null);
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .schema("billing")
    .from("plan_addons")
    .insert(parsed.data)
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id }, { status: 201 });
}
