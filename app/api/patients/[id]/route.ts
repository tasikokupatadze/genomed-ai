import { getPatient } from "@/lib/store";
import { bad } from "@/lib/http";

export async function GET(_req: Request, ctx: RouteContext<"/api/patients/[id]">) {
  const { id } = await ctx.params;
  const p = getPatient(id);
  return p ? Response.json(p) : bad("Patient not found", 404);
}
