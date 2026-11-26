import { getPatient, updatePatient } from "@/lib/store";
import { bad, body, str } from "@/lib/http";
import type { EmergencyCard } from "@/lib/types";

const list = (v: unknown, max = 10, len = 100) =>
  (Array.isArray(v) ? v : []).map((x) => str(x, len)).filter(Boolean).slice(0, max);

/** Save what the bracelet page shows. Only these fields ever become public. */
export async function POST(req: Request, ctx: RouteContext<"/api/patients/[id]/emergency">) {
  const { id } = await ctx.params;
  const b = await body(req);
  const p = getPatient(id);
  if (!p) return bad("Patient not found", 404);
  const instr = (b.instructions ?? {}) as Record<string, unknown>;
  const card: EmergencyCard = {
    enabled: p.emergency?.enabled ?? false,
    token: p.emergency?.token ?? null,
    short_code: p.emergency?.short_code ?? null,
    display_name: str(b.display_name, 60),
    conditions: list(b.conditions),
    instructions: { en: str(instr.en, 1500) || undefined, ka: str(instr.ka, 1500) || undefined },
    allergies: list(b.allergies),
    medications: list(b.medications),
    contacts: (Array.isArray(b.contacts) ? b.contacts : []).slice(0, 3).map((c: Record<string, unknown>) => ({
      name: str(c?.name, 60), relation: str(c?.relation, 40), phone: str(c?.phone, 30).replace(/[^\d+\s()-]/g, ""),
    })).filter((c) => c.name || c.phone),
    updated_at: new Date().toISOString(),
  };
  if (!card.display_name) return bad("display_name is required");
  const patient = updatePatient(id, (x) => { x.emergency = card; });
  return Response.json({ emergency: patient?.emergency });
}
