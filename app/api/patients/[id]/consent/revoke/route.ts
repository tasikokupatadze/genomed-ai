import { log, now } from "@/lib/ehr/sync";
import { getPatient, updatePatient } from "@/lib/store";
import { bad, body, str } from "@/lib/http";

// Patient stops future syncs. Records already imported stay, labelled with their source.
export async function POST(req: Request, ctx: RouteContext<"/api/patients/[id]/consent/revoke">) {
  const { id } = await ctx.params;
  const clinicId = str((await body(req)).clinic_id, 100);
  const p = getPatient(id);
  if (!p) return bad("Patient not found", 404);
  const c = p.consents?.find((x) => x.clinic_id === clinicId && x.active);
  if (!c) return bad("No active access for this clinic", 404);
  const patient = updatePatient(id, (x) => {
    const cc = x.consents!.find((y) => y.clinic_id === clinicId && y.active)!;
    cc.active = false; cc.revoked_at = now();
    log(x, { actor: "patient", event: "revoked", clinic_id: cc.clinic_id, clinic_name: cc.clinic_name });
  });
  return Response.json({ patient });
}
