import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import "./admin.css";

export const metadata = { title: "Admin · Longevity Coach" };

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
        <div className="admin-nav-brand">Longevity Coach · Admin</div>
        <div className="admin-nav-links">
          <a href="/admin">Overview</a>
          <a href="/admin/users">Users</a>
          <a href="/admin/plans">Plans</a>
          <a href="/admin/addons">Add-ons</a>
          <a href="/admin/suppliers">Suppliers</a>
          <a href="/admin/products">Products</a>
          <a href="/admin/agents">Agents</a>
          <a href="/admin/clinicians">Clinicians</a>
          <a href="/admin/admins">Admins</a>
          <a href="/dashboard" className="muted">Exit admin</a>
        </div>
        <div className="admin-nav-user">{profile.full_name ?? user.email}</div>
      </nav>
      <main className="admin-main">{children}</main>
    </div>
  );
}
