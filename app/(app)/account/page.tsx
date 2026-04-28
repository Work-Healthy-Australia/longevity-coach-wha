import { createClient } from "@/lib/supabase/server";
import "./account.css";

export const dynamic = "force-dynamic";

function formatDob(dob: string | null): string {
  if (!dob) return "—";
  try {
    return new Date(dob).toLocaleDateString("en-AU", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dob;
  }
}

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Proxy guard already redirects unauthenticated users away from /account.
  const email = user?.email ?? "—";

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, date_of_birth")
    .eq("id", user!.id)
    .maybeSingle();

  const fullName = (profile?.full_name as string | null) ?? "—";
  const dob = formatDob((profile?.date_of_birth as string | null) ?? null);

  return (
    <div className="lc-account">
      <h1>Account</h1>

      <section className="lc-account-card">
        <h2>Identity</h2>
        <dl className="lc-account-id">
          <div>
            <dt>Name</dt>
            <dd>{fullName}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{email}</dd>
          </div>
          <div>
            <dt>Date of birth</dt>
            <dd>{dob}</dd>
          </div>
        </dl>
      </section>

      <section className="lc-account-card">
        <h2>Download my data</h2>
        <p className="lc-account-info">
          Includes everything we hold: profile, assessments, risk scores,
          supplement plans, lab results, daily logs, consent history, and your
          latest PDF report. ZIP format.
        </p>
        <a className="lc-account-button" href="/api/export" download>
          Download my data
        </a>
      </section>
    </div>
  );
}
