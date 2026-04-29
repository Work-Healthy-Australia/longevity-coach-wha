import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin/guard";

const SupplierPatch = z.object({
  name:                     z.string().min(1).optional(),
  supplier_type:            z.string().nullable().optional(),
  legal_entity_name:        z.string().nullable().optional(),
  abn:                      z.string().nullable().optional(),
  primary_contact_name:     z.string().nullable().optional(),
  contact_email:            z.string().email().nullable().optional(),
  contact_phone:            z.string().nullable().optional(),
  primary_contact_phone:    z.string().nullable().optional(),
  website:                  z.string().nullable().optional(),
  address:                  z.string().nullable().optional(),
  billing_email:            z.string().email().nullable().optional(),
  accounts_contact_name:    z.string().nullable().optional(),
  accounts_contact_email:   z.string().email().nullable().optional(),
  invoice_terms:            z.string().nullable().optional(),
  payment_terms:            z.string().nullable().optional(),
  preferred_payment_method: z.string().nullable().optional(),
  bank_account_name:        z.string().nullable().optional(),
  bsb:                      z.string().nullable().optional(),
  bank_account_number:      z.string().nullable().optional(),
  contract_start_date:      z.string().nullable().optional(),
  contract_end_date:        z.string().nullable().optional(),
  contract_status:          z.enum(["active", "pending", "expired", "terminated"]).nullable().optional(),
  notes:                    z.string().nullable().optional(),
  is_active:                z.boolean().optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { id } = await params;
  const raw = await req.json().catch(() => null);
  const parsed = SupplierPatch.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const admin = createAdminClient();
  const { error } = await admin
    .schema("billing")
    .from("suppliers")
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
    .from("suppliers")
    .update({ is_active: parsed.data.is_active })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
