import { activeConsent, findRequest, log, syncRequest } from "@/lib/ehr/sync";
import { updatePatient } from "@/lib/store";
import { bad } from "@/lib/http";

// A later sync for an approved request. Refused once the patient has revoked access.
export async function POST(_req: Request, ctx: RouteContext<"/api/patients/[id]/record-requests/[reqId]/sync">) {
  const { id, reqId } = await ctx.params;
  const { patient, request } = findRequest(id, reqId);
  if (!patient || !request) return bad("Request not found", 404);
  if (request.status !== "approved") return bad("Only approved requests can sync", 409);
  const consent = activeConsent(patient, request.clinic_id);
  if (!consent) {
    updatePatient(id, (p) => log(p, {
      actor: "system", event: "sync_blocked", clinic_id: request.clinic_id, clinic_name: request.clinic_name, request_id: request.id,
      detail: "Access was revoked by the patient",
    }));
    return bad("The patient has revoked access. A new request is needed.", 403);
  }
  const summary = await syncRequest(id, request, request.approved_categories ?? []);
  return Response.json({ summary });
}
