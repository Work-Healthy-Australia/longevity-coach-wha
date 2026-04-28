import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockSingle = vi.fn();
const mockEqEnabled = vi.fn(() => ({ single: mockSingle }));
const mockEqSlug = vi.fn(() => ({ eq: mockEqEnabled }));
const mockSelect = vi.fn(() => ({ eq: mockEqSlug }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ schema: () => ({ from: mockFrom }) }),
}));

import { loadAgentDef } from "@/lib/ai/loader";

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.resetAllMocks());

const fakeAgentDef = {
  id: "abc-123",
  slug: "janet",
  display_name: "Janet",
  model: "claude-sonnet-4-6",
  provider: "anthropic",
  system_prompt: "You are Janet, a health coach.",
  temperature: 0.7,
  max_tokens: 2048,
  enabled: true,
  mcp_servers: [],
};

describe("loadAgentDef", () => {
  it("queries agent_definitions with the correct slug", async () => {
    mockSingle.mockResolvedValueOnce({ data: fakeAgentDef, error: null });
    await loadAgentDef("janet");
    expect(mockFrom).toHaveBeenCalledWith("agent_definitions");
    expect(mockSelect).toHaveBeenCalledWith("*");
    expect(mockEqSlug).toHaveBeenCalledWith("slug", "janet");
    expect(mockEqEnabled).toHaveBeenCalledWith("enabled", true);
  });

  it("returns the agent definition when found", async () => {
    mockSingle.mockResolvedValueOnce({ data: fakeAgentDef, error: null });
    const def = await loadAgentDef("janet");
    expect(def.slug).toBe("janet");
    expect(def.model).toBe("claude-sonnet-4-6");
    expect(def.system_prompt).toBe("You are Janet, a health coach.");
  });

  it("throws when data is null (agent disabled or missing)", async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: null });
    await expect(loadAgentDef("unknown")).rejects.toThrow(
      "Agent 'unknown' not found or disabled",
    );
  });

  it("throws when Supabase returns an error", async () => {
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { message: "relation does not exist" },
    });
    await expect(loadAgentDef("janet")).rejects.toThrow();
  });
});
