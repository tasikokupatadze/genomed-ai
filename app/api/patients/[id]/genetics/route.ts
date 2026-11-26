import { updatePatient } from "@/lib/store";
import { bad, body, str } from "@/lib/http";

// Extra route (not in the brief's list): add a PGx result or a BRCA1 variant.
export async function POST(req: Request, ctx: RouteContext<"/api/patients/[id]/genetics">) {
  const { id } = await ctx.params;
  const b = await body(req);
  if (b.type === "pgx") {
    const r = { gene: str(b.gene, 30), result: str(b.result, 100) };
    if (!r.gene || !r.result) return bad("gene and result are required");
    const p = updatePatient(id, (p) => { p.genetics.pgx.push(r); });
    return p ? Response.json(p, { status: 201 }) : bad("Patient not found", 404);
  }
  if (b.type === "variant") {
    const v = { gene: "BRCA1", hgvs_c: str(b.hgvs_c, 100) };
    if (!v.hgvs_c) return bad("hgvs_c is required");
    const p = updatePatient(id, (p) => { p.genetics.variants.push(v); });
    return p ? Response.json(p, { status: 201 }) : bad("Patient not found", 404);
  }
  return bad('type must be "pgx" or "variant"');
}
