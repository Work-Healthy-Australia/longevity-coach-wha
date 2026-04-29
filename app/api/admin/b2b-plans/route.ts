import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { loose } from "@/lib/supabase/loose-table";

export const dynamic = "force-dynamic";

// GET /api/admin/b2b-plans — list all plans
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();
  const { data, error } = await loose(admin)
    .schema("billing")
    .from("b2b_plans")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data ?? []);
}

const CreateSchema = z.object({
  org_id: z.string().uuid(),
  name: z.string().min(1).max(200),
  billing_basis: z
    .enum(["per_seat_monthly", "per_seat_annual", "flat_monthly", "flat_annual"])
    .optional()
    .default("per_seat_monthly"),
  status: z.enum(["draft", "active", "suspended"]).optional().default("draft"),
});

// POST /api/admin/b2b-plans — create plan
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { data, error } = await loose(admin)
    .schema("billing")
    .from("b2b_plans")
    .insert({
      org_id: parsed.data.org_id,
      name: parsed.data.name,
      billing_basis: parsed.data.billing_basis,
      status: parsed.data.status,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
