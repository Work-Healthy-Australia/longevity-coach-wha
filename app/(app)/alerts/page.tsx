import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { dismissAlert } from "../dashboard/_actions/dismiss-alert";
import "./alerts.css";

export const metadata = { title: "Alerts · Janet Cares" };

type AlertRow = {
  id: string;
  alert_type: string;
  severity: string;
  title: string;
  body: string;
  link_href: string | null;
  status: string;
  created_at: string;
  dismissed_at: string | null;
};

const SEVERITY_ORDER: Record<string, number> = { urgent: 0, attention: 1, info: 2 };

export default async function AlertsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: rows } = await supabase
    .from("member_alerts")
    .select("id, alert_type, severity, title, body, link_href, status, created_at, dismissed_at")
    .eq("user_uuid", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  const alerts = (rows ?? []) as AlertRow[];
  const open = alerts.filter((a) => a.status === "open");
  const dismissed = alerts.filter((a) => a.status === "dismissed");

  open.sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9));

  return (
    <div className="alerts-page">
      <header className="alerts-header">
        <h1>Alerts</h1>
        <p className="alerts-subtitle">
          Lab results and screening reminders that need your attention.
        </p>
      </header>

      {alerts.length === 0 ? (
        <section className="alerts-empty">
          <div className="alerts-empty-icon">&#x2714;&#xFE0F;</div>
          <h2>All clear</h2>
          <p>
            No alerts right now. When a lab result falls outside the reference
            range or a screening is due, it will appear here.
          </p>
          <Link href="/dashboard" className="alerts-back">Back to dashboard</Link>
        </section>
      ) : (
        <>
          {open.length > 0 && (
            <section className="alerts-group">
              <h2 className="alerts-group-title">
                Open <span className="alerts-count">{open.length}</span>
              </h2>
              <div className="alerts-list">
                {open.map((alert) => (
                  <AlertCard key={alert.id} alert={alert} />
                ))}
              </div>
            </section>
          )}

          {dismissed.length > 0 && (
            <section className="alerts-group">
              <h2 className="alerts-group-title dismissed-title">
                Dismissed <span className="alerts-count">{dismissed.length}</span>
              </h2>
              <div className="alerts-list">
                {dismissed.map((alert) => (
                  <AlertCard key={alert.id} alert={alert} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function AlertCard({ alert }: { alert: AlertRow }) {
  const isOpen = alert.status === "open";
  return (
    <div className={`alert-card alert-${alert.severity} ${isOpen ? "" : "alert-dismissed"}`}>
      <div className="alert-card-body">
        <div className="alert-card-meta">
          <span className={`alert-severity-badge alert-sev-${alert.severity}`}>
            {alert.severity}
          </span>
          <span className="alert-card-date">
            {new Date(alert.created_at).toLocaleDateString(undefined, {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </span>
        </div>
        <div className="alert-card-title">{alert.title}</div>
        <div className="alert-card-text">{alert.body}</div>
      </div>
      <div className="alert-card-actions">
        {alert.link_href && (
          <Link href={alert.link_href} className="alert-card-view">
            View details
          </Link>
        )}
        {isOpen && (
          <form action={dismissAlert}>
            <input type="hidden" name="id" value={alert.id} />
            <button type="submit" className="alert-card-dismiss">
              Dismiss
            </button>
          </form>
        )}
        {!isOpen && alert.dismissed_at && (
          <span className="alert-card-dismissed-label">
            Dismissed {new Date(alert.dismissed_at).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
          </span>
        )}
      </div>
    </div>
  );
}
