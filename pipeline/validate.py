#!/usr/bin/env python3
"""Offline checks for the data tables, plus optional Evo 2 band calibration.

  python pipeline/validate.py                 # check tables, list TODOs
  python pipeline/validate.py --calibrate     # show proposed Evo 2 band thresholds
  python pipeline/validate.py --calibrate --write-bands --by "Dr. Name"

Calibration uses only scored rows in data/scores.csv and their ClinVar labels.
Thresholds are written only on request, with the reviewer's name, and stay null
if there is not enough data.
"""
import argparse, csv, datetime as dt, json, re, sys
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data"
problems, todos = [], []


def read(name):
    return list(csv.DictReader(open(DATA / name, encoding="utf-8")))


def need(rows, name, cols):
    if rows and set(cols) - set(rows[0].keys()):
        problems.append(f"{name}: missing columns {set(cols) - set(rows[0].keys())}")


def check_tables():
    labs = {r["lab_test"].lower() for r in read("lab_tests.csv")}
    classes = {r["drug_class"].lower() for r in read("drug_classes.csv")}

    eff = read("drug_lab_effects.csv")
    need(eff, "drug_lab_effects.csv", ["drug", "drug_class", "lab_test", "direction", "effect_description", "source_url", "reviewed_by"])
    for i, r in enumerate(eff, 2):
        where = f"drug_lab_effects.csv line {i} ({r['drug'] or r['drug_class']} → {r['lab_test']})"
        if not (r["drug"] or r["drug_class"]):
            problems.append(f"{where}: needs drug or drug_class")
        if r["direction"] not in ("high", "low", "any"):
            problems.append(f"{where}: direction must be high/low/any")
        if r["lab_test"].lower() not in labs:
            problems.append(f"{where}: lab_test not in lab_tests.csv")
        if r["drug_class"] and r["drug_class"].lower() not in classes:
            problems.append(f"{where}: no drug in drug_classes.csv maps to class '{r['drug_class']}'")
        if not r["source_url"]:
            todos.append(f"{where}: add source_url")
        if not r["reviewed_by"]:
            todos.append(f"{where}: needs reviewed_by")

    for i, r in enumerate(read("allergy_classes.csv"), 2):
        if not r["source_url"] or not r["reviewed_by"]:
            todos.append(f"allergy_classes.csv line {i} ({r['drug']}): add source_url / reviewed_by")
    for i, r in enumerate(read("pgx.csv"), 2):
        if not r["source_url"]:
            todos.append(f"pgx.csv line {i} ({r['gene']} → {r['drug']}): add CPIC source_url")
        if not r["guideline_summary"]:
            todos.append(f"pgx.csv line {i} ({r['gene']} → {r['drug']}): add guideline_summary from the source")

    facts = json.load(open(DATA / "context_facts.json", encoding="utf-8"))
    if not facts.get("reviewed_by"):
        todos.append("context_facts.json: needs clinical review (reviewed_by) and Georgian native-speaker review")

    clin = read("brca1_clinvar.csv")
    if any(r.get("assembly") != "GRCh37" for r in clin):
        problems.append("brca1_clinvar.csv: rows not on GRCh37")
    print(f"brca1_clinvar.csv: {len(clin)} BRCA1 variants (GRCh37)")

    pts = json.load(open(DATA / "demo_patients.json", encoding="utf-8"))["patients"]
    date_re = re.compile(r"^\d{4}-\d{2}-\d{2}$")
    for p in pts:
        if not p.get("demo"):
            problems.append(f"demo patient {p['id']}: must be marked \"demo\": true")
        for l in p["labs"]:
            if l.get("ref_low") is None or l.get("ref_high") is None:
                problems.append(f"demo patient {p['id']}: {l['test']} has no reference range from the lab report")
            if not date_re.match(str(l.get("date", ""))):
                problems.append(f"demo patient {p['id']}: {l['test']} needs a YYYY-MM-DD date")
        for m in p["medications"]:
            if not date_re.match(str(m.get("start_date", ""))):
                problems.append(f"demo patient {p['id']}: {m['name']} needs a YYYY-MM-DD start_date")


def calibrate(write: bool, by: str | None):
    clin = {(r["chrom"], r["pos"], r["ref"], r["alt"]): r["clinical_significance"] for r in read("brca1_clinvar.csv")}
    path_lbl = {"Pathogenic", "Likely pathogenic", "Pathogenic/Likely pathogenic"}
    ben_lbl = {"Benign", "Likely benign", "Benign/Likely benign"}
    pts = []
    for r in read("scores.csv"):
        if r["score"] == "":
            continue
        lbl = clin.get((r["chrom"], r["pos"], r["ref"], r["alt"]))
        if lbl in path_lbl:
            pts.append((float(r["score"]), 1))
        elif lbl in ben_lbl:
            pts.append((float(r["score"]), 0))
    n_p, n_b = sum(y for _, y in pts), sum(1 - y for _, y in pts)
    print(f"Scored with a P/LP or B/LB label: {n_p} pathogenic, {n_b} benign")
    if n_p < 20 or n_b < 20:
        print("Not enough labelled scores (need at least 20 of each). Bands stay null: the app shows 'AI estimate unavailable'.")
        return

    # AUROC: chance that a pathogenic variant scores lower than a benign one.
    p_s = sorted(s for s, y in pts if y)
    b_s = sorted(s for s, y in pts if not y)
    import bisect
    auroc = sum(len(b_s) - bisect.bisect_right(b_s, s) + 0.5 * (bisect.bisect_right(b_s, s) - bisect.bisect_left(b_s, s)) for s in p_s) / (n_p * n_b)
    print(f"AUROC (lower score = pathogenic): {auroc:.3f}")

    # Thresholds where >= 90% of variants beyond them share one label (min 10 variants).
    pts.sort()
    lo = hi = None
    for i in range(10, len(pts) + 1):
        if sum(y for _, y in pts[:i]) / i >= 0.9:
            lo = pts[i - 1][0]
    for i in range(10, len(pts) + 1):
        tail = pts[-i:]
        if sum(1 - y for _, y in tail) / i >= 0.9:
            hi = tail[0][0]
    if lo is not None and hi is not None and lo >= hi:
        lo = hi = None
    print(f"Proposed: leans_disruptive_at_or_below={lo}, leans_tolerated_at_or_above={hi}")
    if write:
        if not by:
            sys.exit("--write-bands needs --by (who reviewed these thresholds)")
        out = {
            "_comment": "Written by pipeline/validate.py. 90%-precision thresholds on ClinVar P/LP vs B/LB.",
            "leans_disruptive_at_or_below": lo, "leans_tolerated_at_or_above": hi,
            "calibrated_by": by, "calibrated_on": dt.date.today().isoformat(),
            "n_pathogenic": n_p, "n_benign": n_b, "auroc": round(auroc, 4),
        }
        (DATA / "evo2_bands.json").write_text(json.dumps(out, indent=2) + "\n")
        print("Wrote data/evo2_bands.json")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--calibrate", action="store_true")
    ap.add_argument("--write-bands", action="store_true")
    ap.add_argument("--by")
    a = ap.parse_args()
    check_tables()
    if a.calibrate:
        calibrate(a.write_bands, a.by)
    print(f"\n{len(problems)} problem(s):")
    for p in problems:
        print("  ✗", p)
    print(f"\n{len(todos)} TODO(s) before real use:")
    for t in todos:
        print("  •", t)
    sys.exit(1 if problems else 0)


if __name__ == "__main__":
    main()
