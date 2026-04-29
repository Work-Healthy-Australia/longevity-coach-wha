/**
 * Format a risk driver row for display.
 *
 * Used by:
 *  - app/(app)/onboarding/actions.ts when persisting `risk_scores.top_risk_drivers[]`
 *  - app/(app)/report/page.tsx as a defensive display-time cleaner for legacy
 *    rows that were persisted before the formatting rule existed
 *
 * Rules:
 *  - Drop the `${domain}:` prefix when the factor name already names the domain
 *    in parentheses (e.g. `BMI (metabolic)`, `BMI (cancer risk)`). This avoids
 *    the redundant `"metabolic: BMI (metabolic) (score 64)"` shape.
 *  - Otherwise keep the domain prefix so single-word factors like `apoB`,
 *    `hsCRP`, `homocysteine` retain their domain context.
 *  - Score format: `score X` (kept consistent with the original convention so
 *    legacy rows can be cleaned with `cleanLegacyDriver()`).
 */

// Each pattern matches an open-paren followed by a domain keyword — anchoring
// to `(` prevents false positives from substrings like `BMI_onco` (no paren).
const DOMAIN_HINTS: Record<string, RegExp> = {
  metabolic: /\(metabolic/i,
  cardiovascular: /\((cv|cardio)/i,
  oncological: /\((cancer|onco)/i,
  neurodegenerative: /\((neuro|brain)/i,
  musculoskeletal: /\((msk|muscul)/i,
};

/** Format a fresh risk driver from the engine. */
export function formatRiskDriver(domain: string, name: string, score: number): string {
  const hint = DOMAIN_HINTS[domain.toLowerCase()];
  const nameAlreadyTagged = hint ? hint.test(name) : false;
  const prefix = nameAlreadyTagged ? "" : `${domain}: `;
  return `${prefix}${name} (score ${score})`;
}

/**
 * Clean a previously-persisted risk driver string.
 *
 * Handles the redundant shape `"metabolic: BMI (metabolic) (score 64)"`
 * by stripping the leading `"<domain>: "` when the same domain appears
 * inside parentheses later in the string. Returns the input unchanged
 * if no redundancy is detected.
 */
export function cleanLegacyDriver(s: string): string {
  // Match leading "word: " up to the first colon-space.
  const match = s.match(/^([a-z]+):\s+(.*)$/i);
  if (!match) return s;
  const [, domain, rest] = match;
  const hint = DOMAIN_HINTS[domain.toLowerCase()];
  if (!hint) return s;
  return hint.test(rest) ? rest : s;
}
