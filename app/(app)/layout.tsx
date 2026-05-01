import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SupportFAB } from "./_components/support-fab";
import { AppHeader } from "./_components/app-header";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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

  const isAdmin = profile?.is_admin ?? false;
  const userName = (profile?.full_name as string | null | undefined) ?? null;
  const userEmail = user.email ?? null;

  const navItems = [
    { href: "/dashboard", label: "Today" },
    { href: "/report", label: "Report" },
    { href: "/labs", label: "Labs" },
    { href: "/simulator", label: "Simulator" },
    { href: "/uploads", label: "Documents" },
    { href: "/account", label: "Account" },
    ...(isAdmin ? [{ href: "/admin", label: "Admin" }] : []),
  ];

  return (
    <div style={{ minHeight: "100dvh", background: "var(--lc-bg)" }}>
      <AppHeader
        navItems={navItems}
        userName={userName}
        userEmail={userEmail}
      />
      <main style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 48px" }}>
        {children}
      </main>
      <SupportFAB />
    </div>
  );
}
