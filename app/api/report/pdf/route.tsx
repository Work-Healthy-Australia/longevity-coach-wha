import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import {
  ReportDocument,
  type EngineOutput,
  type ReportData,
  type SupplementRow,
} from "@/lib/pdf/report-doc";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [profileResult, riskResult, supplementResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, date_of_birth")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("risk_scores")
      .select("engine_output, assessment_date, created_at")
      .eq("user_uuid", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("supplement_plans")
      .select("items")
      .eq("patient_uuid", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const profile = profileResult.data;
  const risk = riskResult.data;
  const supplement = supplementResult.data;

  const engineOutput =
    (risk?.engine_output as EngineOutput | null | undefined) ?? null;

  // Coerce supplement items into the report's row shape. Plans authored by
  // earlier code may carry richer fields (form, dosage, priority, rationale).
  const rawItems = (supplement?.items as unknown as Array<Record<string, unknown>>) ?? [];
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

  const generatedAt = new Date().toISOString();

  const data: ReportData = {
    memberName: (profile?.full_name as string | null) ?? null,
    dateOfBirth: (profile?.date_of_birth as string | null) ?? null,
    generatedAt,
    engineOutput,
    supplementItems,
  };

  const buffer = await renderToBuffer(<ReportDocument data={data} />);

  const datePart = generatedAt.slice(0, 10);
  const filename = `longevity-report-${datePart}.pdf`;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": buffer.byteLength.toString(),
    },
  });
}
