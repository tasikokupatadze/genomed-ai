import "server-only";
import { checkLabs } from "./checks/labs";
import { checkAllergies } from "./checks/allergies";
import { checkPgx } from "./checks/pgx";
import { checkVariants } from "./checks/variants";
import { canonicalLab, contextFacts } from "./data";
import { patientNotes } from "./translations";
import { buildLabTrends } from "./checks/labs";
import type { Finding, Lang, LabTrend, Patient } from "./types";

export function runChecks(p: Patient): Finding[] {
  return [
    ...checkAllergies(p.medications, p.allergies),
    ...checkPgx(p.genetics.pgx, p.medications),
    ...checkLabs(p.labs, p.medications),
    ...checkVariants(p.genetics.variants),
  ];
}

/** Template lines the patient may see (after approval). Not AI-written. */
export function medicationNotes(findings: Finding[], lang: Lang): string[] {
  const n = patientNotes[lang];
  const lines: string[] = [];
  for (const f of findings) {
    if (f.kind === "lab_medication") lines.push(n.labMed(f.medication, canonicalLab(f.lab.test), f.direction));
    if (f.kind === "allergy") lines.push(n.allergy(f.medication, f.allergy.drug));
    if (f.kind === "pgx") for (const m of f.patient_takes) lines.push(n.pgx(f.gene, m));
  }
  return [...new Set(lines)];
}

/** Structured JSON for the LLM. Only table findings + approved context facts. */
export function buildLlmInput(p: Patient, findings: Finding[], lang: Lang) {
  const cf = contextFacts().facts;
  const pick = (key: string) => ((cf[key] as Record<Lang, string[]> | undefined)?.[lang] ?? []);
  const facts = new Set<string>(pick("always"));
  const gene_info: Record<string, string> = {};

  const items = findings.flatMap((f): Record<string, unknown>[] => {
    switch (f.kind) {
      case "lab_medication":
        pick("lab_medication").forEach((x) => facts.add(x));
        return [{
          type: f.kind,
          test: canonicalLab(f.lab.test), value: f.lab.value, unit: f.lab.unit,
          lab_reference_range: `${f.lab.ref_low}–${f.lab.ref_high}`, direction: f.direction,
          medication: f.medication, table_effect: f.effect_description,
        }];
      case "lab_unexplained":
        pick("lab_unexplained").forEach((x) => facts.add(x));
        return [{
          type: f.kind, test: canonicalLab(f.lab.test), value: f.lab.value, unit: f.lab.unit,
          lab_reference_range: `${f.lab.ref_low}–${f.lab.ref_high}`, direction: f.direction,
        }];
      case "allergy":
        pick("allergy").forEach((x) => facts.add(x));
        return [{ type: f.kind, medication: f.medication, listed_allergy: f.allergy.drug, match: f.match, drug_group: f.allergy_class }];
      case "pgx":
        pick("pgx").forEach((x) => facts.add(x));
        return [{ type: f.kind, gene: f.gene, result: f.result, drug: f.drug, table_effect: f.effect, patient_takes: f.patient_takes }];
      case "variant": {
        if (!f.found || !f.clinvar) return [];
        pick("variant").forEach((x) => facts.add(x));
        const cls = cf.variant_class[f.clinvar.clinical_significance]?.[lang];
        if (cls) facts.add(cls);
        const gi = cf.gene_function[f.gene]?.[lang];
        if (gi) gene_info[f.gene] = gi;
        return [{
          type: f.kind, gene: f.gene, variant: f.hgvs_c, protein_change: f.clinvar.hgvs_p,
          clinvar: { classification: f.clinvar.clinical_significance, review_status: f.clinvar.review_status },
          ...(f.evo2.available
            ? { ai_estimate: { label: f.evo2.label, note: "research-grade, not clinically validated; clinician only" } }
            : {}),
        }];
      }
      default:
        return []; // allergy_unchecked: shown to the doctor only
    }
  });

  return {
    language: lang,
    patient: { age: p.age, sex: p.sex, conditions: p.conditions },
    findings: items,
    gene_info,
    context_facts: [...facts],
  };
}

/** Trend charts with their template "one possible reason" lines, for the approved patient view. */
export function approvedTrends(p: Patient, findings: Finding[], lang: Lang): LabTrend[] {
  const n = patientNotes[lang];
  return buildLabTrends(p).map((t) => ({
    ...t,
    notes: [...new Set(findings.flatMap((f) =>
      f.kind === "lab_medication" && f.canonical_test === t.test ? [n.labMed(f.medication, t.test, f.direction)] : []))],
  }));
}
