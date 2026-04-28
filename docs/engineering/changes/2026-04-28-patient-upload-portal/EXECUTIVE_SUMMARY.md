# Executive Summary: Patient Upload Portal
Date: 2026-04-28
Audience: Product owner, clinical advisor

## What was delivered

Members can now upload their previous medical documents — blood tests, MRI and CT
reports, genetic test results, microbiome tests, and metabolic assessments — directly
inside the platform. They can drag and drop multiple files at once or use a standard
file browser. As soon as a file lands, Janet reads it, works out what kind of document
it is, writes a plain-English summary, and stores the key findings. The member sees
live progress for each file individually — "Uploading…" followed by "Janet is reading…"
— and as soon as Janet finishes with one file it appears in their document list even if
other files are still being processed. Members can also delete any file they no longer
want in the system.

The upload portal only becomes available after a member has completed their health
questionnaire, so Janet always has the context she needs to read results meaningfully.
Members who have not yet completed the questionnaire see a clear prompt to do so first.
The member's personal dashboard also shows a summary of how many documents have been
uploaded, with a quick link to upload more or review what is already there.

## What phase this advances

This delivery advances two phases simultaneously:

- **Phase 2 — Intelligence:** Janet's structured extraction of blood work, imaging,
  genetic, microbiome, and metabolic results is the data feed that will power the risk
  engine and personalised supplement protocol. The moment those pipelines are built,
  they will automatically draw on the document findings already stored by Janet.

- **Phase 4 — Clinical Depth:** The upload portal and Janet auto-parser are the core
  infrastructure for lab result ingestion described in Phase 4. The heavy lifting is
  done — what remains is wiring the outputs into longitudinal charts and the risk
  simulator.

## What comes next

The next logical step is to build the two AI pipelines that consume what Janet has
stored:

1. **Risk narrative pipeline (Atlas)** — takes the questionnaire responses and Janet's
   document findings and produces the five-domain risk scores plus a biological age.
   This is the single highest-priority outstanding item.

2. **Supplement protocol pipeline (Sage)** — takes the risk scores and generates the
   personalised 30-day protocol. Janet's document findings improve the specificity of
   these recommendations considerably.

Once both pipelines are live, the in-app report page and downloadable PDF can be wired
in a single session. That completes Phase 2.

No decisions from James are needed before this work can start — the data is in place
and the API key is configured.

## Risks or open items

- **Document size and processing time.** Files up to 50 MB are accepted. Very large
  files (imaging studies, multi-page PDFs) may take 15–30 seconds for Janet to read.
  This is acceptable for the current member volume. If members begin uploading large
  imaging files regularly, the processing should be moved to a background queue so
  they do not have to wait.

- **Janet analysis accuracy.** Janet is excellent at reading structured pathology
  reports but may produce lower-confidence extractions for handwritten notes or
  scanned images taken at an angle. We recommend advising members to upload
  electronic copies where possible and to review Janet's summary for accuracy.
  Any errors in extraction do not affect stored raw findings — the original file
  is always preserved in storage.

- **Supplement pipeline wiring.** The code in place calls the supplement pipeline
  trigger whenever Janet finishes reading a file. This call currently does nothing
  because the pipeline is not yet built — it fails silently with no effect on the
  member. This will activate automatically once the pipeline is delivered.
