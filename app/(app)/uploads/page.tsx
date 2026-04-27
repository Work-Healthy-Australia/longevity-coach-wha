import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { UploadClient } from "./upload-client";
import "./uploads.css";

export const metadata = { title: "My Documents · Longevity Coach" };

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
        <h1>My Documents</h1>
        <p className="subtitle">
          Upload previous pathology, imaging, and test results for Janet to analyse.
        </p>
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
      <h1>My Documents</h1>
      <p className="subtitle">
        Upload previous pathology, imaging, or any test results. Janet reads each file and
        categorises it automatically — this data improves your risk scores.
      </p>
      <UploadClient initialUploads={uploads ?? []} />
    </div>
  );
}
