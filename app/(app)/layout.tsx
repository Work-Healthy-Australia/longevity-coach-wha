import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "../(auth)/actions";

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
            src="/longevity-coach-logo.png"
            alt="Longevity Coach"
            width={120}
            height={40}
          />
        </Link>
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
      </header>
      <main style={{ maxWidth: 960, margin: "0 auto", padding: "32px 24px" }}>
        {children}
      </main>
    </div>
  );
}
