// Adds fetched clinic records to a patient profile. Pure: returns a new patient + summary.
import type { Clinic, Records } from "./types.ts";
import type { ImportSummary, Patient, Provenance, RecordCategory } from "../types.ts";

const key = (s: string) => s.trim().toLowerCase();
const zero = (): Record<RecordCategory, number> => ({ labs: 0, conditions: 0, surgeries: 0, prescriptions: 0, allergies: 0 });

export function importRecords(
  patient: Patient,
  records: Records,
  ctx: { clinic: Clinic; requestId: string; now: string; canonicalLab: (test: string) => string },
): { patient: Patient; summary: ImportSummary } {
  const p: Patient = structuredClone(patient);
  const imported = zero(), skipped = zero();
  const prov = (ehr_id: string): Provenance => ({
    source: "clinic_simulated", clinic_id: ctx.clinic.id, clinic_name: ctx.clinic.name,
    imported_at: ctx.now, request_id: ctx.requestId, ehr_id,
  });
  const id = (ehr_id: string) => `${ctx.clinic.id}:${ehr_id}`;

  // Labs: duplicate = same test, same date, same value.
  for (const l of records.labs) {
    const t = key(ctx.canonicalLab(l.test));
    if (p.labs.some((x) => key(ctx.canonicalLab(x.test)) === t && x.date === l.date && x.value === l.value)) { skipped.labs++; continue; }
    p.labs.push({ id: id(l.ehr_id), test: ctx.canonicalLab(l.test), value: l.value, unit: l.unit, ref_low: l.ref_low, ref_high: l.ref_high, date: l.date, provenance: prov(l.ehr_id) });
    imported.labs++;
  }
  // Prescriptions: duplicate = same medication, same start date.
  for (const m of records.prescriptions) {
    if (p.medications.some((x) => key(x.name) === key(m.name) && x.start_date === m.start_date)) { skipped.prescriptions++; continue; }
    p.medications.push({ id: id(m.ehr_id), name: m.name, dose: m.dose, start_date: m.start_date, entered_by: "clinic", provenance: prov(m.ehr_id) });
    imported.prescriptions++;
  }
  // Allergies: duplicate = same drug.
  for (const a of records.allergies) {
    if (p.allergies.some((x) => key(x.drug) === key(a.drug))) { skipped.allergies++; continue; }
    p.allergies.push({ id: id(a.ehr_id), drug: a.drug, reaction: a.reaction, provenance: prov(a.ehr_id) });
    imported.allergies++;
  }
  // Conditions: duplicate = same name (in the manual list or already imported).
  p.clinic_conditions ??= [];
  for (const c of records.conditions) {
    if (p.conditions.some((x) => key(x) === key(c.text)) || p.clinic_conditions.some((x) => key(x.text) === key(c.text))) { skipped.conditions++; continue; }
    p.clinic_conditions.push({ id: id(c.ehr_id), text: c.text, onset: c.onset, provenance: prov(c.ehr_id) });
    imported.conditions++;
  }
  // Surgeries: duplicate = same procedure, same date.
  p.procedures ??= [];
  for (const s of records.surgeries) {
    if (p.procedures.some((x) => key(x.text) === key(s.text) && x.date === s.date)) { skipped.surgeries++; continue; }
    p.procedures.push({ id: id(s.ehr_id), text: s.text, date: s.date, provenance: prov(s.ehr_id) });
    imported.surgeries++;
  }
  return { patient: p, summary: { at: ctx.now, imported, skipped_duplicates: skipped } };
}
