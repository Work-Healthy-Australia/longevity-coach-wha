import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { AgentEditForm, type Agent } from "./_components/agent-edit-form";

export default async function AgentEditPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: agent } = await (createAdminClient() as any)
    .schema("agents")
    .from("agent_definitions")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!agent) redirect("/admin/agents");

  return <AgentEditForm agent={agent as unknown as Agent} />;
}
