'use client';

import { useActionState, useState, useTransition } from 'react';
import {
  saveJournalEntry,
  updateJournalEntry,
  deleteJournalEntry,
  togglePinEntry,
  searchJournal,
  type JournalEntry,
} from '../actions';

export type { JournalEntry };

const MOOD_OPTIONS = [
  { value: 'great', emoji: '\u{1F604}', label: 'Great' },
  { value: 'good', emoji: '\u{1F642}', label: 'Good' },
  { value: 'okay', emoji: '\u{1F610}', label: 'Okay' },
  { value: 'low', emoji: '\u{1F614}', label: 'Low' },
  { value: 'bad', emoji: '\u{1F623}', label: 'Bad' },
] as const;

function moodEmoji(mood: string | null): string {
  return MOOD_OPTIONS.find(m => m.value === mood)?.emoji ?? '';
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function JournalClient({ entries }: { entries: JournalEntry[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [searchResults, setSearchResults] = useState<JournalEntry[] | null>(null);
  const [isPinning, startPinTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();

  const [saveResult, saveAction, isSaving] = useActionState(saveJournalEntry, null);
  const [searchResult, searchAction, isSearching] = useActionState(
    async (prev: { results?: JournalEntry[]; error?: string } | null, formData: FormData) => {
      const result = await searchJournal(prev, formData);
      if (result.results) setSearchResults(result.results);
      return result;
    },
    null,
  );

  const displayEntries = searchResults ?? entries;

  function toggleExpand(id: string) {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSearch() {
    setSearchResults(null);
  }

  return (
    <div className="journal-content">
      {/* Search */}
      <div className="journal-search">
        <form action={searchAction} className="journal-search-form">
          <input
            type="text"
            name="query"
            placeholder="Search journal entries..."
            className="journal-search-input"
          />
          <button type="submit" className="journal-search-btn" disabled={isSearching}>
            {isSearching ? 'Searching...' : 'Search'}
          </button>
          {searchResults && (
            <button type="button" className="journal-search-clear" onClick={clearSearch}>
              Clear
            </button>
          )}
        </form>
        {searchResult?.error && <p className="journal-error">{searchResult.error}</p>}
        {searchResults && (
          <p className="journal-search-count">
            {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} found
          </p>
        )}
      </div>

      {/* New entry form */}
      {!searchResults && <NewEntryForm action={saveAction} isSaving={isSaving} error={saveResult?.error} />}

      {/* Entries list */}
      <div className="journal-entries">
        {displayEntries.length === 0 && (
          <p className="journal-empty">
            {searchResults ? 'No entries match your search.' : 'No journal entries yet. Write your first one above.'}
          </p>
        )}
        {displayEntries.map(entry =>
          editingId === entry.id ? (
            <EditEntryForm
              key={entry.id}
              entry={entry}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <EntryCard
              key={entry.id}
              entry={entry}
              expanded={expandedIds.has(entry.id)}
              onToggleExpand={() => toggleExpand(entry.id)}
              onEdit={() => setEditingId(entry.id)}
              onConfirmDelete={confirmDeleteId === entry.id}
              onRequestDelete={() => setConfirmDeleteId(entry.id)}
              onCancelDelete={() => setConfirmDeleteId(null)}
              isPinning={isPinning}
              isDeleting={isDeleting}
              startPinTransition={startPinTransition}
              startDeleteTransition={startDeleteTransition}
            />
          ),
        )}
      </div>
    </div>
  );
}

function NewEntryForm({
  action,
  isSaving,
  error,
}: {
  action: (formData: FormData) => void;
  isSaving: boolean;
  error?: string;
}) {
  const [mood, setMood] = useState<string>('');

  return (
    <form action={action} className="journal-form" onSubmit={() => setMood('')}>
      <input
        type="text"
        name="title"
        placeholder="Title (optional)"
        className="journal-title-input"
        maxLength={200}
      />
      <textarea
        name="body"
        placeholder="How are you feeling today?"
        className="journal-body-input"
        rows={4}
        required
        maxLength={5000}
      />
      <div className="journal-form-meta">
        <div className="journal-mood-selector">
          <span className="journal-mood-label">Mood:</span>
          {MOOD_OPTIONS.map(m => (
            <button
              key={m.value}
              type="button"
              className={`journal-mood-btn ${mood === m.value ? 'journal-mood-btn--active' : ''}`}
              onClick={() => setMood(prev => (prev === m.value ? '' : m.value))}
              title={m.label}
            >
              {m.emoji}
            </button>
          ))}
          <input type="hidden" name="mood" value={mood} />
        </div>
        <input
          type="text"
          name="tags"
          placeholder="Tags (comma-separated)"
          className="journal-tag-input"
          maxLength={500}
        />
      </div>
      {error && <p className="journal-error">{error}</p>}
      <button type="submit" className="journal-submit" disabled={isSaving}>
        {isSaving ? 'Saving...' : 'Save entry'}
      </button>
    </form>
  );
}

function EditEntryForm({
  entry,
  onCancel,
}: {
  entry: JournalEntry;
  onCancel: () => void;
}) {
  const [mood, setMood] = useState(entry.mood ?? '');
  const [result, action, isPending] = useActionState(updateJournalEntry, null);

  return (
    <form action={action} className="journal-entry journal-entry--editing">
      <input type="hidden" name="id" value={entry.id} />
      <input
        type="text"
        name="title"
        defaultValue={entry.title ?? ''}
        placeholder="Title (optional)"
        className="journal-title-input"
        maxLength={200}
      />
      <textarea
        name="body"
        defaultValue={entry.body}
        className="journal-body-input"
        rows={4}
        required
        maxLength={5000}
      />
      <div className="journal-form-meta">
        <div className="journal-mood-selector">
          <span className="journal-mood-label">Mood:</span>
          {MOOD_OPTIONS.map(m => (
            <button
              key={m.value}
              type="button"
              className={`journal-mood-btn ${mood === m.value ? 'journal-mood-btn--active' : ''}`}
              onClick={() => setMood(prev => (prev === m.value ? '' : m.value))}
              title={m.label}
            >
              {m.emoji}
            </button>
          ))}
          <input type="hidden" name="mood" value={mood} />
        </div>
        <input
          type="text"
          name="tags"
          defaultValue={entry.tags.join(', ')}
          placeholder="Tags (comma-separated)"
          className="journal-tag-input"
          maxLength={500}
        />
      </div>
      {result?.error && <p className="journal-error">{result.error}</p>}
      <div className="journal-edit-actions">
        <button type="submit" className="journal-submit" disabled={isPending}>
          {isPending ? 'Saving...' : 'Save changes'}
        </button>
        <button type="button" className="journal-cancel" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function EntryCard({
  entry,
  expanded,
  onToggleExpand,
  onEdit,
  onConfirmDelete,
  onRequestDelete,
  onCancelDelete,
  isPinning,
  isDeleting,
  startPinTransition,
  startDeleteTransition,
}: {
  entry: JournalEntry;
  expanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onConfirmDelete: boolean;
  onRequestDelete: () => void;
  onCancelDelete: () => void;
  isPinning: boolean;
  isDeleting: boolean;
  startPinTransition: (cb: () => void) => void;
  startDeleteTransition: (cb: () => void) => void;
}) {
  const needsTruncation = entry.body.length > 200;
  const displayBody = needsTruncation && !expanded
    ? entry.body.slice(0, 200) + '...'
    : entry.body;

  return (
    <div className={`journal-entry ${entry.is_pinned ? 'journal-entry--pinned' : ''}`}>
      <div className="journal-entry-header">
        <div className="journal-entry-meta">
          {entry.mood && <span className="journal-entry-mood">{moodEmoji(entry.mood)}</span>}
          {entry.title && <span className="journal-entry-title">{entry.title}</span>}
          <span className="journal-entry-date">{formatDate(entry.created_at)}</span>
        </div>
        <div className="journal-entry-actions">
          <form
            action={(formData) => startPinTransition(() => { togglePinEntry(formData); })}
          >
            <input type="hidden" name="id" value={entry.id} />
            <input type="hidden" name="is_pinned" value={String(entry.is_pinned)} />
            <button type="submit" className="journal-action-btn" disabled={isPinning} title={entry.is_pinned ? 'Unpin' : 'Pin'}>
              {entry.is_pinned ? '\u{1F4CC}' : '\u{1F4CB}'}
            </button>
          </form>
          <button type="button" className="journal-action-btn" onClick={onEdit} title="Edit">
            {'✏️'}
          </button>
          {onConfirmDelete ? (
            <span className="journal-delete-confirm">
              <form
                action={(formData) => startDeleteTransition(() => { deleteJournalEntry(formData); onCancelDelete(); })}
              >
                <input type="hidden" name="id" value={entry.id} />
                <button type="submit" className="journal-action-btn journal-action-btn--danger" disabled={isDeleting}>
                  Confirm
                </button>
              </form>
              <button type="button" className="journal-action-btn" onClick={onCancelDelete}>
                Cancel
              </button>
            </span>
          ) : (
            <button type="button" className="journal-action-btn" onClick={onRequestDelete} title="Delete">
              {'\u{1F5D1}️'}
            </button>
          )}
        </div>
      </div>

      <p className="journal-entry-body">{displayBody}</p>
      {needsTruncation && (
        <button type="button" className="journal-expand-btn" onClick={onToggleExpand}>
          {expanded ? 'Show less' : 'Read more'}
        </button>
      )}

      {entry.tags.length > 0 && (
        <div className="journal-entry-tags">
          {entry.tags.map(tag => (
            <span key={tag} className="journal-tag">{tag}</span>
          ))}
        </div>
      )}
    </div>
  );
}
