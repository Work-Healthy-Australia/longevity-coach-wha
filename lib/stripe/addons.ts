// Helpers for managing Stripe subscription items used by recurring add-ons.
// Used by /api/subscription/addons and the account/billing UI.

import { getStripe } from "@/lib/stripe/client";

export async function addSubscriptionItem(
  subscriptionId: string,
  stripePriceId: string
) {
  const stripe = getStripe();
  const item = await stripe.subscriptionItems.create({
    subscription: subscriptionId,
    price: stripePriceId,
    quantity: 1,
  });
  return item;
}

export async function removeSubscriptionItem(subscriptionItemId: string) {
  const stripe = getStripe();
  await stripe.subscriptionItems.del(subscriptionItemId);
}
