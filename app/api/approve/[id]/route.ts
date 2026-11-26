import { getPatient, updatePatient } from "@/lib/store";
import { approvedTrends, buildLlmInput, medicationNotes, runChecks } from "@/lib/analyze";
import { checkOutput } from "@/lib/checkOutput";
import { bad, body, str } from "@/lib/http";
import type { Lang } from "@/lib/types";

export async function POST(req: Request, ctx: RouteContext<"/api/approve/[id]">) {
  const { id } = await ctx.params;
  const p = getPatient(id);
  if (!p) return bad("Patient not found", 404);
  const b = await body(req);
  const lang: Lang = b.lang === "ka" ? "ka" : "en";
  const patient_summary = str(b.patient_summary, 3000);
  const patient_questions = (Array.isArray(b.patient_questions) ? b.patient_questions : [])
    .map((q) => str(q, 300)).filter(Boolean);
  if (!patient_summary) return bad("patient_summary is required");

  // Medication notes are rebuilt from the tables, never taken from the request.
  const findings = runChecks(p);
  const medication_notes = medicationNotes(findings, lang);

  // The edited text must still pass the patient-text rules.
  const check = checkOutput({ patient_summary, patient_questions, medication_notes }, buildLlmInput(p, findings, lang), lang);
  if (!check.ok) return Response.json({ error: "Text breaks the patient-text rules", check_output: check }, { status: 422 });

  // Charts are saved as they are now; later lab or medication edits do not reach the patient until re-approved.
  const trends = approvedTrends(p, findings, lang);
  const approved = { lang, patient_summary, patient_questions, medication_notes, trends, approved_at: new Date().toISOString() };
  updatePatient(id, (p) => { p.approved = { ...p.approved, [lang]: approved }; });
  return Response.json({ approved, check_output: check });
}
