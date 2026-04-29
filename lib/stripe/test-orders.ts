// Helpers for creating Stripe payment intents for one-off test orders.

import { getStripe } from "@/lib/stripe/client";

export async function createTestOrderPaymentIntent({
  amountCents,
  customerEmail,
  productId,
  userId,
}: {
  amountCents: number;
  customerEmail: string;
  productId: string;
  userId: string;
}) {
  const stripe = getStripe();
  const intent = await stripe.paymentIntents.create({
    amount: amountCents,
    currency: "aud",
    receipt_email: customerEmail,
    metadata: { user_uuid: userId, product_id: productId, kind: "test_order" },
  });
  return intent;
}
