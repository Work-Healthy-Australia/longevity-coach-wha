// Side-effect module: ensures env vars are loaded from the main project's
// .env.local before any module that consumes them at import time. Imported
// FIRST in tests that need real Anthropic / Supabase access — worktrees do
// not share untracked files, so we walk up to the parent repo.

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// The user's global shell has ANTHROPIC_BASE_URL=https://api.anthropic.com
// (no /v1 prefix), which overrides the AI SDK's default and yields a 404 on
// every request. Drop it so the SDK uses its real default of
// https://api.anthropic.com/v1.
if (
  process.env.ANTHROPIC_BASE_URL &&
  !/\/v\d+\/?$/.test(process.env.ANTHROPIC_BASE_URL)
) {
  delete process.env.ANTHROPIC_BASE_URL;
}
if (!process.env.ANTHROPIC_API_KEY || !process.env.SUPABASE_SECRET_KEY) {
  const candidates = [
    resolve(process.cwd(), ".env.local"),
    resolve(process.cwd(), "..", "..", "..", ".env.local"),
    resolve(process.cwd(), "..", "..", "..", "..", ".env.local"),
  ];
  for (const p of candidates) {
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf-8").split("\n")) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
      if (!m) continue;
      const [, key, rawVal] = m;
      const val = rawVal.replace(/^["']|["']$/g, "").trim();
      if (key && !process.env[key]) process.env[key] = val;
    }
    break;
  }
}
