import { getEhrConnector } from "@/lib/ehr";
import { log, now, parseCategories } from "@/lib/ehr/sync";
import { getPatient, updatePatient } from "@/lib/store";
import { bad, body, str } from "@/lib/http";
import type { RecordRequest } from "@/lib/types";

// Patient asks for their records from a (simulated) clinic. Nothing is fetched until a doctor approves.
export async function POST(req: Request, ctx: RouteContext<"/api/patients/[id]/record-requests">) {
  const { id } = await ctx.params;
  const b = await body(req);
  const p = getPatient(id);
  if (!p) return bad("Patient not found", 404);
  const clinic = (await getEhrConnector().listClinics()).find((c) => c.id === str(b.clinic_id, 100));
  if (!clinic) return bad("Unknown clinic");
  const categories = parseCategories(b.categories);
  if (!categories.length) return bad("Choose at least one category");
  if (p.record_requests?.some((r) => r.clinic_id === clinic.id && r.status === "pending"))
    return bad("A request to this clinic is already pending", 409);

  const request: RecordRequest = {
    id: `REQ-${Date.now().toString(36).toUpperCase()}`,
    clinic_id: clinic.id, clinic_name: clinic.name, categories, status: "pending", requested_at: now(),
  };
  const patient = updatePatient(id, (x) => {
    x.record_requests = [...(x.record_requests ?? []), request];
    log(x, { actor: "patient", event: "requested", clinic_id: clinic.id, clinic_name: clinic.name, request_id: request.id, categories });
  });
  return Response.json({ request, patient }, { status: 201 });
}
