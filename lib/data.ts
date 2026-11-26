import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseCsv } from "./csv";

export const DATA_DIR = path.join(process.cwd(), "data");

const cache = new Map<string, unknown>();
function cached<T>(key: string, load: () => T): T {
  if (process.env.NODE_ENV !== "production") return load(); // pick up CSV edits in dev
  if (!cache.has(key)) cache.set(key, load());
  return cache.get(key) as T;
}

export const readCsv = (file: string) =>
  cached(file, () => parseCsv(readFileSync(path.join(DATA_DIR, file), "utf-8")));
export const readJson = <T>(file: string) =>
  cached(file, () => JSON.parse(readFileSync(path.join(DATA_DIR, file), "utf-8")) as T);

export const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

// ---- typed tables ----
export interface DrugLabEffect {
  drug: string; drug_class: string; lab_test: string; direction: "high" | "low" | "any";
  effect_description: string; source_url: string; reviewed_by: string;
}
export const drugLabEffects = () => readCsv("drug_lab_effects.csv") as unknown as DrugLabEffect[];

export const drugClassOf = (drug: string): string | null => {
  const row = readCsv("drug_classes.csv").find((r) => norm(r.drug) === norm(drug));
  return row ? row.drug_class : null;
};

export interface AllergyClassRow {
  drug: string; class: string; cross_reactive_classes: string; source_url: string; reviewed_by: string;
}
export const allergyClasses = () => readCsv("allergy_classes.csv") as unknown as AllergyClassRow[];

export interface PgxRow {
  gene: string; variant_or_phenotype: string; drug: string; effect: string;
  guideline_summary: string; source_url: string;
}
export const pgxTable = () => readCsv("pgx.csv") as unknown as PgxRow[];

/** Canonical lab name for whatever the doctor typed (ALT, "alanine aminotransferase", ...). */
export const canonicalLab = (name: string): string => {
  const n = norm(name);
  for (const r of readCsv("lab_tests.csv")) {
    if (norm(r.lab_test) === n || r.aliases.split("|").map(norm).includes(n)) return r.lab_test;
  }
  return name.trim();
};
export const knownLabTests = () => readCsv("lab_tests.csv").map((r) => r.lab_test);

export interface ClinvarRow {
  variation_id: string; transcript: string; hgvs_c: string; hgvs_p: string; name: string;
  type: string; clinical_significance: string; review_status: string; last_evaluated: string;
  rsid: string; chrom: string; pos: string; ref: string; alt: string;
}
export const clinvar = () => readCsv("brca1_clinvar.csv") as unknown as ClinvarRow[];

export interface ScoreRow {
  chrom: string; pos: string; ref: string; alt: string; hgvs_c: string; score: string;
  model: string; window_bp: string; scored_at: string;
}
export const scores = () => readCsv("scores.csv") as unknown as ScoreRow[];

export interface Evo2Bands {
  leans_disruptive_at_or_below: number | null;
  leans_tolerated_at_or_above: number | null;
}
export const evo2Bands = () => readJson<Evo2Bands>("evo2_bands.json");

export interface ContextFacts {
  facts: {
    [k: string]: unknown;
    variant_class: Record<string, { en: string; ka: string }>;
    gene_function: Record<string, { en: string; ka: string }>;
  };
}
export const contextFacts = () => readJson<ContextFacts>("context_facts.json");
