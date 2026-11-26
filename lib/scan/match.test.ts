import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { levenshtein, matchIngredient, type DrugListRow } from "./match.ts";

// Same tiny CSV parser idea as lib/csv.ts, enough for this file.
const [head, ...lines] = readFileSync(new URL("../../data/drug_list.csv", import.meta.url), "utf-8").trim().split("\n");
const cols = head.split(",");
const rows = lines.map((l) => Object.fromEntries(l.split(",").map((v, i) => [cols[i], v]))) as unknown as DrugListRow[];
const m = (s: string) => matchIngredient(s, rows)?.row.ingredient ?? null;

test("levenshtein", () => {
  assert.equal(levenshtein("kitten", "sitting"), 3);
  assert.equal(levenshtein("abc", "abc"), 0);
});

test("exact, case-insensitive and synonyms (incl. Georgian)", () => {
  assert.equal(m("Atorvastatin"), "atorvastatin");
  assert.equal(m("  METFORMIN  "), "metformin");
  assert.equal(m("Metformin hydrochloride"), "metformin");
  assert.equal(m("ფუროსემიდი"), "furosemide");
  assert.equal(m("Vitamin B7"), "biotin");
});

test("small typos match, big ones do not", () => {
  assert.equal(m("atorvastatn"), "atorvastatin");
  assert.equal(m("furosemid"), "furosemide");
  assert.equal(m("amoxicilin"), "amoxicillin");
  assert.equal(m("paracetamol"), null, "not in list: unmatched, never guessed");
  assert.equal(m("statin"), null);
  assert.equal(m(""), null);
});

test("short names need an exact match", () => {
  assert.equal(m("hctz"), "hydrochlorothiazide");
  assert.equal(m("hcta"), null);
});
