import { getPatient } from "@/lib/store";
import { whatIf } from "@/lib/research/tables";
import { bad, body, str } from "@/lib/http";

// Doctor asks: what should I watch if this patient starts <drug>? Nothing is saved.
export async function POST(req: Request, ctx: RouteContext<"/api/whatif/[id]">) {
  const { id } = await ctx.params;
  const p = getPatient(id);
  if (!p) return bad("Patient not found", 404);
  const drug = str((await body(req)).drug, 100);
  if (!drug) return bad("drug is required");
  return Response.json(whatIf(p, drug));
}
