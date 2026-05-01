// Build script for docs/project-status.html.
//
// The HTML viewer embeds a curated set of markdown docs as
// <script type="text/markdown" id="md-...">…</script> blocks and uses
// client-side JS + the URL hash to switch between them. Without this
// script the embedded blocks are hand-maintained and silently drift from
// their source files (today's incident: epic-status was 3 days stale).
//
// Run: pnpm exec tsx scripts/build-status-page.ts
//   or: node --import tsx scripts/build-status-page.ts
//
// CI usage (suggested): run on every push that touches docs/**/*.md, fail
// if the script produces a diff, OR commit the regenerated HTML
// automatically via a bot.

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Single source of truth: which embedded block id maps to which source .md.
// Add new entries here when the dashboard surfaces a new doc.
const MAP: Record<string, string> = {
  'md-README':       'docs/README.md',
  'md-timeline':     'docs/product/01-product-timeline.md',
  'md-state':        'docs/engineering/2026-04-28-current-state.md',
  'md-product':      'docs/product/product.md',
  'md-epics':        'docs/product/epics.md',
  'md-epic-status':  'docs/product/epic-status.md',
  'md-agents':       'docs/product/agents.md',
  'md-ai-vision':    'docs/architecture/ai-vision.md',
  'md-qa-plan':      'docs/qa/qa-plan.md',
  'md-qa-report':    'docs/qa/2026-04-27-qa-report.md',
  'md-plan-a':       'docs/engineering/plan/sprint-2/2026-04-29-plan-business-features.md',
  'md-plan-b':       'docs/engineering/plan/sprint-2/2026-04-29-plan-engineering-completeness.md',
  'md-proposals':    'docs/features/au-asean-expansion/feature-proposal.md',
};

const HTML_PATH = resolve('docs/project-status.html');
let html = readFileSync(HTML_PATH, 'utf-8');

let updated = 0;
let unchanged = 0;
const missing: string[] = [];

for (const [id, srcPath] of Object.entries(MAP)) {
  let src: string;
  try {
    src = readFileSync(resolve(srcPath), 'utf-8');
  } catch {
    missing.push(srcPath);
    continue;
  }

  // The HTML uses a self-closing-ish pattern: <script ... id="md-X">CONTENT</script>
  // CONTENT is raw markdown, sometimes containing characters HTML would normally
  // treat as significant — but inside <script> the parser only stops at the
  // literal </script> tag, so we just need to escape that one sequence.
  const escaped = src.replace(/<\/script>/gi, '<\\/script>');

  const pattern = new RegExp(
    `(<script type="text/markdown" id="${id}">)([\\s\\S]*?)(</script>)`,
    'm',
  );
  const match = pattern.exec(html);
  if (!match) {
    missing.push(`#${id} (no embed block found in HTML)`);
    continue;
  }

  if (match[2] === escaped) {
    unchanged++;
    continue;
  }

  html = html.replace(pattern, `$1${escaped}$3`);
  updated++;
  console.log(`updated ${id}  ←  ${srcPath}`);
}

writeFileSync(HTML_PATH, html);

console.log(`\n${updated} updated · ${unchanged} unchanged · ${missing.length} missing`);
if (missing.length > 0) {
  console.error('Missing sources/blocks:');
  for (const m of missing) console.error(`  - ${m}`);
  process.exit(1);
}
