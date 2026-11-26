import "server-only";
import { allergyClasses, canonicalLab, drugClassOf, drugLabEffects, norm, pgxTable, readCsv } from "../data";
import { checkMedicationAgainstAllergies } from "../checks/allergies";
import { latestByTest } from "../checks/labs";
import { labStatus, predictedEffects, type Tables } from "./predict";
import type { Patient } from "../types";

export const tables = (): Tables => ({ effects: drugLabEffects(), classOf: drugClassOf, canonicalLab });

/** Every medicine name the curated tables know about (for the picker). */
export function knownDrugs(): string[] {
  const names = [
    ...readCsv("drug_classes.csv").map((r) => r.drug),
    ...drugLabEffects().map((r) => r.drug),
    ...allergyClasses().map((r) => r.drug),
    ...pgxTable().map((r) => r.drug).filter((d) => !readCsv("drug_classes.csv").some((c) => norm(c.drug_class) === norm(d))),
    ...readCsv("drug_list.csv").map((r) => r.ingredient),
  ].filter(Boolean).map(norm);
  return [...new Set(names)].sort();
}

export interface WhatIf {
  drug: string;
  drugClass: string | null;
  known: boolean;
  labs: { test: string; direction: "high" | "low" | "any"; effect: string; source_url: string; latest: null | { value: number; unit: string; date: string; status: "in_range" | "below" | "above" } }[];
  pgx: { gene: string; result: string; effect: string; source_url: string }[];
  allergy: { allergy: string; match: string; group: string }[];
  allergyUnchecked: boolean;
}

/** "What if this patient started <drug>?" Table lookups only: a watch list, never a prediction of size. */
export function whatIf(p: Patient, drug: string): WhatIf {
  const t = tables();
  const cls = drugClassOf(drug);
  const latest = latestByTest(p.labs);
  const labs = predictedEffects(drug, t).map((e) => {
    const l = latest.find((x) => norm(canonicalLab(x.test)) === norm(canonicalLab(e.lab_test)));
    return {
      test: canonicalLab(e.lab_test), direction: e.direction, effect: e.effect_description, source_url: e.source_url,
      latest: l ? { value: l.value, unit: l.unit, date: l.date, status: labStatus(l) } : null,
    };
  });
  const pgx = pgxTable()
    .filter((r) => norm(r.drug) === norm(drug) || (cls !== null && norm(r.drug) === norm(cls)))
    .filter((r) => p.genetics.pgx.some((g) => norm(g.gene) === norm(r.gene) && norm(g.result) === norm(r.variant_or_phenotype)))
    .map((r) => ({ gene: r.gene, result: r.variant_or_phenotype, effect: r.effect, source_url: r.source_url }));
  const al = checkMedicationAgainstAllergies(drug, p.allergies);
  const allergy = al.flatMap((f) => (f.kind === "allergy" ? [{ allergy: f.allergy.drug, match: f.match, group: f.allergy_class }] : []));
  return {
    drug, drugClass: cls, labs, pgx, allergy,
    allergyUnchecked: al.some((f) => f.kind === "allergy_unchecked"),
    known: labs.length > 0 || pgx.length > 0 || allergy.length > 0 || cls !== null || knownDrugs().includes(norm(drug)),
  };
}
