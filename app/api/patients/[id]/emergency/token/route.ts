import { randomBytes } from "node:crypto";
import { getPatient, updatePatient } from "@/lib/store";
import { bad, body } from "@/lib/http";

/**
 * "create" / "regenerate": new random link (old QR codes stop working).
 * "disable": page goes offline, link kept so it can be switched back on.
 * "enable": switch the existing link back on.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/patients/[id]/emergency/token">) {
  const { id } = await ctx.params;
  const action = (await body(req)).action;
  const p = getPatient(id);
  if (!p) return bad("Patient not found", 404);
  if (!p.emergency) return bad("Save the emergency card first", 409);
  if (!["create", "regenerate", "disable", "enable"].includes(String(action))) return bad("Unknown action");
  const patient = updatePatient(id, (x) => {
    const e = x.emergency!;
    if (action === "create" || action === "regenerate") { e.token = randomBytes(16).toString("base64url"); e.enabled = true; }
    else if (action === "disable") e.enabled = false;
    else if (action === "enable" && e.token) e.enabled = true;
    e.updated_at = new Date().toISOString();
  });
  return Response.json({ emergency: patient?.emergency });
}
