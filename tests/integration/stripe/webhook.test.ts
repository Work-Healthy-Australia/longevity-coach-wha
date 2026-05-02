import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockUpsert = vi.fn(() => Promise.resolve({ error: null }));
const mockFrom = vi.fn(() => ({ upsert: mockUpsert }));
const mockConstructEventAsync = vi.fn();
const mockRetrieveSubscription = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: mockFrom }),
}));

vi.mock("@/lib/stripe/client", () => ({
  getStripe: () => ({
    webhooks: { constructEventAsync: mockConstructEventAsync },
    subscriptions: { retrieve: mockRetrieveSubscription },
  }),
}));

import { POST } from "@/app/api/stripe/webhook/route";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
});

afterEach(() => {
  delete process.env.STRIPE_WEBHOOK_SECRET;
});

function makeRequest(body: string, signature: string | null): NextRequest {
  const headers = new Headers();
  if (signature) headers.set("stripe-signature", signature);
  return new NextRequest("http://localhost/api/stripe/webhook", {
    method: "POST",
    headers,
    body,
  });
}

const baseSubscription = {
  id: "sub_123",
  status: "active",
  cancel_at_period_end: false,
  customer: "cus_123",
  metadata: { user_uuid: "user-uuid-123" },
  items: {
    data: [
      {
        price: { id: "price_123" },
        current_period_end: 1_900_000_000,
      },
    ],
  },
};

describe("POST /api/stripe/webhook", () => {
  it("returns 500 when STRIPE_WEBHOOK_SECRET is not configured", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const res = await POST(makeRequest("{}", "sig"));
    expect(res.status).toBe(500);
  });

  it("returns 400 when stripe-signature header is missing", async () => {
    const res = await POST(makeRequest("{}", null));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Missing signature");
  });

  it("returns 400 when signature verification fails", async () => {
    mockConstructEventAsync.mockRejectedValueOnce(new Error("Bad sig"));
    const res = await POST(makeRequest("{}", "sig"));
    expect(res.status).toBe(400);
  });

  it("upserts the subscription on customer.subscription.updated", async () => {
    mockConstructEventAsync.mockResolvedValueOnce({
      type: "customer.subscription.updated",
      data: { object: baseSubscription },
    });

    const res = await POST(makeRequest("{}", "sig"));

    expect(res.status).toBe(200);
    expect(mockFrom).toHaveBeenCalledWith("subscriptions");
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    const [row, options] = mockUpsert.mock.calls[0] as unknown as [unknown, unknown];
    expect(row).toMatchObject({
      user_uuid: "user-uuid-123",
      stripe_customer_id: "cus_123",
      stripe_subscription_id: "sub_123",
      status: "active",
      price_id: "price_123",
      cancel_at_period_end: false,
    });
    expect(options).toEqual({ onConflict: "stripe_subscription_id" });
  });

  it("retrieves the subscription on checkout.session.completed and upserts it", async () => {
    mockConstructEventAsync.mockResolvedValueOnce({
      type: "checkout.session.completed",
      data: { object: { subscription: "sub_456" } },
    });
    mockRetrieveSubscription.mockResolvedValueOnce({
      ...baseSubscription,
      id: "sub_456",
    });

    const res = await POST(makeRequest("{}", "sig"));

    expect(res.status).toBe(200);
    expect(mockRetrieveSubscription).toHaveBeenCalledWith("sub_456");
    expect(mockUpsert).toHaveBeenCalled();
  });

  it("propagates the Stripe status (e.g. canceled) to the subscription row", async () => {
    mockConstructEventAsync.mockResolvedValueOnce({
      type: "customer.subscription.deleted",
      data: { object: { ...baseSubscription, status: "canceled" } },
    });

    await POST(makeRequest("{}", "sig"));

    const [row] = mockUpsert.mock.calls[0] as unknown as [unknown];
    expect((row as { status: string }).status).toBe("canceled");
  });

  it("logs a warning and skips upsert when user_uuid metadata is missing", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockConstructEventAsync.mockResolvedValueOnce({
      type: "customer.subscription.updated",
      data: {
        object: {
          ...baseSubscription,
          metadata: {},
          customer: "cus_no_meta",
        },
      },
    });

    const res = await POST(makeRequest("{}", "sig"));

    expect(res.status).toBe(200);
    expect(mockUpsert).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("ignores unrelated event types without crashing", async () => {
    mockConstructEventAsync.mockResolvedValueOnce({
      type: "invoice.payment_succeeded",
      data: { object: {} },
    });

    const res = await POST(makeRequest("{}", "sig"));

    expect(res.status).toBe(200);
    expect(mockUpsert).not.toHaveBeenCalled();
  });
});
