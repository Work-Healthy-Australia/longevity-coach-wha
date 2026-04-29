import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { createTestOrderPaymentIntent } from "@/lib/stripe/test-orders";

const Body = z.object({ product_id: z.string().uuid() });

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .schema("billing")
    .from("test_orders")
    .select(
      "id, product_id, amount_cents, status, notes, created_at, products:products(name, category, supplier_id)"
    )
    .eq("user_uuid", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ orders: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = await request.json().catch(() => null);
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  // Read product retail price via the public view (wholesale never exposed)
  const { data: product, error } = await supabase
    .schema("billing")
    .from("products_public")
    .select("id, retail_cents, is_active")
    .eq("id", parsed.data.product_id)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  let intentId: string;
  let clientSecret: string | null;
  try {
    const intent = await createTestOrderPaymentIntent({
      amountCents: product.retail_cents,
      customerEmail: user.email,
      productId: product.id,
      userId: user.id,
    });
    intentId = intent.id;
    clientSecret = intent.client_secret;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Stripe error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  const admin = createAdminClient();
  const { data: order, error: insErr } = await admin
    .schema("billing")
    .from("test_orders")
    .insert({
      user_uuid: user.id,
      product_id: product.id,
      stripe_payment_intent_id: intentId,
      amount_cents: product.retail_cents,
      status: "pending",
    })
    .select("id")
    .single();

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  return NextResponse.json({ id: order.id, clientSecret }, { status: 201 });
}
