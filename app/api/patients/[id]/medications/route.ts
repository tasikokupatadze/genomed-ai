import { getPatient, updatePatient } from "@/lib/store";
import { checkMedicationAgainstAllergies } from "@/lib/checks/allergies";
import { bad, body, str } from "@/lib/http";

export async function POST(req: Request, ctx: RouteContext<"/api/patients/[id]/medications">) {
  const { id } = await ctx.params;
  const b = await body(req);
  const med = { name: str(b.name, 100), dose: str(b.dose, 100) };
  if (!med.name) return bad("name is required");
  const before = getPatient(id);
  if (!before) return bad("Patient not found", 404);
  // Allergy cross-check runs as soon as a medication is added.
  const allergy_findings = checkMedicationAgainstAllergies(med.name, before.allergies);
  const patient = updatePatient(id, (p) => { p.medications.push(med); });
  return Response.json({ patient, allergy_findings }, { status: 201 });
}
