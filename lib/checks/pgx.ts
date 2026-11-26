import "server-only";
import { drugClassOf, norm, pgxTable } from "../data";
import { medCheckNames } from "../meds";
import type { Medication, PgxFinding, PgxResult } from "../types";

/** Table lookup against data/pgx.csv. Not an AI prediction. */
export function checkPgx(results: PgxResult[], meds: Medication[]): PgxFinding[] {
  const table = pgxTable();
  const findings: PgxFinding[] = [];
  for (const r of results) {
    for (const row of table) {
      if (norm(row.gene) !== norm(r.gene) || norm(row.variant_or_phenotype) !== norm(r.result)) continue;
      const patient_takes = meds
        .filter((m) => medCheckNames(m).some((name) => {
          const cls = drugClassOf(name);
          return norm(name) === norm(row.drug) || (cls !== null && norm(cls) === norm(row.drug));
        }))
        .map((m) => m.name);
      findings.push({
        kind: "pgx",
        gene: row.gene,
        result: r.result,
        drug: row.drug,
        effect: row.effect,
        guideline_summary: row.guideline_summary,
        source_url: row.source_url,
        patient_takes,
      });
    }
  }
  // Findings for drugs the patient currently takes come first.
  return findings.sort((a, b) => b.patient_takes.length - a.patient_takes.length);
}

export const pgxOptions = () =>
  pgxTable().map((r) => ({ gene: r.gene, result: r.variant_or_phenotype }));
