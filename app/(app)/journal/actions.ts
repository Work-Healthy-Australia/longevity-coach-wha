'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const JournalEntrySchema = z.object({
  body: z.string().min(1).max(5000),
});

export async function saveJournalEntry(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const parsed = JournalEntrySchema.safeParse({ body: formData.get('body') });
  if (!parsed.success) return;

  await supabase
    .from('journal_entries')
    .insert({ user_uuid: user.id, body: parsed.data.body });

  revalidatePath('/journal');
}
