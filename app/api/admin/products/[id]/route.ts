import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin/guard";

const Patch = z.object({
  product_code: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  category: z.enum(["imaging", "pathology", "genomics", "hormonal", "microbiome", "other"]).optional(),
  wholesale_cents: z.number().int().min(0).optional(),
  retail_cents: z.number().int().min(0).optional(),
  stripe_price_id: z.string().min(1).nullable().optional(),
  is_active: z.boolean().optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { id } = await params;
  const raw = await req.json().catch(() => null);
  const parsed = Patch.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const admin = createAdminClient();
  const { error } = await admin
    .schema("billing")
    .from("products")
    .update(parsed.data)
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
