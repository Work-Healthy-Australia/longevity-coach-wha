import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ERASURE_PLAN } from "@/lib/erasure/plan";

/* -------------------------------------------------------------------------- */
/*  Fake admin Supabase client                                                */
/* -------------------------------------------------------------------------- */

type Call = {
  schema: string;
  table: string;
  op: "delete" | "update" | "select" | "insert";
  payload?: Record<string, unknown>;
  filter?: { column: string; value: unknown };
  // For select() chains we record the returned data shape used.
};

type FakeAdminOptions = {
  /** Number returned as `count` for delete/update operations. */
  defaultCount?: number;
  /** Result returned by erasure_log idempotency lookup (`select().eq().limit()`). */
  erasureLogRows?: unknown[];
  /** Result returned by subscriptions lookup (`...maybeSingle()`). */
  subscriptionRow?: { stripe_subscription_id: string; status: string } | null;
  /** Rows returned by `patient_uploads` storage_path select. */
  patientUploadsRows?: { storage_path: string | null }[];
  /** Storage report-pdfs list result. */
  reportPdfList?: { name: string }[];
};

function createFakeAdmin(opts: FakeAdminOptions = {}) {
  const calls: Call[] = [];
  const defaultCount = opts.defaultCount ?? 1;

  // Build a chainable per-table builder.
  function buildBuilder(schema: string, table: string) {
    let pendingOp: Call["op"] | null = null;
    let pendingPayload: Record<string, unknown> | undefined;

    const builder: Record<string, unknown> = {
      delete: (_options?: unknown) => {
        pendingOp = "delete";
        return builder;
      },
      update: (payload: Record<string, unknown>, _options?: unknown) => {
        pendingOp = "update";
        pendingPayload = payload;
        return builder;
      },
      select: (_cols?: string) => {
        pendingOp = "select";
        // Return chainable that resolves at .maybeSingle() / .limit() / await.
        const selectChain: Record<string, unknown> = {
          eq: (_c: string, _v: unknown) => selectChain,
          in: (_c: string, _v: unknown) => selectChain,
          order: (_c: string, _o?: unknown) => selectChain,
          limit: (_n: number) => {
            // Used by erasure_log idempotency check + subscriptions lookup.
            // For erasure_log: returns a thenable directly (no maybeSingle).
            if (table === "erasure_log") {
              return Promise.resolve({
                data: opts.erasureLogRows ?? [],
                error: null,
              });
            }
            // Fall through — return chain that supports .maybeSingle().
            return selectChain;
          },
          maybeSingle: () => {
            if (table === "subscriptions") {
              return Promise.resolve({
                data: opts.subscriptionRow ?? null,
                error: null,
              });
            }
            return Promise.resolve({ data: null, error: null });
          },
          // Direct-await on `select().eq()` (e.g. patient_uploads storage path)
          then: (resolve: (v: unknown) => unknown) => {
            if (table === "patient_uploads") {
              return Promise.resolve({
                data: opts.patientUploadsRows ?? [],
                error: null,
              }).then(resolve);
            }
            return Promise.resolve({ data: [], error: null }).then(resolve);
          },
        };
        return selectChain;
      },
      insert: (row: Record<string, unknown>) => {
        calls.push({ schema, table, op: "insert", payload: row });
        return Promise.resolve({ error: null });
      },
      eq: (column: string, value: unknown) => {
        // Terminal `.eq()` for delete/update: record + resolve.
        if (pendingOp === "delete" || pendingOp === "update") {
          calls.push({
            schema,
            table,
            op: pendingOp,
            payload: pendingPayload,
            filter: { column, value },
          });
          return Promise.resolve({ error: null, count: defaultCount });
        }
        return builder;
      },
    };
    return builder;
  }

  const fakeStorage = {
    from: (bucket: string) => ({
      list: (_prefix: string) => {
        if (bucket === "report-pdfs") {
          return Promise.resolve({
            data: opts.reportPdfList ?? [],
            error: null,
          });
        }
        return Promise.resolve({ data: [], error: null });
      },
      remove: (_paths: string[]) =>
        Promise.resolve({ data: null, error: null }),
    }),
  };

  const fakeAuth = {
    admin: {
      deleteUser: vi.fn(async (_id: string) => ({ error: null })),
    },
  };

  const adminClient: Record<string, unknown> = {
    from: (table: string) => buildBuilder("public", table),
    schema: (schema: string) => ({
      from: (table: string) => buildBuilder(schema, table),
    }),
    storage: fakeStorage,
    auth: fakeAuth,
  };

  return { admin: adminClient, calls };
}

/* -------------------------------------------------------------------------- */
/*  Test 1-5: executeErasure behaviour                                        */
/* -------------------------------------------------------------------------- */

describe("executeErasure cascade", () => {
  it("returns one count entry per ERASURE_PLAN row, formatted as <schema>.<table>", async () => {
    const { executeErasure } = await import("@/lib/erasure/execute");
    const { admin } = createFakeAdmin({ defaultCount: 3 });

    const result = await executeErasure(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      admin as any,
      "test-user-id",
    );

    expect(result.counts).toHaveLength(ERASURE_PLAN.length);
    expect(result.counts).toHaveLength(24);

    for (const row of result.counts) {
      expect(row.table).toMatch(/^(public|biomarkers|billing|agents)\.[a-z_]+$/);
      // every fake call returns count = 3, except patient_assignments empty-scrub
      // which still goes through update path with status flip.
      expect(row.count).toBeGreaterThanOrEqual(0);
    }

    // Every plan entry's fully-qualified name must show up.
    for (const entry of ERASURE_PLAN) {
      const fq = `${entry.schema}.${entry.table}`;
      expect(result.counts.find((c) => c.table === fq)).toBeTruthy();
    }
  });

  it("invokes delete() for delete-strategy entries and update() for scrub/retain_anonymised", async () => {
    const { executeErasure } = await import("@/lib/erasure/execute");
    const { admin, calls } = createFakeAdmin({ defaultCount: 1 });

    await executeErasure(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      admin as any,
      "uid-1",
    );

    const cascadeCalls = calls.filter(
      (c) => c.op === "delete" || c.op === "update",
    );

    for (const entry of ERASURE_PLAN) {
      const match = cascadeCalls.find(
        (c) => c.schema === entry.schema && c.table === entry.table,
      );
      expect(
        match,
        `expected a cascade call for ${entry.schema}.${entry.table}`,
      ).toBeTruthy();
      if (entry.strategy === "delete") {
        expect(match!.op).toBe("delete");
      } else {
        expect(match!.op).toBe("update");
      }
      // userColumn filter must be applied with our user id
      expect(match!.filter).toEqual({ column: entry.userColumn, value: "uid-1" });
    }
  });

  it("flips patient_assignments.status to 'patient_erased'", async () => {
    const { executeErasure } = await import("@/lib/erasure/execute");
    const { admin, calls } = createFakeAdmin();

    await executeErasure(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      admin as any,
      "uid-2",
    );

    const paCall = calls.find(
      (c) => c.table === "patient_assignments" && c.op === "update",
    );
    expect(paCall).toBeTruthy();
    expect(paCall!.payload).toEqual({ status: "patient_erased" });
  });

  it("scrubs profiles with the correct sentinel/null payload", async () => {
    const { executeErasure } = await import("@/lib/erasure/execute");
    const { admin, calls } = createFakeAdmin();

    await executeErasure(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      admin as any,
      "uid-3",
    );

    const profilesCall = calls.find(
      (c) => c.schema === "public" && c.table === "profiles" && c.op === "update",
    );
    expect(profilesCall).toBeTruthy();
    expect(profilesCall!.payload).toEqual({
      full_name: "[ERASED]",
      date_of_birth: null,
      phone: null,
      address_postal: null,
    });
  });

  it("scrubs health_profiles.responses with empty_jsonb mode resolving to {}", async () => {
    const { executeErasure } = await import("@/lib/erasure/execute");
    const { admin, calls } = createFakeAdmin();

    await executeErasure(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      admin as any,
      "uid-4",
    );

    const hpCall = calls.find(
      (c) =>
        c.schema === "public" &&
        c.table === "health_profiles" &&
        c.op === "update",
    );
    expect(hpCall).toBeTruthy();
    expect(hpCall!.payload).toMatchObject({ responses: {} });
  });
});

/* -------------------------------------------------------------------------- */
/*  Test 6-9: deleteAccount server action                                     */
/* -------------------------------------------------------------------------- */

const mockGetUser = vi.fn();
const mockSignOut = vi.fn(async () => ({ error: null }));

let currentFakeAdmin: ReturnType<typeof createFakeAdmin> | null = null;

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: mockGetUser,
      signOut: mockSignOut,
    },
  })),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    if (!currentFakeAdmin) {
      throw new Error("Test forgot to set currentFakeAdmin");
    }
    return currentFakeAdmin.admin;
  },
}));

const mockStripeCancel = vi.fn();
vi.mock("@/lib/stripe/client", () => ({
  getStripe: () => ({
    subscriptions: {
      cancel: mockStripeCancel,
    },
  }),
}));

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
}

beforeEach(() => {
  vi.clearAllMocks();
  currentFakeAdmin = null;
});

afterEach(() => {
  delete process.env.STRIPE_SECRET_KEY;
});

describe("deleteAccount server action", () => {
  it("rejects when confirmation is not 'DELETE'", async () => {
    const { deleteAccount } = await import("@/app/(app)/account/actions");

    // No admin needed since we short-circuit before auth/DB.
    currentFakeAdmin = createFakeAdmin();

    const result = await deleteAccount(null, fd({ confirmation: "wrong" }));
    expect(result).toEqual({ error: "Type DELETE to confirm." });

    // No cascade, no auth call should have happened.
    expect(mockGetUser).not.toHaveBeenCalled();
    const cascadeCalls = currentFakeAdmin.calls.filter(
      (c) => c.op === "delete" || c.op === "update",
    );
    expect(cascadeCalls).toHaveLength(0);
  });

  it("returns 'Already erased.' and short-circuits when erasure_log already has a row", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-already-erased" } },
    });

    currentFakeAdmin = createFakeAdmin({
      erasureLogRows: [{ id: "log-row-1" }],
    });

    const { deleteAccount } = await import("@/app/(app)/account/actions");

    const result = await deleteAccount(null, fd({ confirmation: "DELETE" }));
    expect(result).toEqual({ error: "Already erased." });

    // No cascade ran.
    const cascadeCalls = currentFakeAdmin.calls.filter(
      (c) => c.op === "delete" || c.op === "update",
    );
    expect(cascadeCalls).toHaveLength(0);

    // No erasure_log insert either.
    const inserts = currentFakeAdmin.calls.filter((c) => c.op === "insert");
    expect(inserts).toHaveLength(0);
  });

  it("runs the full cascade, writes one audit row, and hard-deletes auth on the happy path", async () => {
    // No active Stripe subscription, hard-delete on (default), no idempotency conflict.
    process.env.ENABLE_HARD_DELETE = "true";

    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-happy-path" } },
    });

    currentFakeAdmin = createFakeAdmin({
      defaultCount: 2,
      erasureLogRows: [], // no prior erasure
      subscriptionRow: null, // no active sub
      patientUploadsRows: [
        { storage_path: "user-happy-path/file-a.pdf" },
        { storage_path: "user-happy-path/file-b.pdf" },
      ],
    });

    const { deleteAccount } = await import("@/app/(app)/account/actions");

    // deleteAccount eventually calls redirect() which throws NEXT_REDIRECT.
    // Catch it so we can assert post-cascade side-effects.
    let caught: unknown = null;
    try {
      await deleteAccount(null, fd({ confirmation: "DELETE" }));
    } catch (e) {
      caught = e;
    }

    // The redirect was reached — that's the success signal.
    expect(caught).toBeTruthy();

    // Stripe was NOT called (no active subscription).
    expect(mockStripeCancel).not.toHaveBeenCalled();

    // Cascade ran: every plan entry has a corresponding call.
    const cascadeCalls = currentFakeAdmin.calls.filter(
      (c) => c.op === "delete" || c.op === "update",
    );
    // 24 plan entries + 1 final profiles.erased_at stamp = 25 cascade-shaped calls.
    expect(cascadeCalls.length).toBeGreaterThanOrEqual(ERASURE_PLAN.length);

    // Exactly one erasure_log audit row was written, with the right shape.
    const auditInserts = currentFakeAdmin.calls.filter(
      (c) => c.op === "insert" && c.table === "erasure_log",
    );
    expect(auditInserts).toHaveLength(1);
    expect(auditInserts[0].payload).toMatchObject({
      user_uuid: "user-happy-path",
      confirmation_text: "DELETE",
      hard_delete: true,
      stripe_subscription_action: "none",
    });
    // table_counts should be a non-empty object (zero-counts get filtered by summariseCounts).
    const tableCounts = (auditInserts[0].payload as { table_counts: unknown })
      .table_counts;
    expect(typeof tableCounts).toBe("object");
    expect(Object.keys(tableCounts as Record<string, unknown>).length).toBeGreaterThan(0);

    // Hard-delete fired (default behaviour).
    const deleteUserFn = (
      currentFakeAdmin.admin as {
        auth: { admin: { deleteUser: ReturnType<typeof vi.fn> } };
      }
    ).auth.admin.deleteUser;
    expect(deleteUserFn).toHaveBeenCalledWith("user-happy-path");

    // Sign-out did NOT fire (hard-delete branch took priority).
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it("returns the support-contact error and aborts when Stripe cancel fails", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_dummy";

    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-stripe-fail" } },
    });

    currentFakeAdmin = createFakeAdmin({
      erasureLogRows: [],
      subscriptionRow: {
        stripe_subscription_id: "sub_active_123",
        status: "active",
      },
    });

    mockStripeCancel.mockRejectedValueOnce(new Error("Stripe down"));

    const { deleteAccount } = await import("@/app/(app)/account/actions");

    const result = await deleteAccount(null, fd({ confirmation: "DELETE" }));

    expect(result).toEqual({
      error: "Could not cancel your subscription. Please contact support.",
    });

    // Stripe was attempted with the right id.
    expect(mockStripeCancel).toHaveBeenCalledWith("sub_active_123", {
      invoice_now: false,
      prorate: false,
    });

    // No erasure_log insert.
    const inserts = currentFakeAdmin.calls.filter(
      (c) => c.op === "insert" && c.table === "erasure_log",
    );
    expect(inserts).toHaveLength(0);

    // No cascade.
    const cascadeCalls = currentFakeAdmin.calls.filter(
      (c) => c.op === "delete" || c.op === "update",
    );
    expect(cascadeCalls).toHaveLength(0);
  });
});
