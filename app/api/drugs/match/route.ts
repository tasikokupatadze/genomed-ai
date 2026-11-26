import { withMatches } from "@/lib/scan/drugList";
import { bad, body } from "@/lib/http";

/** Re-match edited ingredient names against data/drug_list.csv. */
export async function POST(req: Request) {
  const b = await body(req);
  if (!Array.isArray(b.ingredients)) return bad("ingredients must be a list");
  const items = (b.ingredients as unknown[]).slice(0, 10).map((x) => {
    const o = (x ?? {}) as Record<string, unknown>;
    return { name: String(o.name ?? "").slice(0, 100), strength: o.strength ? String(o.strength).slice(0, 20) : null, unit: o.unit ? String(o.unit).slice(0, 20) : null };
  });
  return Response.json({ ingredients: withMatches(items) });
}
