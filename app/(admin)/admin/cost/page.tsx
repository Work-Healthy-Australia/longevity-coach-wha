import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Cost · Admin" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ range?: string }>;
type Range = "7d" | "30d" | "quarter";

function parseRange(raw?: string): Range {
  if (raw === "30d" || raw === "quarter") return raw;
  return "7d";
}

function rangeStartIso(range: Range): string {
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

function fmtUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

type UsageRow = {
  created_at: string;
  agent_slug: string;
  model: string;
  cost_usd_cents: number;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  success: boolean;
  path: string;
};

type AlertRow = {
  id: string;
  period_date: string;
  cost_usd_cents: number;
  threshold_usd_cents: number;
  severity: string;
  status: string;
  created_at: string;
};

export default async function AdminCostPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const range = parseRange(params.range);
  const sinceIso = rangeStartIso(range);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const [usageResult, alertsResult] = await Promise.all([
    admin
      .from("agent_usage")
      .select(
        "created_at, agent_slug, model, cost_usd_cents, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, success, path",
      )
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(5000),
    admin
      .from("agent_cost_alerts")
      .select("id, period_date, cost_usd_cents, threshold_usd_cents, severity, status, created_at")
      .order("period_date", { ascending: false })
      .limit(30),
  ]);

  const rows = ((usageResult.data ?? []) as unknown) as UsageRow[];
  const alerts = ((alertsResult.data ?? []) as unknown) as AlertRow[];
  const openAlerts = alerts.filter((a) => a.status === "open");

  // Day buckets (UTC)
  const dailyTotals = new Map<string, number>();
  const dailyCalls = new Map<string, number>();
  for (const r of rows) {
    const day = r.created_at.slice(0, 10);
    dailyTotals.set(day, (dailyTotals.get(day) ?? 0) + r.cost_usd_cents);
    dailyCalls.set(day, (dailyCalls.get(day) ?? 0) + 1);
  }
  const dayKeys = [...dailyTotals.keys()].sort().reverse();

  // Per-agent rollup
  const perAgent = new Map<string, { calls: number; cost: number; failures: number; inputT: number; outputT: number; cacheR: number }>();
  for (const r of rows) {
    const k = r.agent_slug;
    const cur = perAgent.get(k) ?? { calls: 0, cost: 0, failures: 0, inputT: 0, outputT: 0, cacheR: 0 };
    cur.calls += 1;
    cur.cost += r.cost_usd_cents;
    if (!r.success) cur.failures += 1;
    cur.inputT += r.input_tokens;
    cur.outputT += r.output_tokens;
    cur.cacheR += r.cache_read_tokens;
    perAgent.set(k, cur);
  }
  const agentRows = [...perAgent.entries()].sort((a, b) => b[1].cost - a[1].cost);

  const totalCost = rows.reduce((acc, r) => acc + r.cost_usd_cents, 0);
  const totalCalls = rows.length;
  const failureCount = rows.filter((r) => !r.success).length;

  const todayKey = new Date().toISOString().slice(0, 10);
  const todayCost = dailyTotals.get(todayKey) ?? 0;

  const recentFailures = rows.filter((r) => !r.success).slice(0, 20);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Admin · Anthropic spend</h1>
        <form method="get" style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <label htmlFor="range" style={{ fontSize: 13, color: "#4A6070" }}>Range</label>
          <select id="range" name="range" defaultValue={range} style={{ padding: "6px 10px", fontSize: 13 }}>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="quarter">Last 90 days</option>
          </select>
          <button type="submit" style={{ padding: "6px 14px", fontSize: 13 }}>Apply</button>
        </form>
      </header>

      {openAlerts.length > 0 && (
        <section style={{ marginBottom: 24, padding: 16, background: "#FEF3C7", border: "1px solid #F59E0B", borderRadius: 8 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Open budget alerts ({openAlerts.length})</h2>
          <ul style={{ fontSize: 13, color: "#4A6070" }}>
            {openAlerts.map((a) => (
              <li key={a.id}>
                {a.period_date}: {fmtUsd(a.cost_usd_cents)} (threshold {fmtUsd(a.threshold_usd_cents)}) — {a.severity}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        <Tile label="Today" value={fmtUsd(todayCost)} />
        <Tile label={`Window (${range})`} value={fmtUsd(totalCost)} />
        <Tile label="Calls" value={totalCalls.toLocaleString()} />
        <Tile label="Failures" value={`${failureCount} (${totalCalls ? ((failureCount / totalCalls) * 100).toFixed(1) : "0.0"}%)`} />
      </div>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Daily totals</h2>
        <Table headers={["Day (UTC)", "Cost", "Calls"]}>
          {dayKeys.map((d) => (
            <tr key={d} style={{ borderTop: "1px solid #E8EEF2" }}>
              <td style={cellStyle}>{d}</td>
              <td style={cellStyle}>{fmtUsd(dailyTotals.get(d) ?? 0)}</td>
              <td style={cellStyle}>{(dailyCalls.get(d) ?? 0).toLocaleString()}</td>
            </tr>
          ))}
        </Table>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>By agent</h2>
        <Table headers={["Agent", "Calls", "Failures", "Input tok", "Output tok", "Cache read tok", "Cost"]}>
          {agentRows.map(([slug, v]) => (
            <tr key={slug} style={{ borderTop: "1px solid #E8EEF2" }}>
              <td style={{ ...cellStyle, fontFamily: "monospace" }}>{slug}</td>
              <td style={cellStyle}>{v.calls.toLocaleString()}</td>
              <td style={cellStyle}>{v.failures.toLocaleString()}</td>
              <td style={cellStyle}>{v.inputT.toLocaleString()}</td>
              <td style={cellStyle}>{v.outputT.toLocaleString()}</td>
              <td style={cellStyle}>{v.cacheR.toLocaleString()}</td>
              <td style={cellStyle}>{fmtUsd(v.cost)}</td>
            </tr>
          ))}
        </Table>
      </section>

      {recentFailures.length > 0 && (
        <section>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Recent failures</h2>
          <Table headers={["When (UTC)", "Agent", "Path", "Model"]}>
            {recentFailures.map((r, i) => (
              <tr key={i} style={{ borderTop: "1px solid #E8EEF2" }}>
                <td style={cellStyle}>{r.created_at.replace("T", " ").slice(0, 19)}</td>
                <td style={{ ...cellStyle, fontFamily: "monospace" }}>{r.agent_slug}</td>
                <td style={cellStyle}>{r.path}</td>
                <td style={{ ...cellStyle, fontFamily: "monospace" }}>{r.model}</td>
              </tr>
            ))}
          </Table>
        </section>
      )}

      {totalCalls === 0 && (
        <p style={{ color: "#6B7A82", fontSize: 14, marginTop: 24 }}>
          No Claude calls recorded in this window. Once telemetry catches a few calls this page populates.
        </p>
      )}
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "#fff", padding: "16px 18px", borderRadius: 8, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
      <div style={{ fontSize: 12, color: "#6B7A82", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: "#1F3A4D" }}>{value}</div>
    </div>
  );
}

function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 8, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
      <thead>
        <tr style={{ background: "#F0F4F7", textAlign: "left" }}>
          {headers.map((h) => (
            <th key={h} style={{ padding: "10px 14px", fontSize: 12, fontWeight: 600, color: "#4A6070" }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}

const cellStyle: React.CSSProperties = { padding: "10px 14px", fontSize: 13, color: "#1F3A4D" };
