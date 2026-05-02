import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  categoryLabel,
  formatRange,
  groupByBiomarker,
  statusTone,
  type BiomarkerGroup,
  type LabRow,
} from "@/lib/labs";
import { StatusBadge } from "./_components/status-badge";
import "./labs.css";

export const metadata = { title: "Lab results" };

export default async function LabsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: rawRows } = await supabase
    .schema("biomarkers" as never)
    .from("lab_results")
    .select(
      "id, user_uuid, biomarker, category, test_date, value, unit, reference_min, reference_max, optimal_min, optimal_max, status, trend, panel_name, lab_provider, notes, upload_id, created_at",
    )
    .eq("user_uuid", user.id)
    .order("test_date", { ascending: false });

  const rows = (rawRows ?? []) as unknown as LabRow[];

  if (rows.length === 0) {
    return (
      <div className="lc-labs">
        <header className="lc-labs-header">
          <span className="lc-labs-eyebrow">Labs · Biomarkers</span>
          <h1>Your <em>numbers</em></h1>
          <p className="lc-labs-lede">
            Upload a recent blood panel or DEXA scan and Janet will extract every
            biomarker here, with reference ranges and trends.
          </p>
        </header>
        <div className="lc-labs-empty">
          <h2>No lab data yet</h2>
          <p>
            Upload a recent blood panel or DEXA scan and Janet will extract your
            biomarkers here.
          </p>
          <Link href="/uploads" className="lc-labs-empty-cta">
            Upload your first panel →
          </Link>
        </div>
      </div>
    );
  }

  const groups = groupByBiomarker(rows);
  const latestTestDate = rows[0]?.test_date ?? null;
  const totalRowCount = rows.length;
  const biomarkerCount = groups.length;

  // Group the groups by category for sectioning, preserving sort order.
  const byCategory = new Map<string | null, BiomarkerGroup[]>();
  for (const g of groups) {
    const list = byCategory.get(g.category);
    if (list) list.push(g);
    else byCategory.set(g.category, [g]);
  }

  return (
    <div className="lc-labs">
      <header className="lc-labs-header">
        <span className="lc-labs-eyebrow">Labs · Biomarkers</span>
        <h1>Your <em>numbers</em></h1>
        <p className="lc-labs-lede">
          Every biomarker Janet has extracted from your panels and scans, with
          reference ranges and trend over time. Tap any card for the history.
        </p>
        <div className="lc-labs-stat-strip">
          <span className="stat">
            <strong>{biomarkerCount}</strong>
            {biomarkerCount === 1 ? "biomarker tracked" : "biomarkers tracked"}
          </span>
          <span className="stat">
            <strong>{totalRowCount}</strong>
            {totalRowCount === 1 ? "result on file" : "results on file"}
          </span>
          {latestTestDate && (
            <span className="stat">
              Latest <strong>{formatDate(latestTestDate)}</strong>
            </span>
          )}
        </div>
      </header>

      {Array.from(byCategory.entries()).map(([category, groupsInCat]) => (
        <section className="lc-labs-category" key={category ?? "uncategorised"}>
          <div className="lc-labs-category-headline">
            <span className="lc-labs-category-eyebrow">Category</span>
            <h2>{categoryLabel(category)}</h2>
          </div>
          <div className="lc-labs-grid">
            {groupsInCat.map((g) => (
              <BiomarkerCard key={g.biomarker} group={g} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function BiomarkerCard({ group }: { group: BiomarkerGroup }) {
  const { latest, biomarker, unit } = group;
  const tone = statusTone(latest.status);
  const range = formatRange(latest.reference_min, latest.reference_max, unit);
  const trendClass = trendToClass(latest.trend);

  return (
    <Link
      href={`/labs/${encodeURIComponent(biomarker)}`}
      className="lc-labs-card"
    >
      <div className="lc-labs-card-head">
        <div className="lc-labs-card-name">{biomarker}</div>
        <StatusBadge tone={tone} />
      </div>
      <div className="lc-labs-card-value">
        {formatValue(latest.value)}
        <span className="lc-labs-card-unit">{unit}</span>
      </div>
      <div className="lc-labs-card-range">Range {range}</div>
      <div className="lc-labs-card-foot">
        <span>{formatDate(latest.test_date)}</span>
        {latest.trend && (
          <span className={`lc-labs-card-trend ${trendClass}`}>
            {trendSymbol(latest.trend)} {latest.trend}
          </span>
        )}
      </div>
    </Link>
  );
}

function trendToClass(trend: string | null): string {
  if (!trend) return "";
  const t = trend.toLowerCase();
  if (t.includes("improv")) return "improving";
  if (t.includes("declin") || t.includes("worsen")) return "declining";
  return "stable";
}

function trendSymbol(trend: string): string {
  const t = trend.toLowerCase();
  if (t.includes("improv")) return "↑";
  if (t.includes("declin") || t.includes("worsen")) return "↓";
  return "→";
}

function formatValue(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(2).replace(/\.?0+$/, "");
}

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
