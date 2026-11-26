import { normalizeClassification, normalizeGene, normalizeId } from "./normalize.ts";
import type { CompareField, EvidenceUpdate, GeneticReport, MatchResult } from "./types.ts";

/**
 * Decides whether new evidence is about the SAME finding as the original report.
 * The gene name alone is not enough: the variant ID and the condition ID must both match.
 * A review opens only when both match and the classification has changed.
 */
export function matchUpdate(report: GeneticReport, update: EvidenceUpdate): MatchResult {
  const geneMatch = normalizeGene(report.gene) === normalizeGene(update.gene);
  const variantMatch = normalizeId(report.variant.id) === normalizeId(update.variant.id);
  const conditionMatch = normalizeId(report.condition.id) === normalizeId(update.condition.id);
  const previousClassification = normalizeClassification(report.classification);
  const newClassification = normalizeClassification(update.classification);

  const differences: CompareField[] = [];
  if (!geneMatch) differences.push("gene");
  if (!variantMatch) differences.push("variant");
  if (!conditionMatch) differences.push("condition");
  if (newClassification !== previousClassification) differences.push("classification");

  let outcome: MatchResult["outcome"];
  if (!variantMatch) outcome = geneMatch ? "different_variant" : "different_gene";
  else if (!conditionMatch) outcome = "different_condition";
  else if (newClassification === "unknown") outcome = "unrecognized_classification";
  else if (newClassification !== previousClassification) outcome = "changed_interpretation";
  else outcome = "same_interpretation";

  return {
    geneMatch, variantMatch, conditionMatch,
    previousClassification, newClassification,
    outcome,
    opensReview: outcome === "changed_interpretation",
    differences,
  };
}

/** Two deliveries of the same evidence produce the same fingerprint (used to block duplicates). */
export function updateFingerprint(reportId: string, u: EvidenceUpdate): string {
  return [
    reportId,
    normalizeId(u.variant.id),
    normalizeId(u.condition.id),
    normalizeClassification(u.classification),
    normalizeId(u.source.submitter),
    u.evidenceDate,
  ].join("|");
}
