import type { Metadata } from "next";
import { PublicNav } from "../_components/nav";
import { PublicFooter } from "../_components/footer";
import { Science, HowItWorks, WhatYouGet, FinalCTA } from "../_components/sections";
import "../home.css";

export const metadata: Metadata = {
  title: "Science",
  description:
    "How Janet Cares calculates your biological age and risk scores — the clinical models, the methodology, and the limits we're honest about.",
  alternates: { canonical: "/science" },
  openGraph: {
    type: "article",
    url: "/science",
    title: "Science — Janet Cares",
    description:
      "The clinical models behind your biological age and five-domain risk scores, and the limits we're honest about.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Science — Janet Cares",
    description:
      "The clinical models behind your biological age and five-domain risk scores.",
  },
};

export default function SciencePage() {
  return (
    <div className="lc-home" data-hero="a" data-accent="orange">
      <PublicNav />
      <Science />
      <HowItWorks />
      <WhatYouGet />
      <FinalCTA />
      <PublicFooter />
    </div>
  );
}
