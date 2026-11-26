import type { ClassificationCode } from "./types.ts";

/** "syn var 000117", "SYN_VAR_000117 " and "SYN-VAR-000117" all become "SYN-VAR-000117". */
export function normalizeId(s: string): string {
  return s.normalize("NFKC").trim().toUpperCase().replace(/[\s_‐-―]+/g, "-").replace(/-+/g, "-");
}

export const normalizeGene = (s: string) => s.normalize("NFKC").trim().toUpperCase();

const CLASS_MAP: Record<string, ClassificationCode> = {
  "pathogenic": "pathogenic",
  "p": "pathogenic",
  "likely pathogenic": "likely_pathogenic",
  "lp": "likely_pathogenic",
  "uncertain significance": "vus",
  "variant of uncertain significance": "vus",
  "vus": "vus",
  "likely benign": "likely_benign",
  "lb": "likely_benign",
  "benign": "benign",
  "b": "benign",
};

/** Maps the many ways a classification is written onto one code. */
export function normalizeClassification(s: string): ClassificationCode {
  const k = s.normalize("NFKC").toLowerCase().replace(/[_\-]+/g, " ").replace(/\s+/g, " ").trim();
  return CLASS_MAP[k] ?? "unknown";
}
