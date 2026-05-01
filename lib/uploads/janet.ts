import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

// ─── Zod schemas (source of truth for runtime types) ─────────────────────

// .catch() on every field means a wrong value becomes a safe default instead
// of rejecting the entire parse. Critical for enums and coerced numbers.
const BiomarkerExtractionSchema = z.object({
  biomarker: z.string().catch(""),
  value: z.coerce.number().catch(0),
  unit: z.string().catch(""),
  reference_min: z.coerce.number().nullable().catch(null),
  reference_max: z.coerce.number().nullable().catch(null),
  test_date: z.string().nullable().catch(null).optional(),
  panel_name: z.string().nullable().catch(null).optional(),
  lab_provider: z.string().nullable().catch(null).optional(),
});

const JanetResultSchema = z.object({
  category: z
    .enum(["blood_work", "imaging", "genetic", "microbiome", "metabolic", "other"])
    .catch("other"),
  summary: z.string().catch(""),
  findings: z
    .object({
      document_type: z.string().catch(""),
      key_values: z.record(z.string(), z.string()).optional().catch(undefined),
      notable_findings: z.array(z.string()).optional().catch(undefined),
      date_of_test: z.string().nullable().catch(null).optional(),
      ordering_provider: z.string().nullable().catch(null).optional(),
      biomarkers: z.array(BiomarkerExtractionSchema).optional().catch(undefined),
    })
    .catch({ document_type: "" }),
});

// ─── Exported types (derived from schema, not hand-written interfaces) ────

export type JanetCategory =
  | "blood_work"
  | "imaging"
  | "genetic"
  | "microbiome"
  | "metabolic"
  | "other";

export type BiomarkerExtraction = z.infer<typeof BiomarkerExtractionSchema>;
export type JanetResult = z.infer<typeof JanetResultSchema>;

// ─── System prompt ────────────────────────────────────────────────────────

export const SYSTEM_PROMPT = `You are Janet, an AI clinical analyst for a longevity coaching platform.
Your role is to read medical documents and pathology reports uploaded by patients and extract structured information.

For each document you must:
1. Identify the document category from this exact list: blood_work, imaging, genetic, microbiome, metabolic, other
2. Write a concise one-to-two sentence plain-English summary for the patient
3. Extract key structured findings

Category definitions:
- blood_work: Full blood count, lipid panel, HbA1c, liver function, kidney function, thyroid, vitamins, hormones
- imaging: MRI, CT, X-ray, DEXA scan, ultrasound, PET scan
- genetic: 23andMe, AncestryDNA, whole-genome sequencing, BRCA, pharmacogenomics
- microbiome: Gut microbiome analysis, Viome, uBiome, stool tests
- metabolic: VO2 max, metabolic rate, continuous glucose monitoring, DEXA body composition
- other: Anything that does not fit the above categories

Always respond with valid JSON matching this exact shape:
{
  "category": "<one of the six categories>",
  "summary": "<one or two sentences for the patient>",
  "findings": {
    "document_type": "<specific type, e.g. Lipid Panel, Lumbar MRI>",
    "key_values": { "<name>": "<value with unit>" },
    "notable_findings": ["<finding 1>", "<finding 2>"],
    "date_of_test": "<ISO date or null>",
    "ordering_provider": "<name or null>",
    "biomarkers": [
      {
        "biomarker": "<verbatim name>",
        "value": <number>,
        "unit": "<verbatim unit>",
        "reference_min": <number or null>,
        "reference_max": <number or null>,
        "test_date": "<ISO YYYY-MM-DD or null>",
        "panel_name": "<panel name or null>",
        "lab_provider": "<lab company or null>"
      }
    ]
  }
}

When category is "blood_work", also extract one biomarkers array entry per measured biomarker. Use the document's exact biomarker name and unit. Pull reference_min and reference_max from the lab's reference range when shown; use null for either bound if the document does not show it. Do NOT compute or interpret status (high / low / critical) — that is computed server-side.

When category is not "blood_work", omit the biomarkers array entirely.

IMPORTANT: Always respond with exactly ONE JSON object at the top level. Never return an array. If the document contains multiple test dates (e.g. a pathology report showing current results alongside previous panels in a trend table), represent every result as a separate entry in the single \`biomarkers\` array, each carrying its own \`test_date\`. Do not split the response into multiple top-level objects.

Do not include any text outside the JSON object. Do not wrap in markdown code blocks.`;

// ─── JSON extraction helpers ──────────────────────────────────────────────

/** Try every extraction strategy to get a JSON value from arbitrary text. */
function extractJson(text: string): unknown {
  try { return JSON.parse(text.trim()); } catch {}

  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try { return JSON.parse(fenceMatch[1].trim()); } catch {}
  }

  for (const [open, close] of [["{", "}"], ["[", "]"]] as const) {
    const start = text.indexOf(open);
    const end = text.lastIndexOf(close);
    if (start !== -1 && end > start) {
      try { return JSON.parse(text.slice(start, end + 1)); } catch {}
    }
  }

  return null;
}

/** Extract the text content from an Anthropic message, skipping thinking blocks. */
function extractTextFromMessage(message: Anthropic.Message): string {
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

/**
 * Heal an Anthropic response that came back as a top-level array (one entry per
 * test date) into a single JanetResult-shaped object. Single-object responses
 * pass through untouched.
 */
export function healJanetJson(json: unknown): unknown {
  if (!Array.isArray(json)) return json;

  if (json.length === 0) {
    throw new Error("janet: response was an empty array — no usable data");
  }

  if (json.length === 1) return json[0];

  type EntryShape = {
    category?: unknown;
    summary?: unknown;
    findings?: { date_of_test?: unknown; biomarkers?: unknown } & Record<string, unknown>;
  };

  const entries = json as EntryShape[];

  // findings.date_of_test is an ISO YYYY-MM-DD string per the schema, so
  // localeCompare gives correct chronological order; missing dates sink to bottom.
  const sorted = [...entries].sort((a, b) => {
    const da = typeof a?.findings?.date_of_test === "string" ? a.findings!.date_of_test as string : "";
    const db = typeof b?.findings?.date_of_test === "string" ? b.findings!.date_of_test as string : "";
    if (!da && !db) return 0;
    if (!da) return 1;
    if (!db) return -1;
    return db.localeCompare(da);
  });

  const canonical = sorted[0];

  const allBiomarkers = entries.flatMap((entry) => {
    const bm = entry?.findings?.biomarkers;
    return Array.isArray(bm) ? bm : [];
  });

  return {
    category: canonical?.category,
    summary: canonical?.summary,
    findings: {
      ...(canonical?.findings ?? {}),
      biomarkers: allBiomarkers,
    },
  };
}

/** Parse raw model text into a validated JanetResult. Throws if no JSON is extractable. */
export function parseJanetResult(rawText: string): JanetResult {
  const json = extractJson(rawText);
  if (json === null) {
    throw new Error(`janet: no JSON extractable from response (preview: ${rawText.slice(0, 200)})`);
  }
  const healed = healJanetJson(json);
  // safeParse is used so .catch() fallbacks apply field-by-field rather than hard-throwing
  const parsed = JanetResultSchema.safeParse(healed);
  if (!parsed.success) {
    // Should never reach here given .catch() on every field, but surface it if it does
    throw new Error(`janet: Zod parse failed: ${parsed.error.message.slice(0, 300)}`);
  }
  return parsed.data;
}

// ─── Client ───────────────────────────────────────────────────────────────

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) _client = new Anthropic();
  return _client;
}

// ─── analyzeUpload ────────────────────────────────────────────────────────

/**
 * Send a patient-uploaded document to Janet for structured analysis.
 *
 * Retry strategy:
 *   Attempt 1 — normal call with adaptive thinking
 *     ↳ On failure: try extractJson on whatever raw text was returned (no extra API call)
 *   Attempt 2 — retry with thinking disabled, explicit JSON reminder in the user turn
 *     ↳ On failure: try extractJson on raw text before giving up
 *
 * Only infrastructure failures (auth, network, timeout) escape both attempts.
 */
export async function analyzeUpload(
  fileBuffer: ArrayBuffer,
  mimeType: string,
  filename: string,
): Promise<JanetResult> {
  const base64 = Buffer.from(fileBuffer).toString("base64");

  const contentBlock =
    mimeType === "application/pdf"
      ? ({
          type: "document" as const,
          source: { type: "base64" as const, media_type: "application/pdf" as const, data: base64 },
          title: filename,
        })
      : ({
          type: "image" as const,
          source: {
            type: "base64" as const,
            media_type: mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
            data: base64,
          },
        });

  let lastRawText: string | undefined;
  let lastErr: unknown;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const userText =
        attempt === 1
          ? `Analyse this medical document (filename: ${filename}) and respond with structured JSON only.`
          : `Analyse this medical document (filename: ${filename}) and respond with structured JSON only.\n\nCRITICAL: Return ONLY a valid JSON object. No markdown, no code fences, no explanation — just the JSON object starting with { and ending with }.`;

      const message = await getClient().messages.create({
        model: "claude-opus-4-7",
        max_tokens: 2048,
        // Disable thinking on retry — reduces chance of model generating non-JSON preamble
        thinking: attempt === 1 ? { type: "adaptive" } : { type: "disabled" as never },
        system: [
          {
            type: "text",
            text: SYSTEM_PROMPT,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [
          {
            role: "user",
            content: [contentBlock, { type: "text", text: userText }],
          },
        ],
      });

      lastRawText = extractTextFromMessage(message);
      return parseJanetResult(lastRawText);

    } catch (err) {
      lastErr = err;

      // Before spending a second LLM call, try extracting JSON from whatever
      // raw text the model produced (e.g. valid JSON wrapped in markdown fences)
      if (lastRawText && attempt < 2) {
        try {
          const healed = parseJanetResult(lastRawText);
          console.warn(JSON.stringify({ event: "janet_upload_healed_from_raw", attempt, filename }));
          return healed;
        } catch {
          // healing failed — fall through to retry
        }
      }

      console.warn(JSON.stringify({
        event: "janet_upload_parse_failed",
        attempt,
        filename,
        error: err instanceof Error ? err.message : String(err),
        raw_preview: lastRawText?.slice(0, 400),
      }));

      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }
  }

  throw lastErr;
}
