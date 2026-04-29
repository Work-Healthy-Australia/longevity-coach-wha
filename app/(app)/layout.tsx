import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { signOut } from "../(auth)/actions";
import { SupportFAB } from "./_components/support-fab";

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
    .select("is_admin")
    .eq("id", user.id)
    .single();

  const isAdmin = profile?.is_admin ?? false;

  return (
    <div style={{ minHeight: "100dvh", background: "#F4F7F9" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 24px",
          background: "#fff",
          borderBottom: "1px solid #E3E8EC",
        }}
      >
        <Link href="/dashboard" style={{ display: "flex", alignItems: "center" }}>
          <Image
            src="/longevity-coach-horizontal-logo.png"
            alt="Longevity Coach"
            width={900}
            height={188}
            priority
          />
        </Link>
        <nav style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {[
            { href: "/dashboard", label: "Dashboard" },
            { href: "/report", label: "My Report" },
            { href: "/labs", label: "Labs" },
            { href: "/uploads", label: "Documents" },
            { href: "/account", label: "Account" },
            ...(isAdmin ? [{ href: "/admin", label: "Admin" }] : []),
          ].map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              style={{
                fontSize: 14,
                fontWeight: 500,
                color: "#2F6F8F",
                textDecoration: "none",
                padding: "6px 12px",
                borderRadius: 6,
              }}
            >
              {label}
            </Link>
          ))}
          <form action={signOut}>
            <button
              type="submit"
              style={{
                font: "inherit",
                padding: "8px 14px",
                background: "transparent",
                color: "#2F6F8F",
                border: "1px solid #DDE8EE",
                borderRadius: 8,
                cursor: "pointer",
              }}
            >
              Sign out
            </button>
          </form>
        </nav>
      </header>
      <main style={{ maxWidth: 960, margin: "0 auto", padding: "32px 24px" }}>
        {children}
      </main>
      <SupportFAB />
    </div>
  );
}
