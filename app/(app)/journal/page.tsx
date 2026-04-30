import { createClient } from '@/lib/supabase/server';
import { JournalClient, type JournalEntry } from './_components/journal-client';
import './journal.css';

export const metadata = { title: 'Journal · Longevity Coach' };

export default async function JournalPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: entries } = await supabase
    .from('journal_entries')
    .select('id, title, body, mood, tags, is_pinned, created_at')
    .eq('user_uuid', user!.id)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(50);

  return (
    <div className="lc-journal">
      <h1>Health journal</h1>
      <p className="journal-lede">
        Notes for yourself — Janet reads your recent entries as context.
      </p>
      <JournalClient entries={(entries ?? []) as JournalEntry[]} />
    </div>
  );
}
