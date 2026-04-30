import type { Metadata } from "next";
import { PublicNav } from "../_components/nav";
import { PublicFooter } from "../_components/footer";
import { Founder, FinalCTA } from "../_components/sections";
import "../home.css";

export const metadata: Metadata = {
  title: "Team · Janet Cares",
  description:
    "The clinicians, data scientists and designers behind Janet Cares.",
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
