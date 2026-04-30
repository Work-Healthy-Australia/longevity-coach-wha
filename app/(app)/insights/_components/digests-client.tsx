'use client';

import { useState, useMemo } from 'react';

type HealthUpdate = {
  id: string;
  title: string;
  content: string;
  category: string;
  source: string;
  evidence_level: string;
  posted_date: string;
};

const EVIDENCE_LABELS: Record<string, string> = {
  strong: 'Strong evidence',
  moderate: 'Moderate evidence',
  preliminary: 'Preliminary',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function DigestsClient({
  updates,
  categoryLabels,
}: {
  updates: HealthUpdate[];
  categoryLabels: Record<string, string>;
}) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');

  // Derive the set of categories present in the data
  const presentCategories = useMemo(() => {
    const seen = new Set<string>();
    for (const u of updates) {
      seen.add(u.category);
    }
    // Return in the order defined by categoryLabels, then any extras
    const ordered: string[] = [];
    for (const key of Object.keys(categoryLabels)) {
      if (seen.has(key)) ordered.push(key);
    }
    for (const key of seen) {
      if (!ordered.includes(key)) ordered.push(key);
    }
    return ordered;
  }, [updates, categoryLabels]);

  const filtered = useMemo(() => {
    let result = updates;

    if (activeCategory) {
      result = result.filter((u) => u.category === activeCategory);
    }

    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      result = result.filter(
        (u) =>
          u.title.toLowerCase().includes(q) ||
          u.content.toLowerCase().includes(q),
      );
    }

    return result;
  }, [updates, activeCategory, searchText]);

  const isFiltered = activeCategory !== null || searchText.trim() !== '';

  return (
    <>
      <div className="digest-filters">
        <button
          type="button"
          className={`digest-filter-pill digest-filter-pill-all${activeCategory === null ? ' active' : ''}`}
          onClick={() => setActiveCategory(null)}
        >
          All
        </button>
        {presentCategories.map((cat) => (
          <button
            key={cat}
            type="button"
            className={`digest-filter-pill digest-filter-pill-${cat}${activeCategory === cat ? ' active' : ''}`}
            onClick={() =>
              setActiveCategory(activeCategory === cat ? null : cat)
            }
          >
            {categoryLabels[cat] ?? cat}
          </button>
        ))}
      </div>

      <div className="digest-search-row">
        <input
          type="text"
          className="digest-search"
          placeholder="Search updates..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          aria-label="Search research updates"
        />
      </div>

      {isFiltered && (
        <p className="digest-result-count">
          {filtered.length} {filtered.length === 1 ? 'result' : 'results'}
        </p>
      )}

      {filtered.length === 0 ? (
        <p className="insights-empty">
          {isFiltered
            ? 'No updates match your filters.'
            : 'Research digests will appear here once our health researcher begins publishing.'}
        </p>
      ) : (
        <div className="digests-grid">
          {filtered.map((u) => (
            <article key={u.id} className="digest-card">
              <div className="digest-meta">
                <span
                  className={`digest-category digest-category-${u.category}`}
                >
                  {categoryLabels[u.category] ?? u.category}
                </span>
                <span
                  className={`digest-evidence digest-evidence-${u.evidence_level}`}
                >
                  {EVIDENCE_LABELS[u.evidence_level] ?? u.evidence_level}
                </span>
              </div>
              <h3 className="digest-title">{u.title}</h3>
              <p className="digest-content">{u.content}</p>
              <div className="digest-footer">
                <span className="digest-source">{u.source}</span>
                <time className="digest-date" dateTime={u.posted_date}>
                  {formatDate(u.posted_date)}
                </time>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
