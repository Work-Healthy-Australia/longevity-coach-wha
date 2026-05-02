import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Users · Admin" };
export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const admin = createAdminClient();

  const [usersResult, subscriptionsResult, risksResult] = await Promise.all([
    admin
      .from("profiles")
      .select("id, full_name, created_at, is_admin")
      .order("created_at", { ascending: false }),

    admin
      .from("subscriptions")
      .select("user_uuid, status, price_id, current_period_end"),

    admin
      .from("risk_scores")
      .select("user_uuid, biological_age, longevity_score, assessment_date"),
  ]);

  const profiles = usersResult.data ?? [];
  const subs = subscriptionsResult.data ?? [];
  const risks = risksResult.data ?? [];

  const subMap = new Map(subs.map((s) => [s.user_uuid, s]));
  const riskMap = new Map(risks.map((r) => [r.user_uuid, r]));

  // Analytics
  const totalUsers = profiles.length;
  const activeSubscriptions = subs.filter((s) =>
    ["active", "trialing"].includes(s.status ?? ""),
  ).length;
  const completedAssessments = risks.length;
  const conversionRate =
    totalUsers > 0 ? Math.round((activeSubscriptions / totalUsers) * 100) : 0;

  const rows = profiles.map((p) => ({
    id: p.id,
    fullName: p.full_name ?? "—",
    createdAt: p.created_at,
    isAdmin: p.is_admin,
    sub: subMap.get(p.id) ?? null,
    risk: riskMap.get(p.id) ?? null,
  }));

  return (
    <div className="admin-content">
      {/* Analytics strip */}
      <div className="analytics-strip">
        <div className="analytics-card">
          <div className="analytics-value">{totalUsers}</div>
          <div className="analytics-label">Total users</div>
        </div>
        <div className="analytics-card">
          <div className="analytics-value">{activeSubscriptions}</div>
          <div className="analytics-label">Active subscriptions</div>
        </div>
        <div className="analytics-card">
          <div className="analytics-value">{completedAssessments}</div>
          <div className="analytics-label">Assessments completed</div>
        </div>
        <div className="analytics-card">
          <div className="analytics-value">{conversionRate}%</div>
          <div className="analytics-label">Trial → paid conversion</div>
        </div>
      </div>

      {/* User table */}
      <div className="admin-card">
        <h2 className="admin-card-title">All users</h2>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Signed up</th>
              <th>Subscription</th>
              <th>Plan</th>
              <th>Assessment</th>
              <th>Bio age</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <span className="user-name">{row.fullName}</span>
                  {row.isAdmin && <span className="badge admin-badge">admin</span>}
                </td>
                <td>{formatDate(row.createdAt)}</td>
                <td>
                  <span className={`status-badge status-${row.sub?.status ?? "none"}`}>
                    {row.sub?.status ?? "No plan"}
                  </span>
                </td>
                <td>{row.sub?.price_id ?? "—"}</td>
                <td>
                  {row.risk ? (
                    <span className="badge">
                      {formatDate(row.risk.assessment_date)}
                    </span>
                  ) : (
                    <span className="muted-cell">Not started</span>
                  )}
                </td>
                <td>
                  {row.risk?.biological_age != null ? (
                    <strong>{Math.round(row.risk.biological_age)}</strong>
                  ) : (
                    <span className="muted-cell">—</span>
                  )}
                </td>
                <td>
                  <a href={`/admin/users/${row.id}`} className="view-link">
                    View →
                  </a>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="empty-row">No users yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-AU", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
