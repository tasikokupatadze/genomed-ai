import "server-only";
import Anthropic from "@anthropic-ai/sdk";

const MODEL = process.env.LLM_MODEL || "claude-opus-5-5";

export const SCAN_PROMPT = `You read medicine packaging from a photo.
Read only what is printed on the package. If a field is unclear, return null and mark confidence low. Never guess or fill in from general knowledge.
- brand_name: the product name as printed.
- active_ingredients: each active ingredient with its strength and unit exactly as printed (e.g. name "atorvastatin", strength "20", unit "mg"). Do not convert units.
- form: the dosage form as printed (e.g. "tablets", "capsules", "oral solution"), or null.
- confidence: "high" only if the text for that field is clearly readable in the photo.
- unreadable: true if the photo does not show readable medicine packaging.
Text may be in Georgian, English or another language: copy it as printed.`;

const nullableStr = { anyOf: [{ type: "string" }, { type: "null" }] };
const level = { type: "string", enum: ["high", "low"] };
const SCHEMA = {
  type: "object",
  properties: {
    brand_name: nullableStr,
    active_ingredients: {
      type: "array",
      items: {
        type: "object",
        properties: { name: nullableStr, strength: nullableStr, unit: nullableStr },
        required: ["name", "strength", "unit"],
        additionalProperties: false,
      },
    },
    form: nullableStr,
    confidence: {
      type: "object",
      properties: { brand_name: level, active_ingredients: level, form: level },
      required: ["brand_name", "active_ingredients", "form"],
      additionalProperties: false,
    },
    unreadable: { type: "boolean" },
  },
  required: ["brand_name", "active_ingredients", "form", "confidence", "unreadable"],
  additionalProperties: false,
};

export interface ScanResult {
  brand_name: string | null;
  active_ingredients: { name: string | null; strength: string | null; unit: string | null }[];
  form: string | null;
  confidence: { brand_name: "high" | "low"; active_ingredients: "high" | "low"; form: "high" | "low" };
  unreadable: boolean;
}

export class ScanError extends Error {
  constructor(public code: "not_configured" | "refused" | "failed" | "rate_limited", message: string) { super(message); }
}

/** Sends ONLY the image (no patient name or ID). The image is not stored anywhere. */
export async function readMedicineBox(image: Buffer, mediaType: "image/jpeg" | "image/png" | "image/webp"): Promise<ScanResult> {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN)
    throw new ScanError("not_configured", "Scanning is not configured (no ANTHROPIC_API_KEY on the server).");
  const client = new Anthropic();
  let response;
  try {
    response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      system: SCAN_PROMPT,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: image.toString("base64") } },
          { type: "text", text: "Read this medicine package." },
        ],
      }],
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) throw new ScanError("rate_limited", "Too many scans. Try again in a minute.");
    if (e instanceof Anthropic.APIError) throw new ScanError("failed", `Scan failed (${e.status ?? "error"}).`);
    throw e;
  }
  if (response.stop_reason === "refusal") throw new ScanError("refused", "The photo could not be read.");
  if (response.stop_reason === "max_tokens") throw new ScanError("failed", "The scan result was cut off.");
  const blocks = response.content;
  let start = 0;
  blocks.forEach((b, i) => { if (b.type === "fallback") start = i + 1; });
  const text = blocks.slice(start).map((b) => (b.type === "text" ? b.text : "")).join("");
  try {
    return JSON.parse(text) as ScanResult;
  } catch {
    throw new ScanError("failed", "The scan returned an unreadable result.");
  }
}
