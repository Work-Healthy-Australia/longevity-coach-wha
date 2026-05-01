import type { Metadata } from "next";
import { PublicNav } from "../_components/nav";
import { PublicFooter } from "../_components/footer";
import { Founder, FinalCTA } from "../_components/sections";
import "../home.css";

export const metadata: Metadata = {
  title: "Team",
  description:
    "The clinicians, data scientists and designers behind Janet Cares — and the standards we hold ourselves to.",
  alternates: { canonical: "/team" },
  openGraph: {
    type: "website",
    url: "/team",
    title: "Team — Janet Cares",
    description:
      "Meet the clinicians, data scientists and designers behind Janet Cares.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Team — Janet Cares",
    description:
      "The clinicians, data scientists and designers behind Janet Cares.",
  },
};

export default function TeamPage() {
  return (
    <div className="lc-home" data-hero="a" data-accent="orange">
      <PublicNav />
      <Founder />
      <FinalCTA />
      <PublicFooter />
    </div>
  );
}
