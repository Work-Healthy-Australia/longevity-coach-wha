import type { Metadata } from "next";
import { PublicNav } from "../_components/nav";
import { PublicFooter } from "../_components/footer";
import { Testimonials, FinalCTA } from "../_components/sections";
import "../home.css";

export const metadata: Metadata = {
  title: "Member stories",
  description:
    "Ninety-day deltas from real Janet Cares members — biological age, energy, sleep, and the levers that moved them.",
  alternates: { canonical: "/stories" },
  openGraph: {
    type: "article",
    url: "/stories",
    title: "Member stories — Janet Cares",
    description:
      "Ninety-day deltas from real Janet Cares members and the levers that moved them.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Member stories — Janet Cares",
    description:
      "Ninety-day deltas from real Janet Cares members.",
  },
};

export default function StoriesPage() {
  return (
    <div className="lc-home" data-hero="a" data-accent="orange">
      <PublicNav />
      <Testimonials />
      <FinalCTA />
      <PublicFooter />
    </div>
  );
}
