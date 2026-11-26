import type { RecordCategory } from "../types.ts";

export type Category = RecordCategory;

/** Records in our own shape, after mapping from the clinic system's (FHIR-like) resources. */
export interface Records {
  labs: { ehr_id: string; test: string; value: number; unit: string; ref_low: number; ref_high: number; date: string }[];
  conditions: { ehr_id: string; text: string; onset?: string }[];
  surgeries: { ehr_id: string; text: string; date?: string }[];
  prescriptions: { ehr_id: string; name: string; dose: string; start_date: string }[];
  allergies: { ehr_id: string; drug: string; reaction: string }[];
}

export interface Clinic { id: string; name: string }

/**
 * The only way sync code talks to a doctor's record system.
 * Today: MockEhrConnector (simulated). Later: a real FHIR connector with the same interface.
 */
export interface EhrConnector {
  listClinics(): Promise<Clinic[]>;
  fetchRecords(patientId: string, clinicId: string, categories: Category[]): Promise<Records>;
}

export const emptyRecords = (): Records => ({ labs: [], conditions: [], surgeries: [], prescriptions: [], allergies: [] });
