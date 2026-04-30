# Executive Summary: Check-in → Atlas Trigger
Date: 2026-04-28
Audience: Product owner, clinical advisor

## What was delivered
Each time a member saves their daily check-in, the platform now automatically kicks off a
background refresh of their health risk assessment. This happens invisibly in the background
and does not slow down the check-in experience. The next time the member opens their
dashboard or report, their risk scores and narrative will reflect the latest available data.

## What phase this advances
Phase 2 — Intelligence. The daily check-in was previously a standalone data-collection
feature with no downstream effect. It now feeds into the risk intelligence loop, completing
the pipeline chain: questionnaire → check-in → Atlas risk narrative → dashboard.

## What comes next
Atlas currently scores from questionnaire responses and uploaded documents. The next
meaningful upgrade is to have Atlas also incorporate daily check-in trends — for example,
flagging sustained low energy or poor sleep as a risk signal. That work belongs in a later
phase and requires a product decision on which daily metrics to weight.

## Risks or open items
- **Token cost:** Every check-in re-runs the Atlas LLM pipeline. For members who edit their
  log multiple times in a day this may trigger two or three runs. Each run is inexpensive,
  but this should be revisited if usage scales significantly. Throttling to once-per-day is
  a low-effort follow-up.
- **No new data in Atlas yet:** Daily check-in data is not yet read by Atlas. Members will
  see their risk scores refresh, but the refresh will produce the same result as the previous
  run unless they have also uploaded new documents. This is expected behaviour for this phase.
