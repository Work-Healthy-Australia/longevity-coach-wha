import { getDashboardMetrics, parseRange, formatMrr, type DateRange } from "@/lib/admin/metrics";

export const metadata = { title: "Overview · Admin" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ range?: string }>;

export default async function AdminOverviewPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const range: DateRange = parseRange(params.range);
  const metrics = await getDashboardMetrics(range);

  return (
    <div className="admin-content">
      <header className="admin-overview-header">
        <h1 className="admin-overview-title">Admin · Overview</h1>
        <form method="get" className="admin-range-form">
          <label htmlFor="range" className="admin-range-label">Date range</label>
          <select
            id="range"
            name="range"
            defaultValue={range}
            className="admin-range-select"
            // submit on change via a tiny inline script-free pattern:
            // wrap in <noscript>-friendly button below
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="quarter">Last quarter</option>
            <option value="all">All time</option>
          </select>
          <button type="submit" className="admin-range-submit">Apply</button>
        </form>
      </header>

      <div className="admin-metric-grid">
        <MetricTile label="MRR" value={formatMrr(metrics.mrrCents)} />
        <MetricTile label="Active members" value={metrics.activeMembers.toLocaleString()} />
        <MetricTile label={`New signups (${rangeLabel(range)})`} value={metrics.newSignups.toLocaleString()} />
        <MetricTile label="Churn (30d)" value={metrics.churn30d.toLocaleString()} />
        <MetricTile label="Pipeline runs (24h)" value={metrics.pipelineRuns24h.toLocaleString()} />
        <MetricTile label="Uploads (24h)" value={metrics.uploads24h.toLocaleString()} />
      </div>

      <div className="admin-card">
        <h2 className="admin-card-title">Recent signups</h2>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Signed up</th>
              <th>Subscription</th>
              <th>Assessment</th>
            </tr>
          </thead>
          <tbody>
            {metrics.recentSignups.map((row) => (
              <tr key={row.id}>
                <td>
                  <a href={`/admin/users/${row.id}`} className="user-name view-link">
                    {row.fullName}
                  </a>
                </td>
                <td>{row.email ?? <span className="muted-cell">—</span>}</td>
                <td>{formatDate(row.createdAt)}</td>
                <td>
                  <span className={`status-badge status-${row.subscriptionStatus ?? "none"}`}>
                    {row.subscriptionStatus ?? "No plan"}
                  </span>
                </td>
                <td>
                  {row.hasAssessment ? (
                    <span className="badge">Done</span>
                  ) : (
                    <span className="muted-cell">Not started</span>
                  )}
                </td>
              </tr>
            ))}
            {metrics.recentSignups.length === 0 && (
              <tr>
                <td colSpan={5} className="empty-row">No signups yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="analytics-card admin-metric-tile">
      <div className="analytics-value">{value}</div>
      <div className="analytics-label">{label}</div>
    </div>
  );
}

function rangeLabel(range: DateRange): string {
  switch (range) {
    case "7d": return "7d";
    case "30d": return "30d";
    case "quarter": return "quarter";
    case "all": return "all time";
  }
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-AU", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
