import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Dashboard · Longevity Coach" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div>
      <h1
        style={{
          fontFamily: "var(--font-lc-serif), Georgia, serif",
          fontSize: 32,
          fontWeight: 400,
          margin: "0 0 8px",
        }}
      >
        Welcome{user?.user_metadata?.full_name ? `, ${user.user_metadata.full_name}` : ""}.
      </h1>
      <p style={{ color: "#4B4B4B", margin: "0 0 32px" }}>
        Your dashboard will appear here once you complete the onboarding assessment.
      </p>
      <div
        style={{
          background: "#fff",
          border: "1px solid #E3E8EC",
          borderRadius: 16,
          padding: 32,
        }}
      >
        <h2 style={{ marginTop: 0 }}>Next: complete your assessment</h2>
        <p style={{ color: "#4B4B4B" }}>
          Coming next — a short questionnaire will give us your biological age,
          risk scores across five domains, and a personalised supplement protocol.
        </p>
      </div>
    </div>
  );
}
