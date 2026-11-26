#!/usr/bin/env python3
"""Compare Evo 2 scores with expert (ClinVar) labels -> data/research/results.json.

- AUROC: chance that a random pathogenic variant scores LOWER than a random benign one
  (0.5 = coin flip, 1.0 = perfect), with a 95% bootstrap interval.
- Cut-off chosen on the CALIBRATION half only (best balanced accuracy), then
  agreement measured on the untouched TEST half.
- Every disagreement on the test half is listed.
Nothing is written unless real scores exist.

  python pipeline/analyze_benchmark.py
"""
import csv, json, random, sys, datetime as dt
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
R = ROOT / "data" / "research"


def auroc(pos, neg):
    """P(score_pathogenic < score_benign); ties count half."""
    if not pos or not neg:
        return None
    wins = sum((p < n) + 0.5 * (p == n) for p in pos for n in neg)
    return wins / (len(pos) * len(neg))


def bootstrap_ci(pos, neg, n=2000, seed=7):
    rng = random.Random(seed)
    vals = sorted(auroc([rng.choice(pos) for _ in pos], [rng.choice(neg) for _ in neg]) for _ in range(n))
    return [round(vals[int(0.025 * n)], 3), round(vals[int(0.975 * n) - 1], 3)]


def best_cutoff(items):
    """Cut-off (score <= c -> 'leans disruptive') with the best balanced accuracy."""
    best = None
    for c in sorted({s for s, _ in items}):
        tp = sum(1 for s, y in items if y == 1 and s <= c)
        tn = sum(1 for s, y in items if y == 0 and s > c)
        P = sum(1 for _, y in items if y == 1) or 1
        N = sum(1 for _, y in items if y == 0) or 1
        bal = (tp / P + tn / N) / 2
        if best is None or bal > best[1]:
            best = (c, bal)
    return best


def main():
    vs = {(r["chrom"], r["pos"], r["ref"], r["alt"]): r for r in csv.DictReader(open(R / "variant_set.csv", encoding="utf-8"))}
    scores_path = R / "scores.csv"
    if not scores_path.exists():
        sys.exit("No data/research/scores.csv yet: run pipeline/score_variants.py first.")
    rows, failed, meta = [], 0, set()
    for s in csv.DictReader(open(scores_path, encoding="utf-8")):
        v = vs.get((s["chrom"], s["pos"], s["ref"], s["alt"]))
        if not v:
            continue
        if s["score"] == "":
            failed += 1
            continue
        meta.add((s["model"], s["method"], s["window_bp"]))
        rows.append({**v, "score": float(s["score"]), "expert_label": int(v["expert_label"]), "scored_at": s["scored_at"]})
    if len(meta) > 1:
        sys.exit(f"Scores come from more than one model/method: {meta}. Score everything with one setup.")
    cal = [r for r in rows if r["split"] == "calibration"]
    test = [r for r in rows if r["split"] == "test"]
    pos = lambda rs: [r["score"] for r in rs if r["expert_label"] == 1]
    neg = lambda rs: [r["score"] for r in rs if r["expert_label"] == 0]
    if min(len(pos(cal)), len(neg(cal)), len(pos(test)), len(neg(test))) < 5:
        sys.exit("Too few scored variants in a split/label (need at least 5 each).")

    cutoff, cal_bal = best_cutoff([(r["score"], r["expert_label"]) for r in cal])
    for r in rows:
        r["model_call"] = 1 if r["score"] <= cutoff else 0
        r["agrees"] = r["model_call"] == r["expert_label"]
    agree = sum(r["agrees"] for r in test) / len(test)
    model, method, window = next(iter(meta))
    results = {
        "status": "complete",
        "generated_at": dt.datetime.now().isoformat(timespec="seconds"),
        "model": model, "method": method, "window_bp": int(window),
        "scored_on": sorted({r["scored_at"] for r in rows}),
        "n_scored": len(rows), "n_failed": failed,
        "auroc_all": round(auroc(pos(rows), neg(rows)), 3), "auroc_all_ci95": bootstrap_ci(pos(rows), neg(rows)),
        "auroc_test": round(auroc(pos(test), neg(test)), 3), "auroc_test_ci95": bootstrap_ci(pos(test), neg(test)),
        "cutoff": round(cutoff, 4), "calibration_balanced_accuracy": round(cal_bal, 3),
        "test_agreement": round(agree, 3), "n_test": len(test),
        "variants": [
            {k: r[k] for k in ("variation_id", "hgvs_c", "hgvs_p", "clinical_significance", "expert_label", "split", "source_url")}
            | {"score": round(r["score"], 4), "model_call": r["model_call"], "agrees": r["agrees"]}
            for r in sorted(rows, key=lambda r: r["score"])
        ],
    }
    (R / "results.json").write_text(json.dumps(results, indent=2) + "\n")
    print({k: v for k, v in results.items() if k != "variants"})


if __name__ == "__main__":
    main()
