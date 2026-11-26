import { getPatient } from "@/lib/store";
import { buildLlmInput, medicationNotes, runChecks } from "@/lib/analyze";
import { explain } from "@/lib/explain";
import { bad, body } from "@/lib/http";
import type { Lang } from "@/lib/types";

export const maxDuration = 60;

export async function POST(req: Request, ctx: RouteContext<"/api/analyze/[id]">) {
  const { id } = await ctx.params;
  const p = getPatient(id);
  if (!p) return bad("Patient not found", 404);
  const lang: Lang = (await body(req)).lang === "ka" ? "ka" : "en";

  const findings = runChecks(p);
  const llm_input = buildLlmInput(p, findings, lang);
  const { draft, check, attempts } = await explain(llm_input, lang);

  return Response.json({
    lang,
    findings,
    medication_notes: medicationNotes(findings, lang),
    draft,
    check_output: check,
    attempts,
    llm_input, // shown to the doctor for transparency
  });
}
