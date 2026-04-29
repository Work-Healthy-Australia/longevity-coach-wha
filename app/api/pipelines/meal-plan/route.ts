import { NextRequest, NextResponse } from "next/server";
import { runMealPlanPipeline } from "@/lib/ai/pipelines/meal-plan";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const secret = request.headers.get("x-pipeline-secret");
  if (!secret || secret !== process.env.PIPELINE_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let userId: string;
  let weekStart: string | undefined;
  try {
    const body = await request.json();
    userId = body.userId;
    weekStart = body.weekStart;
    if (!userId || typeof userId !== "string") throw new Error("Missing userId");
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  await runMealPlanPipeline(userId, weekStart);

  return NextResponse.json({ ok: true });
}
