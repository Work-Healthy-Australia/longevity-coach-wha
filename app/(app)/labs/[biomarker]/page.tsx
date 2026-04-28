import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatRange, statusTone, type LabRow } from "@/lib/labs";
import { StatusBadge } from "../_components/status-badge";
import { BiomarkerChart } from "./_components/biomarker-chart";
import "../labs.css";

export const metadata = { title: "Lab Detail · Longevity Coach" };

export default async function BiomarkerDetailPage({
  params,
}: {
  params: Promise<{ biomarker: string }>;
}) {
  const { biomarker: rawParam } = await params;
  const biomarker = decodeURIComponent(rawParam);

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
    .eq("biomarker", biomarker)
    .order("test_date", { ascending: true });

  const rows = (rawRows ?? []) as unknown as LabRow[];
  if (rows.length === 0) notFound();

  const latest = rows[rows.length - 1];
  const tone = statusTone(latest.status);
  const range = formatRange(latest.reference_min, latest.reference_max, latest.unit);
  const history = [...rows].reverse(); // newest first for table

  return (
    <div className="lc-labs">
      <div className="lc-labs-breadcrumb">
        <Link href="/labs">Labs</Link> › {biomarker}
      </div>

      <section className="lc-labs-detail-header">
        <h1 className="lc-labs-detail-name">{biomarker}</h1>
        <div className="lc-labs-detail-row">
          <div>
            <span className="lc-labs-detail-value">
              {formatValue(latest.value)}
            </span>
            <span className="lc-labs-detail-unit">{latest.unit}</span>
          </div>
          <StatusBadge tone={tone} />
        </div>
        <div className="lc-labs-detail-meta">
          <span>
            Range <strong>{range}</strong>
          </span>
          {latest.trend && (
            <>
              {" · "}
              <span>
                Trend <strong>{latest.trend}</strong>
              </span>
            </>
          )}
          {" · "}
          <span>
            {rows.length} {rows.length === 1 ? "result" : "results"} on file
          </span>
        </div>
      </section>

      <section className="lc-labs-chart-card">
        <BiomarkerChart
          rows={rows.map((r) => ({
            test_date: r.test_date,
            value: r.value,
            unit: r.unit,
            reference_min: r.reference_min,
            reference_max: r.reference_max,
          }))}
        />
      </section>

      <section className="lc-labs-history">
        <h2>History</h2>
        <table className="lc-labs-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Value</th>
              <th>Unit</th>
              <th>Status</th>
              <th>Panel</th>
              <th>Lab</th>
            </tr>
          </thead>
          <tbody>
            {history.map((r) => (
              <tr key={r.id}>
                <td>{formatDate(r.test_date)}</td>
                <td>{formatValue(r.value)}</td>
                <td>{r.unit}</td>
                <td>
                  <StatusBadge tone={statusTone(r.status)} />
                </td>
                <td>{r.panel_name ?? "—"}</td>
                <td>{r.lab_provider ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <p className="lc-labs-note">
        All values shown are exactly as Janet extracted them from your uploaded
        documents. Janet&apos;s interpretation of status uses the reference range
        provided by the lab when available.
      </p>
    </div>
  );
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
