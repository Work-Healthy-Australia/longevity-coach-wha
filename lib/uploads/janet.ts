import Anthropic from "@anthropic-ai/sdk";

export type JanetCategory =
  | "blood_work"
  | "imaging"
  | "genetic"
  | "microbiome"
  | "metabolic"
  | "other";

export interface BiomarkerExtraction {
  biomarker: string;
  value: number;
  unit: string;
  reference_min: number | null;
  reference_max: number | null;
  test_date: string | null;
  panel_name: string | null;
  lab_provider: string | null;
}

export interface JanetResult {
  category: JanetCategory;
  summary: string;
  findings: {
    document_type: string;
    key_values?: Record<string, string>;
    notable_findings?: string[];
    date_of_test?: string;
    ordering_provider?: string;
    biomarkers?: BiomarkerExtraction[];
  };
}

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

Do not include any text outside the JSON object. Do not wrap in markdown code blocks.`;

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) _client = new Anthropic();
  return _client;
}

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

  const message = await getClient().messages.create({
    model: "claude-opus-4-7",
    max_tokens: 2048,
    thinking: { type: "adaptive" },
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
        content: [
          contentBlock,
          {
            type: "text",
            text: `Analyse this medical document (filename: ${filename}) and respond with structured JSON only.`,
          },
        ],
      },
    ],
  });

  const text = message.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");

  return JSON.parse(text) as JanetResult;
}
