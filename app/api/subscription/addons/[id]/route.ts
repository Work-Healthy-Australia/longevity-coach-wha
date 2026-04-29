import { NextResponse, type NextRequest } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { removeSubscriptionItem } from "@/lib/stripe/addons";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: row, error } = await supabase
    .schema("billing")
    .from("subscription_addons")
    .select("id, stripe_subscription_item_id, status")
    .eq("id", id)
    .eq("user_uuid", user.id)
    .maybeSingle();

  if (error || !row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (row.status === "cancelled") return NextResponse.json({ ok: true });

  try {
    await removeSubscriptionItem(row.stripe_subscription_item_id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Stripe error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  const admin = createAdminClient();
  const { error: upErr } = await admin
    .schema("billing")
    .from("subscription_addons")
    .update({ status: "cancelled" })
    .eq("id", id);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
