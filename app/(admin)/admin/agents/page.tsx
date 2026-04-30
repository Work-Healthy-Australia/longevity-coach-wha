import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Agents · Admin · Janet Cares" };
export const dynamic = "force-dynamic";

export default async function AdminAgentsPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: agents } = await (createAdminClient() as any)
    .schema("agents")
    .from("agent_definitions")
    .select("slug, display_name, model, provider, enabled, updated_at")
    .order("slug") as { data: Array<{ slug: string; display_name: string; model: string; provider: string; enabled: boolean; updated_at: string | null }> | null };

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 24px" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24 }}>AI Agents</h1>

      <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 8, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
        <thead>
          <tr style={{ background: "#F0F4F7", textAlign: "left" }}>
            {["Slug", "Name", "Model", "Provider", "Enabled", "Updated", ""].map((h) => (
              <th key={h} style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, color: "#4A6070" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(agents ?? []).map((a, i) => (
            <tr key={a.slug} style={{ borderTop: i === 0 ? "none" : "1px solid #E8EEF2" }}>
              <td style={{ padding: "12px 16px", fontFamily: "monospace", fontSize: 13 }}>{a.slug}</td>
              <td style={{ padding: "12px 16px", fontSize: 14 }}>{a.display_name}</td>
              <td style={{ padding: "12px 16px", fontFamily: "monospace", fontSize: 12, color: "#4A6070" }}>{a.model}</td>
              <td style={{ padding: "12px 16px", fontSize: 13 }}>{a.provider}</td>
              <td style={{ padding: "12px 16px" }}>
                <span style={{ padding: "2px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600, background: a.enabled ? "#DFF5E8" : "#FCE8E8", color: a.enabled ? "#1A7A3C" : "#B03030" }}>
                  {a.enabled ? "On" : "Off"}
                </span>
              </td>
              <td style={{ padding: "12px 16px", fontSize: 12, color: "#7A90A0" }}>
                {a.updated_at ? new Date(a.updated_at).toLocaleDateString() : "—"}
              </td>
              <td style={{ padding: "12px 16px" }}>
                <Link href={`/admin/agents/${a.slug}`} style={{ fontSize: 13, color: "#2F6F8F", textDecoration: "none", fontWeight: 500 }}>
                  Edit →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
