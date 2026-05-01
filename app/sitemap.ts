import type { MetadataRoute } from "next";
import { SITE } from "@/lib/seo/site";

// Public, indexable pages. Auth-gated routes (/dashboard, /account, /report,
// /check-in, etc.) are never listed — they redirect unauth users via proxy.ts
// and are explicitly excluded by app/robots.ts.

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const PUBLIC_ROUTES: Array<{
    path: string;
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
    priority: number;
  }> = [
    { path: "/", changeFrequency: "weekly", priority: 1.0 },
    { path: "/pricing", changeFrequency: "monthly", priority: 0.9 },
    { path: "/science", changeFrequency: "monthly", priority: 0.8 },
    { path: "/sample-report", changeFrequency: "monthly", priority: 0.8 },
    { path: "/team", changeFrequency: "monthly", priority: 0.6 },
    { path: "/stories", changeFrequency: "weekly", priority: 0.6 },
    { path: "/legal/data-handling", changeFrequency: "yearly", priority: 0.4 },
    { path: "/legal/collection-notice", changeFrequency: "yearly", priority: 0.4 },
  ];

  return PUBLIC_ROUTES.map((r) => ({
    url: `${SITE.url}${r.path}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));
}
