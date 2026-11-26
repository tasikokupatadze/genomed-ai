import type { ClassificationCode } from "./types.ts";

/**
 * Which reclassifications a doctor may pre-approve for automatic sharing.
 * Only uncertain -> (likely) benign: good news with no action to take.
 * Anything toward pathogenic, or from any other starting point, always waits for review.
 */
export function isLowRiskChange(previous: ClassificationCode, next: ClassificationCode): boolean {
  return previous === "vus" && (next === "likely_benign" || next === "benign");
}
