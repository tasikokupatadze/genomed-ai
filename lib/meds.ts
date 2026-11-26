import type { Medication } from "./types";

/**
 * Names the checks should use for a medication: the matched ingredients from
 * data/drug_list.csv when known (scanned boxes, combination products), otherwise its name.
 */
export function medCheckNames(m: Medication): string[] {
  const matched = (m.ingredients ?? []).map((i) => i.matched_ingredient).filter((x): x is string => Boolean(x));
  return matched.length ? matched : [m.name];
}
