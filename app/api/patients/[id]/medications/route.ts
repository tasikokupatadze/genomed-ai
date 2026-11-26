import { getPatient, updatePatient } from "@/lib/store";
import { checkMedicationAgainstAllergies } from "@/lib/checks/allergies";
import { bad, body, isoDate, str } from "@/lib/http";

export async function POST(req: Request, ctx: RouteContext<"/api/patients/[id]/medications">) {
  const { id } = await ctx.params;
  const b = await body(req);
  const start_date = isoDate(b.start_date);
  const end_date = b.end_date ? isoDate(b.end_date) : undefined;
  if (!str(b.name, 100)) return bad("name is required");
  if (!start_date) return bad("start_date is required (YYYY-MM-DD)");
  if (end_date === null) return bad("end_date must be YYYY-MM-DD");
  if (end_date && end_date < start_date) return bad("end_date must not be before start_date");
  const med = { name: str(b.name, 100), dose: str(b.dose, 100), start_date, ...(end_date ? { end_date } : {}) };
  const before = getPatient(id);
  if (!before) return bad("Patient not found", 404);
  // Allergy cross-check runs as soon as a medication is added.
  const allergy_findings = checkMedicationAgainstAllergies(med.name, before.allergies);
  const patient = updatePatient(id, (p) => { p.medications.push(med); });
  return Response.json({ patient, allergy_findings }, { status: 201 });
}
