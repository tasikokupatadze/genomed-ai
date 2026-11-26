import { readMedicineBox, ScanError } from "@/lib/scan/vision";
import { withMatches } from "@/lib/scan/drugList";
import { bad } from "@/lib/http";

export const maxDuration = 60;
const TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const MAX_BYTES = 5 * 1024 * 1024;

// Privacy: the photo is processed in memory and never written to disk or logged.
// This route takes no patient name or ID, so none can be sent to the LLM.
export async function POST(req: Request) {
  let form: FormData;
  try { form = await req.formData(); } catch { return bad("Send the photo as multipart form data (field: image)"); }
  const file = form.get("image");
  if (!(file instanceof File)) return bad("image is required");
  if (!TYPES.includes(file.type as (typeof TYPES)[number])) return bad("Use a JPEG, PNG or WebP photo");
  if (file.size > MAX_BYTES) return bad("Photo is too large (max 5 MB)");

  try {
    const result = await readMedicineBox(Buffer.from(await file.arrayBuffer()), file.type as (typeof TYPES)[number]);
    const ingredients = withMatches(result.active_ingredients.map((i) => ({ name: i.name ?? "", strength: i.strength, unit: i.unit })));
    return Response.json({ result, ingredients });
  } catch (e) {
    if (e instanceof ScanError) {
      const status = e.code === "not_configured" ? 503 : e.code === "rate_limited" ? 429 : 422;
      return Response.json({ error: e.message, code: e.code }, { status });
    }
    return Response.json({ error: "Scan failed", code: "failed" }, { status: 500 });
  }
}
