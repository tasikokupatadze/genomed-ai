import "server-only";
import { medCheckNames } from "../meds";
import { canonicalLab, drugClassOf, drugLabEffects, norm, type DrugLabEffect } from "../data";
import type {
  LabMedFinding, LabResult, LabTrend, LabUnexplainedFinding, Medication, Patient, TrendEntry,
} from "../types";

/** "high" / "low" against the reference range printed on the patient's own lab report. */
export function outOfRange(lab: LabResult): "high" | "low" | null {
  if (!Number.isFinite(lab.value) || !Number.isFinite(lab.ref_low) || !Number.isFinite(lab.ref_high)) return null;
  if (lab.value < lab.ref_low) return "low";
  if (lab.value > lab.ref_high) return "high";
  return null;
}

/** Does this table row describe this medication (by drug name or by drug class)? */
function rowMatchesMed(row: DrugLabEffect, med: Medication): boolean {
  return medCheckNames(med).some((name) => {
    const cls = drugClassOf(name);
    return Boolean(
      (row.drug && norm(row.drug) === norm(name)) ||
      (row.drug_class && cls && norm(row.drug_class) === norm(cls)),
    );
  });
}

/** Medications the curated table links to this test (any direction). */
export function isLinkedToTest(med: Medication, test: string): boolean {
  const t = norm(canonicalLab(test));
  return drugLabEffects().some((row) => norm(row.lab_test) === t && rowMatchesMed(row, med));
}

/** Most recent entry for each test (by date). */
export function latestByTest(labs: LabResult[]): LabResult[] {
  const latest = new Map<string, LabResult>();
  for (const lab of labs) {
    const key = norm(canonicalLab(lab.test));
    const cur = latest.get(key);
    if (!cur || (lab.date ?? "") >= (cur.date ?? "")) latest.set(key, lab);
  }
  return [...latest.values()];
}

/**
 * For the most recent result of each test, if it is out of range, look for medications
 * that the curated table (data/drug_lab_effects.csv) links to that test in that direction.
 * A medication only counts if it had started on or before the date of that result.
 * Only table rows are used; nothing is inferred.
 */
export function checkLabs(labs: LabResult[], meds: Medication[]): (LabMedFinding | LabUnexplainedFinding)[] {
  const table = drugLabEffects();
  const findings: (LabMedFinding | LabUnexplainedFinding)[] = [];

  for (const lab of latestByTest(labs)) {
    const direction = outOfRange(lab);
    if (!direction) continue;
    const test = norm(canonicalLab(lab.test));
    let matched = false;

    for (const med of meds) {
      if (med.start_date && lab.date && med.start_date > lab.date) continue; // started after this sample
      for (const row of table) {
        if (norm(row.lab_test) !== test) continue;
        if (row.direction !== direction && row.direction !== "any") continue;
        if (!rowMatchesMed(row, med)) continue;
        matched = true;
        findings.push({
          kind: "lab_medication",
          lab, direction,
          canonical_test: canonicalLab(lab.test),
          medication: med.name,
          matched_on: row.drug && medCheckNames(med).some((n) => norm(n) === norm(row.drug)) ? row.drug : row.drug_class,
          effect_description: row.effect_description,
          source_url: row.source_url,
          reviewed_by: row.reviewed_by,
        });
      }
    }
    if (!matched) findings.push({ kind: "lab_unexplained", lab, direction, canonical_test: canonicalLab(lab.test) });
  }
  return findings;
}

/** One trend per test that has 2 or more dated entries. Timing only: no cause is implied. */
export function buildLabTrends(p: Patient): LabTrend[] {
  const groups = new Map<string, LabResult[]>();
  for (const lab of p.labs) {
    if (!lab.date) continue;
    const key = canonicalLab(lab.test);
    groups.set(key, [...(groups.get(key) ?? []), lab]);
  }
  const trends: LabTrend[] = [];
  for (const [test, labs] of groups) {
    if (labs.length < 2) continue;
    const entries: TrendEntry[] = labs
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((l) => {
        const dir = outOfRange(l);
        return {
          date: l.date, value: l.value, unit: l.unit, ref_low: l.ref_low, ref_high: l.ref_high,
          status: dir === "low" ? "below" : dir === "high" ? "above" : "in_range",
        };
      });
    const units = [...new Set(entries.map((e) => e.unit.trim()))];
    const ranges = new Set(entries.map((e) => `${e.ref_low}|${e.ref_high}`));
    trends.push({
      test,
      entries,
      units,
      ranges_differ: ranges.size > 1,
      medications: p.medications
        .filter((m) => m.start_date)
        .map((m) => ({ name: m.name, start_date: m.start_date, end_date: m.end_date, linked: isLinkedToTest(m, test) })),
    });
  }
  return trends;
}
