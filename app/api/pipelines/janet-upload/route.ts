import { NextRequest, NextResponse } from 'next/server';
import { runJanetUploadPipeline } from '@/lib/ai/pipelines/janet-upload';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const secret = request.headers.get('x-pipeline-secret');
  if (!secret || secret !== process.env.PIPELINE_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let uploadId: string;
  try {
    const body = await request.json();
    uploadId = body.uploadId;
    if (!uploadId || typeof uploadId !== 'string') throw new Error('Missing uploadId');
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  await runJanetUploadPipeline(uploadId);

  return NextResponse.json({ ok: true });
}
