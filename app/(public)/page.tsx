import Image from "next/image";
import type { Metadata } from "next";
import { Tweaks } from "./Tweaks";
import "./home.css";

export const metadata: Metadata = {
  title: "Longevity Coach — Live longer, on purpose.",
  description:
    "Seven minutes of honest questions. A clinically-grounded biological age, risk scores across five domains, and a supplement protocol made for you.",
};

export default function Home() {
  return (
    <Tweaks>
      {/* ============ NAV ============ */}
      <nav className="nav">
        <div className="nav-inner">
          <div className="brand">
            <Image
              src="/longevity-coach-logo.png"
              alt=""
              width={34}
              height={34}
            />
            <span className="wordmark">Longevity Coach</span>
          </div>
          <div className="nav-links">
            <a href="#how">How it works</a>
            <a href="#what">What you get</a>
            <a href="#science">Science</a>
            <a href="#founder">Our team</a>
            <a href="#stories">Member stories</a>
          </div>
          <div className="nav-cta">
            <a className="btn btn-ghost" href="#">Sign in</a>
            <a className="btn btn-primary" href="#">Get my bio-age</a>
          </div>
        </div>
      </nav>

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
                supplement protocol made for you — not for everyone.
              </p>
              <div className="ctas">
                <a className="btn btn-primary btn-lg" href="#">Get my bio-age →</a>
                <a className="btn btn-ghost btn-lg" href="#">See a sample report</a>
              </div>
              <div className="mini">
                <span><span className="dot" />&nbsp;&nbsp;No credit card to start</span>
                <span>·</span>
                <span>GMC-registered clinicians</span>
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
                person — you.
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
              <a className="btn btn-primary btn-lg" href="#">Get my bio-age →</a>
              <a className="btn btn-ghost btn-lg" href="#">See a sample report</a>
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
                <span className="url">app.longevity-coach.io / dashboard</span>
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
            <div>Royal College of GPs</div>
            <div>Imperial Longevity Lab</div>
            <div>UK BioBank data</div>
            <div>GMC-registered clinicians</div>
            <div>ISO 27001</div>
          </div>
        </div>
      </div>

      {/* ============ HOW IT WORKS ============ */}
      <section className="how" id="how">
        <div className="wrap">
          <div className="section-head">
            <div>
              <span className="eyebrow">How it works</span>
              <h2>Three steps, <em>one morning.</em></h2>
            </div>
            <div className="intro">
              No blood tests to book, no wearables to buy on day one. You
              answer honest questions, we do the maths, you get a plan you can
              actually follow. If you want deeper panels later, your clinician
              can add them.
            </div>
          </div>

          <div className="steps">
            <div className="step">
              <div className="num">STEP 01 · SEVEN MINUTES</div>
              <h3>Tell us about <em>your life.</em></h3>
              <p>
                A plain-English intake: what you eat, how you sleep, how you
                move, who came before you. Save and come back — nothing is
                submitted until you confirm.
              </p>
              <div className="mini-card">
                <span className="k">TYPICAL DURATION</span>
                <span className="v">6m 42s</span>
              </div>
            </div>
            <div className="step">
              <div className="num">STEP 02 · CLINICAL MODELS</div>
              <h3>Your <em>biological age,</em> five domains scored.</h3>
              <p>
                We run your answers through five peer-reviewed risk models —
                cardiovascular, metabolic, neurological, oncological,
                musculoskeletal — and reconcile them into one age.
              </p>
              <div className="mini-card">
                <span className="k">OUTPUT</span>
                <span className="v">1 bio-age · 5 domain scores</span>
              </div>
            </div>
            <div className="step">
              <div className="num">STEP 03 · YOUR PROTOCOL</div>
              <h3>A plan written <em>for one person.</em></h3>
              <p>
                Specific supplements, specific doses, specific timing — with
                the rationale for each. Download as a branded PDF, or take it
                to your GP.
              </p>
              <div className="mini-card">
                <span className="k">DELIVERED AS</span>
                <span className="v">Dashboard + PDF + email</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ WHAT YOU GET ============ */}
      <section className="get" id="what">
        <div className="wrap">
          <div className="section-head">
            <div>
              <span className="eyebrow">What you get</span>
              <h2>Four things, <em>no noise.</em></h2>
            </div>
            <div className="intro">
              We&rsquo;re deliberately small. No gamified streaks. No daily
              push notifications. No supplements we don&rsquo;t believe in.
              Just the four things that matter on day one.
            </div>
          </div>

          <div className="get-grid">
            <div className="feat tall">
              <span className="eyebrow eye on-dark" style={{ color: "rgba(255,255,255,0.75)" }}>01 · BIO-AGE</span>
              <h3>The only number <em>you actually need.</em></h3>
              <p className="sub">
                One figure. Updated every time your data changes. Compared
                honestly against your chronological age — no hype.
              </p>
              <div className="feat-big-n">34.8<span className="u">yrs</span></div>
            </div>

            <div className="feat warm">
              <span className="eyebrow eye" style={{ color: "var(--accent-600)" }}>02 · RISK SCORES</span>
              <h3>Five domains, <em>measured.</em></h3>
              <p className="sub">
                Cardiovascular, metabolic, neurological, oncological,
                musculoskeletal — low, moderate, or high, with what&rsquo;s
                driving each.
              </p>
              <div className="proof">
                <span className="k">YOUR MODERATE DOMAINS</span>
                Metabolic · Musculoskeletal
              </div>
            </div>

            <div className="feat plum">
              <span className="eyebrow eye" style={{ color: "var(--lc-plum-700)" }}>03 · SUPPLEMENTS</span>
              <h3>A protocol, <em>not a pile.</em></h3>
              <p className="sub">
                3–7 supplements, specific doses, specific times — and the
                reason each one is on your list.
              </p>
              <div className="proof">
                <span className="k">NINA&rsquo;S PROTOCOL · 4 ITEMS</span>
                Ω-3 EPA/DHA · D3+K2 · Mg glycinate · Creatine
              </div>
            </div>

            <div className="feat dark">
              <span className="eyebrow eye on-dark">04 · A BRANDED PDF</span>
              <h3>Something you can <em>show your GP.</em></h3>
              <p className="sub">
                Every report is exported as a clean, clinician-ready PDF —
                your bio-age, risk domains, protocol and the methodology
                behind each number.
              </p>
              <div className="pdf-mock">
                <div className="t">Longevity Report · Nina Okafor</div>
                <div className="l">APR 2026 · 12 PAGES</div>
                <div className="bars"><span /><span /><span /></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ SCIENCE ============ */}
      <section className="science" id="science">
        <div className="wrap">
          <div className="section-head">
            <div>
              <span className="eyebrow">Science &amp; methodology</span>
              <h2>Conservative models, <em>open about their edges.</em></h2>
            </div>
            <div className="intro">
              Longevity is a field with real signal and real hype. We only use
              scoring methods that have been replicated in large cohort
              studies, and we tell you where each score is uncertain.
            </div>
          </div>

          <div className="sci-grid">
            <div className="sci-art">
              <svg viewBox="0 0 400 320" preserveAspectRatio="xMidYMid meet" style={{ width: "100%", height: "100%" }}>
                <g transform="translate(200,160)">
                  <g fill="none" stroke="#E3E8EC" strokeWidth="1">
                    <polygon points="0,-120 114,-37 70,97 -70,97 -114,-37" />
                    <polygon points="0,-90 86,-28 53,73 -53,73 -86,-28" />
                    <polygon points="0,-60 57,-19 35,48 -35,48 -57,-19" />
                    <polygon points="0,-30 29,-10 18,24 -18,24 -29,-10" />
                  </g>
                  <g stroke="#E3E8EC" strokeWidth="1">
                    <line x1="0" y1="0" x2="0" y2="-120" />
                    <line x1="0" y1="0" x2="114" y2="-37" />
                    <line x1="0" y1="0" x2="70" y2="97" />
                    <line x1="0" y1="0" x2="-70" y2="97" />
                    <line x1="0" y1="0" x2="-114" y2="-37" />
                  </g>
                  <polygon points="0,-90 86,-28 42,58 -42,58 -63,-21" fill="#2F6F8F" fillOpacity="0.12" stroke="#2F6F8F" strokeWidth="1.75" />
                  <g fill="#2F6F8F">
                    <circle cx="0" cy="-90" r="4" />
                    <circle cx="86" cy="-28" r="4" />
                    <circle cx="42" cy="58" r="4" />
                    <circle cx="-42" cy="58" r="4" />
                    <circle cx="-63" cy="-21" r="4" />
                  </g>
                  <g fontFamily="var(--lc-mono)" fontSize="10" fill="#8A9AA5" letterSpacing="0.08em">
                    <text x="0" y="-132" textAnchor="middle">CV</text>
                    <text x="126" y="-38" textAnchor="start">METAB</text>
                    <text x="78" y="112" textAnchor="start">NEURO</text>
                    <text x="-78" y="112" textAnchor="end">ONCO</text>
                    <text x="-126" y="-38" textAnchor="end">MSK</text>
                  </g>
                </g>
              </svg>
              <div className="sci-caption">
                <span>FIG 01 · FIVE-DOMAIN RADAR</span>
                <span>SAMPLE · NINA O. · APR 2026</span>
              </div>
            </div>

            <div className="sci-list">
              <div className="sci-item">
                <div className="n">01 /</div>
                <div>
                  <h4>Based on <em>replicated</em> cohort data.</h4>
                  <p>
                    We combine established risk engines — QRISK3 for CV,
                    FINDRISC for metabolic, and peer-reviewed equivalents for
                    the other three domains — rather than a single black-box
                    algorithm.
                  </p>
                </div>
              </div>
              <div className="sci-item">
                <div className="n">02 /</div>
                <div>
                  <h4>Every score carries a <em>confidence interval.</em></h4>
                  <p>
                    When we don&rsquo;t have enough input to be confident, we
                    tell you — and we ask for the specific data point that
                    would sharpen the number.
                  </p>
                </div>
              </div>
              <div className="sci-item">
                <div className="n">03 /</div>
                <div>
                  <h4>We never pretend <em>a questionnaire is a lab.</em></h4>
                  <p>
                    When a biomarker would genuinely change your plan,
                    we&rsquo;ll say so — and connect you to a partner lab
                    rather than guess.
                  </p>
                </div>
              </div>
              <div className="sci-item">
                <div className="n">04 /</div>
                <div>
                  <h4>Your data is <em>separated from your identity.</em></h4>
                  <p>
                    Identifiers are encrypted at rest and never exposed to our
                    AI layer. Health data is linked by UUID. Even our own
                    engineers can&rsquo;t read your records without your key.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ FOUNDER ============ */}
      <section className="founder" id="founder">
        <div className="wrap">
          <div className="section-head">
            <div>
              <span className="eyebrow">Our team</span>
              <h2>Built by clinicians, <em>not marketers.</em></h2>
            </div>
            <div className="intro">
              Longevity Coach is a small team of GPs, data scientists and
              designers. We see patients in the morning and ship product in
              the afternoon.
            </div>
          </div>

          <div className="founder-grid">
            <div className="founder-portrait">
              <span className="tag">LEAD CLINICIAN · SINCE 2024</span>
            </div>
            <div>
              <blockquote className="founder-quote">
                &ldquo;I spent fifteen years telling patients to lose weight
                and sleep better. Longevity Coach is what happens when you
                give that advice the <em>specificity</em> it deserves — for
                one person, not the average patient.&rdquo;
              </blockquote>
              <div className="founder-attribution">
                <div>
                  <strong>Dr. Amara Mendes</strong>
                  <span className="small">LEAD CLINICIAN · MBBS, MRCGP</span>
                </div>
                <div>
                  <strong>James Murray</strong>
                  <span className="small">FOUNDER · EX-BUPA, WORK HEALTHY</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ TESTIMONIALS ============ */}
      <section className="testi" id="stories">
        <div className="wrap">
          <div className="section-head">
            <div>
              <span className="eyebrow">Member stories</span>
              <h2>Small changes, <em>compounded.</em></h2>
            </div>
            <div className="intro">
              We don&rsquo;t collect five-star reviews. We collect ninety-day
              deltas. Here are three members who let us share theirs.
            </div>
          </div>

          <div className="testi-grid">
            <div className="testi-card">
              <p className="q">
                &ldquo;I thought I was in decent shape. Turns out my metabolic
                score was quietly creeping up.{" "}
                <em>Three supplements and one habit later,</em> it&rsquo;s
                back in the low band.&rdquo;
              </p>
              <div className="attr">
                <div className="avi">NO</div>
                <div>
                  <div className="name">Nina Okafor</div>
                  <div className="role">Architect · London · 38</div>
                </div>
                <div className="delta"><span className="k">BIO-AGE</span>−3.2 yrs</div>
              </div>
            </div>
            <div className="testi-card">
              <p className="q">
                &ldquo;The PDF was the thing. I walked into my GP with it and
                we skipped <em>twenty minutes of small talk.</em> She changed
                one thing on the spot.&rdquo;
              </p>
              <div className="attr">
                <div className="avi">DK</div>
                <div>
                  <div className="name">Daniel Kemal</div>
                  <div className="role">Founder · Dubai · 44</div>
                </div>
                <div className="delta"><span className="k">BIO-AGE</span>−1.8 yrs</div>
              </div>
            </div>
            <div className="testi-card">
              <p className="q">
                &ldquo;No streaks, no guilt notifications, no 40-page
                &lsquo;optimisation protocol&rsquo;. Four supplements and a
                weekly check-in. <em>That&rsquo;s it.</em> That&rsquo;s why I
                stayed.&rdquo;
              </p>
              <div className="attr">
                <div className="avi">PH</div>
                <div>
                  <div className="name">Priya Hartwell</div>
                  <div className="role">Pediatrician · Hanoi · 41</div>
                </div>
                <div className="delta"><span className="k">BIO-AGE</span>−2.4 yrs</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ CTA ============ */}
      <section className="cta-final">
        <div className="wrap">
          <div>
            <h2>Seven minutes <em>from now,</em> you&rsquo;ll know your bio-age.</h2>
            <p>
              No credit card to start. No appointment to book. No lab visit
              required. Just a questionnaire, honest answers, and a plan
              written for one person.
            </p>
            <div className="ctas">
              <a className="btn btn-accent btn-lg" href="#">Get my bio-age →</a>
              <a className="btn btn-ghost btn-lg" href="#" style={{ color: "#fff" }}>See a sample report</a>
            </div>
          </div>
          <div className="points">
            <div className="p">
              <span className="n">01</span>
              <span>Your data is encrypted at rest and never shared with advertisers or insurers. Ever.</span>
            </div>
            <div className="p">
              <span className="n">02</span>
              <span>Cancel your membership in one click. Your data is yours — export it or delete it anytime.</span>
            </div>
            <div className="p">
              <span className="n">03</span>
              <span>If you&rsquo;re not happier with the service after 30 days, we refund the month. No questions.</span>
            </div>
          </div>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="foot">
        <div className="wrap">
          <div className="brand-f">
            <Image
              src="/longevity-coach-logo.png"
              alt=""
              width={28}
              height={28}
            />
            <span className="wordmark">Longevity Coach</span>
          </div>
          <div className="links">
            <a href="#">Privacy</a>
            <a href="#">Terms</a>
            <a href="#">Clinical governance</a>
            <a href="#">Contact</a>
          </div>
          <div>© 2026 · LONGEVITY COACH LTD</div>
        </div>
      </footer>
    </Tweaks>
  );
}
