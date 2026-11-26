import "server-only";
import { canonicalLab } from "../data";
import { getPatient, updatePatient } from "../store";
import { getEhrConnector } from "./index";
import { importRecords } from "./importRecords";
import type { ConsentEvent, ImportSummary, Patient, RecordCategory, RecordRequest } from "../types";
import { RECORD_CATEGORIES } from "../types";

export const now = () => new Date().toISOString();

export function parseCategories(v: unknown): RecordCategory[] {
  if (!Array.isArray(v)) return [];
  return RECORD_CATEGORIES.filter((c) => v.includes(c)); // known values only, fixed order
}

export function log(p: Patient, e: Omit<ConsentEvent, "at">) {
  p.consent_log = [...(p.consent_log ?? []), { at: now(), ...e }];
}

export const activeConsent = (p: Patient, clinicId: string) =>
  (p.consents ?? []).find((c) => c.clinic_id === clinicId && c.active) ?? null;

/** Fetch through the connector (never the JSON file) and import. Caller checks consent first. */
export async function syncRequest(patientId: string, req: RecordRequest, categories: RecordCategory[]): Promise<ImportSummary> {
  const records = await getEhrConnector().fetchRecords(patientId, req.clinic_id, categories);
  let summary!: ImportSummary;
  updatePatient(patientId, (p) => {
    const res = importRecords(p, records, {
      clinic: { id: req.clinic_id, name: req.clinic_name }, requestId: req.id, now: now(), canonicalLab,
    });
    Object.assign(p, res.patient);
    summary = res.summary;
    const r = p.record_requests?.find((x) => x.id === req.id);
    if (r) r.syncs = [...(r.syncs ?? []), summary];
    const total = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);
    log(p, {
      actor: "system", event: "synced", clinic_id: req.clinic_id, clinic_name: req.clinic_name, request_id: req.id, categories,
      detail: `${total(summary.imported)} imported, ${total(summary.skipped_duplicates)} duplicates skipped`,
    });
  });
  return summary;
}

export const findRequest = (patientId: string, reqId: string) => {
  const p = getPatient(patientId);
  return { patient: p, request: p?.record_requests?.find((r) => r.id === reqId) ?? null };
};
