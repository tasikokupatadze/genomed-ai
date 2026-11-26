export type Lang = "en" | "ka";

export interface Medication { name: string; dose: string }
export interface Allergy { drug: string; reaction: string }
export interface LabResult {
  test: string;
  value: number;
  unit: string;
  ref_low: number; // from the patient's own lab report
  ref_high: number;
  date?: string;
}
export interface PgxResult { gene: string; result: string }
export interface VariantResult { gene: string; hgvs_c: string }

export interface ApprovedSummary {
  lang: Lang;
  patient_summary: string;
  patient_questions: string[];
  medication_notes: string[];
  approved_at: string;
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
}

// ---- findings ----
export interface LabMedFinding {
  kind: "lab_medication";
  lab: LabResult;
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
