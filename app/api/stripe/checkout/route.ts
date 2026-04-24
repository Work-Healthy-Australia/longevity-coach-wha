import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe, priceIdForPlan, type PlanId } from "@/lib/stripe/client";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { plan?: PlanId };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const plan = body.plan;
  if (plan !== "monthly" && plan !== "annual") {
    return NextResponse.json({ error: "Unknown plan" }, { status: 400 });
  }

  const origin =
    request.headers.get("origin") ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "http://localhost:3000";

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: priceIdForPlan(plan), quantity: 1 }],
    customer_email: user.email,
    success_url: `${origin}/dashboard?checkout=success`,
    cancel_url: `${origin}/?checkout=canceled`,
    client_reference_id: user.id,
    metadata: { user_uuid: user.id, plan },
    subscription_data: { metadata: { user_uuid: user.id, plan } },
  });

  return NextResponse.json({ url: session.url, sessionId: session.id });
}
