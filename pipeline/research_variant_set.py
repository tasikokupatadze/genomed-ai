#!/usr/bin/env python3
"""Pick the fixed Evo 2 benchmark set from data/brca1_clinvar.csv (real ClinVar data, GRCh37).

Rules (decided BEFORE any scoring):
- BRCA1 single-letter (SNV) MISSENSE variants only. Mixing in stop/silent/intronic
  changes would let a model "win" just by telling variant types apart.
- ClinVar review status "reviewed by expert panel" only.
- Label 1 = Pathogenic / Likely pathogenic, label 0 = Benign / Likely benign. VUS and conflicting excluded.
- Up to 60 per label, random with a fixed seed, then split 50/50 per label into
  "calibration" (to choose the cut-off) and "test" (to measure agreement).

  python pipeline/research_variant_set.py
"""
import csv, json, random
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "research"
SEED, PER_LABEL = 2026, 60
PATHO = {"Pathogenic", "Likely pathogenic", "Pathogenic/Likely pathogenic"}
BENIGN = {"Benign", "Likely benign", "Benign/Likely benign"}


def is_missense(r):
    p = r["hgvs_p"]
    return bool(p) and "Ter" not in p and "*" not in p and not p.rstrip(")").endswith("=") and "?" not in p


def main():
    rows = [r for r in csv.DictReader(open(ROOT / "data" / "brca1_clinvar.csv", encoding="utf-8"))
            if len(r["ref"]) == 1 and len(r["alt"]) == 1 and r["review_status"] == "reviewed by expert panel" and is_missense(r)]
    rng = random.Random(SEED)
    chosen = []
    pool_sizes = {}
    for label, classes in ((1, PATHO), (0, BENIGN)):
        pool = sorted((r for r in rows if r["clinical_significance"] in classes), key=lambda r: int(r["variation_id"]))
        pool_sizes[label] = len(pool)
        pick = rng.sample(pool, min(PER_LABEL, len(pool)))
        rng.shuffle(pick)
        half = len(pick) // 2
        for i, r in enumerate(pick):
            chosen.append({
                "variation_id": r["variation_id"], "hgvs_c": r["hgvs_c"], "hgvs_p": r["hgvs_p"],
                "chrom": r["chrom"], "pos": r["pos"], "ref": r["ref"], "alt": r["alt"],
                "expert_label": label, "clinical_significance": r["clinical_significance"],
                "review_status": r["review_status"], "last_evaluated": r["last_evaluated"],
                "split": "calibration" if i < half else "test",
                "source_url": f"https://www.ncbi.nlm.nih.gov/clinvar/variation/{r['variation_id']}/",
            })
    OUT.mkdir(parents=True, exist_ok=True)
    with open(OUT / "variant_set.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(chosen[0].keys()))
        w.writeheader()
        w.writerows(chosen)
    summary = {
        "gene": "BRCA1", "assembly": "GRCh37", "source": "ClinVar variant_summary.txt (via data/brca1_clinvar.csv)",
        "selection": "SNV missense; reviewed by expert panel; P/LP vs B/LB", "seed": SEED,
        "eligible": {"pathogenic": pool_sizes[1], "benign": pool_sizes[0]},
        "selected": {
            split: {"pathogenic": sum(1 for c in chosen if c["split"] == split and c["expert_label"] == 1),
                    "benign": sum(1 for c in chosen if c["split"] == split and c["expert_label"] == 0)}
            for split in ("calibration", "test")
        },
    }
    (OUT / "variant_set_summary.json").write_text(json.dumps(summary, indent=2) + "\n")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
