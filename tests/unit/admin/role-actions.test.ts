import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetUser, mockMaybeSingle, mockRpc, mockRedirect, mockRevalidatePath } =
  vi.hoisted(() => ({
    mockGetUser: vi.fn(),
    mockMaybeSingle: vi.fn(),
    mockRpc: vi.fn(),
    mockRedirect: vi.fn((url: string) => {
      throw new Error(`NEXT_REDIRECT:${url}`);
    }),
    mockRevalidatePath: vi.fn(),
  }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: mockMaybeSingle,
        }),
      }),
    }),
    rpc: mockRpc,
  })),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({})),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath,
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => ({
    get: (key: string) => {
      if (key === "x-forwarded-for") return "203.0.113.1";
      if (key === "user-agent") return "test-agent";
      return null;
    },
  })),
}));

import { grantRole, revokeRoleAssignment } from "@/app/(admin)/admin/users/[id]/actions";

// Valid v4 UUIDs: version nibble (13th hex) = 4; variant nibble (17th) ∈ 8|9|a|b.
const ACTOR_ID = "11111111-1111-4111-8111-111111111111";
const TARGET_ID = "22222222-2222-4222-9222-222222222222";
const ASSIGNMENT_ID = "33333333-3333-4333-a333-333333333333";

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: { id: ACTOR_ID } } });
  mockMaybeSingle.mockResolvedValue({ data: { is_admin: true } });
  mockRpc.mockResolvedValue({ error: null });
  mockRedirect.mockImplementation((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  });
});

afterEach(() => {
  vi.resetAllMocks();
});

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
}

describe("grantRole", () => {
  it("1. happy path → calls RPC and revalidates", async () => {
    const result = await grantRole(
      {},
      fd({ target_user_id: TARGET_ID, role: "clinician", reason: "onboarding" }),
    );

    expect(mockRpc).toHaveBeenCalledWith("grant_role", {
      target_user_uuid: TARGET_ID,
      grant_role: "clinician",
      grant_scope_type: "global",
      grant_scope_id: null,
      grant_reason: "onboarding",
    });
    expect(result).toEqual({ success: "Role granted." });
    expect(mockRevalidatePath).toHaveBeenCalledWith(`/admin/users/${TARGET_ID}`);
  });

  it("2. non-admin caller → redirected to /dashboard", async () => {
    mockMaybeSingle.mockResolvedValue({ data: { is_admin: false } });

    await expect(
      grantRole({}, fd({ target_user_id: TARGET_ID, role: "clinician" })),
    ).rejects.toThrow("NEXT_REDIRECT:/dashboard");
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("3. unauthenticated caller → redirected to /login", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    await expect(
      grantRole({}, fd({ target_user_id: TARGET_ID, role: "clinician" })),
    ).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("4. invalid uuid → returns error, no RPC call", async () => {
    const result = await grantRole(
      {},
      fd({ target_user_id: "not-a-uuid", role: "clinician" }),
    );

    expect(result.error).toBeDefined();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("5. invalid role (corp_health_manager not in ASSIGNABLE_ROLES) → returns error", async () => {
    const result = await grantRole(
      {},
      fd({ target_user_id: TARGET_ID, role: "corp_health_manager" }),
    );

    expect(result.error).toBeDefined();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("6. RPC privilege error → returns error message verbatim", async () => {
    mockRpc.mockResolvedValue({
      error: { message: "only super_admin can grant super_admin or admin roles" },
    });

    const result = await grantRole(
      {},
      fd({ target_user_id: TARGET_ID, role: "super_admin" }),
    );

    expect(result).toEqual({
      error: "only super_admin can grant super_admin or admin roles",
    });
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it("11. self-grant of admin → blocked, no RPC call", async () => {
    const result = await grantRole(
      {},
      fd({ target_user_id: ACTOR_ID, role: "admin" }),
    );

    expect(result).toEqual({
      error: "Self-grant of admin roles is blocked — ask another super_admin.",
    });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("12. self-grant of super_admin → blocked, no RPC call", async () => {
    const result = await grantRole(
      {},
      fd({ target_user_id: ACTOR_ID, role: "super_admin" }),
    );

    expect(result).toEqual({
      error: "Self-grant of admin roles is blocked — ask another super_admin.",
    });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("13. self-grant of clinician (allowed) → RPC IS called", async () => {
    const result = await grantRole(
      {},
      fd({ target_user_id: ACTOR_ID, role: "clinician" }),
    );

    expect(mockRpc).toHaveBeenCalled();
    expect(result).toEqual({ success: "Role granted." });
  });

  it("14. duplicate grant (Postgres 23505) → mapped to friendly message", async () => {
    mockRpc.mockResolvedValue({
      error: {
        code: "23505",
        message:
          'duplicate key value violates unique constraint "user_role_assignments_active_unique"',
      },
    });

    const result = await grantRole(
      {},
      fd({ target_user_id: TARGET_ID, role: "clinician" }),
    );

    expect(result).toEqual({ error: "User already has this role." });
  });

  it("15. AHPRA gate (manager without ahpra_verified_at) → returns raw DB message", async () => {
    mockRpc.mockResolvedValue({
      error: { message: "manager role requires ahpra_verified_at on target user" },
    });

    const result = await grantRole(
      {},
      fd({ target_user_id: TARGET_ID, role: "manager" }),
    );

    expect(result).toEqual({
      error: "manager role requires ahpra_verified_at on target user",
    });
  });

  it("16. empty reason → RPC receives null for grant_reason", async () => {
    await grantRole(
      {},
      fd({ target_user_id: TARGET_ID, role: "clinician", reason: "" }),
    );

    expect(mockRpc).toHaveBeenCalledWith(
      "grant_role",
      expect.objectContaining({ grant_reason: null }),
    );
  });
});

describe("revokeRoleAssignment", () => {
  it("7. happy path → calls RPC and revalidates", async () => {
    const result = await revokeRoleAssignment(
      {},
      fd({ assignment_id: ASSIGNMENT_ID, target_user_id: TARGET_ID }),
    );

    expect(mockRpc).toHaveBeenCalledWith("revoke_role", {
      assignment_id: ASSIGNMENT_ID,
      revoke_reason: null,
    });
    expect(result).toEqual({ success: "Role revoked." });
    expect(mockRevalidatePath).toHaveBeenCalledWith(`/admin/users/${TARGET_ID}`);
  });

  it("8. non-admin caller → redirected to /dashboard", async () => {
    mockMaybeSingle.mockResolvedValue({ data: { is_admin: false } });

    await expect(
      revokeRoleAssignment(
        {},
        fd({ assignment_id: ASSIGNMENT_ID, target_user_id: TARGET_ID }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT:/dashboard");
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("9. invalid assignment_id (non-uuid) → returns error, no RPC call", async () => {
    const result = await revokeRoleAssignment(
      {},
      fd({ assignment_id: "bad", target_user_id: TARGET_ID }),
    );

    expect(result.error).toBeDefined();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("10. RPC error → returns error message", async () => {
    mockRpc.mockResolvedValue({
      error: { message: "role assignment already revoked" },
    });

    const result = await revokeRoleAssignment(
      {},
      fd({ assignment_id: ASSIGNMENT_ID, target_user_id: TARGET_ID }),
    );

    expect(result).toEqual({ error: "role assignment already revoked" });
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });
});
