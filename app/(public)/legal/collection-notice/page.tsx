import type { Metadata } from "next";
import Link from "next/link";
import { CONSENT_POLICIES } from "@/lib/consent/policies";
import "../legal.css";

export const metadata: Metadata = {
  title: "Personal information collection notice",
  description:
    "How Janet Cares collects, uses, stores and discloses your personal and health information, in line with the Australian Privacy Principles (APPs).",
  alternates: { canonical: "/legal/collection-notice" },
  openGraph: {
    type: "article",
    url: "/legal/collection-notice",
    title: "Personal information collection notice — Janet Cares",
    description:
      "How Janet Cares collects, uses, stores and discloses your personal and health information under the Australian Privacy Principles.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Collection notice — Janet Cares",
    description:
      "How Janet Cares handles your personal information under the Australian Privacy Principles.",
  },
};

export default function CollectionNoticePage() {
  return (
    <main className="lc-legal">
      <article>
        <header>
          <p className="lc-legal-eyebrow">Australian Privacy Principle 5 notice</p>
          <h1>Personal information collection notice</h1>
          <p className="lc-legal-meta">
            Version {CONSENT_POLICIES.app5_collection_notice.version} · Effective 27 April 2026
          </p>
        </header>

        <section>
          <h2>1. Who collects the information</h2>
          <p>
            Janet Cares is operated by <strong>Work Healthy Australia Pty Ltd</strong>{" "}
            (the &ldquo;Practice&rdquo;), the data controller for the purposes of the
            Australian <em>Privacy Act 1988</em> (Cth) and the Australian Privacy
            Principles (APPs).
          </p>
        </section>

        <section>
          <h2>2. What we collect</h2>
          <ul>
            <li>
              <strong>Identifiers</strong>: full name, date of birth, postal address,
              mobile phone, email address.
            </li>
            <li>
              <strong>Sensitive health information</strong>: medical history, current
              medications, allergies, family history (including causes of death of
              parents and grandparents), lifestyle factors (smoking, alcohol, exercise,
              sleep, diet, stress), height, weight, sex assigned at birth and gender
              identity.
            </li>
            <li>
              <strong>Files you upload</strong>: blood work, imaging reports, genetic
              and microbiome reports, and other pathology you choose to share.
            </li>
            <li>
              <strong>Account &amp; technical data</strong>: hashed password (via
              Supabase Auth), IP address and browser user-agent at the time of consent
              acceptance, billing identifiers (via Stripe).
            </li>
          </ul>
        </section>

        <section>
          <h2>3. Why we collect it (purposes)</h2>
          <ul>
            <li>
              To generate your biological-age estimate, domain risk scores and
              personalised protocols (the core service).
            </li>
            <li>To enable a registered clinician to review and approve recommendations.</li>
            <li>To send transactional email related to your account.</li>
            <li>To meet our record-keeping obligations under AHPRA and the Privacy Act.</li>
          </ul>
        </section>

        <section>
          <h2>4. Who we disclose it to</h2>
          <p>
            We use third-party processors to run the service. Each is bound by a written
            data-processing arrangement and is named here so you have full visibility:
          </p>
          <ul>
            <li>
              <strong>Supabase</strong> (database, authentication, file storage) —
              hosting region: configured AU/EU. Service role keys are server-only.
            </li>
            <li>
              <strong>Anthropic</strong> (the &ldquo;Janet&rdquo; AI that reads your
              uploads and generates narrative) — processed in the United States. See
              <em> APP 8 cross-border disclosure</em> below.
            </li>
            <li>
              <strong>Stripe</strong> (payment processing) — payment card data goes
              direct to Stripe and is not stored on our servers.
            </li>
            <li>
              <strong>Resend</strong> (transactional email).
            </li>
          </ul>
          <p>
            We do <strong>not</strong> sell or rent your information. We do{" "}
            <strong>not</strong> use your data to train third-party AI models.
          </p>
        </section>

        <section>
          <h2>5. APP 8 — cross-border disclosure</h2>
          <p>
            Some processors (notably Anthropic and Resend) process data outside
            Australia. By accepting the consent toggles you acknowledge this. We take
            reasonable steps to ensure overseas recipients comply with the APPs, but
            you should be aware that overseas privacy laws may differ from the
            Privacy Act.
          </p>
        </section>

        <section>
          <h2>6. Consequences of not providing information</h2>
          <p>
            Most of the questionnaire is optional and you may skip questions you don&rsquo;t
            wish to answer; this will reduce the precision of your risk scores. If you
            decline mandatory consents (data processing, the &ldquo;not medical advice&rdquo;
            acknowledgement, or terms of service) we cannot provide the service.
          </p>
        </section>

        <section>
          <h2>7. Access, correction and complaints</h2>
          <p>
            You may request access to or correction of your personal information at any
            time by emailing{" "}
            <a href="mailto:privacy@workhealthyaus.com.au">privacy@workhealthyaus.com.au</a>.
            If you believe we have breached the APPs, please raise a complaint with us
            in the first instance; if unresolved you may complain to the{" "}
            <a
              href="https://www.oaic.gov.au/privacy/privacy-complaints"
              target="_blank"
              rel="noreferrer"
            >
              Office of the Australian Information Commissioner (OAIC)
            </a>
            .
          </p>
        </section>

        <section>
          <h2>8. Retention</h2>
          <p>
            Health records are retained for at least 7 years from the date of last
            service for adults, and until age 25 for records about minors, in line with
            Australian medical-record retention requirements.
          </p>
        </section>

        <p className="lc-legal-back">
          <Link href="/onboarding">← Back to onboarding</Link>
        </p>
      </article>
    </main>
  );
}
