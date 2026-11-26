import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { checkOutput, type CheckResult } from "./checkOutput";
import type { DraftSummary, Lang } from "./types";

const MODEL = process.env.LLM_MODEL || "claude-opus-5-5";

const nullable = (schema: object) => ({ anyOf: [schema, { type: "null" }] });
const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    clinician_summary: nullable({ type: "array", items: { type: "string" } }),
    patient_summary: nullable({ type: "string" }),
    patient_questions: nullable({ type: "array", items: { type: "string" } }),
    error: nullable({ type: "string" }),
  },
  required: ["clinician_summary", "patient_summary", "patient_questions", "error"],
  additionalProperties: false,
};

const systemPrompt = () => readFileSync(path.join(process.cwd(), "prompts", "system.md"), "utf-8");
const fail = (error: string): DraftSummary => ({
  clinician_summary: null, patient_summary: null, patient_questions: null, error,
});

async function callLlm(input: unknown, problems?: CheckResult["errors"]): Promise<DraftSummary> {
  const client = new Anthropic();
  let content = "INPUT:\n" + JSON.stringify(input, null, 2);
  if (problems?.length) {
    content += "\n\nPROBLEMS in your previous patient text (fix all of them):\n" +
      problems.map((p) => `- ${p.message}: "${p.found}"`).join("\n");
  }
  // Note: current Claude models do not accept `temperature`; the JSON schema and
  // the code checks below keep the output constrained instead.
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    system: systemPrompt(),
    messages: [{ role: "user", content }],
    output_config: { effort: "medium", format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
    // If a safety filter declines (genetics can trigger it), retry on a fallback model in the same call.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
  });

  if (response.stop_reason === "refusal") return fail("The model declined this request.");
  if (response.stop_reason === "max_tokens") return fail("The draft was cut off.");
  // Use the text after the last fallback switch, if any.
  const blocks = response.content;
  let start = 0;
  blocks.forEach((b, i) => { if (b.type === "fallback") start = i + 1; });
  const text = blocks.slice(start).map((b) => (b.type === "text" ? b.text : "")).join("");
  return JSON.parse(text) as DraftSummary;
}

export interface ExplainResult {
  draft: DraftSummary;
  check: CheckResult | null;
  attempts: number;
}

/**
 * Drafts summaries and runs checkOutput. A draft that breaks the patient-text rules
 * is retried once with the problems listed; if it still fails it is withheld
 * (patient fields set to null) so the doctor never sees rule-breaking text.
 */
export async function explain(input: { findings: unknown[] }, lang: Lang): Promise<ExplainResult> {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN)
    return { draft: fail("LLM not configured: set ANTHROPIC_API_KEY on the server."), check: null, attempts: 0 };
  if (!input.findings.length)
    return { draft: fail("No findings to explain."), check: null, attempts: 0 };

  let problems: CheckResult["errors"] | undefined;
  for (let attempt = 1; attempt <= 2; attempt++) {
    let draft: DraftSummary;
    try {
      draft = await callLlm(input, problems);
    } catch (e) {
      if (e instanceof Anthropic.AuthenticationError) return { draft: fail("Invalid ANTHROPIC_API_KEY."), check: null, attempts: attempt };
      if (e instanceof Anthropic.RateLimitError) return { draft: fail("Rate limited. Try again in a minute."), check: null, attempts: attempt };
      if (e instanceof Anthropic.APIError) return { draft: fail(`LLM API error ${e.status ?? ""}: ${e.message}`), check: null, attempts: attempt };
      if (e instanceof SyntaxError) return { draft: fail("The LLM returned invalid JSON."), check: null, attempts: attempt };
      throw e;
    }
    if (draft.error || draft.patient_summary === null) return { draft, check: null, attempts: attempt };

    const check = checkOutput(
      { patient_summary: draft.patient_summary, patient_questions: draft.patient_questions ?? [] },
      input, lang,
    );
    if (check.ok) return { draft, check, attempts: attempt };
    problems = check.errors;
    if (attempt === 2) {
      return {
        draft: { ...draft, patient_summary: null, patient_questions: null, error: "rejected_by_check_output" },
        check, attempts: attempt,
      };
    }
  }
  throw new Error("unreachable");
}
