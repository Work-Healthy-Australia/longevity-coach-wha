import { NextRequest, NextResponse } from "next/server";
import { runRiskNarrativePipeline } from "@/lib/ai/pipelines/risk-narrative";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const secret = request.headers.get("x-pipeline-secret");
  if (!secret || secret !== process.env.PIPELINE_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let userId: string;
  try {
    const body = await request.json();
    userId = body.userId;
    if (!userId || typeof userId !== "string") throw new Error("Missing userId");
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // Run synchronously in this function invocation (fire-and-forget was at the trigger level)
  await runRiskNarrativePipeline(userId);

  return NextResponse.json({ ok: true });
}
