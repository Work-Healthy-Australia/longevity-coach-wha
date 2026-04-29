import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ text: null }, { status: 401 });

  const since = req.nextUrl.searchParams.get('since');
  if (!since) return NextResponse.json({ text: null }, { status: 400 });

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (admin as any)
    .schema('agents')
    .from('agent_conversations')
    .select('content')
    .eq('user_uuid', user.id)
    .eq('agent', 'janet')
    .eq('role', 'assistant')
    .gt('created_at', since)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ text: data?.content ?? null });
}
