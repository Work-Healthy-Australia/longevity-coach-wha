# Data Breach Notification Protocol

**Owner:** James Murray (Privacy Officer / Incident Commander)
**Backup:** Trac Nguyen
**Review cadence:** annually, or after any incident
**Last reviewed:** 2026-04-30

This document is the operational response plan for a suspected or confirmed data breach affecting Longevity Coach members. It is the single source of truth for "what do we do now" when something has gone wrong with patient data.

## Regulatory regime

Longevity Coach handles personal information and health information collected from members in Australia. Three regulatory layers apply:

1. **Privacy Act 1988 (Cth)** — Notifiable Data Breaches (NDB) scheme. Administered by the Office of the Australian Information Commissioner (OAIC). Triggered when there is unauthorised access to, disclosure of, or loss of personal information that is **likely to result in serious harm** to one or more individuals, and we have not been able to prevent the likely risk of serious harm.
2. **AHPRA (Australian Health Practitioner Regulation Agency)** — relevant when the breach involves a registered health practitioner (e.g., a clinician on the platform). AHPRA's notifiable-conduct obligations are about practitioner behaviour rather than data security per se, but a breach involving practitioner credentials, clinical notes, or patient identifiers may also trigger a separate practitioner-side notification by the affected clinician.
3. **State health-records legislation** — particularly *Health Records and Information Privacy Act 2002 (NSW)* (HRIPA) and *Health Records Act 2001 (Vic)* (HRA), which impose state-level obligations parallel to the federal NDB scheme. We default to the strictest applicable standard.

If a member's data is also held in the My Health Record system (not currently the case for Longevity Coach), additional notification under the *My Health Records Act 2012* would apply.

## What counts as a notifiable data breach

A breach is **notifiable** if all three are true:

1. There has been **unauthorised access**, **unauthorised disclosure**, or **loss** of personal information held by Longevity Coach.
2. That access/disclosure/loss is **likely to result in serious harm** to any of the affected individuals.
3. We **cannot prevent** the likely risk of serious harm by remedial action (e.g., remote-wiping a stolen laptop, revoking a leaked token before exfiltration).

"Serious harm" is contextual. For a longevity-and-health platform, examples that meet the bar include:

- Disclosure of a patient's diagnosis, medication, lab result, or risk score to a third party.
- Disclosure of identifying details (name + DOB + email) plus health information sufficient to enable discrimination, blackmail, or insurance/employment impact.
- Bulk loss of `auth.users` rows (email + hashed password), even if hashes appear strong, because of credential-stuffing risk against other services.
- Loss of a clinician's session credentials with read access across multiple patients.

Examples that **may not** meet the bar (still document, still investigate):

- A single member views their own data through an unintended UI path, with no third-party exposure.
- A `console.log` containing one user UUID surfaces in server logs visible only to the engineering team.
- A misconfigured RLS policy is detected by us before any access has occurred.

## Roles

| Role | Person | Responsibilities |
|---|---|---|
| **Incident Commander (IC)** | James | Owns the response. Decides notification, public statement, regulator engagement. |
| **Backup IC** | Trac | Steps in if James is unreachable within 1 hour during business hours / 4 hours overnight. |
| **Technical Lead** | Whoever shipped the affected code, or whoever James designates | Containment, evidence preservation, root cause. |
| **Comms Lead** | James (until we hire) | Member communication, public statement, regulator correspondence. |
| **Clinical Lead** | The senior clinician on the platform at the time | Clinical-impact assessment if the breach involves clinical decisions or care delivery. |

The Incident Commander has decision authority. Disagreements escalate to the IC; the IC is accountable for the call.

## Timeline (target windows)

| Window | What must happen |
|---|---|
| **0–1 hour** | Initial triage. Confirm the report. Contain the bleeding (revoke tokens, disable accounts, take service offline if necessary). Open an incident ticket. Page the IC. |
| **1–24 hours** | Scope assessment. How many members? What data? Is harm likely? Preserve evidence (logs, DB snapshots before any cleanup). |
| **24–72 hours** | Eligible Data Breach assessment complete. Decision: notifiable or not? Document the reasoning regardless of the call. |
| **Within 30 days** | If notifiable: notify the OAIC and affected individuals **as soon as practicable**. The 30-day clock is the regulatory ceiling, not the target — most breaches should notify well inside it. |
| **Day 30+ to closure** | Remediation, post-mortem, control improvements, clinician/member follow-up where required. |

The 30-day clock starts from the moment we have **reasonable grounds to believe** an eligible data breach has occurred. Not from when we were first alerted, not from when we finished investigating — from the point a reasonable person in our position would say "yes, this is probably notifiable."

## The response runbook

### Step 1 — Acknowledge (within 10 minutes of report)

The first person aware of a possible breach acknowledges the report. The person who raised it gets confirmation that it has been received and the IC is being paged.

The IC opens an incident document at `docs/incidents/YYYY-MM-DD-<short-slug>.md` (private repo path; if no such directory exists yet, create it). Every subsequent decision goes in that document with a timestamp.

### Step 2 — Contain (within 1 hour)

Stop the bleeding. The exact actions depend on the breach:

- **Credential leak:** rotate the affected secret in Vercel + Supabase + any third party. Revoke active sessions for impacted users via `auth.admin.signOut`.
- **Public exposure (logs, screenshots, support tickets):** delete from the visible surface, then preserve the original via export before any further cleanup.
- **Stolen device:** trigger remote wipe if MDM is in place. Otherwise revoke the device's active sessions and rotate any keys it had access to.
- **Vulnerable code path:** push a feature-flag kill or hotfix the route to return 503. Do not let the same path serve more requests while you investigate.

Containment must not destroy evidence. **Always export before you delete.** Preserve a Supabase point-in-time snapshot of the relevant tables before scrubbing anything.

### Step 3 — Scope (within 24 hours)

Answer these questions and write the answers in the incident document:

1. What data was exposed? (specific columns / files / fields)
2. How many members are affected? (specific counts; "approximately N" only if the underlying logs are truly imprecise)
3. To whom was it exposed? (a specific third party, the public internet, our own internal team only?)
4. For how long? (window of exposure)
5. What is the realistic harm pathway? (identity theft, embarrassment, discrimination, clinical decision impact, financial loss)
6. Have we already prevented the harm? (e.g., the leaked URL was indexed by no search engine and we revoked the link before any access; that is a strong "prevented" argument)

### Step 4 — Decide notifiable / not (within 72 hours)

The IC convenes a 30-minute decision meeting. Required attendees: IC, Technical Lead, Clinical Lead.

The decision uses the OAIC's reasonable-person test: would a reasonable person in our position conclude that this breach is **likely** to result in **serious harm** to **any** of the affected individuals?

- If **yes** and we cannot prevent that harm → notifiable. Proceed to Step 5.
- If **no** or we have prevented it → not notifiable. Document the reasoning thoroughly in the incident document and end the response.

If the call is genuinely unclear, default to notifying. Over-notification is recoverable; under-notification is a regulatory finding.

### Step 5 — Notify the OAIC (as soon as practicable, within 30 days)

Submit the OAIC Notifiable Data Breach form: <https://www.oaic.gov.au/privacy/notifiable-data-breaches/report-a-data-breach>. The form requires:

- Our identity and contact details.
- A description of the breach.
- The kind(s) of information involved.
- Recommendations for steps individuals should take.

Keep a copy of the submitted form in the incident document.

### Step 6 — Notify affected individuals (in parallel with Step 5)

Email each affected individual directly. The email must be from a real, monitored mailbox (`james@longevity-coach.io` or equivalent), not a no-reply alias. It must include:

1. A description of the breach in plain English. No jargon, no minimisation.
2. The kind(s) of information involved **for that specific individual** (do not use a one-size-fits-all template if the data scopes differ).
3. Concrete steps the individual can take (change passwords, monitor accounts, contact their clinician).
4. What we are doing in response.
5. A contact for questions, with a target response time we can actually meet.

If direct individual notification is not practicable (e.g., we don't have current contact details for some), publish a notice on the website and notify the OAIC about that limitation.

### Step 7 — Notify other regulators where relevant

- **AHPRA**: if the breach involves the conduct of a registered health practitioner on the platform, the practitioner has their own notification obligations under the National Law. We do not file *for* them, but the IC must inform the affected practitioner promptly so they can comply.
- **State privacy regulators**: HRIPA / HRA notifications may apply on top of OAIC. The IC checks with the privacy lawyer (see "External counsel" below) for state-level scope.
- **Stripe / Anthropic / Resend / Supabase / Vercel**: if the breach involves their systems or their access to our data, notify them under the relevant DPA. This is contractual, not regulatory, but ignoring it has commercial consequences.

### Step 8 — Post-mortem and remediation (within 14 days of containment)

- Blameless post-mortem document attached to the incident.
- Root cause identified.
- Concrete control improvements committed to (each with an owner and a target date).
- Update to this protocol if the response surfaced gaps.
- Update to the production-readiness checklist if the breach class wasn't previously covered.

## Mandatory documentation per incident

Every incident gets one document at `docs/incidents/YYYY-MM-DD-<slug>.md` containing:

1. **Discovery** — when, by whom, how
2. **Containment actions** — chronological, with timestamps
3. **Scope** — all six questions from Step 3 with answers
4. **Decision** — notifiable or not, with reasoning
5. **Notifications sent** — OAIC form copy, individual email template, regulator correspondence
6. **Post-mortem** — root cause, control improvements
7. **Closure** — IC sign-off, residual-risk note

These documents are confidential and live in this private repo. They are retained for **at least 7 years** consistent with our health-records retention policy.

## External counsel

Privacy lawyer for breach decisions: **to be retained** before public launch. The IC should have the lawyer's contact details on a card in their wallet.

Cyber insurance broker: **to be retained** before public launch.

Both are listed as a hard blocker in `docs/operations/checklist.md` (production-readiness) once that file is created.

## Drill cadence

The IC runs a tabletop drill every six months using one of these scenarios:

1. A misconfigured RLS policy is reported by an external researcher; one row of `lab_results` was readable across patients for 4 hours.
2. A clinician's session token is leaked via a screenshot in a Slack screen-share; the token had read access to 12 patients' care notes.
3. A Supabase service-role key is found in a public GitHub gist after being accidentally committed, then force-pushed away, then exposed via the Internet Archive.
4. Sentry breadcrumbs from an exception contained a patient's email and DOB; the breadcrumbs were visible in the Sentry UI to anyone on the engineering team for 3 weeks before discovery.

Each drill produces a one-page report tightening the protocol where it broke.

## Quick reference card

If you are reading this *during* an incident:

1. Acknowledge the report. Page James.
2. Contain. Don't delete evidence.
3. Open `docs/incidents/YYYY-MM-DD-<slug>.md` and start logging.
4. Scope (6 questions).
5. Decide notifiable / not within 72 hours.
6. If notifiable: OAIC + individuals **as soon as practicable**, ceiling 30 days.
7. Post-mortem within 14 days of containment.

If in doubt, escalate. There is no penalty for waking the IC. There is a regulatory and reputational penalty for sitting on a breach.
