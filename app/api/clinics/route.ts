import { getEhrConnector } from "@/lib/ehr";

export async function GET() {
  return Response.json({ clinics: await getEhrConnector().listClinics(), simulated: true });
}
