// Research data shipped with the app. results.json is only "complete" after a real
// Evo 2 run (pipeline/score_variants.py + analyze_benchmark.py); nothing here is estimated.
import summaryJson from "../../data/research/variant_set_summary.json";
import resultsJson from "../../data/research/results.json";

export interface VariantSetSummary {
  gene: string; assembly: string; source: string; selection: string; seed: number;
  eligible: { pathogenic: number; benign: number };
  selected: Record<"calibration" | "test", { pathogenic: number; benign: number }>;
}
export interface ResearchVariant {
  variation_id: string; hgvs_c: string; hgvs_p: string; clinical_significance: string;
  expert_label: number; split: "calibration" | "test"; source_url: string;
  score: number; model_call: number; agrees: boolean;
}
export type ResearchResults =
  | { status: "not_run" }
  | {
      status: "complete"; generated_at: string; model: string; method: "next_base" | "forward"; window_bp: number;
      scored_on: string[]; n_scored: number; n_failed: number;
      auroc_all: number; auroc_all_ci95: [number, number]; auroc_test: number; auroc_test_ci95: [number, number];
      cutoff: number; calibration_balanced_accuracy: number; test_agreement: number; n_test: number;
      variants: ResearchVariant[];
    };

export const VARIANT_SET = summaryJson as VariantSetSummary;
export const RESULTS = resultsJson as ResearchResults;
