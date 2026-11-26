// Domain model for the GenoMed demo. Original reports, evidence updates, clinician
// reviews and published patient messages are separate objects on purpose:
// a draft or dismissed review is never a message.

export type Lang = "en" | "ka";
export type Bilingual = Record<Lang, string>;
export type Role = "patient" | "clinician" | "research";
export type PatientId = "pt-nino" | "pt-davit";

export type ClassificationCode =
  | "pathogenic" | "likely_pathogenic" | "vus" | "likely_benign" | "benign" | "unknown";

export interface Source {
  submitter: string;        // who made the claim
  name: Bilingual;          // how to show it
  url?: string;
  isDemo: boolean;          // invented for the demo?
}

export interface Variant { id: string; hgvs: string; transcript: string }
export interface Condition { id: string; name: Bilingual }

/** The original report. Never modified after it is issued. */
export interface GeneticReport {
  id: string;
  patientId: PatientId;
  reportDate: string;       // date the lab issued the report
  lab: Bilingual;
  gene: string;
  variant: Variant;
  condition: Condition;
  classification: string;   // as written on the report
  source: Source;
}

/** New evidence about a variant from a database or expert panel (simulated in the demo). */
export interface EvidenceUpdate {
  id: string;
  controlTitle: Bilingual;  // label for the judge's demo control
  evidenceDate: string;     // date the evidence was published
  gene: string;
  variant: Variant;
  condition: Condition;
  classification: string;
  source: Source;
}

export type MatchOutcome =
  | "different_gene"
  | "different_variant"
  | "different_condition"
  | "same_interpretation"
  | "changed_interpretation"
  | "unrecognized_classification";

export type CompareField = "gene" | "variant" | "condition" | "classification";

export interface MatchResult {
  geneMatch: boolean;
  variantMatch: boolean;
  conditionMatch: boolean;
  previousClassification: ClassificationCode;
  newClassification: ClassificationCode;
  outcome: MatchOutcome;
  opensReview: boolean;
  differences: CompareField[];
}

export interface LabResult {
  test: string;
  value: number;
  unit: string;
  refLow: number;
  refHigh: number;
  flag: "H" | "L";
}
export interface LabReport {
  id: string;
  patientId: PatientId;
  drawDate: string;         // date the blood sample was collected
  reportDate: string;       // date the lab issued the report
  lab: Bilingual;
  results: LabResult[];
  history: Bilingual[];
}

export type BiotinAnswer = "yes_before" | "started_after" | "no" | "unsure";
export interface BiotinAnswerRecord {
  id: string;
  labReportId: string;
  answer: BiotinAnswer;
  recordedAt: string;
  corrects: string | null;  // id of the answer this one replaced
}

export type ReviewStatus = "pending" | "approved" | "dismissed" | "withdrawn";
export type FollowUp = "recommended" | "not_needed";

export interface Draft {
  text: string;
  updatedAt: string;
  /** True when the other language was edited after this one: it may no longer match. */
  needsCheck: boolean;
}

export interface Review {
  id: string;
  kind: "genetic" | "biotin";
  patientId: PatientId;
  createdAt: string;
  status: ReviewStatus;
  // genetic
  reportId?: string;
  updateId?: string;
  match?: MatchResult;
  // biotin
  labReportId?: string;
  biotinAnswerId?: string;
  // clinician work
  drafts: Record<Lang, Draft>;
  followUp: FollowUp | null;
  decidedAt?: string;
  dismissReason?: string;
  withdrawnReason?: "answer_corrected";
  messageId?: string;
  /** Shared automatically under the doctor's standing approval (no manual review). */
  autoShared?: boolean;
}

/** A doctor's one-time instruction: share low-risk reclassifications for this patient automatically. */
export interface StandingApproval {
  enabled: boolean;
  followUp: FollowUp;
  setAt: string;
}

/** What the patient actually sees. Only created by approving a review. */
export interface PublishedMessage {
  id: string;
  reviewId: string;
  patientId: PatientId;
  kind: "genetic" | "biotin";
  sharedAt: string;         // date the clinician shared it
  texts: Partial<Record<Lang, string>>; // only languages the clinician approved
  followUp: FollowUp;
  basedOn: { reportId?: string; updateId?: string; labReportId?: string; biotinAnswerId?: string };
  answerCorrectedAt?: string; // the answer it was based on was later corrected
  autoShared?: { standingSetAt: string }; // sent under a standing approval
}

export interface ProcessedUpdate {
  fingerprint: string;
  updateId: string;
  reportId: string;
  firstProcessedAt: string;
  lastReceivedAt: string;
  timesReceived: number;
  result: MatchResult;
  reviewId: string | null;
}

export type LastEvent =
  | { kind: "genetic"; updateId: string; reportId: string; duplicate: boolean; result: MatchResult; reviewId: string | null; autoShared?: boolean; at: string }
  | { kind: "reset"; at: string };

export interface DemoState {
  version: 1;
  lang: Lang;
  role: Role;
  patientId: PatientId;
  seq: number;
  processed: ProcessedUpdate[];
  reviews: Review[];
  messages: PublishedMessage[];
  biotinAnswers: BiotinAnswerRecord[];
  lastEvent: LastEvent | null;
  selectedReviewId: string | null;
  standing?: Partial<Record<PatientId, StandingApproval>>; // optional: older saved states have none
}
