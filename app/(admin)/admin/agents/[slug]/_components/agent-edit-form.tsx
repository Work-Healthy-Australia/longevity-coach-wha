"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { updateAgentDefinition, addMCPServer, removeMCPServer } from "../actions";

export type Agent = {
  slug: string;
  display_name: string;
  model: string;
  provider: string;
  system_prompt: string;
  temperature: number;
  max_tokens: number;
  enabled: boolean;
  mcp_servers: Array<{ id: string; name: string; type: string; url: string; enabled: boolean }>;
};

export function AgentEditForm({ agent }: { agent: Agent }) {
  const [state, action, pending] = useActionState(
    async (_prev: { error?: string }, formData: FormData) => {
      return updateAgentDefinition(agent.slug, {
        display_name: formData.get("display_name") as string,
        model: formData.get("model") as string,
        provider: formData.get("provider") as string,
        system_prompt: formData.get("system_prompt") as string,
        temperature: parseFloat(formData.get("temperature") as string),
        max_tokens: parseInt(formData.get("max_tokens") as string, 10),
        enabled: formData.get("enabled") === "true",
      });
    },
    {},
  );

  const [newServer, setNewServer] = useState({ name: "", type: "sse" as "sse" | "http", url: "" });
  const [serverError, setServerError] = useState("");

  async function handleAddServer() {
    if (!newServer.name || !newServer.url) { setServerError("Name and URL required."); return; }
    const res = await addMCPServer(agent.slug, { id: crypto.randomUUID(), ...newServer, enabled: true });
    if (res.error) { setServerError(res.error); } else { setNewServer({ name: "", type: "sse", url: "" }); setServerError(""); }
  }

  async function handleRemoveServer(id: string) {
    await removeMCPServer(agent.slug, id);
  }

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "32px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32 }}>
        <Link href="/admin/agents" style={{ color: "#2F6F8F", textDecoration: "none", fontSize: 14 }}>← Agents</Link>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{agent.display_name}</h1>
        <code style={{ background: "#F0F4F7", padding: "2px 8px", borderRadius: 4, fontSize: 12 }}>{agent.slug}</code>
      </div>

      <form action={action} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <Field label="Display name" name="display_name" defaultValue={agent.display_name} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Field label="Model" name="model" defaultValue={agent.model} mono />
          <div>
            <label style={labelStyle}>Provider</label>
            <select name="provider" defaultValue={agent.provider} style={inputStyle}>
              <option value="anthropic">anthropic</option>
              <option value="openrouter">openrouter</option>
            </select>
          </div>
        </div>

        <div>
          <label style={labelStyle}>System prompt</label>
          <textarea name="system_prompt" defaultValue={agent.system_prompt} rows={12}
            style={{ ...inputStyle, fontFamily: "monospace", fontSize: 13, resize: "vertical" }} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
          <Field label="Temperature (0–1)" name="temperature" defaultValue={String(agent.temperature)} type="number" step="0.05" min="0" max="1" />
          <Field label="Max tokens" name="max_tokens" defaultValue={String(agent.max_tokens)} type="number" min="256" max="32000" />
          <div>
            <label style={labelStyle}>Enabled</label>
            <select name="enabled" defaultValue={String(agent.enabled)} style={inputStyle}>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </div>
        </div>

        {state.error && <p style={{ color: "#B03030", fontSize: 14 }}>{state.error}</p>}

        <button type="submit" disabled={pending}
          style={{ alignSelf: "flex-start", padding: "10px 24px", background: "#2F6F8F", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: pending ? "not-allowed" : "pointer", opacity: pending ? 0.6 : 1 }}>
          {pending ? "Saving…" : "Save changes"}
        </button>
      </form>

      <hr style={{ margin: "40px 0", borderColor: "#E3E8EC" }} />

      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>MCP Servers</h2>

      {agent.mcp_servers.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24 }}>
          <thead>
            <tr style={{ background: "#F0F4F7", textAlign: "left" }}>
              {["Name", "Type", "URL", "Enabled", ""].map((h) => (
                <th key={h} style={{ padding: "8px 12px", fontSize: 12, fontWeight: 600, color: "#4A6070" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {agent.mcp_servers.map((s) => (
              <tr key={s.id} style={{ borderTop: "1px solid #E8EEF2" }}>
                <td style={{ padding: "8px 12px", fontSize: 13 }}>{s.name}</td>
                <td style={{ padding: "8px 12px", fontSize: 12, fontFamily: "monospace" }}>{s.type}</td>
                <td style={{ padding: "8px 12px", fontSize: 12, fontFamily: "monospace", color: "#4A6070" }}>{s.url}</td>
                <td style={{ padding: "8px 12px" }}>{s.enabled ? "✓" : "✗"}</td>
                <td style={{ padding: "8px 12px" }}>
                  <button type="button" onClick={() => handleRemoveServer(s.id)}
                    style={{ fontSize: 12, color: "#B03030", background: "none", border: "none", cursor: "pointer" }}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 2fr auto", gap: 8, alignItems: "end" }}>
        <div>
          <label style={labelStyle}>Name</label>
          <input value={newServer.name} onChange={(e) => setNewServer((s) => ({ ...s, name: e.target.value }))} style={inputStyle} placeholder="My MCP Server" />
        </div>
        <div>
          <label style={labelStyle}>Type</label>
          <select value={newServer.type} onChange={(e) => setNewServer((s) => ({ ...s, type: e.target.value as "sse" | "http" }))} style={inputStyle}>
            <option value="sse">sse</option>
            <option value="http">http</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>URL</label>
          <input value={newServer.url} onChange={(e) => setNewServer((s) => ({ ...s, url: e.target.value }))} style={inputStyle} placeholder="https://…" />
        </div>
        <button type="button" onClick={handleAddServer}
          style={{ padding: "8px 16px", background: "#2F6F8F", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}>
          Add
        </button>
      </div>
      {serverError && <p style={{ color: "#B03030", fontSize: 13, marginTop: 8 }}>{serverError}</p>}
    </div>
  );
}

const labelStyle: React.CSSProperties = { display: "block", fontSize: 13, fontWeight: 600, color: "#4A6070", marginBottom: 6 };
const inputStyle: React.CSSProperties = { width: "100%", padding: "8px 12px", border: "1px solid #DDE8EE", borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" };

function Field({ label, name, defaultValue, mono, type = "text", ...rest }: {
  label: string; name: string; defaultValue: string; mono?: boolean; type?: string; [k: string]: unknown;
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input name={name} defaultValue={defaultValue} type={type}
        style={{ ...inputStyle, fontFamily: mono ? "monospace" : "inherit" }} {...(rest as object)} />
    </div>
  );
}
