import type { BiotinAnswer } from "./types.ts";

export type BiotinFlag = "possible_interference" | "none" | "unresolved";

/**
 * Supplement timing rule for ONE blood sample.
 * Only biotin taken before the draw can affect that sample, so only that answer opens a review.
 * The rule never concludes that biotin caused the result: it asks a clinician to look.
 */
export function evaluateBiotinAnswer(answer: BiotinAnswer): { flag: BiotinFlag; opensReview: boolean } {
  switch (answer) {
    case "yes_before":
      return { flag: "possible_interference", opensReview: true };
    case "started_after":
      return { flag: "none", opensReview: false }; // timing recorded; no flag for this sample
    case "no":
      return { flag: "none", opensReview: false };
    case "unsure":
      return { flag: "unresolved", opensReview: false }; // history stays open
  }
}
