import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getStripe, priceIdForPlan, type PlanId } from "@/lib/stripe/client";

const isProduction =
  process.env.NODE_ENV === "production" ||
  process.env.VERCEL_ENV === "production";

function resolveOrigin(request: NextRequest): string | null {
  const headerOrigin = request.headers.get("origin");
  if (headerOrigin) return headerOrigin;

  const envOrigin = process.env.NEXT_PUBLIC_SITE_URL;
  if (envOrigin) return envOrigin;

  if (isProduction) {
    console.error(
      "[stripe/checkout] NEXT_PUBLIC_SITE_URL is unset and no origin header was sent. Refusing to fall back to localhost in production — Stripe redirects would be unreachable."
    );
    return null;
  }

  return "http://localhost:3000";
}

const NewBodySchema = z.object({
  plan_id: z.string().uuid(),
  addon_ids: z.array(z.string().uuid()).default([]),
  billing_interval: z.enum(["month", "year"]),
});

const LegacyBodySchema = z.object({
  plan: z.enum(["monthly", "annual"]),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw: unknown = await request.json().catch(() => null);
  if (!raw || typeof raw !== "object") {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const origin = resolveOrigin(request);
  if (!origin) {
    return NextResponse.json(
      { error: "Service misconfigured: site URL unavailable" },
      { status: 500 }
    );
  }

  const stripe = getStripe();

  // Try the new DB-driven shape first
  const newParse = NewBodySchema.safeParse(raw);
  if (newParse.success) {
    const { plan_id, addon_ids, billing_interval } = newParse.data;

    const { data: plan, error: planErr } = await supabase
      .schema("billing")
      .from("plans")
      .select("id, stripe_price_id, billing_interval, tier, is_active")
      .eq("id", plan_id)
      .eq("is_active", true)
      .maybeSingle();

    if (planErr || !plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }
    if (plan.billing_interval !== billing_interval) {
      return NextResponse.json(
        { error: "Plan does not match selected billing interval" },
        { status: 400 }
      );
    }

    let addonRows: Array<{
      id: string;
      stripe_price_id_monthly: string;
      stripe_price_id_annual: string;
      min_tier: string;
    }> = [];
    if (addon_ids.length > 0) {
      const { data, error } = await supabase
        .schema("billing")
        .from("plan_addons")
        .select("id, stripe_price_id_monthly, stripe_price_id_annual, min_tier, is_active")
        .in("id", addon_ids)
        .eq("is_active", true);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      addonRows = (data ?? []) as typeof addonRows;
      if (addonRows.length !== addon_ids.length) {
        return NextResponse.json({ error: "One or more add-ons unavailable" }, { status: 400 });
      }
      const tierRank: Record<string, number> = {
        individual: 0,
        professional: 1,
        corporate: 2,
      };
      for (const a of addonRows) {
        if ((tierRank[a.min_tier] ?? 99) > (tierRank[plan.tier] ?? 0)) {
          return NextResponse.json(
            { error: `Add-on requires ${a.min_tier} tier or above` },
            { status: 400 }
          );
        }
      }
    }

    const lineItems: Array<{ price: string; quantity: number }> = [
      { price: plan.stripe_price_id, quantity: 1 },
      ...addonRows.map((a) => ({
        price:
          billing_interval === "year"
            ? a.stripe_price_id_annual
            : a.stripe_price_id_monthly,
        quantity: 1,
      })),
    ];

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: lineItems,
      customer_email: user.email,
      success_url: `${origin}/dashboard?checkout=success`,
      cancel_url: `${origin}/pricing?checkout=canceled`,
      client_reference_id: user.id,
      metadata: {
        user_uuid: user.id,
        plan_id,
        billing_interval,
        addon_ids: addon_ids.join(","),
      },
      subscription_data: {
        metadata: {
          user_uuid: user.id,
          plan_id,
          billing_interval,
          addon_ids: addon_ids.join(","),
        },
      },
    });

    return NextResponse.json({ url: session.url, sessionId: session.id });
  }

  // Legacy shape — keep working for the old signup buttons until they migrate.
  // priceIdForPlan() is deprecated; remove once all callers use the DB-driven path.
  const legacyParse = LegacyBodySchema.safeParse(raw);
  if (!legacyParse.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const plan: PlanId = legacyParse.data.plan;
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
