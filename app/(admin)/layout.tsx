import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import "./admin.css";

export const metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("is_admin, full_name")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) redirect("/dashboard");

  return (
    <div className="admin-shell">
      <nav className="admin-nav">
        <div className="admin-nav-brand">Janet Cares · Admin</div>
        <div className="admin-nav-links">
          <Link href="/admin">Overview</Link>
          <Link href="/admin/users">Users</Link>
          <Link href="/admin/tiers">Tiers</Link>
          <Link href="/admin/suppliers">Suppliers</Link>
          <Link href="/admin/plan-builder">Plan Builder</Link>
          <Link href="/admin/agents">Agents</Link>
          <Link href="/admin/cost">Cost</Link>
          <Link href="/admin/clinicians">Clinicians</Link>
          <Link href="/admin/admins">Admins</Link>
          <Link href="/dashboard" className="muted">Exit admin</Link>
        </div>
        <div className="admin-nav-user">{profile.full_name ?? user.email}</div>
      </nav>
      <main className="admin-main">{children}</main>
    </div>
  );
}
