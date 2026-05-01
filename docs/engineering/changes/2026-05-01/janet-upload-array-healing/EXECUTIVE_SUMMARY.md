# Executive Summary: Janet upload fix for pathology reports with historical results
Date: 2026-05-01
Audience: James Murray (Product Owner), Clinical advisor

## What was delivered

When patients upload a pathology PDF that contains both their current results and previous results in the same document — a very common format in Australian lab reports, where pathologists print a trend table alongside the latest panel — Janet was failing to read it. The patient saw "Analysis failed" on the Documents page and none of their lab data made it into the Labs view.

This fix teaches Janet to handle multi-panel reports correctly. She now recognises that one document can carry multiple test dates and folds every result into the same upload, with each individual measurement tagged with the date it was actually taken. Patients no longer need to crop or trim their pathology PDFs; they can upload exactly what their GP or lab gave them and Janet will preserve the full history.

The first patient affected is Tracy, who hit this error this morning. Once she re-uploads her document, all of her current and historical results will land in her record on their correct dates and feed into her risk profile and biological-age calculation.

## What phase this advances

Phase 2 — Intelligence. The upload pipeline is the on-ramp for biomarker data, and biomarker data is the input the risk engine and supplement protocol both depend on. Removing this failure class makes the upload flow trustworthy for clinical pilot users, which is a precondition for the practitioner channel work later in Phase 2.

No epic moves to "complete" on this single fix, but it removes a known blocker that was causing patient-visible errors on real uploads.

## What comes next

Two follow-ups, neither blocking:

1. **Notify Tracy** that she can re-upload her document and the analysis will now succeed. Going forward, anyone who hits the same error in the past can be told the same thing — the fix is automatic for new uploads but does not retroactively re-process failed ones in the database.

2. **Consider a one-off "retry failed uploads" job** if the volume of historical failures grows. Today there is one known case (Tracy) — manual re-upload is cheaper than a backfill script. If we discover more failures during the clinician pilot, we revisit.

## Risks or open items

None requiring a decision. The fix is a strict superset of the previous behaviour — single-result documents continue to work exactly as before. Worst case for an unusual response shape we have not seen yet, the patient sees the same "Analysis failed" message they would have seen previously, with no additional regression.
