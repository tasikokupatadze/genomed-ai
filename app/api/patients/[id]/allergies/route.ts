import { updatePatient } from "@/lib/store";
import { bad, body, str } from "@/lib/http";

export async function POST(req: Request, ctx: RouteContext<"/api/patients/[id]/allergies">) {
  const { id } = await ctx.params;
  const b = await body(req);
  const allergy = { drug: str(b.drug, 100), reaction: str(b.reaction, 200) };
  if (!allergy.drug) return bad("drug is required");
  const p = updatePatient(id, (p) => { p.allergies.push(allergy); });
  return p ? Response.json(p, { status: 201 }) : bad("Patient not found", 404);
}
