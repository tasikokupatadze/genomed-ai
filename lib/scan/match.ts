// Matching a medicine ingredient (read from a box or typed) against data/drug_list.csv.
// Pure functions: no file access, so they can be unit-tested.

export interface DrugListRow { ingredient: string; drug_class: string; synonyms: string; source_url: string }
export interface IngredientMatch {
  row: DrugListRow;
  via: "exact" | "synonym" | "fuzzy";
  distance: number;
}

export function normalizeName(s: string): string {
  return s.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, " ").replace(/\s+/g, " ").trim();
}

/** Classic edit distance (insert, delete, substitute = 1). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

/** Small typos only: none under 5 letters, 1 for 5-8 letters, 2 for longer names. */
export const allowedTypos = (len: number) => (len < 5 ? 0 : len < 9 ? 1 : 2);

/**
 * Case-insensitive match on the ingredient name or a listed synonym (incl. Georgian),
 * then a small-typo fuzzy match. Returns null when nothing is close enough, or when two
 * different ingredients are equally close (never guess).
 */
export function matchIngredient(name: string, rows: DrugListRow[]): IngredientMatch | null {
  const n = normalizeName(name);
  if (!n) return null;
  const names = (r: DrugListRow) => [r.ingredient, ...r.synonyms.split("|")].map(normalizeName).filter(Boolean);

  for (const r of rows) if (normalizeName(r.ingredient) === n) return { row: r, via: "exact", distance: 0 };
  for (const r of rows) if (names(r).includes(n)) return { row: r, via: "synonym", distance: 0 };

  const max = allowedTypos(n.length);
  if (!max) return null;
  let best: { row: DrugListRow; d: number } | null = null;
  let tie = false;
  for (const r of rows) {
    const d = Math.min(...names(r).map((x) => levenshtein(n, x)));
    if (d > max) continue;
    if (!best || d < best.d) { best = { row: r, d }; tie = false; }
    else if (d === best.d && best.row.ingredient !== r.ingredient) tie = true;
  }
  return best && !tie ? { row: best.row, via: "fuzzy", distance: best.d } : null;
}
