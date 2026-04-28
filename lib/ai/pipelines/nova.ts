// Nova research digest pipeline — Phase 4
// Populates health_knowledge via pgvector embeddings for RAG retrieval.
// Triggered by cron or admin action — never called from a user request.

import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { createPipelineAgent } from '@/lib/ai/agent-factory';
import { embedText } from '@/lib/ai/rag';

// ---------------------------------------------------------------------------
// Types & schemas
// ---------------------------------------------------------------------------

interface PubMedArticle {
  pmid: string;
  title: string;
  abstract: string;
  sourceUrl: string;
}

const DigestSchema = z.object({
  title: z.string(),
  content: z.string().min(50),
  evidence_level: z.enum(['strong', 'moderate', 'preliminary']),
  key_passages: z.array(z.string()).min(1).max(5),
  source_url: z.string(),
});
type Digest = z.infer<typeof DigestSchema>;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORY_QUERIES: Record<string, string> = {
  cv:          'cardiovascular longevity prevention age heart',
  metabolic:   'metabolic health insulin longevity diabetes prevention',
  neuro:       'brain cognitive longevity neurodegeneration prevention',
  onco:        'cancer prevention longevity biomarkers early detection',
  msk:         'musculoskeletal longevity bone muscle aging sarcopenia',
  supplements: 'longevity supplements nutraceuticals clinical trial',
};

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

/**
 * Splits text into overlapping word-based chunks for embedding.
 * Exported for unit tests.
 */
export function chunkText(text: string, chunkWords = 300, overlapWords = 60): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const chunks: string[] = [];
  let start = 0;
  while (start < words.length) {
    chunks.push(words.slice(start, start + chunkWords).join(' '));
    if (start + chunkWords >= words.length) break;
    start += chunkWords - overlapWords;
  }
  return chunks;
}

// ---------------------------------------------------------------------------
// Phase 1 — PubMed search
// ---------------------------------------------------------------------------

async function searchPubMed(category: string, query: string): Promise<string[]> {
  try {
    const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=5&retmode=json&sort=relevance&mindate=2024/01/01`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json() as { esearchresult?: { idlist?: string[] } };
    return data?.esearchresult?.idlist ?? [];
  } catch {
    console.warn(`[Nova] PubMed search failed for category ${category}`);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Phase 2 — Fetch abstracts + parse
// ---------------------------------------------------------------------------

function parseEfetchText(text: string, pmids: string[]): PubMedArticle[] {
  const pmidSet = new Set(pmids);
  const articles: PubMedArticle[] = [];

  // Split on blank lines to get rough sections
  const sections = text.split(/\n\n+/);
  let currentPmid: string | null = null;
  let currentTitle = '';
  const abstractLines: string[] = [];
  let inAbstract = false;

  const flushArticle = () => {
    if (currentPmid && pmidSet.has(currentPmid) && currentTitle) {
      articles.push({
        pmid: currentPmid,
        title: currentTitle,
        abstract: abstractLines.join(' ').trim(),
        sourceUrl: `https://pubmed.ncbi.nlm.nih.gov/${currentPmid}/`,
      });
    }
    currentPmid = null;
    currentTitle = '';
    abstractLines.length = 0;
    inAbstract = false;
  };

  for (const section of sections) {
    const lines = section.split('\n').map(l => l.trim()).filter(Boolean);
    for (const line of lines) {
      const pmidMatch = line.match(/^PMID:\s*(\d+)/);
      if (pmidMatch) {
        flushArticle();
        currentPmid = pmidMatch[1];
        inAbstract = false;
        continue;
      }
      if (!currentPmid) {
        // Haven't hit a PMID yet for this block — treat first non-empty line as title
        if (!currentTitle) currentTitle = line;
        continue;
      }
      if (line.startsWith('Abstract')) {
        inAbstract = true;
        // rest of line after "Abstract" may contain text
        const rest = line.replace(/^Abstract\s*/, '').trim();
        if (rest) abstractLines.push(rest);
        continue;
      }
      if (inAbstract) {
        abstractLines.push(line);
      } else if (!currentTitle) {
        currentTitle = line;
      }
    }
  }
  flushArticle();

  return articles;
}

// ---------------------------------------------------------------------------
// Main pipeline
// ---------------------------------------------------------------------------

export async function runNovaDigestPipeline(): Promise<void> {
  try {
    const admin = createAdminClient();

    // -----------------------------------------------------------------------
    // Phase 1 — PubMed search (6 parallel)
    // -----------------------------------------------------------------------
    const categories = Object.keys(CATEGORY_QUERIES);
    const searchResults = await Promise.allSettled(
      categories.map(cat => searchPubMed(cat, CATEGORY_QUERIES[cat]))
    );

    const categoryPmids: Record<string, string[]> = {};
    searchResults.forEach((result, idx) => {
      categoryPmids[categories[idx]] = result.status === 'fulfilled' ? result.value : [];
    });

    // -----------------------------------------------------------------------
    // Phase 2 — Fetch abstracts + deduplicate
    // -----------------------------------------------------------------------
    const allPmids = [...new Set(Object.values(categoryPmids).flat())];
    if (allPmids.length === 0) {
      console.warn('[Nova] No PMIDs found — pipeline exiting early');
      return;
    }

    // 500ms polite delay before efetch
    await new Promise(r => setTimeout(r, 500));

    let articles: PubMedArticle[] = [];
    try {
      const efetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${allPmids.join(',')}&rettype=abstract&retmode=text`;
      const efetchRes = await fetch(efetchUrl);
      if (efetchRes.ok) {
        const text = await efetchRes.text();
        articles = parseEfetchText(text, allPmids);
      }
    } catch (err) {
      console.error('[Nova] efetch failed:', err);
    }

    // Deduplicate against recent health_knowledge
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: recentRows } = await (admin as any)
      .schema('agents')
      .from('health_knowledge')
      .select('metadata')
      .gte('created_at', thirtyDaysAgo);

    const recentSources = new Set<string>(
      (recentRows ?? [])
        .map((r: { metadata?: { source?: string } }) => r.metadata?.source)
        .filter(Boolean) as string[]
    );

    const articlesByPmid = new Map<string, PubMedArticle>(articles.map(a => [a.pmid, a]));

    // Build per-category article lists (deduplicated from recentSources)
    const categoryArticles: Record<string, PubMedArticle[]> = {};
    for (const cat of categories) {
      categoryArticles[cat] = categoryPmids[cat]
        .map(pmid => articlesByPmid.get(pmid))
        .filter((a): a is PubMedArticle => !!a && !recentSources.has(a.sourceUrl));
    }

    // -----------------------------------------------------------------------
    // Phase 3 — Synthesize (2 batches of 3 parallel LLM calls)
    // -----------------------------------------------------------------------
    const agent = createPipelineAgent('nova');
    const batches: string[][] = [
      ['cv', 'metabolic', 'neuro'],
      ['onco', 'msk', 'supplements'],
    ];

    const successfulResults: Array<{ category: string; digest: Digest }> = [];

    for (const batch of batches) {
      const batchResults = await Promise.allSettled(
        batch.map(async (category) => {
          const arts = categoryArticles[category] ?? [];
          if (arts.length === 0) return null;

          const articlesText = arts.map(a =>
            `Title: ${a.title}\nAbstract: ${a.abstract}\nURL: ${a.sourceUrl}`
          ).join('\n---\n');

          const prompt = `Category: ${category}\n\nRecent PubMed abstracts:\n---\n${articlesText}\n---\n\nSynthesise a digest following your instructions. Return JSON matching the schema.`;

          const result = await agent.run(DigestSchema, prompt);
          return { category, digest: result };
        })
      );

      for (let i = 0; i < batch.length; i++) {
        const r = batchResults[i];
        if (r.status === 'fulfilled' && r.value !== null) {
          successfulResults.push(r.value);
        } else if (r.status === 'rejected') {
          console.error(`[Nova] Category ${batch[i]} failed:`, r.reason);
        }
      }
    }

    if (successfulResults.length === 0) {
      console.warn('[Nova] No digests produced — pipeline exiting early');
      return;
    }

    // -----------------------------------------------------------------------
    // Phase 4 — Chunk + embed
    // -----------------------------------------------------------------------
    interface ChunkMeta {
      text: string;
      category: string;
      evidenceLevel: string;
      sourceUrl: string;
    }

    const allChunksWithMeta: ChunkMeta[] = [];

    for (const { category, digest } of successfulResults) {
      const contentChunks = chunkText(digest.content);
      for (const chunk of contentChunks) {
        allChunksWithMeta.push({
          text: chunk,
          category,
          evidenceLevel: digest.evidence_level,
          sourceUrl: digest.source_url,
        });
      }
      for (const passage of digest.key_passages) {
        allChunksWithMeta.push({
          text: passage,
          category,
          evidenceLevel: digest.evidence_level,
          sourceUrl: digest.source_url,
        });
      }
    }

    const allChunkTexts = allChunksWithMeta.map(c => c.text);
    const allEmbeddings = await embedText(allChunkTexts);

    // -----------------------------------------------------------------------
    // Phase 5 — Upsert + prune
    // -----------------------------------------------------------------------
    const runId = crypto.randomUUID();

    // Insert health_updates (one row per successful digest)
    const updates = successfulResults.map(({ category, digest }) => ({
      run_id: runId,
      title: digest.title,
      content: digest.content,
      category,
      source: digest.source_url,
      evidence_level: digest.evidence_level,
    }));

    if (updates.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any).schema('agents').from('health_updates').insert(updates);
    }

    // Insert health_knowledge chunks
    const knowledgeRows = allChunksWithMeta.map((c, i) => ({
      content: c.text,
      embedding: allEmbeddings[i],
      metadata: {
        source: c.sourceUrl,
        category: c.category,
        evidence_level: c.evidenceLevel,
        run_id: runId,
        published_at: new Date().toISOString().split('T')[0],
      },
    }));

    if (knowledgeRows.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any).schema('agents').from('health_knowledge').insert(knowledgeRows);
    }

    // Prune old rows (90 days) from both tables
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (admin as any).schema('agents').from('health_knowledge').delete().lt('created_at', ninetyDaysAgo),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (admin as any).schema('agents').from('health_updates').delete().lt('created_at', ninetyDaysAgo),
    ]);

    console.log(`[Nova] Pipeline complete — run_id=${runId}, digests=${successfulResults.length}, chunks=${knowledgeRows.length}`);
  } catch (err) {
    // Top-level catch: log but never rethrow — cron route handles return code
    console.error('[Nova] Pipeline error:', err);
  }
}
