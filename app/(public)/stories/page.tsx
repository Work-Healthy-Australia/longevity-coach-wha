import type { Metadata } from "next";
import { PublicNav } from "../_components/nav";
import { PublicFooter } from "../_components/footer";
import { Testimonials, FinalCTA } from "../_components/sections";
import "../home.css";

export const metadata: Metadata = {
  title: "Member stories · Janet Cares",
  description:
    "Ninety-day deltas from real members of Janet Cares.",
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
