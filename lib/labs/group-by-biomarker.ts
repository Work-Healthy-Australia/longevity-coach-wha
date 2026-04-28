import type { Database } from "@/lib/supabase/database.types";

export type LabRow = Database["biomarkers"]["Tables"]["lab_results"]["Row"];

export type BiomarkerGroup = {
  biomarker: string;
  category: string | null;
  unit: string;
  latest: LabRow;
  rowCount: number;
  firstTestDate: string;
};

/**
 * Group lab_result rows by biomarker.
 *
 * - Groups by exact `biomarker` string (Janet normalises casing on insert).
 * - Each group's `latest` is the row with the most recent `test_date`.
 * - The output array is sorted by `category` (case-insensitive, nulls last)
 *   and then by `biomarker` (case-insensitive).
 */
export function groupByBiomarker(rows: LabRow[]): BiomarkerGroup[] {
  if (rows.length === 0) return [];

  const buckets = new Map<string, LabRow[]>();
  for (const row of rows) {
    const list = buckets.get(row.biomarker);
    if (list) list.push(row);
    else buckets.set(row.biomarker, [row]);
  }

  const groups: BiomarkerGroup[] = [];
  for (const [biomarker, list] of buckets) {
    const sorted = [...list].sort((a, b) =>
      a.test_date < b.test_date ? 1 : a.test_date > b.test_date ? -1 : 0,
    );
    const latest = sorted[0];
    const earliest = sorted[sorted.length - 1];
    groups.push({
      biomarker,
      category: latest.category,
      unit: latest.unit,
      latest,
      rowCount: sorted.length,
      firstTestDate: earliest.test_date,
    });
  }

  groups.sort((a, b) => {
    const ac = (a.category ?? "￿").toLowerCase();
    const bc = (b.category ?? "￿").toLowerCase();
    if (ac !== bc) return ac < bc ? -1 : 1;
    const an = a.biomarker.toLowerCase();
    const bn = b.biomarker.toLowerCase();
    if (an !== bn) return an < bn ? -1 : 1;
    return 0;
  });

  return groups;
}
