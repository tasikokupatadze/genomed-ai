// "Predict, then check": which lab changes the curated table predicts for a medication,
// and whether they actually happened after it started. Pure functions (tables passed in)
// so they can be unit-tested. Predictions come ONLY from data/drug_lab_effects.csv.
import type { LabResult, Medication, Patient } from "../types.ts";

export interface EffectRow {
  drug: string; drug_class: string; lab_test: string; direction: "high" | "low" | "any";
  effect_description: string; source_url: string; reviewed_by: string;
}
export interface Tables {
  effects: EffectRow[];
  classOf: (drug: string) => string | null;
  canonicalLab: (test: string) => string;
}

const norm = (s: string) => s.trim().toLowerCase();
export type Status = "in_range" | "below" | "above";
export const labStatus = (l: LabResult): Status => (l.value < l.ref_low ? "below" : l.value > l.ref_high ? "above" : "in_range");

/** Table rows that apply to a medication name (by drug name or by its class). */
export function predictedEffects(drug: string, t: Tables): EffectRow[] {
  const cls = t.classOf(drug);
  return t.effects.filter((r) =>
    (r.drug && norm(r.drug) === norm(drug)) || (r.drug_class && cls && norm(r.drug_class) === norm(cls)));
}

const matches = (dir: EffectRow["direction"], s: Status) =>
  dir === "any" ? s !== "in_range" : dir === "high" ? s === "above" : s === "below";

export interface Point { value: number; unit: string; date: string; status: Status }
const point = (l: LabResult): Point => ({ value: l.value, unit: l.unit, date: l.date, status: labStatus(l) });

export interface PredictionRow {
  patientId: string; patientName: string; medication: string; start: string;
  test: string; predicted: EffectRow["direction"]; source_url: string;
  baseline?: Point; after?: Point;
  outcome: "came_true" | "did_not" | "not_evaluable";
  reason?: "no_baseline" | "no_after" | "baseline_out_of_range";
}

function resultsFor(p: Patient, test: string, t: Tables) {
  return p.labs.filter((l) => l.date && norm(t.canonicalLab(l.test)) === norm(test)).sort((a, b) => a.date.localeCompare(b.date));
}

/** One row per (patient, medication with a start date, predicted lab). */
export function evaluatePredictions(patients: Patient[], t: Tables): PredictionRow[] {
  const rows: PredictionRow[] = [];
  for (const p of patients) {
    for (const m of p.medications as Medication[]) {
      if (!m.start_date) continue;
      for (const e of predictedEffects(m.name, t)) {
        const test = t.canonicalLab(e.lab_test);
        const res = resultsFor(p, test, t);
        const before = res.filter((l) => l.date < m.start_date).at(-1);
        const after = res.filter((l) => l.date > m.start_date && (!m.end_date || l.date <= m.end_date)).at(-1);
        const row: PredictionRow = {
          patientId: p.id, patientName: p.name, medication: m.name, start: m.start_date,
          test, predicted: e.direction, source_url: e.source_url,
          baseline: before && point(before), after: after && point(after), outcome: "not_evaluable",
        };
        if (!before) row.reason = "no_baseline";
        else if (!after) row.reason = "no_after";
        else if (labStatus(before) !== "in_range") row.reason = "baseline_out_of_range";
        else row.outcome = matches(e.direction, labStatus(after)) ? "came_true" : "did_not";
        rows.push(row);
      }
    }
  }
  return rows;
}

export interface ObservedChange { patientId: string; patientName: string; test: string; before: Point; after: Point; explainedBy: string[] }

/** Every lab that went from in range to out of range, and which predictions (if any) explain it. */
export function observedChanges(patients: Patient[], t: Tables): ObservedChange[] {
  const out: ObservedChange[] = [];
  for (const p of patients) {
    const tests = [...new Set(p.labs.filter((l) => l.date).map((l) => t.canonicalLab(l.test)))];
    for (const test of tests) {
      const res = resultsFor(p, test, t);
      for (let i = 1; i < res.length; i++) {
        const a = res.at(i - 1)!, b = res.at(i)!;
        if (labStatus(a) !== "in_range" || labStatus(b) === "in_range") continue;
        const explainedBy = p.medications
          .filter((m) => m.start_date && m.start_date > a.date && m.start_date <= b.date)
          .filter((m) => predictedEffects(m.name, t).some((e) => norm(t.canonicalLab(e.lab_test)) === norm(test) && matches(e.direction, labStatus(b))))
          .map((m) => m.name);
        out.push({ patientId: p.id, patientName: p.name, test, before: point(a), after: point(b), explainedBy });
        break; // first change per test
      }
    }
  }
  return out;
}

export function summarize(rows: PredictionRow[], changes: ObservedChange[]) {
  const evaluable = rows.filter((r) => r.outcome !== "not_evaluable");
  const cameTrue = evaluable.filter((r) => r.outcome === "came_true").length;
  const explained = changes.filter((c) => c.explainedBy.length).length;
  return {
    predictions: rows.length,
    evaluable: evaluable.length,
    cameTrue,
    precision: evaluable.length ? cameTrue / evaluable.length : null, // how often warnings came true
    changes: changes.length,
    explained,
    recall: changes.length ? explained / changes.length : null,       // how many real changes were predicted
  };
}
