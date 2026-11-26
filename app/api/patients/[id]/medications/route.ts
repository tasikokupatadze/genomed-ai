import { getPatient, updatePatient } from "@/lib/store";
import { checkAllergies } from "@/lib/checks/allergies";
import { withMatches } from "@/lib/scan/drugList";
import { bad, body, isoDate, str } from "@/lib/http";
import type { Medication } from "@/lib/types";

const ENTERED_BY = ["doctor", "patient_typed", "patient_scan"] as const;

export async function POST(req: Request, ctx: RouteContext<"/api/patients/[id]/medications">) {
  const { id } = await ctx.params;
  const b = await body(req);
  const start_date = isoDate(b.start_date);
  const end_date = b.end_date ? isoDate(b.end_date) : undefined;
  const brand_name = str(b.brand_name, 100);
  const name = str(b.name, 100) || brand_name;
  if (!name) return bad("name is required");
  if (!start_date) return bad("start_date is required (YYYY-MM-DD)");
  if (end_date === null) return bad("end_date must be YYYY-MM-DD");
  if (end_date && end_date < start_date) return bad("end_date must not be before start_date");

  // Ingredients are always re-matched here against data/drug_list.csv; client matches are ignored.
  const raw = Array.isArray(b.ingredients) && b.ingredients.length
    ? (b.ingredients as Record<string, unknown>[]).slice(0, 10).map((i) => ({ name: str(i?.name, 100), strength: str(i?.strength, 20) || null, unit: str(i?.unit, 20) || null }))
    : [{ name, strength: null, unit: null }];
  const ingredients = withMatches(raw);
  const entered_by = ENTERED_BY.includes(b.entered_by as (typeof ENTERED_BY)[number]) ? (b.entered_by as Medication["entered_by"]) : "doctor";

  const med: Medication = {
    id: `med-${Date.now().toString(36)}`,
    name,
    dose: str(b.dose, 100),
    frequency: str(b.frequency, 100) || undefined,
    start_date,
    ...(end_date ? { end_date } : {}),
    brand_name: brand_name || undefined,
    form: str(b.form, 50) || undefined,
    ingredients,
    match_status: ingredients.length && ingredients.every((i) => i.matched_ingredient) ? "matched" : "unmatched",
    entered_by,
  };

  const before = getPatient(id);
  if (!before) return bad("Patient not found", 404);
  const patient = updatePatient(id, (p) => { p.medications.push(med); });
  // Allergy check runs right after saving, on every ingredient.
  const allergy_findings = checkAllergies([med], before.allergies);
  return Response.json({ patient, medication: med, allergy_findings }, { status: 201 });
}
