import { createAdminClient } from "@/lib/supabase/admin";
import { loose } from "@/lib/supabase/loose-table";
import { createClient } from "@/lib/supabase/server";
import { policyVersion } from "@/lib/consent/policies";
import { CareTeamSection, type AssignedClinician } from "./_components/care-team-section";
import { DeleteAccountButton } from "./_components/delete-account-button";
import { NotificationPrefs } from "./_components/NotificationPrefs";
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

  // Surface the patient's most-recent acceptance of the current data_no_training
  // policy version so the "How we use your data" card can show when (or whether)
  // they confirmed it.
  const dataNoTrainingVersion = policyVersion("data_no_training");
  const { data: acceptanceRow } = await supabase
    .from("consent_records")
    .select("accepted_at")
    .eq("user_uuid", user!.id)
    .eq("policy_id", "data_no_training")
    .eq("policy_version", dataNoTrainingVersion)
    .order("accepted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const dataNoTrainingAcceptedAt =
    (acceptanceRow?.accepted_at as string | null) ?? null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: prefsRow } = await (supabase as any)
    .from("notification_prefs")
    .select("check_in_reminders, weekly_digest, alert_emails")
    .eq("user_uuid", user!.id)
    .maybeSingle();
  const notificationPrefs = {
    check_in_reminders: prefsRow?.check_in_reminders ?? true,
    weekly_digest: prefsRow?.weekly_digest ?? true,
    alert_emails: prefsRow?.alert_emails ?? true,
  };

  // Active care-team assignments (clinicians the patient has nominated).
  // Service-role read so we can join across patient_assignments + auth.users +
  // clinician_profiles without RLS friction; only displayed back to the patient.
  const admin = createAdminClient();
  const { data: assignmentRows } = await admin
    .from("patient_assignments")
    .select("id, clinician_uuid, assigned_at")
    .eq("patient_uuid", user!.id)
    .eq("status", "active")
    .order("assigned_at", { ascending: false });

  const clinicianIds = (assignmentRows ?? [])
    .map((a) => a.clinician_uuid)
    .filter((x): x is string => Boolean(x));

  let clinicianRows: { user_uuid: string; full_name: string | null; contact_email: string | null; specialties: string[] }[] = [];
  if (clinicianIds.length > 0) {
    const { data } = await loose(admin)
      .from("clinician_profiles")
      .select("user_uuid, full_name, contact_email, specialties")
      .in("user_uuid", clinicianIds);
    clinicianRows = data ?? [];
  }

  const clinicians: AssignedClinician[] = (assignmentRows ?? [])
    .map((a) => {
      if (!a.clinician_uuid) return null;
      const profile = clinicianRows.find((c) => c.user_uuid === a.clinician_uuid);
      return {
        assignment_id: a.id,
        full_name: profile?.full_name ?? null,
        contact_email: profile?.contact_email ?? null,
        specialties: profile?.specialties ?? [],
        assigned_at: a.assigned_at,
      };
    })
    .filter((x): x is AssignedClinician => x !== null);

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
        <h2>How we use your data</h2>
        <p className="lc-account-info">
          Your data powers your personalised risk scores, supplement protocol,
          and clinician reviews — and nothing more. We never train AI models on
          your data, never sell it, and never share it with employers.{" "}
          <a href="/legal/data-handling">Read the full data-handling statement →</a>
        </p>
        {dataNoTrainingAcceptedAt ? (
          <p className="lc-account-meta">
            You agreed to this policy on{" "}
            {new Date(dataNoTrainingAcceptedAt).toLocaleDateString("en-AU", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
            .
          </p>
        ) : (
          <p className="lc-account-meta">
            Not yet confirmed.{" "}
            <a href="/legal/data-handling">Review the data-handling statement →</a>
          </p>
        )}
      </section>

      <CareTeamSection clinicians={clinicians} />

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
        <h2>Notifications</h2>
        <p className="lc-account-info">
          Choose which reminders we email you. Changes save automatically.
        </p>
        <NotificationPrefs initial={notificationPrefs} />
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
