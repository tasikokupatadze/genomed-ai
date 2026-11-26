import "server-only";
import { readJson } from "../data";
import { fhirToRecords } from "./fhir";
import { emptyRecords, type Category, type Clinic, type EhrConnector, type Records } from "./types";

interface MockFile {
  clinics: Clinic[];
  records: { clinic_id: string; patient_id: string; resources: Parameters<typeof fhirToRecords>[0] }[];
}

/** SIMULATED clinic system backed by data/mock_ehr.json. */
export class MockEhrConnector implements EhrConnector {
  async listClinics(): Promise<Clinic[]> {
    return readJson<MockFile>("mock_ehr.json").clinics;
  }
  async fetchRecords(patientId: string, clinicId: string, categories: Category[]): Promise<Records> {
    const entry = readJson<MockFile>("mock_ehr.json").records.find((r) => r.patient_id === patientId && r.clinic_id === clinicId);
    return entry ? fhirToRecords(entry.resources, categories) : emptyRecords(); // clinic has no record of this patient
  }
}
