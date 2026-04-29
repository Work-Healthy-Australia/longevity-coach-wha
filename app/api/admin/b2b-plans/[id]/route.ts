import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { loose } from "@/lib/supabase/loose-table";

export const dynamic = "force-dynamic";

const UpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  billing_basis: z
    .enum(["per_seat_monthly", "per_seat_annual", "flat_monthly", "flat_annual"])
    .optional(),
  negotiated_discount_pct: z.number().min(0).max(100).optional(),
  setup_fee_cents: z.number().int().min(0).optional(),
  contract_start_date: z.string().nullable().optional(),
  contract_end_date: z.string().nullable().optional(),
  minimum_commitment_months: z.number().int().min(1).optional(),
  max_seats_per_tier: z.number().int().min(1).nullable().optional(),
  status: z.enum(["draft", "active", "suspended"]).optional(),
  internal_notes: z.string().nullable().optional(),
});

// PUT /api/admin/b2b-plans/[id] — update plan details
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;

  const body = await request.json().catch(() => ({}));
  const parsed = UpdateSchema.safeParse(body);
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
    .update(parsed.data)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}
