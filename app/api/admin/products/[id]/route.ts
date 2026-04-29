import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin/guard";

const CATEGORIES = ["imaging", "pathology", "genomics", "hormonal", "microbiome", "supplements", "fitness", "other"] as const;
const PRODUCT_TYPES = ["product", "service", "test", "scan", "session", "subscription", "bundle"] as const;
const UNIT_TYPES = ["per_test", "per_scan", "per_session", "per_month", "per_year", "per_unit", "per_employee", "per_patient"] as const;
const DELIVERY_METHODS = ["digital", "in_person", "shipped", "referral", "lab", "clinic", "telehealth"] as const;

const ProductPatch = z.object({
  product_code:      z.string().min(1).optional(),
  name:              z.string().min(1).optional(),
  category:          z.enum(CATEGORIES).optional(),
  description:       z.string().nullable().optional(),
  product_type:      z.enum(PRODUCT_TYPES).nullable().optional(),
  unit_type:         z.enum(UNIT_TYPES).nullable().optional(),
  subscription_type: z.enum(["one_time", "recurring"]).optional(),
  delivery_method:   z.enum(DELIVERY_METHODS).nullable().optional(),
  retail_cents:      z.number().int().min(0).optional(),
  wholesale_cents:   z.number().int().min(0).optional(),
  gst_applicable:    z.boolean().optional(),
  minimum_order_qty: z.number().int().min(1).optional(),
  lead_time_days:    z.number().int().min(0).nullable().optional(),
  stripe_price_id:   z.string().min(1).nullable().optional(),
  internal_notes:    z.string().nullable().optional(),
  is_active:         z.boolean().optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { id } = await params;
  const raw = await req.json().catch(() => null);
  const parsed = ProductPatch.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const admin = createAdminClient();
  const { error } = await admin
    .schema("billing")
    .from("products")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update(parsed.data as any)
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { id } = await params;
  const raw = await req.json().catch(() => null);
  const parsed = z.object({ is_active: z.boolean() }).safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const admin = createAdminClient();
  const { error } = await admin
    .schema("billing")
    .from("products")
    .update({ is_active: parsed.data.is_active })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
