'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

type Field = 'check_in_reminders' | 'weekly_digest' | 'alert_emails';

export async function updateNotificationPref(field: Field, enabled: boolean): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  await sb
    .from('notification_prefs')
    .upsert(
      { user_uuid: user.id, [field]: enabled, updated_at: new Date().toISOString() },
      { onConflict: 'user_uuid' },
    );

  revalidatePath('/account');
}
