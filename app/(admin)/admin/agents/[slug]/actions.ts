"use server";

import { revalidateTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

export async function updateAgentDefinition(
  slug: string,
  data: {
    display_name: string;
    model: string;
    provider: string;
    system_prompt: string;
    temperature: number;
    max_tokens: number;
    enabled: boolean;
  },
): Promise<{ error?: string }> {
  if (!data.model || !data.system_prompt) return { error: "Model and system prompt are required." };
  if (data.provider !== "anthropic" && data.provider !== "openrouter") {
    return { error: "Provider must be anthropic or openrouter." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("agent_definitions")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("slug", slug);

  if (error) return { error: error.message };

  revalidateTag("agent-def", "max");
  return {};
}

export async function addMCPServer(
  slug: string,
  server: { id: string; name: string; type: "sse" | "http"; url: string; enabled: boolean },
): Promise<{ error?: string }> {
  const admin = createAdminClient();
  const { data, error: fetchErr } = await admin
    .from("agent_definitions")
    .select("mcp_servers")
    .eq("slug", slug)
    .single();

  if (fetchErr || !data) return { error: "Agent not found." };

  const current = (data.mcp_servers as typeof server[]) ?? [];
  const updated = [...current, server];

  const { error } = await admin
    .from("agent_definitions")
    .update({ mcp_servers: updated as unknown as import("@/lib/supabase/database.types").Json, updated_at: new Date().toISOString() })
    .eq("slug", slug);

  if (error) return { error: error.message };
  revalidateTag("agent-def", "max");
  return {};
}

export async function removeMCPServer(
  slug: string,
  serverId: string,
): Promise<{ error?: string }> {
  const admin = createAdminClient();
  const { data, error: fetchErr } = await admin
    .from("agent_definitions")
    .select("mcp_servers")
    .eq("slug", slug)
    .single();

  if (fetchErr || !data) return { error: "Agent not found." };

  type MCPServer = { id: string; [key: string]: unknown };
  const current = (data.mcp_servers as MCPServer[]) ?? [];
  const updated = current.filter((s) => s.id !== serverId);

  const { error } = await admin
    .from("agent_definitions")
    .update({ mcp_servers: updated as unknown as import("@/lib/supabase/database.types").Json, updated_at: new Date().toISOString() })
    .eq("slug", slug);

  if (error) return { error: error.message };
  revalidateTag("agent-def", "max");
  return {};
}

export async function toggleAgent(
  slug: string,
  enabled: boolean,
): Promise<{ error?: string }> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("agent_definitions")
    .update({ enabled, updated_at: new Date().toISOString() })
    .eq("slug", slug);

  if (error) return { error: error.message };
  revalidateTag("agent-def", "max");
  return {};
}
