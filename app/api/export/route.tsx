// /api/export — return a ZIP of everything we hold about the signed-in member.
//
// RLS audit (verified against migrations 0001/0004/0009/0010/0012):
// All seven tables read here have owner-select policies, so reads use the
// USER-CONTEXT Supabase client (no admin client for reads).
//   profiles               — profiles_owner_select          (auth.uid() = id)
//   health_profiles        — health_owner_all               (auth.uid() = user_uuid)
//   risk_scores            — risk_owner_select              (auth.uid() = user_uuid)
//   supplement_plans       — supplement_plans_patient_select(auth.uid() = patient_uuid)
//   biomarkers.lab_results — lab_results_owner_select       (auth.uid() = user_uuid)
//   biomarkers.daily_logs  — daily_logs_owner_select        (auth.uid() = user_uuid)
//   consent_records        — consent_owner_select           (auth.uid() = user_uuid)
//
// The admin client is used ONLY to write the export_log audit row, because
// export_log has no insert policy by design (service-role-only insert).
// That insert is best-effort and never blocks the response to the user.

import { NextResponse } from "next/server";
import archiver from "archiver";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ReportDocument,
  type EngineOutput,
  type ReportData,
  type SupplementRow,
} from "@/lib/pdf/report-doc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Soft per-table cap. Keeps response size bounded for power users.
// Tables that hit this cap are flagged with `truncated: true` in manifest.json.
export const ROW_CAP = 10000;

type AnyRow = Record<string, unknown>;

export type ExportPayload = {
  profile: AnyRow | null;
  health_profiles: AnyRow[];
  risk_scores: AnyRow[];
  supplement_plans: AnyRow[];
  lab_results: AnyRow[];
  daily_logs: AnyRow[];
  consent_records: AnyRow[];
};

export type ExportTableKey =
  | "profile"
  | "health_profiles"
  | "risk_scores"
  | "supplement_plans"
  | "lab_results"
  | "daily_logs"
  | "consent_records";

/**
 * Pure helper: fetches every owner-readable row for the user via the supplied
 * Supabase client. Caller is responsible for passing a user-context client so
 * RLS enforces ownership.
 */
export async function buildExportPayload(
  // Loose-typed to keep the helper testable with a simple mock without
  // dragging the full Database type generic into tests.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
): Promise<ExportPayload> {
  const [
    profileRes,
    healthRes,
    riskRes,
    plansRes,
    labsRes,
    logsRes,
    consentRes,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .limit(ROW_CAP)
      .maybeSingle(),
    supabase
      .from("health_profiles")
      .select("*")
      .eq("user_uuid", userId)
      .order("created_at", { ascending: false })
      .limit(ROW_CAP),
    supabase
      .from("risk_scores")
      .select("*")
      .eq("user_uuid", userId)
      .order("created_at", { ascending: false })
      .limit(ROW_CAP),
    supabase
      .from("supplement_plans")
      .select("*")
      .eq("patient_uuid", userId)
      .order("created_at", { ascending: false })
      .limit(ROW_CAP),
    supabase
      .schema("biomarkers")
      .from("lab_results")
      .select("*")
      .eq("user_uuid", userId)
      .order("collected_at", { ascending: false })
      .limit(ROW_CAP),
    supabase
      .schema("biomarkers")
      .from("daily_logs")
      .select("*")
      .eq("user_uuid", userId)
      .order("log_date", { ascending: false })
      .limit(ROW_CAP),
    supabase
      .from("consent_records")
      .select("*")
      .eq("user_uuid", userId)
      .order("created_at", { ascending: false })
      .limit(ROW_CAP),
  ]);

  return {
    profile: (profileRes?.data as AnyRow | null) ?? null,
    health_profiles: (healthRes?.data as AnyRow[] | null) ?? [],
    risk_scores: (riskRes?.data as AnyRow[] | null) ?? [],
    supplement_plans: (plansRes?.data as AnyRow[] | null) ?? [],
    lab_results: (labsRes?.data as AnyRow[] | null) ?? [],
    daily_logs: (logsRes?.data as AnyRow[] | null) ?? [],
    consent_records: (consentRes?.data as AnyRow[] | null) ?? [],
  };
}

export type ManifestTableEntry = {
  rows: number;
  truncated: boolean;
};

export type Manifest = {
  archive_version: 1;
  exported_at: string;
  user_uuid_prefix: string; // first 8 chars only — non-PII identifier
  tables: Record<ExportTableKey, ManifestTableEntry>;
};

export function buildManifest(
  payload: ExportPayload,
  userId: string,
  exportedAt: string,
): Manifest {
  const count = (n: number): ManifestTableEntry => ({
    rows: n,
    truncated: n >= ROW_CAP,
  });
  return {
    archive_version: 1,
    exported_at: exportedAt,
    user_uuid_prefix: userId.slice(0, 8),
    tables: {
      profile: { rows: payload.profile ? 1 : 0, truncated: false },
      health_profiles: count(payload.health_profiles.length),
      risk_scores: count(payload.risk_scores.length),
      supplement_plans: count(payload.supplement_plans.length),
      lab_results: count(payload.lab_results.length),
      daily_logs: count(payload.daily_logs.length),
      consent_records: count(payload.consent_records.length),
    },
  };
}

// Stable JSON.stringify with sorted keys so byte output is deterministic.
function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_k, v) => {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      return Object.keys(v as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((acc, k) => {
          acc[k] = (v as Record<string, unknown>)[k];
          return acc;
        }, {});
    }
    return v;
  }, 2);
}

async function buildReportPdf(payload: ExportPayload): Promise<Buffer> {
  const profile = payload.profile;
  const latestRisk = payload.risk_scores[0] as AnyRow | undefined;
  const activePlan =
    (payload.supplement_plans.find((p) => p.status === "active") as
      | AnyRow
      | undefined) ?? (payload.supplement_plans[0] as AnyRow | undefined);

  const engineOutput =
    (latestRisk?.engine_output as EngineOutput | null | undefined) ?? null;

  const rawItems =
    (activePlan?.items as Array<Record<string, unknown>> | undefined) ?? [];
  const supplementItems: SupplementRow[] = rawItems.map((it) => {
    const tierRaw = (it.tier ?? it.priority) as string | undefined;
    const tier =
      tierRaw === "critical" ||
      tierRaw === "high" ||
      tierRaw === "recommended" ||
      tierRaw === "performance"
        ? tierRaw
        : undefined;
    return {
      name: String(it.name ?? ""),
      dose: String(it.dose ?? it.dosage ?? ""),
      timing: it.timing ? String(it.timing) : undefined,
      tier,
      note: it.note ? String(it.note) : undefined,
    };
  });

  const data: ReportData = {
    memberName: (profile?.full_name as string | null) ?? null,
    dateOfBirth: (profile?.date_of_birth as string | null) ?? null,
    generatedAt: new Date().toISOString(),
    engineOutput,
    supplementItems,
  };

  return await renderToBuffer(<ReportDocument data={data} />);
}

async function buildZipBuffer(
  payload: ExportPayload,
  manifest: Manifest,
  pdfBuffer: Buffer,
): Promise<Buffer> {
  const archive = archiver("zip", { zlib: { level: 9 } });
  const chunks: Buffer[] = [];

  archive.on("data", (chunk: Buffer) => chunks.push(chunk));

  const done = new Promise<void>((resolve, reject) => {
    archive.on("end", () => resolve());
    archive.on("error", (err: Error) => reject(err));
  });

  archive.append(stableStringify(payload.profile ?? null), {
    name: "profile.json",
  });
  archive.append(stableStringify(payload.health_profiles), {
    name: "health_profiles.json",
  });
  archive.append(stableStringify(payload.risk_scores), {
    name: "risk_scores.json",
  });
  archive.append(stableStringify(payload.supplement_plans), {
    name: "supplement_plans.json",
  });
  archive.append(stableStringify(payload.lab_results), {
    name: "lab_results.json",
  });
  archive.append(stableStringify(payload.daily_logs), {
    name: "daily_logs.json",
  });
  archive.append(stableStringify(payload.consent_records), {
    name: "consent_records.json",
  });
  archive.append(stableStringify(manifest), { name: "manifest.json" });
  archive.append(pdfBuffer, { name: "report.pdf" });

  await archive.finalize();
  await done;

  return Buffer.concat(chunks);
}

export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await buildExportPayload(supabase, user.id);

  const exportedAt = new Date().toISOString();
  const manifest = buildManifest(payload, user.id, exportedAt);

  const pdfBuffer = await buildReportPdf(payload);
  const zipBuffer = await buildZipBuffer(payload, manifest, pdfBuffer);

  // Best-effort audit log. Use admin client because export_log has no
  // insert policy (service-role-only insert by design). Failure must
  // never block the export response.
  try {
    const admin = createAdminClient();
    await admin
      .from("export_log")
      .insert({
        user_uuid: user.id,
        format: "zip",
        byte_size: zipBuffer.byteLength,
        request_ip: req.headers.get("x-forwarded-for") ?? null,
      });
  } catch {
    // swallow — audit failure must not break the export
  }

  const datePart = exportedAt.slice(0, 10);
  const filename = `janet-cares-export-${datePart}.zip`;

  return new Response(new Uint8Array(zipBuffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": zipBuffer.byteLength.toString(),
    },
  });
}
