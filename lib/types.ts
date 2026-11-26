export type Lang = "en" | "ka";

/** Where an imported item came from. The clinic system is SIMULATED in this demo. */
export interface Provenance {
  source: "clinic_simulated";
  clinic_id: string;
  clinic_name: string;
  imported_at: string;
  request_id: string;
  ehr_id: string;
}
/** Fields every imported clinic record has: read-only for the patient, who may add a note. */
interface Imported { id?: string; provenance?: Provenance; patient_note?: string }

export interface MedIngredient {
  name: string;                     // as read from the box or typed
  strength: string | null;
  unit: string | null;
  matched_ingredient: string | null; // from data/drug_list.csv, null = unmatched
  drug_class: string | null;         // from data/drug_list.csv only, never guessed
}

export interface Medication extends Imported {
  name: string;
  dose: string;
  start_date: string; // YYYY-MM-DD
  end_date?: string;  // YYYY-MM-DD, optional
  frequency?: string;
  brand_name?: string;
  form?: string;
  ingredients?: MedIngredient[];
  match_status?: "matched" | "unmatched";
  entered_by?: "doctor" | "patient_typed" | "patient_scan" | "clinic";
}
export interface Allergy extends Imported { drug: string; reaction: string }

export interface ClinicCondition extends Imported { text: string; onset?: string }
export interface ProcedureRecord extends Imported { text: string; date?: string }

export type RecordCategory = "labs" | "conditions" | "surgeries" | "prescriptions" | "allergies";
export const RECORD_CATEGORIES: RecordCategory[] = ["labs", "conditions", "surgeries", "prescriptions", "allergies"];

export interface ImportSummary {
  at: string;
  imported: Record<RecordCategory, number>;
  skipped_duplicates: Record<RecordCategory, number>;
}
export interface RecordRequest {
  id: string;
  clinic_id: string;
  clinic_name: string;
  categories: RecordCategory[];          // what the patient asked for
  status: "pending" | "approved" | "declined";
  requested_at: string;
  decided_at?: string;
  approved_categories?: RecordCategory[]; // what the doctor approved
  syncs?: ImportSummary[];
}
export interface Consent {
  clinic_id: string;
  clinic_name: string;
  categories: RecordCategory[];
  active: boolean;
  granted_at: string;
  revoked_at?: string;
}
export interface ConsentEvent {
  at: string;
  actor: "patient" | "doctor" | "system";
  event: "requested" | "approved" | "declined" | "synced" | "revoked" | "sync_blocked";
  clinic_id: string;
  clinic_name: string;
  request_id?: string;
  categories?: RecordCategory[];
  detail?: string;
}
export interface LabResult extends Imported {
  test: string;
  value: number;
  unit: string;
  ref_low: number; // from the patient's own lab report
  ref_high: number;
  date: string; // YYYY-MM-DD, required
}
export interface PgxResult { gene: string; result: string }
export interface VariantResult { gene: string; hgvs_c: string }

export interface ApprovedSummary {
  lang: Lang;
  patient_summary: string;
  patient_questions: string[];
  medication_notes: string[];
  /** Snapshot of the charts at approval time, so later data changes never reach the patient unapproved. */
  trends?: LabTrend[];
  approved_at: string;
}

export interface TrendEntry {
  date: string;
  value: number;
  unit: string;
  ref_low: number;
  ref_high: number;
  status: "in_range" | "below" | "above";
}
export interface TrendMedication {
  name: string;
  start_date: string;
  end_date?: string;
  linked: boolean; // linked to this test in data/drug_lab_effects.csv
}
export interface LabTrend {
  test: string;              // canonical test name
  entries: TrendEntry[];     // sorted by date
  units: string[];           // distinct units; more than one means "don't plot together"
  ranges_differ: boolean;
  medications: TrendMedication[];
  notes?: string[];          // doctor-approved "one possible reason" lines (patient view only)
}

export interface Patient {
  id: string;
  name: string;
  age?: number;
  sex?: string;
  conditions: string[];
  medications: Medication[];
  allergies: Allergy[];
  labs: LabResult[];
  genetics: { pgx: PgxResult[]; variants: VariantResult[] };
  approved?: Partial<Record<Lang, ApprovedSummary>>;
  demo?: boolean;
  clinic_conditions?: ClinicCondition[];
  procedures?: ProcedureRecord[];
  record_requests?: RecordRequest[];
  consents?: Consent[];
  consent_log?: ConsentEvent[];
  emergency?: EmergencyCard;
}

/**
 * What a stranger sees after scanning the patient's bracelet QR code.
 * Only these fields are public; the patient chooses them. The link uses a random
 * token (not the patient ID) and can be regenerated or switched off at any time.
 */
export interface EmergencyCard {
  enabled: boolean;
  token: string | null;
  /** 6 capitals/digits for the compact bracelet QR (/B/<code> redirects to /e/<token>). */
  short_code?: string | null;
  display_name: string;            // e.g. first name only
  conditions: string[];
  instructions: Partial<Record<Lang, string>>; // "If you see me…", written by the patient
  allergies: string[];
  medications: string[];
  contacts: { name: string; relation: string; phone: string }[];
  updated_at: string;
}

// ---- findings ----
export interface LabMedFinding {
  kind: "lab_medication";
  lab: LabResult;
  canonical_test: string;
  direction: "high" | "low";
  medication: string;
  matched_on: string; // drug name or drug class
  effect_description: string;
  source_url: string;
  reviewed_by: string;
}
export interface LabUnexplainedFinding {
  kind: "lab_unexplained";
  lab: LabResult;
  canonical_test: string;
  direction: "high" | "low";
}
export interface AllergyFinding {
  kind: "allergy";
  medication: string;
  allergy: Allergy;
  match: "same_drug" | "same_class" | "cross_reactive_class";
  medication_class: string;
  allergy_class: string;
  source_url: string;
  reviewed_by: string;
}
export interface AllergyUncheckedFinding {
  kind: "allergy_unchecked";
  medication: string;
}
export interface PgxFinding {
  kind: "pgx";
  gene: string;
  result: string;
  drug: string;
  effect: string;
  guideline_summary: string;
  source_url: string;
  patient_takes: string[]; // current medications that match the drug or class
}
export type Evo2Band = "leans_tolerated" | "unclear" | "leans_disruptive";
export interface VariantFinding {
  kind: "variant";
  gene: string;
  hgvs_c: string;
  found: boolean;
  clinvar?: {
    variation_id: string;
    name: string;
    hgvs_p: string;
    clinical_significance: string;
    review_status: string;
    last_evaluated: string;
    url: string;
  };
  evo2: { available: false } | { available: true; band: Evo2Band; label: string };
}

export type Finding =
  | LabMedFinding
  | LabUnexplainedFinding
  | AllergyFinding
  | AllergyUncheckedFinding
  | PgxFinding
  | VariantFinding;

export interface DraftSummary {
  clinician_summary: string[] | null;
  patient_summary: string | null;
  patient_questions: string[] | null;
  error: string | null;
}
