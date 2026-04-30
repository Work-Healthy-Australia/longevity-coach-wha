import type { Metadata } from "next";
import { PublicNav } from "../_components/nav";
import { PublicFooter } from "../_components/footer";
import { Science, HowItWorks, WhatYouGet, FinalCTA } from "../_components/sections";
import "../home.css";

export const metadata: Metadata = {
  title: "Science · Janet Cares",
  description:
    "How Janet Cares calculates your biological age and risk scores - the models, the methodology, and the limits we&apos;re honest about.",
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
