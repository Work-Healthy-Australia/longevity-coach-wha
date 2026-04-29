import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin/guard";

const Body = z.object({
  supplier_id: z.string().uuid(),
  product_code: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  category: z.enum(["imaging", "pathology", "genomics", "hormonal", "microbiome", "other"]),
  wholesale_cents: z.number().int().min(0),
  retail_cents: z.number().int().min(0),
  stripe_price_id: z.string().min(1).nullable().optional(),
  is_active: z.boolean().default(true),
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
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const admin = createAdminClient();
  const { data, error } = await admin
    .schema("billing")
    .from("products")
    .insert(parsed.data)
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id }, { status: 201 });
}
