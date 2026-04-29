import { NextRequest, NextResponse } from "next/server";
import { runSupplementProtocolPipeline } from "@/lib/ai/pipelines/supplement-protocol";

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

  try {
    await runSupplementProtocolPipeline(userId);
    console.log(`[supplement-protocol route] Pipeline completed for user ${userId}`);
  } catch (err) {
    console.error(`[supplement-protocol route] Unhandled error for user ${userId}:`, err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
