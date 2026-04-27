// `full_name` is the single source of truth for a user's name (stored in
// profiles, captured at signup). First / last names are derived on read so
// they can never drift from the canonical value.

export type SplitName = { firstName: string | null; lastName: string | null };

export function splitFullName(fullName: string | null | undefined): SplitName {
  if (!fullName) return { firstName: null, lastName: null };
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: null, lastName: null };
  if (parts.length === 1) return { firstName: parts[0]!, lastName: null };
  return {
    firstName: parts[0]!,
    lastName: parts.slice(1).join(" "),
  };
}
