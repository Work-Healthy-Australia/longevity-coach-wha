# Executive Summary: janet-tool-use
Date: 2026-04-28
Audience: Product owner, clinical advisor

## What was delivered
Janet can now call on specialist agents mid-conversation when a patient's question warrants it. When a patient asks about their risk profile, Janet can silently consult Atlas (the risk narrative agent) and weave its analysis into her response. When a patient asks about their supplements, she can consult Sage (the supplement protocol agent) for a focused explanation. From the patient's perspective, Janet simply gives a richer, more grounded answer — the sub-agent calls happen behind the scenes. This implements the Janet sub-agent pattern described in the AI architecture specification.

## What phase this advances
Phase 3 — Janet (Real-time Health Coach). Tool use is a core capability for Janet to deliver clinically grounded answers without performing that analysis herself in real time.

## What comes next
- End-to-end integration test for the full streaming tool-use loop.
- Latency benchmarking — each sub-agent call adds one LLM round-trip. If latency is unacceptable, tool calls can be made conditional on question type.
- PT Coach tool integration, once the PT Coach agent is built (Phase 3).
- Clinical review of the prompts passed to Atlas and Sage to ensure medical language is appropriate.

## Risks or open items
- Sub-agent calls add latency. A conversation turn that triggers both Atlas and Sage will involve three LLM calls (Janet + 2 tools). This is within the architectural limit of one sub-agent layer but may be noticeable to the patient on slow connections.
- The AI SDK `tool()` helper cannot be used due to a TypeScript compatibility issue with Zod v4; tools are constructed as object literals instead. This is a cosmetic deviation with no runtime impact, but should be revisited when the SDK or Zod dependency is updated.
