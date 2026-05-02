import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import "./sync.css";

export const metadata = { title: "Wearable sync" };

const PROVIDERS = [
  {
    id: "apple_health",
    name: "Apple Health",
    icon: "❤️",
    description:
      "Sync sleep, steps, heart rate, and HRV from your iPhone. Use the iOS Shortcuts app to push data automatically each morning.",
    status: "available" as const,
  },
  {
    id: "garmin",
    name: "Garmin Connect",
    icon: "⌚",
    description: "Sync from Garmin watches and fitness trackers.",
    status: "coming_soon" as const,
  },
  {
    id: "oura",
    name: "Oura Ring",
    icon: "💍",
    description: "Sleep stages, readiness score, HRV, and body temperature.",
    status: "coming_soon" as const,
  },
  {
    id: "whoop",
    name: "WHOOP",
    icon: "🏋️",
    description: "Strain, recovery, and sleep performance data.",
    status: "coming_soon" as const,
  },
  {
    id: "fitbit",
    name: "Fitbit",
    icon: "📱",
    description: "Steps, sleep, heart rate from Fitbit devices.",
    status: "coming_soon" as const,
  },
];

export default async function SyncSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("wearable_sync_enabled, wearable_provider")
    .eq("id", user.id)
    .single();

  const activeProvider = profile?.wearable_provider ?? null;

  return (
    <div className="lc-sync">
      <Link href="/account" className="lc-sync-back">
        ← Account
      </Link>
      <h1>Wearable sync</h1>
      <p className="lc-sync-intro">
        Connect your wearable device to auto-populate your daily check-in with
        sleep, steps, heart rate, and HRV data. Less manual entry, better data.
      </p>

      <div className="lc-sync-grid">
        {PROVIDERS.map((p) => (
          <div
            key={p.id}
            className={`lc-sync-card ${activeProvider === p.id ? "active" : ""} ${p.status === "coming_soon" ? "disabled" : ""}`}
          >
            <div className="lc-sync-card-icon">{p.icon}</div>
            <div className="lc-sync-card-body">
              <div className="lc-sync-card-name">
                {p.name}
                {activeProvider === p.id && (
                  <span className="lc-sync-badge">Connected</span>
                )}
                {p.status === "coming_soon" && (
                  <span className="lc-sync-badge coming">Coming soon</span>
                )}
              </div>
              <p className="lc-sync-card-desc">{p.description}</p>
            </div>
          </div>
        ))}
      </div>

      <section className="lc-sync-howto">
        <h2>How to sync Apple Health</h2>
        <ol>
          <li>
            Open the <strong>Shortcuts</strong> app on your iPhone.
          </li>
          <li>
            Create a new shortcut that reads today's Health data (sleep, steps,
            heart rate).
          </li>
          <li>
            Add a &quot;Get Contents of URL&quot; action pointing to your Longevity
            Coach sync endpoint.
          </li>
          <li>
            Set it to run each morning via a Personal Automation trigger.
          </li>
        </ol>
        <div className="lc-sync-endpoint">
          <span className="lc-sync-endpoint-label">Your sync endpoint:</span>
          <code>POST /api/wearable/sync</code>
        </div>
      </section>
    </div>
  );
}
