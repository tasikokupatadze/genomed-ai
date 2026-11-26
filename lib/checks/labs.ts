import "server-only";
import { canonicalLab, drugClassOf, drugLabEffects, norm } from "../data";
import type { LabMedFinding, LabResult, LabUnexplainedFinding, Medication } from "../types";

/** "high" / "low" against the reference range printed on the patient's own lab report. */
export function outOfRange(lab: LabResult): "high" | "low" | null {
  if (!Number.isFinite(lab.value) || !Number.isFinite(lab.ref_low) || !Number.isFinite(lab.ref_high)) return null;
  if (lab.value < lab.ref_low) return "low";
  if (lab.value > lab.ref_high) return "high";
  return null;
}

/**
 * For each out-of-range lab, look for medications that the curated table
 * (data/drug_lab_effects.csv) links to that test in that direction.
 * Only table rows are used; nothing is inferred.
 */
export function checkLabs(labs: LabResult[], meds: Medication[]): (LabMedFinding | LabUnexplainedFinding)[] {
  const table = drugLabEffects();
  const findings: (LabMedFinding | LabUnexplainedFinding)[] = [];

  for (const lab of labs) {
    const direction = outOfRange(lab);
    if (!direction) continue;
    const test = norm(canonicalLab(lab.test));
    let matched = false;

    for (const med of meds) {
      const medName = norm(med.name);
      const medClass = drugClassOf(med.name);
      for (const row of table) {
        if (norm(row.lab_test) !== test) continue;
        if (row.direction !== direction && row.direction !== "any") continue;
        const byDrug = row.drug && norm(row.drug) === medName;
        const byClass = row.drug_class && medClass && norm(row.drug_class) === norm(medClass);
        if (!byDrug && !byClass) continue;
        matched = true;
        findings.push({
          kind: "lab_medication",
          lab, direction,
          medication: med.name,
          matched_on: byDrug ? row.drug : row.drug_class,
          effect_description: row.effect_description,
          source_url: row.source_url,
          reviewed_by: row.reviewed_by,
        });
      }
    }
    if (!matched) findings.push({ kind: "lab_unexplained", lab, direction });
  }
  return findings;
}
