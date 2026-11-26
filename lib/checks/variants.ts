import "server-only";
import { clinvar, evo2Bands, scores, type ClinvarRow } from "../data";
import type { Evo2Band, VariantFinding, VariantResult } from "../types";

/**
 * Normalise HGVS c. notation so "c.68_69delAG" matches ClinVar's "c.68_69del".
 * (ClinVar drops the deleted/duplicated bases from the name.)
 */
export function normalizeHgvsC(s: string): string {
  let v = s.trim().replace(/\s+/g, "");
  const colon = v.lastIndexOf(":");
  if (colon >= 0) v = v.slice(colon + 1);
  if (!v.startsWith("c.")) v = "c." + v;
  return v.replace(/(del|dup)[ACGT]+$/i, "$1").replace(/^c\./i, "c.");
}

export function findClinvar(hgvs: string): ClinvarRow | undefined {
  const target = normalizeHgvsC(hgvs).toLowerCase();
  return clinvar().find((r) => r.hgvs_c.toLowerCase() === target);
}

const BAND_LABEL: Record<Evo2Band, string> = {
  leans_tolerated: "leans tolerated",
  unclear: "unclear",
  leans_disruptive: "leans disruptive",
};

/**
 * Evo 2 band from data/scores.csv (written offline by pipeline/score_variants.py).
 * Never estimated here: no score or no calibrated thresholds => unavailable.
 */
function evo2For(row: ClinvarRow): VariantFinding["evo2"] {
  const s = scores().find(
    (x) => x.chrom === row.chrom && x.pos === row.pos && x.ref === row.ref && x.alt === row.alt,
  );
  const value = s && s.score !== "" ? Number(s.score) : NaN;
  const { leans_disruptive_at_or_below: lo, leans_tolerated_at_or_above: hi } = evo2Bands();
  if (!Number.isFinite(value) || lo === null || hi === null) return { available: false };
  const band: Evo2Band = value <= lo ? "leans_disruptive" : value >= hi ? "leans_tolerated" : "unclear";
  return { available: true, band, label: BAND_LABEL[band] };
}

export function checkVariants(variants: VariantResult[]): VariantFinding[] {
  return variants
    .filter((v) => v.gene.toUpperCase() === "BRCA1")
    .map((v) => {
      const row = findClinvar(v.hgvs_c);
      if (!row) return { kind: "variant", gene: v.gene, hgvs_c: v.hgvs_c, found: false, evo2: { available: false } };
      return {
        kind: "variant",
        gene: "BRCA1",
        hgvs_c: row.hgvs_c,
        found: true,
        clinvar: {
          variation_id: row.variation_id,
          name: row.name,
          hgvs_p: row.hgvs_p,
          clinical_significance: row.clinical_significance,
          review_status: row.review_status,
          last_evaluated: row.last_evaluated,
          url: `https://www.ncbi.nlm.nih.gov/clinvar/variation/${row.variation_id}/`,
        },
        evo2: evo2For(row),
      };
    });
}
