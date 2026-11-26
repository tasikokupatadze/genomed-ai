import "server-only";
import { allergyClasses, norm } from "../data";
import { medCheckNames } from "../meds";
import type { Allergy, AllergyFinding, AllergyUncheckedFinding, Medication } from "../types";

const splitClasses = (s: string) => s.split("|").map(norm).filter(Boolean);

/**
 * Flags a medication that matches a listed allergy, a drug in the same class,
 * or a class listed as cross-reactive in data/allergy_classes.csv.
 * Allergies come only from the patient's history: blood tests are never used to detect allergies.
 */
export function checkMedicationAgainstAllergies(
  medication: string,
  allergies: Allergy[],
): (AllergyFinding | AllergyUncheckedFinding)[] {
  if (!allergies.length) return [];
  const table = allergyClasses();
  const rowFor = (drug: string) => table.find((r) => norm(r.drug) === norm(drug));
  const med = rowFor(medication);
  const out: AllergyFinding[] = [];

  for (const allergy of allergies) {
    const al = rowFor(allergy.drug);
    // The allergy may be written as a class name ("penicillins").
    const allergyClass = al?.class ?? (table.some((r) => norm(r.class) === norm(allergy.drug)) ? allergy.drug : null);

    let match: AllergyFinding["match"] | null = null;
    if (norm(medication) === norm(allergy.drug)) match = "same_drug";
    else if (med && allergyClass && norm(med.class) === norm(allergyClass)) match = "same_class";
    else if (med && allergyClass && al && splitClasses(al.cross_reactive_classes).includes(norm(med.class)))
      match = "cross_reactive_class";

    if (match) {
      out.push({
        kind: "allergy",
        medication,
        allergy,
        match,
        medication_class: med?.class ?? "",
        allergy_class: allergyClass ?? "",
        source_url: (match === "same_drug" ? al?.source_url : med?.source_url) ?? "",
        reviewed_by: (match === "same_drug" ? al?.reviewed_by : med?.reviewed_by) ?? "",
      });
    }
  }
  if (out.length) return out;
  // Not in the table: say so, so "no flag" is never read as "safe".
  if (!med) return [{ kind: "allergy_unchecked", medication }];
  return [];
}

/** Checks every active ingredient of every medication; labels show the brand and ingredient. */
export function checkAllergies(meds: Medication[], allergies: Allergy[]) {
  return meds.flatMap((m) => {
    const names = medCheckNames(m);
    return names.flatMap((n) =>
      checkMedicationAgainstAllergies(n, allergies).map((f) => ({
        ...f,
        medication: norm(n) === norm(m.name) ? m.name : `${m.name} (${n})`,
      })),
    );
  });
}
