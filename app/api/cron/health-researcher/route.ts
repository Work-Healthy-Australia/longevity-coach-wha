import { NextRequest, NextResponse } from 'next/server';
import { runHealthResearcherPipeline } from '@/lib/ai/pipelines/health-researcher';

export const maxDuration = 300; // Vercel Pro max; module-level export required by Next.js

export async function GET(request: NextRequest): Promise<NextResponse> {
  // Vercel sets Authorization: Bearer <CRON_SECRET> on cron-triggered requests.
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await runHealthResearcherPipeline();
    return NextResponse.json({ ok: true });
  } catch (err) {
    // Return 200 to suppress Vercel cron retry (which would cause double-writes).
    console.error('[health-researcher cron] Unhandled pipeline error:', err);
    return NextResponse.json({ ok: false, error: 'pipeline_error' });
  }
}
