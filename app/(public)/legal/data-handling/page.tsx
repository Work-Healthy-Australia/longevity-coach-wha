import type { Metadata } from "next";
import Link from "next/link";
import "./data-handling.css";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Data handling · Janet Cares",
  description:
    "How Janet Cares handles your personal and health data — what we do, what we never do, the third-party processors we use, and your rights.",
};

export default function DataHandlingPage() {
  return (
    <main className="lc-data-handling">
      <article>
        <header>
          <p className="lc-data-handling-eyebrow">Data handling commitments</p>
          <h1>How we handle your data</h1>
          <p className="lc-data-handling-meta">Effective 29 April 2026</p>
        </header>

        <section>
          <h2>1. What we do with your data</h2>
          <ul>
            <li>Generate your personalised risk scores and supplement protocol.</li>
            <li>Show your daily check-in trends and lab results back to you.</li>
            <li>
              Let your nominated clinician review and approve your monthly program.
            </li>
            <li>
              Send you transactional email — welcome, password reset, and program-delivery
              messages — via Resend.
            </li>
          </ul>
        </section>

        <section>
          <h2>2. What we never do</h2>
          <ol>
            <li>
              <strong>We never train AI models on your personal data.</strong> Anthropic
              and any other LLM provider receive your data for inference only — never
              for training. We have a Zero Data Retention agreement in place where the
              vendor offers one.
            </li>
            <li>
              <strong>
                We never sell, rent, or share your personal data with third parties
              </strong>{" "}
              other than the named processors listed below.
            </li>
            <li>
              <strong>We never share your data with employers</strong> without your
              explicit written consent. Even when you opt into a corporate plan,
              identifiable data does not flow to your employer — only de-identified,
              aggregated cohort signals.
            </li>
          </ol>
        </section>

        <section>
          <h2>3. Named third-party processors</h2>
          <p>
            We use the following processors to run the service. Each is bound by a written
            data-processing arrangement (DPA) and named here so you have full visibility:
          </p>
          <div className="lc-data-handling-table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Vendor</th>
                  <th scope="col">Purpose</th>
                  <th scope="col">Region</th>
                  <th scope="col">DPA</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Anthropic</td>
                  <td>LLM inference (Claude)</td>
                  <td>US</td>
                  <td>
                    <a
                      href="https://www.anthropic.com/legal/aup"
                      target="_blank"
                      rel="noreferrer"
                    >
                      anthropic.com/legal/aup
                    </a>
                  </td>
                </tr>
                <tr>
                  <td>Resend</td>
                  <td>Transactional email</td>
                  <td>US/EU</td>
                  <td>
                    <a
                      href="https://resend.com/legal/dpa"
                      target="_blank"
                      rel="noreferrer"
                    >
                      resend.com/legal/dpa
                    </a>
                  </td>
                </tr>
                <tr>
                  <td>Stripe</td>
                  <td>Payment processing</td>
                  <td>US</td>
                  <td>
                    <a
                      href="https://stripe.com/au/legal/dpa"
                      target="_blank"
                      rel="noreferrer"
                    >
                      stripe.com/au/legal/dpa
                    </a>
                  </td>
                </tr>
                <tr>
                  <td>Supabase</td>
                  <td>Database, storage, authentication</td>
                  <td>AU (ap-southeast-2)</td>
                  <td>
                    <a
                      href="https://supabase.com/dpa"
                      target="_blank"
                      rel="noreferrer"
                    >
                      supabase.com/dpa
                    </a>
                  </td>
                </tr>
                <tr>
                  <td>Vercel</td>
                  <td>Application hosting</td>
                  <td>Global</td>
                  <td>
                    <a
                      href="https://vercel.com/legal/dpa"
                      target="_blank"
                      rel="noreferrer"
                    >
                      vercel.com/legal/dpa
                    </a>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2>4. Your rights</h2>
          <p>
            You can download a complete export of everything we hold about you at any
            time from your <Link href="/account">Account page</Link>.
          </p>
          <p>
            You can permanently erase your data at any time from your{" "}
            <Link href="/account">Account page</Link>. Your identifiers are removed;
            de-identified clinical observations may be retained per AHPRA records-keeping
            requirements.
          </p>
        </section>

        <p className="lc-data-handling-back">
          <Link href="/">← Back to home</Link>
        </p>
      </article>
    </main>
  );
}
