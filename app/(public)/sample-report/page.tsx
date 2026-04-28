import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import "./sample-report.css";

export const metadata: Metadata = {
  title: "Sample report · Longevity Coach",
  description:
    "A worked example of a Longevity Coach report: biological age, five domain risk scores, top modifiable drivers, and a personalised supplement protocol.",
};

const SAMPLE = {
  name: "Nina Okafor",
  context: "Architect, London, 38",
  reportDate: "April 2026",
  bioAge: 34.8,
  chronoAge: 38.0,
  domains: [
    { label: "Cardiovascular", score: 28, band: "low" as const },
    { label: "Metabolic", score: 58, band: "mod" as const },
    { label: "Neurological", score: 22, band: "low" as const },
    { label: "Oncological", score: 32, band: "low" as const },
    { label: "Musculoskeletal", score: 64, band: "mod" as const },
  ],
  drivers: [
    {
      name: "Triglyceride / HDL ratio",
      domain: "Metabolic",
      why: "Currently 2.4. Above 2.0 is consistently associated with insulin resistance in women your age. Most modifiable through carbohydrate quality and resistance training volume.",
    },
    {
      name: "Sleep regularity index",
      domain: "Neurological",
      why: "Wake-time variance is 1h 45m across the week. Reducing variance below 60 minutes is the single largest driver of slow-wave sleep at this age.",
    },
    {
      name: "Resistance training volume",
      domain: "Musculoskeletal",
      why: "Self-reported 1 session/week. Hip and lumbar bone density tracks closely with 2-3 weekly sessions for women approaching perimenopause.",
    },
    {
      name: "Omega-3 index",
      domain: "Cardiovascular",
      why: "Estimated 4.8% from diet recall. Target range 8-12% lowers ApoB and resting heart rate independent of statin status.",
    },
  ],
  supplements: [
    {
      name: "Omega-3 (EPA + DHA)",
      why: "Raises omega-3 index toward 8% over 90 days. Reduces inflammatory markers and triglycerides.",
      dose: "2 g EPA+DHA",
      timing: "With breakfast",
    },
    {
      name: "Vitamin D3 + K2",
      why: "Latitude + indoor work suggest insufficient endogenous synthesis. K2 directs calcium to bone rather than soft tissue.",
      dose: "4,000 IU D3 · 100 mcg K2-MK7",
      timing: "With breakfast",
    },
    {
      name: "Magnesium glycinate",
      why: "Supports sleep-onset latency and overnight glucose regulation. Glycinate form for tolerability and bioavailability.",
      dose: "400 mg",
      timing: "60 min before bed",
    },
    {
      name: "Creatine monohydrate",
      why: "Supports lean mass retention with limited resistance training. Emerging evidence for cognition in women approaching perimenopause.",
      dose: "5 g",
      timing: "Any time, daily",
    },
  ],
};

export default function SampleReportPage() {
  return (
    <div className="lc-report">
      <header className="topbar">
        <Link href="/">
          <Image
            src="/longevity-coach-horizontal-logo.png"
            alt="Longevity Coach"
            width={900}
            height={188}
            priority
          />
        </Link>
        <span className="meta">Sample report · for illustration</span>
      </header>

      <article className="doc">
        <div className="ribbon">
          <span className="pill">Bio-Age Report</span>
          <span className="for">For: {SAMPLE.name} · {SAMPLE.context}</span>
          <span className="date">{SAMPLE.reportDate}</span>
        </div>

        <h1>
          You&rsquo;re tracking <em>{(SAMPLE.chronoAge - SAMPLE.bioAge).toFixed(1)} years younger</em>{" "}
          than your passport.
        </h1>
        <p className="lede">
          Across five clinically-grounded models, your biological age comes in
          at <strong>{SAMPLE.bioAge}</strong>. Three of your five domains are in
          the low-risk band; two are flagged as moderate, and both are highly
          modifiable. Below: where the number comes from, what&rsquo;s pulling it
          one way or the other, and the protocol your coach has built for the
          next 90 days.
        </p>

        {/* ============ BIO-AGE ============ */}
        <div className="bio">
          <div className="big">
            {SAMPLE.bioAge}
            <span className="u">yrs</span>
          </div>
          <div className="compare">
            <span className="k">Chronological age</span>
            <div className="row">
              <span className="v">{SAMPLE.chronoAge}</span>
              <span className="delta">
                −{(SAMPLE.chronoAge - SAMPLE.bioAge).toFixed(1)} yrs
              </span>
            </div>
          </div>
          <div className="summary">
            Your biological age is reconciled from cardiovascular, metabolic,
            neurological, oncological and musculoskeletal models, weighted by
            data completeness. As you add wearable data and lab panels, the
            estimate tightens.
          </div>
        </div>

        {/* ============ DOMAINS ============ */}
        <div className="section-eyebrow">Five domains</div>
        <h2>Where the number <em>comes from.</em></h2>
        <p className="h2-sub">
          Lower scores mean lower modelled risk. Bands: low (0-30), moderate
          (31-60), high (61-100).
        </p>
        <div className="domains">
          {SAMPLE.domains.map((d) => (
            <div className="domain" key={d.label}>
              <div className="label">{d.label}</div>
              <div className="score">{d.score}</div>
              <div className="bar">
                <div className={`fill ${d.band}`} style={{ width: `${d.score}%` }} />
              </div>
              <div className={`tag ${d.band}`}>
                {d.band === "low" ? "Low" : d.band === "mod" ? "Moderate" : "High"}
              </div>
            </div>
          ))}
        </div>

        {/* ============ DRIVERS ============ */}
        <div className="section-eyebrow">Top modifiable drivers</div>
        <h2>What&rsquo;s actually <em>pulling you up.</em></h2>
        <p className="h2-sub">
          The four highest-impact factors you can change in 90 days, ranked by
          modelled effect on your bio-age.
        </p>
        <div className="drivers">
          {SAMPLE.drivers.map((d, i) => (
            <div className="driver" key={d.name}>
              <span className="num">{String(i + 1).padStart(2, "0")}</span>
              <div className="name">
                {d.name}
                <span className="why">{d.why}</span>
              </div>
              <span className="domain-pill">{d.domain}</span>
            </div>
          ))}
        </div>

        {/* ============ PROTOCOL ============ */}
        <div className="section-eyebrow">Your supplement protocol</div>
        <h2>A protocol, <em>not a pile.</em></h2>
        <p className="h2-sub">
          Four supplements, dosed and timed against your priority drivers. Each
          one earns its place: if the rationale stops applying, it comes off.
        </p>
        <div className="protocol">
          {SAMPLE.supplements.map((s) => (
            <div className="supp" key={s.name}>
              <div>
                <div className="name">{s.name}</div>
                <div className="why">{s.why}</div>
              </div>
              <div className="col">
                <span className="k">Dose</span>
                <span className="v">{s.dose}</span>
              </div>
              <div className="col">
                <span className="k">Timing</span>
                <span className="v">{s.timing}</span>
              </div>
            </div>
          ))}
        </div>

        {/* ============ METHODOLOGY ============ */}
        <div className="section-eyebrow" style={{ marginTop: 56 }}>Methodology</div>
        <h2>How the math <em>actually works.</em></h2>
        <p className="h2-sub">A note on what&rsquo;s under the hood.</p>
        <div className="method">
          Each domain runs a peer-reviewed risk model against your intake plus
          any wearable or lab data on file. Factors are scored on a 0-100 scale
          and combined as a weighted average, with weights set by domain expert
          panels. Your <strong>biological age</strong> is the chronological age
          at which a reference cohort of the same sex shows your composite risk
          profile. Data completeness modifies confidence, not direction. The
          full per-factor breakdown, weights, and references are available in
          the <strong>Methodology</strong> appendix of your downloadable PDF.
        </div>

        <div className="cta-strip">
          <h3>Ready to see your numbers?</h3>
          <p>
            A seven-minute intake gets you the same report, built around your
            answers. No credit card to start.
          </p>
          <Link href="/signup">Get my bio-age</Link>
          <span className="legal">No credit card · 7 minutes · Cancel anytime</span>
        </div>
      </article>
    </div>
  );
}
