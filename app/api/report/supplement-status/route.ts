import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ready: false }, { status: 401 });

  const since = req.nextUrl.searchParams.get('since');
  if (!since) return NextResponse.json({ ready: false }, { status: 400 });

  const { data } = await supabase
    .from('supplement_plans')
    .select('created_at')
    .eq('patient_uuid', user.id)
    .eq('status', 'active')
    .gt('created_at', since)
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ ready: !!data, createdAt: data?.created_at ?? null });
}
