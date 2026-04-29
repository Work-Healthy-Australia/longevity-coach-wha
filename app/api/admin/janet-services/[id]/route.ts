import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/guard";
import { createAdminClient } from "@/lib/supabase/admin";

const ServiceUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  unit_type: z.string().min(1).optional(),
  internal_cost_cents: z.number().int().min(0).optional(),
  retail_value_cents: z.number().int().min(0).optional(),
  delivery_owner: z.string().nullable().optional(),
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
  const parsed = ServiceUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .schema("billing")
    .from("janet_services")
    .update(parsed.data)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const admin = createAdminClient();

  // Soft delete — set is_active = false
  const { data, error } = await admin
    .schema("billing")
    .from("janet_services")
    .update({ is_active: false })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
