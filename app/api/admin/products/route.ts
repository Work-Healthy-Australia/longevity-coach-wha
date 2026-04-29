import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin/guard";

const CATEGORIES = ["imaging", "pathology", "genomics", "hormonal", "microbiome", "supplements", "fitness", "other"] as const;
const PRODUCT_TYPES = ["product", "service", "test", "scan", "session", "subscription", "bundle"] as const;
const UNIT_TYPES = ["per_test", "per_scan", "per_session", "per_month", "per_year", "per_unit", "per_employee", "per_patient"] as const;
const DELIVERY_METHODS = ["digital", "in_person", "shipped", "referral", "lab", "clinic", "telehealth"] as const;

const ProductBody = z.object({
  supplier_id:       z.string().uuid(),
  product_code:      z.string().min(1),
  name:              z.string().min(1),
  category:          z.enum(CATEGORIES),
  description:       z.string().nullable().optional(),
  product_type:      z.enum(PRODUCT_TYPES).nullable().optional(),
  unit_type:         z.enum(UNIT_TYPES).nullable().optional(),
  subscription_type: z.enum(["one_time", "recurring"]).default("one_time"),
  delivery_method:   z.enum(DELIVERY_METHODS).nullable().optional(),
  retail_cents:      z.number().int().min(0),
  wholesale_cents:   z.number().int().min(0),
  gst_applicable:    z.boolean().default(true),
  minimum_order_qty: z.number().int().min(1).default(1),
  lead_time_days:    z.number().int().min(0).nullable().optional(),
  stripe_price_id:   z.string().min(1).nullable().optional(),
  internal_notes:    z.string().nullable().optional(),
  is_active:         z.boolean().default(true),
});

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const admin = createAdminClient();
  const { data, error } = await admin
    .schema("billing")
    .from("products")
    .select("*, supplier:suppliers(name)")
    .order("name", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ products: data ?? [] });
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const raw = await req.json().catch(() => null);
  const parsed = ProductBody.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const admin = createAdminClient();
  const { data, error } = await admin
    .schema("billing")
    .from("products")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert(parsed.data as any)
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id }, { status: 201 });
}
