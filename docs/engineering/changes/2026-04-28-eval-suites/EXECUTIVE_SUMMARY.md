# Executive Summary: eval-suites
Date: 2026-04-28
Audience: Product owner, clinical advisor

## What was delivered
The team now has an automated way to check whether Janet and Sage are giving good answers — not just whether the code runs without errors, but whether the actual AI responses meet clinical and coaching quality standards. Five rubrics test Janet (does she use the patient's health data, stay grounded in their supplement protocol, avoid making things up, use the right tone, and remember previous conversations?) and four test Sage (does she produce a complete protocol, use safe language, personalise recommendations, and cite the specific supplements?). A judge AI scores each response and the test run fails if quality drops below the expected level. These evals are run on demand rather than on every code change, to avoid unnecessary API cost.

## What phase this advances
Phase 3 — Janet (Real-time Health Coach). Quality assurance for AI responses is a prerequisite for clinical confidence in the coaching layer. These suites provide a repeatable, auditable quality gate.

## What comes next
- Schedule eval suites to run automatically on a weekly or pre-release cadence via CI.
- Clinical advisor review of rubric wording to ensure they capture clinically meaningful quality signals.
- Add eval coverage for Atlas (risk narrative) once that agent is in active use.

## Risks or open items
- Eval results depend on the judge LLM returning consistent scores. Temperature 0 mitigates variance but does not eliminate it entirely.
- Rubric wording has not yet been reviewed by a clinician — there is a risk that rubrics are too permissive or miss important safety signals.
- Eval scripts require a live Anthropic API key and incur cost on each run; accidental inclusion in CI would add expense.
