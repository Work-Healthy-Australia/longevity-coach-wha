/**
 * CSV parsing + validation for bulk org invites.
 *
 * Accepts a raw CSV string (email,name per line) and returns dedup'd rows
 * plus any parse errors. Lightweight — no Zod dependency.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type InviteRow = { email: string; name: string };

export type ParseResult = {
  rows: InviteRow[];
  errors: string[];
};

/**
 * Parse a CSV string into invite rows.
 *
 * Handles:
 * - Header row detection (skips if first row looks like "email,name" etc.)
 * - Empty rows and whitespace trimming
 * - Email validation via regex
 * - Deduplication by email (case-insensitive, keeps first occurrence)
 */
export function parseInviteCSV(text: string): ParseResult {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return { rows: [], errors: ["CSV is empty"] };
  }

  const errors: string[] = [];
  const rows: InviteRow[] = [];
  const seen = new Set<string>();

  // Detect header row
  let startIdx = 0;
  const firstCols = lines[0].split(",").map((c) => c.trim().toLowerCase());
  if (firstCols.includes("email") || firstCols.includes("name")) {
    startIdx = 1;
  }

  for (let i = startIdx; i < lines.length; i++) {
    const lineNum = i + 1;
    const parts = lines[i].split(",").map((c) => c.trim());

    if (parts.length < 1 || !parts[0]) {
      errors.push(`Row ${lineNum}: missing email`);
      continue;
    }

    const email = parts[0].toLowerCase();
    const name = parts.length > 1 ? parts.slice(1).join(",").trim() : "";

    if (!EMAIL_RE.test(email)) {
      errors.push(`Row ${lineNum}: invalid email "${parts[0]}"`);
      continue;
    }

    if (seen.has(email)) {
      continue; // silently dedup
    }

    seen.add(email);
    rows.push({ email, name });
  }

  return { rows, errors };
}
