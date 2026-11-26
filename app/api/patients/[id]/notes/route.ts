import { updatePatient, getPatient } from "@/lib/store";
import { bad, body, str } from "@/lib/http";
import type { Patient } from "@/lib/types";

const importedItems = (p: Patient) => [
  ...p.labs, ...p.medications, ...p.allergies, ...(p.clinic_conditions ?? []), ...(p.procedures ?? []),
].filter((x) => x.provenance && x.id);

// Patients cannot edit imported clinic records, but they can attach a note to one.
export async function POST(req: Request, ctx: RouteContext<"/api/patients/[id]/notes">) {
  const { id } = await ctx.params;
  const b = await body(req);
  const itemId = str(b.item_id, 200);
  const note = str(b.note, 500);
  const p = getPatient(id);
  if (!p) return bad("Patient not found", 404);
  if (!importedItems(p).some((x) => x.id === itemId)) return bad("Notes can only be added to imported clinic records", 404);
  const patient = updatePatient(id, (x) => {
    const item = importedItems(x).find((y) => y.id === itemId)!;
    if (note) item.patient_note = note; else delete item.patient_note;
  });
  return Response.json({ patient });
}
