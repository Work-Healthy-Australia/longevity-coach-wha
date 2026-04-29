import { createClient } from '@/lib/supabase/server';
import { saveJournalEntry } from './actions';

export const metadata = { title: 'Journal · Longevity Coach' };

type JournalEntry = {
  id: string;
  body: string;
  created_at: string;
};

export default async function JournalPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: entries } = await supabase
    .from('journal_entries')
    .select('id, body, created_at')
    .eq('user_uuid', user!.id)
    .order('created_at', { ascending: false })
    .limit(50);

  const journalEntries = (entries ?? []) as JournalEntry[];

  return (
    <div className="lc-journal">
      <h1>Health journal</h1>
      <p>Notes for yourself — Janet reads your recent entries as context.</p>

      <form action={saveJournalEntry} className="journal-form">
        <textarea name="body" placeholder="How are you feeling today?" rows={4} required maxLength={5000} />
        <button type="submit">Save entry</button>
      </form>

      {journalEntries.length > 0 && (
        <div className="journal-entries">
          {journalEntries.map(entry => (
            <div key={entry.id} className="journal-entry">
              <p className="journal-date">{new Date(entry.created_at).toLocaleDateString()}</p>
              <p className="journal-body">{entry.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
