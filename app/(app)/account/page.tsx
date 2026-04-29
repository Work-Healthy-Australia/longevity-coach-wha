import { createClient } from "@/lib/supabase/server";
import { DeleteAccountButton } from "./_components/delete-account-button";
import { pauseAccount, unpauseAccount } from "./pause-actions";
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

export default async function AccountPage({
  searchParams,
}: {
  searchParams?: Promise<{ paused?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Proxy guard already redirects unauthenticated users away from /account.
  const email = user?.email ?? "—";

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, date_of_birth, paused_at")
    .eq("id", user!.id)
    .maybeSingle();

  const fullName = (profile?.full_name as string | null) ?? "—";
  const dob = formatDob((profile?.date_of_birth as string | null) ?? null);
  const pausedAt = (profile?.paused_at as string | null) ?? null;

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const showPausedBanner = resolvedSearchParams?.paused === "true";

  return (
    <div className="lc-account">
      <h1>Account</h1>

      {showPausedBanner && (
        <div className="lc-paused-banner">
          <strong>Account paused.</strong> Some features are suspended.{" "}
          <form action={unpauseAccount} style={{ display: "inline" }}>
            <button type="submit" className="btn-link">
              Unfreeze now
            </button>
          </form>
        </div>
      )}

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

      <section className="lc-account-card">
        <h2>Pause account</h2>
        <p className="lc-account-info">
          {pausedAt
            ? "Your account is paused. Dashboard, report, and check-in are suspended."
            : "Temporarily suspend access to your dashboard and health data."}
        </p>
        <form action={pausedAt ? unpauseAccount : pauseAccount}>
          <button
            type="submit"
            className={pausedAt ? "lc-account-button" : "lc-account-button-secondary"}
          >
            {pausedAt ? "Unfreeze account" : "Pause account"}
          </button>
        </form>
      </section>

      <section className="lc-account-card lc-account-danger">
        <h2>Delete account</h2>
        <p>
          Permanently erases your PII and removes access to your account.
          Health data is anonymised, not deleted, for clinical integrity.
        </p>
        <DeleteAccountButton />
      </section>
    </div>
  );
}
