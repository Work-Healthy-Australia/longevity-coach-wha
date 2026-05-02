import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockUpdateEq = vi.fn(() => Promise.resolve({ error: null }));
const mockUpdate = vi.fn(() => ({ eq: mockUpdateEq }));

const mockSingleForSelect = vi.fn();
const mockSelectEq = vi.fn(() => ({ single: mockSingleForSelect }));
const mockSelect = vi.fn(() => ({ eq: mockSelectEq }));

const mockFrom = vi.fn(() => ({
  update: mockUpdate,
  select: mockSelect,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ schema: () => ({ from: mockFrom }) }),
}));

import {
  addMCPServer,
  removeMCPServer,
  toggleAgent,
  updateAgentDefinition,
} from "@/app/(admin)/admin/agents/[slug]/actions";

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.resetAllMocks());

const validData = {
  display_name: "Janet",
  model: "claude-sonnet-4-6",
  provider: "anthropic",
  system_prompt: "You are Janet, a health coach.",
  temperature: 0.7,
  max_tokens: 2048,
  enabled: true,
};

describe("updateAgentDefinition", () => {
  it("returns an error when model is empty", async () => {
    const r = await updateAgentDefinition("janet", { ...validData, model: "" });
    expect(r.error).toMatch(/model/i);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("returns an error when system_prompt is empty", async () => {
    const r = await updateAgentDefinition("janet", {
      ...validData,
      system_prompt: "",
    });
    expect(r.error).toMatch(/system prompt/i);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("returns an error for an invalid provider value", async () => {
    const r = await updateAgentDefinition("janet", {
      ...validData,
      provider: "bedrock",
    });
    expect(r.error).toMatch(/provider/i);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("calls update on agent_definitions with the correct slug", async () => {
    const r = await updateAgentDefinition("janet", validData);
    expect(r.error).toBeUndefined();
    expect(mockFrom).toHaveBeenCalledWith("agent_definitions");
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdateEq).toHaveBeenCalledWith("slug", "janet");
  });

  it("invalidates the agent-def cache after a successful update", async () => {
    await updateAgentDefinition("janet", validData);
    const { revalidateTag } = await import("next/cache");
    expect(revalidateTag).toHaveBeenCalledWith("agent-def", "max");
  });

  it("surfaces Supabase errors", async () => {
    mockUpdateEq.mockResolvedValueOnce({ error: { message: "DB write error" } });
    const r = await updateAgentDefinition("janet", validData);
    expect(r.error).toBe("DB write error");
  });
});

describe("addMCPServer", () => {
  const newServer = {
    id: "srv-1",
    name: "Test MCP",
    type: "sse" as const,
    url: "https://mcp.example.com",
    enabled: true,
  };

  it("returns an error when the agent slug is not found", async () => {
    mockSingleForSelect.mockResolvedValueOnce({
      data: null,
      error: { message: "not found" },
    });
    const r = await addMCPServer("janet", newServer);
    expect(r.error).toBe("Agent not found.");
  });

  it("appends the new server to the existing mcp_servers list", async () => {
    mockSingleForSelect.mockResolvedValueOnce({
      data: { mcp_servers: [{ id: "existing", name: "Old", type: "http", url: "https://old.com", enabled: false }] },
      error: null,
    });
    const r = await addMCPServer("janet", newServer);
    expect(r.error).toBeUndefined();
    const updateArg = mockUpdate.mock.calls[0]?.[0] as unknown as {
      mcp_servers: { id: string }[];
    };
    expect(updateArg.mcp_servers).toHaveLength(2);
    expect(updateArg.mcp_servers.find((s) => s.id === "srv-1")).toBeDefined();
    expect(
      updateArg.mcp_servers.find((s) => s.id === "existing"),
    ).toBeDefined();
  });

  it("works when mcp_servers is null in the database", async () => {
    mockSingleForSelect.mockResolvedValueOnce({
      data: { mcp_servers: null },
      error: null,
    });
    const r = await addMCPServer("janet", newServer);
    expect(r.error).toBeUndefined();
    const updateArg = mockUpdate.mock.calls[0]?.[0] as unknown as {
      mcp_servers: { id: string }[];
    };
    expect(updateArg.mcp_servers).toHaveLength(1);
  });
});

describe("removeMCPServer", () => {
  it("filters out the target server by id", async () => {
    mockSingleForSelect.mockResolvedValueOnce({
      data: {
        mcp_servers: [
          { id: "keep-me", name: "Keep", type: "sse", url: "https://keep.com", enabled: true },
          { id: "remove-me", name: "Remove", type: "http", url: "https://remove.com", enabled: false },
        ],
      },
      error: null,
    });
    const r = await removeMCPServer("janet", "remove-me");
    expect(r.error).toBeUndefined();
    const updateArg = mockUpdate.mock.calls[0]?.[0] as unknown as {
      mcp_servers: { id: string }[];
    };
    expect(updateArg.mcp_servers).toHaveLength(1);
    expect(
      updateArg.mcp_servers.find((s) => s.id === "remove-me"),
    ).toBeUndefined();
    expect(updateArg.mcp_servers.find((s) => s.id === "keep-me")).toBeDefined();
  });

  it("returns an error when the agent slug is not found", async () => {
    mockSingleForSelect.mockResolvedValueOnce({
      data: null,
      error: { message: "not found" },
    });
    const r = await removeMCPServer("janet", "srv-1");
    expect(r.error).toBe("Agent not found.");
  });
});

describe("toggleAgent", () => {
  it("sets enabled=false in the update payload", async () => {
    const r = await toggleAgent("janet", false);
    expect(r.error).toBeUndefined();
    const updateArg = mockUpdate.mock.calls[0]?.[0] as unknown as { enabled: boolean };
    expect(updateArg.enabled).toBe(false);
  });

  it("sets enabled=true in the update payload", async () => {
    const r = await toggleAgent("atlas", true);
    expect(r.error).toBeUndefined();
    const updateArg = mockUpdate.mock.calls[0]?.[0] as unknown as { enabled: boolean };
    expect(updateArg.enabled).toBe(true);
  });

  it("updates the correct slug", async () => {
    await toggleAgent("sage", true);
    expect(mockUpdateEq).toHaveBeenCalledWith("slug", "sage");
  });
});
