import { findRequest, log, now, parseCategories, syncRequest } from "@/lib/ehr/sync";
import { updatePatient } from "@/lib/store";
import { bad, body } from "@/lib/http";

// Doctor approves (possibly fewer categories) or declines a pending request.
export async function POST(req: Request, ctx: RouteContext<"/api/patients/[id]/record-requests/[reqId]/decision">) {
  const { id, reqId } = await ctx.params;
  const b = await body(req);
  const { patient, request } = findRequest(id, reqId);
  if (!patient || !request) return bad("Request not found", 404);
  if (request.status !== "pending") return bad("This request was already decided", 409);

  if (b.decision === "decline") {
    updatePatient(id, (p) => {
      const r = p.record_requests!.find((x) => x.id === reqId)!;
      r.status = "declined"; r.decided_at = now();
      log(p, { actor: "doctor", event: "declined", clinic_id: r.clinic_id, clinic_name: r.clinic_name, request_id: r.id });
    });
    return Response.json({ status: "declined" });
  }
  if (b.decision !== "approve") return bad('decision must be "approve" or "decline"');

  // The doctor may untick categories, but never add ones the patient did not ask for.
  const categories = parseCategories(b.categories).filter((c) => request.categories.includes(c));
  if (!categories.length) return bad("Approve at least one category, or decline");

  updatePatient(id, (p) => {
    const r = p.record_requests!.find((x) => x.id === reqId)!;
    r.status = "approved"; r.decided_at = now(); r.approved_categories = categories;
    p.consents = [
      ...(p.consents ?? []).filter((c) => c.clinic_id !== r.clinic_id),
      { clinic_id: r.clinic_id, clinic_name: r.clinic_name, categories, active: true, granted_at: now() },
    ];
    log(p, { actor: "doctor", event: "approved", clinic_id: r.clinic_id, clinic_name: r.clinic_name, request_id: r.id, categories });
  });
  const summary = await syncRequest(id, request, categories);
  return Response.json({ status: "approved", summary });
}
