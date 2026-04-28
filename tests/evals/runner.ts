import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { JudgeScore } from './judge';

const RESULTS_DIR = join(process.cwd(), 'tests', 'evals', 'results');

export function writeEvalReport(suiteName: string, scores: JudgeScore[]): void {
  const date = new Date().toISOString().slice(0, 10);
  const anyFail = scores.some((s) => !s.pass);

  // Stdout table
  console.log(`\n=== Eval Report: ${suiteName} (${date}) ===\n`);
  const col = (s: string, w: number) => s.padEnd(w).slice(0, w);
  console.log(col('Rubric', 30) + col('Score', 8) + col('Pass', 8) + 'Reasoning');
  console.log('─'.repeat(90));
  for (const s of scores) {
    const pass = s.pass ? '✓ PASS' : '✗ FAIL';
    console.log(col(s.rubric, 30) + col(String(s.score), 8) + col(pass, 8) + s.reasoning);
  }
  console.log('─'.repeat(90));
  console.log(`\nResult: ${anyFail ? 'FAIL' : 'PASS'} (${scores.filter((s) => s.pass).length}/${scores.length} rubrics passed)\n`);

  // JSON artifact
  mkdirSync(RESULTS_DIR, { recursive: true });
  const outPath = join(RESULTS_DIR, `${suiteName}-${date}.json`);
  writeFileSync(outPath, JSON.stringify({ suite: suiteName, date, scores }, null, 2));
  console.log(`Report written to ${outPath}`);

  if (anyFail) process.exit(1);
}
