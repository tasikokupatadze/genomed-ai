import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { evaluatePredictions, observedChanges, summarize, type EffectRow, type Tables } from "./predict.ts";
import type { Patient } from "../types.ts";

const csv = (f: string) => {
  const [h, ...rows] = readFileSync(new URL(`../../data/${f}`, import.meta.url), "utf-8").trim().split("\n");
  const cols = h.split(",");
  return rows.map((r) => Object.fromEntries(r.split(",").map((v, i) => [cols[i], v])));
};
const classes = csv("drug_classes.csv");
const tables: Tables = {
  effects: csv("drug_lab_effects.csv") as unknown as EffectRow[],
  classOf: (d) => classes.find((r) => r.drug.toLowerCase() === d.toLowerCase())?.drug_class ?? null,
  canonicalLab: (t) => t,
};
const patients: Patient[] = JSON.parse(readFileSync(new URL("../../data/demo_patients.json", import.meta.url), "utf-8")).patients;

test("predictions are checked against labs before and after the start date", () => {
  const rows = evaluatePredictions(patients, tables);
  const get = (pid: string, test: string) => rows.find((r) => r.patientId === pid && r.test === test)!;
  assert.equal(get("p003", "Potassium").outcome, "came_true");
  assert.equal(get("p004", "Sodium").outcome, "did_not");
  assert.equal(get("p005", "CK").outcome, "came_true");
  assert.equal(get("p005", "ALT").outcome, "did_not");
  assert.equal(get("p005", "AST").reason, "no_baseline", "no AST results: not evaluable, not counted");
  assert.equal(get("p001", "Potassium").outcome, "came_true");
  assert.equal(get("p001", "ALT").reason, "no_baseline");
});

test("observed changes and what explains them", () => {
  const ch = observedChanges(patients, tables);
  const tsh = ch.find((c) => c.patientId === "p007" && c.test === "TSH")!;
  assert.deepEqual(tsh.explainedBy, [], "TSH change is not predicted by lisinopril");
  assert.deepEqual(ch.find((c) => c.patientId === "p008" && c.test === "Vitamin B12")!.explainedBy, ["Metformin"]);
});

test("summary numbers", () => {
  const s = summarize(evaluatePredictions(patients, tables), observedChanges(patients, tables));
  assert.equal(s.evaluable, 11);
  assert.equal(s.cameTrue, 6);
  assert.equal(s.changes, 7);
  assert.equal(s.explained, 6);
});
