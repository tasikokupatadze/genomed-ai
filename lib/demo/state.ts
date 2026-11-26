// All demo state changes in one pure function, kept separate from the UI so it can be tested.
import { evaluateBiotinAnswer } from "./biotin.ts";
import { EVIDENCE_UPDATES, GENETIC_REPORT, LAB_REPORT, seedBiotinDraft, seedGeneticDraft } from "./fixtures.ts";
import { matchUpdate, updateFingerprint } from "./matching.ts";
import type {
  BiotinAnswer, DemoState, FollowUp, Lang, PatientId, PublishedMessage, Review, Role,
} from "./types.ts";

export const GENETIC_REPORTS = [GENETIC_REPORT];

export function initialState(): DemoState {
  return {
    version: 1,
    lang: "en",
    role: "patient",
    patientId: "pt-nino",
    seq: 0,
    processed: [],
    reviews: [],
    messages: [],
    biotinAnswers: [],
    lastEvent: null,
    selectedReviewId: null,
  };
}

export type Action =
  | { type: "setLang"; lang: Lang }
  | { type: "setRole"; role: Role }
  | { type: "setPatient"; patientId: PatientId }
  | { type: "selectReview"; reviewId: string | null }
  | { type: "processUpdate"; updateId: string }
  | { type: "editDraft"; reviewId: string; lang: Lang; text: string }
  | { type: "confirmTranslation"; reviewId: string; lang: Lang }
  | { type: "setFollowUp"; reviewId: string; followUp: FollowUp }
  | { type: "approve"; reviewId: string }
  | { type: "dismiss"; reviewId: string; reason: string }
  | { type: "answerBiotin"; answer: BiotinAnswer }
  | { type: "reset" };

const other = (l: Lang): Lang => (l === "en" ? "ka" : "en");

/** A language is out of date when the other language was edited and this one was not checked since. */
export function isStale(review: Review, lang: Lang): boolean {
  return review.drafts[lang].needsCheck;
}

/** Languages that would be shared if the clinician approved now. */
export function shareableLangs(review: Review): Lang[] {
  return (["en", "ka"] as Lang[]).filter((l) => !isStale(review, l) && review.drafts[l].text.trim() !== "");
}

export function canApprove(review: Review): { ok: boolean; reason?: "follow_up" | "text" | "status" } {
  if (review.status !== "pending") return { ok: false, reason: "status" };
  if (!review.followUp) return { ok: false, reason: "follow_up" };
  if (!shareableLangs(review).length) return { ok: false, reason: "text" };
  return { ok: true };
}

export const currentBiotinAnswer = (s: DemoState) =>
  s.biotinAnswers.filter((a) => a.labReportId === LAB_REPORT.id).at(-1) ?? null;

function nextId(s: DemoState, prefix: string): [DemoState, string] {
  const seq = s.seq + 1;
  return [{ ...s, seq }, `${prefix}-${String(seq).padStart(4, "0")}`];
}

function updateReview(s: DemoState, id: string, change: (r: Review) => Review): DemoState {
  return { ...s, reviews: s.reviews.map((r) => (r.id === id ? change(r) : r)) };
}

export function reduce(state: DemoState, action: Action, now: string): DemoState {
  let s = state;
  switch (action.type) {
    case "setLang":
      return { ...s, lang: action.lang };
    case "setRole":
      return { ...s, role: action.role };
    case "setPatient":
      return { ...s, patientId: action.patientId };
    case "selectReview":
      return { ...s, selectedReviewId: action.reviewId };
    case "reset":
      return { ...initialState(), lang: s.lang, lastEvent: { kind: "reset", at: now } };

    case "processUpdate": {
      const update = EVIDENCE_UPDATES.find((u) => u.id === action.updateId);
      if (!update) return s;
      for (const report of GENETIC_REPORTS) {
        const fp = updateFingerprint(report.id, update);
        const seen = s.processed.find((p) => p.fingerprint === fp);
        if (seen) {
          // Replay of the same evidence: count it, but never create a second review or message.
          s = {
            ...s,
            processed: s.processed.map((p) =>
              p.fingerprint === fp ? { ...p, timesReceived: p.timesReceived + 1, lastReceivedAt: now } : p),
            lastEvent: { kind: "genetic", updateId: update.id, reportId: report.id, duplicate: true, result: seen.result, reviewId: seen.reviewId, at: now },
          };
          continue;
        }
        const result = matchUpdate(report, update);
        let reviewId: string | null = null;
        if (result.opensReview) {
          [s, reviewId] = nextId(s, "REV");
          const seed = seedGeneticDraft(report, update);
          const review: Review = {
            id: reviewId, kind: "genetic", patientId: report.patientId, createdAt: now, status: "pending",
            reportId: report.id, updateId: update.id, match: result,
            drafts: { en: { text: seed.en, updatedAt: now, needsCheck: false }, ka: { text: seed.ka, updatedAt: now, needsCheck: false } },
            followUp: null,
          };
          s = { ...s, reviews: [...s.reviews, review] };
        }
        s = {
          ...s,
          processed: [...s.processed, {
            fingerprint: fp, updateId: update.id, reportId: report.id,
            firstProcessedAt: now, lastReceivedAt: now, timesReceived: 1, result, reviewId,
          }],
          lastEvent: { kind: "genetic", updateId: update.id, reportId: report.id, duplicate: false, result, reviewId, at: now },
        };
      }
      return s;
    }

    case "editDraft":
      // One call = one committed edit (the UI commits when the text box loses focus).
      return updateReview(s, action.reviewId, (r) => {
        const l = action.lang, o = other(l);
        if (r.status !== "pending" || r.drafts[l].text === action.text) return r;
        // Editing an out-of-date language is catching it up; any other edit puts the other language out of date.
        const catchingUp = r.drafts[l].needsCheck;
        return {
          ...r,
          drafts: {
            [l]: { text: action.text, updatedAt: now, needsCheck: false },
            [o]: catchingUp ? r.drafts[o] : { ...r.drafts[o], needsCheck: true },
          } as Review["drafts"],
        };
      });

    case "confirmTranslation":
      return updateReview(s, action.reviewId, (r) =>
        r.status !== "pending" ? r
          : { ...r, drafts: { ...r.drafts, [action.lang]: { ...r.drafts[action.lang], needsCheck: false } } });

    case "setFollowUp":
      return updateReview(s, action.reviewId, (r) => (r.status !== "pending" ? r : { ...r, followUp: action.followUp }));

    case "approve": {
      const review = s.reviews.find((r) => r.id === action.reviewId);
      if (!review || !canApprove(review).ok) return s;
      let messageId: string;
      [s, messageId] = nextId(s, "MSG");
      const langs = shareableLangs(review);
      const message: PublishedMessage = {
        id: messageId, reviewId: review.id, patientId: review.patientId, kind: review.kind, sharedAt: now,
        texts: Object.fromEntries(langs.map((l) => [l, review.drafts[l].text])), // exactly as approved
        followUp: review.followUp!,
        basedOn: { reportId: review.reportId, updateId: review.updateId, labReportId: review.labReportId, biotinAnswerId: review.biotinAnswerId },
      };
      s = { ...s, messages: [...s.messages, message] };
      return updateReview(s, review.id, (r) => ({ ...r, status: "approved", decidedAt: now, messageId }));
    }

    case "dismiss": {
      const reason = action.reason.trim();
      if (!reason) return s;
      return updateReview(s, action.reviewId, (r) =>
        r.status !== "pending" ? r : { ...r, status: "dismissed", decidedAt: now, dismissReason: reason });
    }

    case "answerBiotin": {
      const current = currentBiotinAnswer(s);
      if (current?.answer === action.answer) return s; // same answer again: nothing changes
      let answerId: string;
      [s, answerId] = nextId(s, "ANS");
      s = {
        ...s,
        biotinAnswers: [...s.biotinAnswers, {
          id: answerId, labReportId: LAB_REPORT.id, answer: action.answer, recordedAt: now, corrects: current?.id ?? null,
        }],
      };
      const { opensReview } = evaluateBiotinAnswer(action.answer);

      // Recompute: a pending flag based on an older answer must not stay active.
      s = {
        ...s,
        reviews: s.reviews.map((r) =>
          r.kind === "biotin" && r.status === "pending" && r.biotinAnswerId !== answerId
            ? { ...r, status: "withdrawn", withdrawnReason: "answer_corrected", decidedAt: now }
            : r),
        // Shared messages stay in the history, marked as based on a corrected answer.
        messages: s.messages.map((m) =>
          m.kind === "biotin" && m.basedOn.biotinAnswerId !== answerId && !m.answerCorrectedAt
            ? { ...m, answerCorrectedAt: now }
            : m),
      };

      if (opensReview) {
        let reviewId: string;
        [s, reviewId] = nextId(s, "REV");
        const seed = seedBiotinDraft(LAB_REPORT);
        s = {
          ...s,
          reviews: [...s.reviews, {
            id: reviewId, kind: "biotin", patientId: LAB_REPORT.patientId, createdAt: now, status: "pending",
            labReportId: LAB_REPORT.id, biotinAnswerId: answerId,
            drafts: { en: { text: seed.en, updatedAt: now, needsCheck: false }, ka: { text: seed.ka, updatedAt: now, needsCheck: false } },
            followUp: null,
          }],
        };
      }
      return s;
    }
  }
}

/** Messages a patient may see: only published ones. */
export const patientMessages = (s: DemoState, patientId: PatientId) =>
  s.messages.filter((m) => m.patientId === patientId);
