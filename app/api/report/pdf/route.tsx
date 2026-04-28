import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { ReportDocument } from "@/lib/pdf/report-doc";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [riskResult, supplementResult] = await Promise.all([
    supabase
      .from("risk_scores")
      .select(
        "biological_age, confidence_level, narrative, cv_risk, metabolic_risk, neuro_risk, onco_risk, msk_risk, top_risk_drivers, top_protective_levers, recommended_screenings, assessment_date",
      )
      .eq("user_uuid", user.id)
      .order("assessment_date", { ascending: false })
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

  const risk = riskResult.data;
  const supplement = supplementResult.data;

  type SupplementItem = {
    name: string;
    form: string;
    dosage: string;
    timing: string;
    priority: "critical" | "high" | "recommended" | "performance";
    domains: string[];
    rationale: string;
    note?: string;
  };

  const data = {
    biologicalAge: risk?.biological_age ?? null,
    confidenceLevel: risk?.confidence_level ?? null,
    narrative: risk?.narrative ?? null,
    cvRisk: risk?.cv_risk ?? null,
    metabolicRisk: risk?.metabolic_risk ?? null,
    neuroRisk: risk?.neuro_risk ?? null,
    oncoRisk: risk?.onco_risk ?? null,
    mskRisk: risk?.msk_risk ?? null,
    topRiskDrivers: (risk?.top_risk_drivers as string[]) ?? [],
    topProtectiveLevers: (risk?.top_protective_levers as string[]) ?? [],
    recommendedScreenings: (risk?.recommended_screenings as string[]) ?? [],
    supplements: (supplement?.items as unknown as SupplementItem[]) ?? [],
    assessmentDate: risk?.assessment_date ?? null,
  };

  const buffer = await renderToBuffer(<ReportDocument data={data} />);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="longevity-report.pdf"',
      "Content-Length": buffer.byteLength.toString(),
    },
  });
}
