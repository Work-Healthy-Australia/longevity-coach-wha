import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/guard";
import { createAdminClient } from "@/lib/supabase/admin";

const FeatureKeyUpdateSchema = z.object({
  label: z.string().min(1).optional(),
  tier_affinity: z.enum(["core", "clinical", "elite"]).optional(),
  is_active: z.boolean().optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { key } = await params;
  const body = await request.json().catch(() => null);
  const parsed = FeatureKeyUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .schema("billing")
    .from("feature_keys")
    .update(parsed.data)
    .eq("key", key)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { key } = await params;
  const admin = createAdminClient();

  // Soft delete — set is_active = false
  const { data, error } = await admin
    .schema("billing")
    .from("feature_keys")
    .update({ is_active: false })
    .eq("key", key)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
