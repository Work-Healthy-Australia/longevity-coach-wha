import type { MetadataRoute } from "next";
import { SITE } from "@/lib/seo/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/auth/",
          "/dashboard",
          "/dashboard/",
          "/account",
          "/account/",
          "/admin",
          "/admin/",
          "/report",
          "/report/",
          "/check-in",
          "/check-in/",
          "/onboarding",
          "/onboarding/",
          "/labs",
          "/labs/",
          "/insights",
          "/journal",
          "/uploads",
          "/uploads/",
          "/care-team",
          "/simulator",
          "/trends",
          "/routines",
          "/alerts",
          "/org",
          "/org/",
          "/clinician",
          "/clinician/",
          "/login",
          "/signup",
          "/forgot-password",
          "/reset-password",
          "/verify-email",
          "/email-confirmed",
          "/project-status.html",
        ],
      },
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
