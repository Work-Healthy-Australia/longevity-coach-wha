import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin/guard";

const PlanBody = z.object({
  name: z.string().min(1),
  tier: z.enum(["core", "clinical", "elite"]),
  billing_interval: z.enum(["month", "year"]),
  stripe_price_id: z.string().min(1),
  base_price_cents: z.number().int().min(0),
  annual_discount_pct: z.number().min(0).max(100).default(0),
  feature_flags: z.record(z.string(), z.boolean()).default({}),
  is_active: z.boolean().default(true),
});

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const admin = createAdminClient();
  const { data, error } = await admin
    .schema("billing")
    .from("plans")
    .select("*")
    .order("base_price_cents", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ plans: data ?? [] });
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const raw = await req.json().catch(() => null);
  const parsed = PlanBody.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .schema("billing")
    .from("plans")
    .insert(parsed.data)
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id }, { status: 201 });
}
