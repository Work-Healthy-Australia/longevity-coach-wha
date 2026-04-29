/**
 * Formats a baseline-vs-simulated score delta for the simulator UI.
 *
 * Both numbers are rounded to integers (engine scores are 0–100). Output
 * uses an en-dash minus (U+2212) for negatives so the typography reads
 * cleanly at small font sizes.
 *
 * Examples:
 *   formatDelta(45, 38) // "45 → 38 (−7)"
 *   formatDelta(45, 50) // "45 → 50 (+5)"
 *   formatDelta(45, 45) // "45 → 45 (0)"
 */
export function formatDelta(baseline: number, simulated: number): string {
  const b = Math.round(baseline);
  const s = Math.round(simulated);
  const diff = s - b;
  let sign = "";
  if (diff > 0) sign = "+";
  else if (diff < 0) sign = "−";
  const abs = Math.abs(diff);
  return `${b} → ${s} (${sign}${abs})`;
}
