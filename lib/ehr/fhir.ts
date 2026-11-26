// Maps simplified FHIR R4 resources to our Records shape. Pure, so a real FHIR
// connector can reuse it. Resources missing required fields are skipped, never filled in.
import { emptyRecords, type Category, type Records } from "./types.ts";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Resource = { resourceType: string; id: string; [k: string]: any };

const CATEGORY_OF: Record<string, Category> = {
  Observation: "labs",
  Condition: "conditions",
  Procedure: "surgeries",
  MedicationRequest: "prescriptions",
  AllergyIntolerance: "allergies",
};

const isDate = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}/.test(s);
const day = (s: string) => s.slice(0, 10);

export function fhirToRecords(resources: Resource[], categories: Category[]): Records {
  const out = emptyRecords();
  const want = new Set(categories);
  for (const r of resources) {
    const cat = CATEGORY_OF[r.resourceType];
    if (!cat || !want.has(cat)) continue;
    switch (r.resourceType) {
      case "Observation": {
        const v = r.valueQuantity, rr = r.referenceRange?.[0];
        if (!r.code?.text || typeof v?.value !== "number" || !v.unit || !isDate(r.effectiveDateTime)) break;
        if (typeof rr?.low?.value !== "number" || typeof rr?.high?.value !== "number") break; // no range, no import
        out.labs.push({ ehr_id: r.id, test: r.code.text, value: v.value, unit: v.unit, ref_low: rr.low.value, ref_high: rr.high.value, date: day(r.effectiveDateTime) });
        break;
      }
      case "Condition":
        if (r.code?.text) out.conditions.push({ ehr_id: r.id, text: r.code.text, onset: isDate(r.onsetDateTime) ? day(r.onsetDateTime) : undefined });
        break;
      case "Procedure":
        if (r.code?.text) out.surgeries.push({ ehr_id: r.id, text: r.code.text, date: isDate(r.performedDateTime) ? day(r.performedDateTime) : undefined });
        break;
      case "MedicationRequest": {
        const start = r.dispenseRequest?.validityPeriod?.start ?? r.authoredOn;
        if (!r.medicationCodeableConcept?.text || !isDate(start)) break;
        out.prescriptions.push({ ehr_id: r.id, name: r.medicationCodeableConcept.text, dose: r.dosageInstruction?.[0]?.text ?? "", start_date: day(start) });
        break;
      }
      case "AllergyIntolerance":
        if (r.code?.text) out.allergies.push({ ehr_id: r.id, drug: r.code.text, reaction: r.reaction?.[0]?.manifestation?.[0]?.text ?? "" });
        break;
    }
  }
  return out;
}
