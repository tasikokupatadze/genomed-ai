import "server-only";
import { readCsv } from "../data";
import { matchIngredient, type DrugListRow } from "./match";
import type { MedIngredient } from "../types";

export const drugListRows = () => readCsv("drug_list.csv") as unknown as DrugListRow[];

/** Attach a drug_list.csv match (or null) to each ingredient. The class comes only from the table. */
export function withMatches(ingredients: { name: string; strength?: string | null; unit?: string | null }[]): MedIngredient[] {
  const rows = drugListRows();
  return ingredients
    .filter((i) => i.name && i.name.trim())
    .map((i) => {
      const m = matchIngredient(i.name, rows);
      return {
        name: i.name.trim(),
        strength: i.strength?.toString().trim() || null,
        unit: i.unit?.trim() || null,
        matched_ingredient: m?.row.ingredient ?? null,
        drug_class: m?.row.drug_class || null,
      };
    });
}
