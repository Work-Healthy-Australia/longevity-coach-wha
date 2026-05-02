import Link from "next/link";
import { redirect } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import "./clinician.css";

export const metadata = { title: "Clinician" };

export default async function ClinicianLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/clinician");

  // Proxy already gates by role; this is the in-page belt-and-braces check
  // (and gives us full_name for the nav). Same pattern as /admin/layout.tsx.
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role, is_admin, full_name")
    .eq("id", user.id)
    .single();

  const allowed = profile?.role === "clinician" || profile?.is_admin === true;
  if (!allowed) redirect("/dashboard");

  return (
    <div className="clinician-shell">
      <nav className="clinician-nav">
        <div className="clinician-nav-brand">Janet Cares · Clinician</div>
        <div className="clinician-nav-links">
          <Link href="/clinician">Reviews</Link>
          <Link href="/clinician/schedule">Schedule</Link>
          <Link href="/clinician/profile">Profile</Link>
          <Link href="/dashboard" className="muted">Exit</Link>
        </div>
        <div className="clinician-nav-user">{profile?.full_name ?? user.email}</div>
      </nav>
      <main className="clinician-main">{children}</main>
    </div>
  );
}
