// Shared B2C plan tier helpers — used by the public pricing page and the
// Stripe checkout API to keep tier-rank logic in one place.

export type Tier = "core" | "clinical" | "elite";

export const TIER_RANK: Record<Tier, number> = {
  core: 0,
  clinical: 1,
  elite: 2,
};

// Group key for collapsing monthly + annual rows of the same plan into one
// card. Strips trailing " Monthly" / " Annual" from the name so e.g.
// "Core" and "Core Annual" share the same group.
export function planKey(p: { tier: string; name: string }): string {
  const cleaned = p.name.replace(/\s+(monthly|annual)$/i, "").trim();
  return `${p.tier}::${cleaned}`;
}
