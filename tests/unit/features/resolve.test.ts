import { describe, expect, it, vi } from "vitest";

import { canAccess, type FeatureKey } from "@/lib/features/resolve";

// Build a minimal Supabase client mock that supports the call patterns in resolve.ts.
// Each branch sets up specific responses for sequential .from() calls.

type MockResponse = { data: unknown; error?: null };

function makeClient(plan: {
  profile?: MockResponse;
  membership?: MockResponse;
  orgAddon?: MockResponse;
  org?: MockResponse;
  sub?: MockResponse;
  subAddon?: MockResponse;
  planByPriceId?: MockResponse;
}) {
  // Each call to .from() returns a chainable that yields the appropriate value
  // based on which logical "table call" is being made. We track call order.
  const queue: Array<MockResponse> = [];
  if (plan.profile) queue.push(plan.profile);
  if (plan.membership) queue.push(plan.membership);
  if (plan.orgAddon) queue.push(plan.orgAddon);
  if (plan.org) queue.push(plan.org);
  if (plan.sub) queue.push(plan.sub);
  if (plan.subAddon) queue.push(plan.subAddon);
  if (plan.planByPriceId) queue.push(plan.planByPriceId);

  const chain = (response: MockResponse) => {
    const c: Record<string, unknown> = {};
    const fn = (..._args: unknown[]) => c;
    c.select = fn;
    c.eq = fn;
    c.limit = fn;
    c.maybeSingle = vi.fn(async () => response);
    return c;
  };

  let idx = 0;
  const fromImpl = () => chain(queue[idx++] ?? { data: null });
  const schemaImpl = () => ({ from: fromImpl });

  return {
    from: fromImpl,
    schema: schemaImpl,
  } as unknown as Parameters<typeof canAccess>[2];
}

const FEATURE: FeatureKey = "supplement_protocol";

describe("canAccess — feature resolution", () => {
  it("returns true for platform admin (path 1)", async () => {
    const supabase = makeClient({ profile: { data: { is_admin: true } } });
    expect(await canAccess("u1", FEATURE, supabase)).toBe(true);
  });

  it("returns true for org member with org_addon for the feature (path 2a)", async () => {
    const supabase = makeClient({
      profile: { data: { is_admin: false } },
      membership: { data: { org_id: "org-1" } },
      orgAddon: { data: { plan_addon_id: "pa-1" } },
    });
    expect(await canAccess("u1", FEATURE, supabase)).toBe(true);
  });

  it("returns true for org member when feature is in org plan tier flags (path 2b)", async () => {
    const supabase = makeClient({
      profile: { data: { is_admin: false } },
      membership: { data: { org_id: "org-1" } },
      orgAddon: { data: null },
      org: { data: { plan_id: "p-1", plans: { feature_flags: { supplement_protocol: true } } } },
    });
    expect(await canAccess("u1", FEATURE, supabase)).toBe(true);
  });

  it("returns false for org member without addon and feature not in tier (path 2 fallthrough)", async () => {
    const supabase = makeClient({
      profile: { data: { is_admin: false } },
      membership: { data: { org_id: "org-1" } },
      orgAddon: { data: null },
      org: { data: { plan_id: "p-1", plans: { feature_flags: {} } } },
    });
    expect(await canAccess("u1", FEATURE, supabase)).toBe(false);
  });

  it("returns true for standalone subscriber with active subscription_addon (path 3a)", async () => {
    const supabase = makeClient({
      profile: { data: { is_admin: false } },
      membership: { data: null },
      sub: { data: { price_id: "price_X", status: "active" } },
      subAddon: { data: { plan_addon_id: "pa-1", status: "active" } },
    });
    expect(await canAccess("u1", FEATURE, supabase)).toBe(true);
  });

  it("returns true for standalone subscriber when feature is in plan tier flags (path 3b)", async () => {
    const supabase = makeClient({
      profile: { data: { is_admin: false } },
      membership: { data: null },
      sub: { data: { price_id: "price_X", status: "active" } },
      subAddon: { data: null },
      planByPriceId: { data: { feature_flags: { supplement_protocol: true } } },
    });
    expect(await canAccess("u1", FEATURE, supabase)).toBe(true);
  });

  it("returns false when no membership, no subscription (path 4)", async () => {
    const supabase = makeClient({
      profile: { data: { is_admin: false } },
      membership: { data: null },
      sub: { data: null },
    });
    expect(await canAccess("u1", FEATURE, supabase)).toBe(false);
  });

  it("returns false when subscription exists but neither addon nor tier covers feature (path 4)", async () => {
    const supabase = makeClient({
      profile: { data: { is_admin: false } },
      membership: { data: null },
      sub: { data: { price_id: "price_X", status: "active" } },
      subAddon: { data: null },
      planByPriceId: { data: { feature_flags: {} } },
    });
    expect(await canAccess("u1", FEATURE, supabase)).toBe(false);
  });
});
