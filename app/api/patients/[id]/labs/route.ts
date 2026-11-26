import { updatePatient } from "@/lib/store";
import { bad, body, isoDate, num, str } from "@/lib/http";

export async function POST(req: Request, ctx: RouteContext<"/api/patients/[id]/labs">) {
  const { id } = await ctx.params;
  const b = await body(req);
  const lab = {
    test: str(b.test), value: num(b.value), unit: str(b.unit, 30),
    ref_low: num(b.ref_low), ref_high: num(b.ref_high), date: isoDate(b.date) ?? "",
  };
  if (!lab.test) return bad("test is required");
  if (!lab.date) return bad("date is required (YYYY-MM-DD)");
  if (![lab.value, lab.ref_low, lab.ref_high].every(Number.isFinite))
    return bad("value, ref_low and ref_high must be numbers (use the range printed on the lab report)");
  if (lab.ref_low > lab.ref_high) return bad("ref_low must not be greater than ref_high");
  const p = updatePatient(id, (p) => { p.labs.push(lab); });
  return p ? Response.json(p, { status: 201 }) : bad("Patient not found", 404);
}
