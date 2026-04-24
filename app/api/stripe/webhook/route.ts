import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 },
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const body = await request.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, secret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const admin = createAdminClient();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const subId = typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id;
        if (!subId) break;
        const subscription = await stripe.subscriptions.retrieve(subId);
        await upsertSubscription(admin, subscription);
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await upsertSubscription(admin, event.data.object);
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error("Stripe webhook handler error", event.type, err);
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function upsertSubscription(
  admin: ReturnType<typeof createAdminClient>,
  sub: Stripe.Subscription,
) {
  const userUuid =
    sub.metadata?.user_uuid ??
    (typeof sub.customer === "object" && !sub.customer.deleted
      ? sub.customer.metadata?.user_uuid
      : undefined);
  if (!userUuid) {
    console.warn("Subscription missing user_uuid metadata", sub.id);
    return;
  }

  const item = sub.items.data[0];
  const priceId = item?.price.id;
  const periodEnd = item?.current_period_end ?? null;
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;

  await admin
    .from("subscriptions")
    .upsert(
      {
        user_uuid: userUuid,
        stripe_customer_id: customerId,
        stripe_subscription_id: sub.id,
        price_id: priceId ?? null,
        status: sub.status,
        current_period_end: periodEnd
          ? new Date(periodEnd * 1000).toISOString()
          : null,
        cancel_at_period_end: sub.cancel_at_period_end,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "stripe_subscription_id" },
    );
}
