import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fhirToRecords } from "./fhir.ts";
import { importRecords } from "./importRecords.ts";
import type { Patient } from "../types.ts";

const ehr = JSON.parse(readFileSync(new URL("../../data/mock_ehr.json", import.meta.url), "utf-8"));
const demo = JSON.parse(readFileSync(new URL("../../data/demo_patients.json", import.meta.url), "utf-8"));
const p001: Patient = demo.patients.find((p: Patient) => p.id === "p001");
const res = ehr.records.find((r: { patient_id: string }) => r.patient_id === "p001").resources;
const clinic = ehr.clinics[0];
const ALL = ["labs", "conditions", "surgeries", "prescriptions", "allergies"] as const;
const ctx = { clinic, requestId: "REQ-1", now: "2026-11-26T10:00:00Z", canonicalLab: (t: string) => t };

test("FHIR mapping respects categories", () => {
  const onlyLabs = fhirToRecords(res, ["labs"]);
  assert.equal(onlyLabs.labs.length, 2);
  assert.equal(onlyLabs.prescriptions.length + onlyLabs.allergies.length + onlyLabs.conditions.length, 0);
  const all = fhirToRecords(res, [...ALL]);
  assert.deepEqual(all.prescriptions[0], { ehr_id: "medreq-1001", name: "Furosemide", dose: "40 mg once daily", start_date: "2026-07-01" });
});

test("FHIR mapping skips incomplete resources instead of filling them in", () => {
  const r = fhirToRecords([
    { resourceType: "Observation", id: "x", code: { text: "K" }, valueQuantity: { value: 4, unit: "mmol/L" }, effectiveDateTime: "2026-01-01" },
  ], ["labs"]);
  assert.equal(r.labs.length, 0, "no reference range, no import");
});

test("import skips duplicates and tags provenance", () => {
  const { patient, summary } = importRecords(p001, fhirToRecords(res, [...ALL]), ctx);
  assert.equal(summary.imported.labs, 1);                 // 2026-02-03 is new
  assert.equal(summary.skipped_duplicates.labs, 1);       // 2026-05-12 4.2 already there
  assert.equal(summary.skipped_duplicates.prescriptions, 1); // Furosemide 2026-07-01
  assert.equal(summary.skipped_duplicates.allergies, 1);  // Penicillin
  assert.equal(summary.skipped_duplicates.conditions, 1); // High blood pressure
  assert.equal(summary.imported.conditions, 1);
  assert.equal(summary.imported.surgeries, 1);
  const lab = patient.labs.find((l) => l.date === "2026-02-03")!;
  assert.equal(lab.provenance?.clinic_name, clinic.name);
  assert.equal(lab.provenance?.source, "clinic_simulated");
  assert.equal(p001.labs.length + 1, patient.labs.length, "input patient not mutated, one lab added");
  // second import of the same records adds nothing
  const again = importRecords(patient, fhirToRecords(res, [...ALL]), ctx);
  assert.equal(Object.values(again.summary.imported).reduce((a, b) => a + b, 0), 0);
});
