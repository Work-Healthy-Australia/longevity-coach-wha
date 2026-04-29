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

  console.log(`[meal-plan route] starting pipeline for user ${userId}`);
  try {
    await runMealPlanPipeline(userId, weekStart);
    console.log(`[meal-plan route] pipeline completed for user ${userId}`);
  } catch (err) {
    console.error(`[meal-plan route] pipeline failed for user ${userId}:`, err);
    return NextResponse.json({ error: 'Pipeline failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
