// Single source of truth for SEO/site constants.
// Keep narrow — anything page-specific stays in the page's metadata export.

export const SITE = {
  name: "Janet Cares",
  legalName: "Janet Cares",
  url: "https://janet.care",
  defaultTitle: "Janet Cares — Personalised longevity coaching",
  defaultDescription:
    "Personalised biological age, five-domain risk scores, and a supplement protocol made for you — clinically grounded and built for one person at a time.",
  twitterHandle: undefined as string | undefined, // set when we have one
  ogImagePath: "/opengraph-image", // generated dynamically by app/opengraph-image.tsx
  ogImageWidth: 1200,
  ogImageHeight: 630,
} as const;

export type Locale = "en_AU";

export function absoluteUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const trimmed = path.startsWith("/") ? path : `/${path}`;
  return `${SITE.url}${trimmed}`;
}
