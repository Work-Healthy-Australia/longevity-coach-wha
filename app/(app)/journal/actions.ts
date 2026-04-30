'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const moods = ['great', 'good', 'okay', 'low', 'bad'] as const;

const SaveSchema = z.object({
  body: z.string().min(1).max(5000),
  title: z.string().max(200).optional(),
  mood: z.enum(moods).optional(),
  tags: z.string().max(500).optional(),
});

const UpdateSchema = SaveSchema.extend({ id: z.string().uuid() });

type Result = { error?: string };

function parseTags(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map(t => t.trim().toLowerCase())
    .filter(t => t.length > 0)
    .slice(0, 20);
}

export async function saveJournalEntry(_prev: Result | null, formData: FormData): Promise<Result> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const parsed = SaveSchema.safeParse({
    body: formData.get('body'),
    title: formData.get('title') || undefined,
    mood: formData.get('mood') || undefined,
    tags: formData.get('tags') || undefined,
  });
  if (!parsed.success) return { error: 'Invalid entry. Body is required.' };

  const { error } = await supabase.from('journal_entries').insert({
    user_uuid: user.id,
    body: parsed.data.body,
    title: parsed.data.title || null,
    mood: parsed.data.mood || null,
    tags: parseTags(parsed.data.tags),
  });

  if (error) return { error: 'Failed to save entry.' };
  revalidatePath('/journal');
  return {};
}

export async function updateJournalEntry(_prev: Result | null, formData: FormData): Promise<Result> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const parsed = UpdateSchema.safeParse({
    id: formData.get('id'),
    body: formData.get('body'),
    title: formData.get('title') || undefined,
    mood: formData.get('mood') || undefined,
    tags: formData.get('tags') || undefined,
  });
  if (!parsed.success) return { error: 'Invalid entry data.' };

  const { error } = await supabase
    .from('journal_entries')
    .update({
      body: parsed.data.body,
      title: parsed.data.title || null,
      mood: parsed.data.mood || null,
      tags: parseTags(parsed.data.tags),
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsed.data.id)
    .eq('user_uuid', user.id);

  if (error) return { error: 'Failed to update entry.' };
  revalidatePath('/journal');
  return {};
}

export async function deleteJournalEntry(formData: FormData): Promise<Result> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const id = z.string().uuid().safeParse(formData.get('id'));
  if (!id.success) return { error: 'Invalid entry ID.' };

  const { error } = await supabase
    .from('journal_entries')
    .delete()
    .eq('id', id.data)
    .eq('user_uuid', user.id);

  if (error) return { error: 'Failed to delete entry.' };
  revalidatePath('/journal');
  return {};
}

export async function togglePinEntry(formData: FormData): Promise<Result> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const id = z.string().uuid().safeParse(formData.get('id'));
  if (!id.success) return { error: 'Invalid entry ID.' };
  const pinned = formData.get('is_pinned') === 'true';

  const { error } = await supabase
    .from('journal_entries')
    .update({ is_pinned: !pinned })
    .eq('id', id.data)
    .eq('user_uuid', user.id);

  if (error) return { error: 'Failed to update pin.' };
  revalidatePath('/journal');
  return {};
}

export type JournalEntry = {
  id: string;
  title: string | null;
  body: string;
  mood: string | null;
  tags: string[];
  is_pinned: boolean;
  created_at: string;
};

export async function searchJournal(
  _prev: { results?: JournalEntry[]; error?: string } | null,
  formData: FormData,
): Promise<{ results?: JournalEntry[]; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const query = formData.get('query');
  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return { error: 'Search query is required.' };
  }

  const { data, error } = await supabase
    .from('journal_entries')
    .select('id, title, body, mood, tags, is_pinned, created_at')
    .eq('user_uuid', user.id)
    .textSearch('fts', query.trim().slice(0, 200), { type: 'plain', config: 'english' })
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return { error: 'Search failed.' };
  return { results: (data ?? []) as JournalEntry[] };
}
