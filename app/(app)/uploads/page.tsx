import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { UploadClient } from "./upload-client";
import "./uploads.css";

export const metadata = { title: "Documents · Janet Cares" };

export default async function UploadsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Gate: must have completed health assessment
  const { data: assessment } = await supabase
    .from("health_profiles")
    .select("id, completed_at")
    .eq("user_uuid", user!.id)
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: uploads } = await supabase
    .from("patient_uploads")
    .select("*")
    .eq("user_uuid", user!.id)
    .order("created_at", { ascending: false });

  if (!assessment) {
    return (
      <div className="lc-uploads">
        <header className="lc-uploads-header">
          <span className="lc-uploads-eyebrow">Documents · Uploads</span>
          <h1>Your <em>records</em></h1>
          <p className="lc-uploads-lede">
            Upload previous pathology, imaging, and test results — Janet reads each file
            and folds it into your risk profile.
          </p>
        </header>
        <div className="gate-card">
          <h2>Complete your health assessment first</h2>
          <p>
            Janet needs your health history before she can put your test results in context.
            This takes about 10 minutes and unlocks your full risk profile.
          </p>
          <Link className="btn btn-primary" href="/onboarding">
            Start your assessment
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="lc-uploads">
      <header className="lc-uploads-header">
        <span className="lc-uploads-eyebrow">Documents · Uploads</span>
        <h1>Your <em>records</em></h1>
        <p className="lc-uploads-lede">
          Upload previous pathology, imaging, or any test results. Janet reads each
          file and categorises it automatically — this data improves your risk scores.
        </p>
      </header>
      <UploadClient initialUploads={uploads ?? []} />
    </div>
  );
}
