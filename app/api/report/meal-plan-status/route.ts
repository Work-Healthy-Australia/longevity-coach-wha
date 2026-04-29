import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ready: false }, { status: 401 });

  const since = req.nextUrl.searchParams.get('since');
  if (!since) return NextResponse.json({ ready: false }, { status: 400 });

  // Use admin client because meal_plans/recipes RLS may not allow this select
  // pattern under the user role; we re-scope to the authenticated user_id.
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (admin as any)
    .from('meal_plans')
    .select('id, last_run_at')
    .eq('patient_uuid', user.id)
    .eq('status', 'active')
    .gt('last_run_at', since)
    .order('last_run_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    ready: !!data,
    lastRunAt: data?.last_run_at ?? null,
  });
}
