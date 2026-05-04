import type { Metadata } from "next";
import { PublicNav } from "./_components/nav";
import { PublicFooter } from "./_components/footer";
import {
  HowItWorks,
  WhatYouGet,
  Science,
  Founder,
  Testimonials,
  FinalCTA,
} from "./_components/sections";
import "./home.css";

export const metadata: Metadata = {
  title: "Live longer, on purpose.",
  description:
    "Seven minutes of honest questions. A clinically grounded biological age, risk scores across five domains, and a supplement, exercise and meal plan made for you — not for everyone.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    title: "Janet Cares — Live longer, on purpose.",
    description:
      "A clinically grounded biological age, risk scores across five domains, and a supplement, exercise and meal plan made for you — not for everyone.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Janet Cares — Live longer, on purpose.",
    description:
      "A clinically grounded biological age, risk scores across five domains, and a supplement, exercise and meal plan made for you — not for everyone.",
  },
};

export default function Home() {
  return (
    <div className="lc-home" data-hero="a" data-accent="orange">
      <PublicNav />

      {/* ============ HERO A · SAFE ============ */}
      <section className="hero-a">
        <div className="wrap">
          <div className="row">
            <div>
              <span className="eyebrow eye">
                Personalised longevity · for one person at a time
              </span>
              <h1>
                Live <em>longer,</em>
                <br />
                on <span className="accent">purpose.</span>
              </h1>
              <p className="sub">
                Seven minutes of honest questions. A clinically-grounded
                biological age, risk scores across five domains, and a
                supplement, exercise and meal plan made for you - not for
                everyone.
              </p>
              <div className="ctas">
                <a className="btn btn-primary btn-lg" href="/signup">Get my bio-age →</a>
                <a className="btn btn-ghost btn-lg" href="/sample-report">See a sample report</a>
              </div>
              <div className="mini">
                <span><span className="dot" />&nbsp;&nbsp;No credit card to start</span>
                <span>·</span>
                <span>AHPRA-registered clinicians</span>
                <span>·</span>
                <span>Cancel anytime</span>
              </div>
            </div>

            <div className="report">
              <div className="tab">
                <span className="pill">BIO-AGE REPORT</span>
                <span className="date">APR · 2026</span>
              </div>
              <h3 className="headline">
                You&rsquo;re tracking <em>3.2 years younger</em> than your passport.
              </h3>
              <div className="big">
                <div className="n">34.8<span className="u">yrs</span></div>
                <div className="compare">
                  <div className="k">CHRONOLOGICAL</div>
                  <div className="v">38.0</div>
                  <div className="delta">−3.2 yrs</div>
                </div>
              </div>
              <div className="rows">
                {[
                  ["Cardiovascular", "fill-low", "28%", "LOW"],
                  ["Metabolic", "fill-mid", "58%", "MOD"],
                  ["Neurological", "fill-low", "22%", "LOW"],
                  ["Oncological", "fill-low", "32%", "LOW"],
                  ["Musculoskeletal", "fill-mid", "64%", "MOD"],
                ].map(([label, fill, width, val]) => (
                  <div className="row" key={label}>
                    <span className="lbl">{label}</span>
                    <div className="bar">
                      <div className={`fill ${fill}`} style={{ width }} />
                    </div>
                    <span className="val">{val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ HERO B · BOLDER ============ */}
      <section className="hero-b">
        <div className="wrap">
          <div className="grid">
            <div className="kicker">
              <span className="issue">VOL. 01 · ISSUE 04 · APRIL 2026</span>
              <span className="caption">A HEALTH QUARTERLY FOR THE REST OF YOUR LIFE</span>
            </div>

            <h1>
              Add <em>years</em>
              <br />
              to your life.
              <br />
              <span className="blue">Life</span> to your years.
            </h1>

            <div className="meta-row">
              <div className="lede">
                A seven-minute intake. A clinically-grounded biological age.
                Five risk domains and a supplement protocol built for one
                person - you.
              </div>
              <div className="stat">
                <div className="n">5,400+</div>
                <div className="l">members enrolled across the UK, UAE &amp; Vietnam</div>
              </div>
              <div className="stat">
                <div className="n">
                  −2.8
                  <span style={{ fontSize: "32px", color: "var(--lc-grey)", letterSpacing: 0, fontFamily: "var(--lc-sans)", marginLeft: "4px" }}>yrs</span>
                </div>
                <div className="l">median bio-age reduction after 90 days on protocol</div>
              </div>
            </div>

            <div className="cta-row">
              <a className="btn btn-primary btn-lg" href="/signup">Get my bio-age →</a>
              <a className="btn btn-ghost btn-lg" href="/sample-report">See a sample report</a>
              <span className="legal">NO CREDIT CARD · 7 MINUTES · CANCEL ANYTIME</span>
            </div>
          </div>
        </div>

        <div className="hero-b-visual">
          <div className="dash">
            <div className="dash-panel">
              <div className="chrome">
                <div className="dot" style={{ background: "#E57B6B" }} />
                <div className="dot" style={{ background: "#E8C46B" }} />
                <div className="dot" style={{ background: "#7DB87F" }} />
                <span className="url">janet.care / dashboard</span>
              </div>

              <div className="dp-side">
                <div className="i on">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a10 10 0 1 0 10 10" />
                    <path d="M12 2v10l7 3" />
                  </svg>
                  Overview
                </div>
                <div className="i">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 12h4l3-8 4 16 3-8h4" />
                  </svg>
                  Domains
                </div>
                <div className="i">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="5" y="3" width="14" height="18" rx="2" />
                    <path d="M9 8h6M9 12h6M9 16h4" />
                  </svg>
                  Protocol
                </div>
                <div className="i">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 2" />
                  </svg>
                  History
                </div>
              </div>

              <div className="dp-main">
                <h3 className="greet">Good morning, <em>Nina.</em></h3>
                <div className="sub">Your bio-age is trending well. Two small wins this week.</div>

                <div className="score-row">
                  <div className="big-n">34.8<span className="u">yrs</span></div>
                  <div className="score-meta">
                    <div>CHRONO · 38.0 YRS</div>
                    <div className="delta">−3.2 YRS DELTA</div>
                    <div>CONFIDENCE · HIGH</div>
                  </div>
                </div>

                <div className="minirows">
                  {[
                    ["Cardiovascular", "fill-low", "28%", "LOW"],
                    ["Metabolic", "fill-mid", "58%", "MOD"],
                    ["Neurological", "fill-low", "22%", "LOW"],
                    ["Oncological", "fill-low", "32%", "LOW"],
                    ["Musculoskeletal", "fill-mid", "64%", "MOD"],
                  ].map(([label, fill, width, val]) => (
                    <div className="mini" key={label}>
                      <span>{label}</span>
                      <div className="bar">
                        <div className={`fill ${fill}`} style={{ width }} />
                      </div>
                      <span className="v">{val}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="dp-right">
                <div className="card">
                  <div className="t">Today&rsquo;s focus</div>
                  <div className="d">
                    Add two resistance sessions this week to move
                    musculoskeletal from moderate to low.
                  </div>
                </div>
                {[
                  ["Ω3", "Omega-3 EPA/DHA", "2 × 500 mg · breakfast"],
                  ["D₃", "Vitamin D3 + K2", "1 × 4,000 IU · morning"],
                  ["Mg", "Magnesium glycinate", "1 × 300 mg · evening"],
                ].map(([icon, name, dose]) => (
                  <div className="supp" key={name}>
                    <div className="i">{icon}</div>
                    <div>
                      <div className="n">{name}</div>
                      <div className="d">{dose}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ TRUST ============ */}
      <div className="trust">
        <div className="wrap">
          <div className="row">
            <div className="lbl">Built with and reviewed by</div>
            <div>RACGP-aligned protocols</div>
            <div>45 and Up Study data</div>
            <div>AHPRA-registered clinicians</div>
            <div>ISO 27001</div>
          </div>
        </div>
      </div>

      <HowItWorks />
      <WhatYouGet />
      <Science />
      <Founder />
      <Testimonials />
      <FinalCTA />
      <PublicFooter />
    </div>
  );
}
