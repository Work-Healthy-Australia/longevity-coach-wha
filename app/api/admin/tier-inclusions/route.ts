import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/guard";
import { createAdminClient } from "@/lib/supabase/admin";

const InclusionSchema = z.object({
  plan_id: z.string().uuid(),
  janet_service_id: z.string().uuid(),
  quantity: z.number().int().min(1).default(1),
  frequency: z.string().min(1),
  wholesale_cost_cents: z.number().int().min(0).default(0),
  retail_value_cents: z.number().int().min(0).default(0),
  is_visible_to_customer: z.boolean().default(true),
});

export async function GET(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const planId = request.nextUrl.searchParams.get("plan_id");
  if (!planId) {
    return NextResponse.json({ error: "plan_id query param required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .schema("billing")
    .from("tier_inclusions")
    .select("*")
    .eq("plan_id", planId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => null);
  const parsed = InclusionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .schema("billing")
    .from("tier_inclusions")
    .upsert(parsed.data, { onConflict: "plan_id,janet_service_id" })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
