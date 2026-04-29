import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/guard";
import { createAdminClient } from "@/lib/supabase/admin";

const FeatureKeyCreateSchema = z.object({
  key: z.string().min(1).regex(/^[a-z0-9_]+$/, "Key must be lowercase alphanumeric with underscores"),
  label: z.string().min(1),
  tier_affinity: z.enum(["core", "clinical", "elite"]),
  is_active: z.boolean().default(true),
});

export async function GET(_request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const admin = createAdminClient();
  const { data, error } = await admin
    .schema("billing")
    .from("feature_keys")
    .select("*")
    .order("tier_affinity")
    .order("label");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => null);
  const parsed = FeatureKeyCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .schema("billing")
    .from("feature_keys")
    .insert(parsed.data)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
