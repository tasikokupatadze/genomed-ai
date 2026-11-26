#!/usr/bin/env python3
"""Build data/brca1_clinvar.csv from ClinVar's variant_summary.txt.gz.

Keeps BRCA1 rows on GRCh37 only (one genome build throughout the project).
Nothing is invented: every column is copied from ClinVar.

Usage:
  python pipeline/build_clinvar.py                       # downloads from NCBI
  python pipeline/build_clinvar.py path/to/variant_summary.txt.gz
  python pipeline/build_clinvar.py path/to/already_filtered.tsv
"""
import csv, gzip, io, re, sys, urllib.request
from pathlib import Path

URL = "https://ftp.ncbi.nlm.nih.gov/pub/clinvar/tab_delimited/variant_summary.txt.gz"
OUT = Path(__file__).resolve().parent.parent / "data" / "brca1_clinvar.csv"
NEEDED = ["VariationID", "Name", "Type", "GeneSymbol", "ClinicalSignificance", "ReviewStatus",
          "LastEvaluated", "RS# (dbSNP)", "Assembly", "Chromosome",
          "PositionVCF", "ReferenceAlleleVCF", "AlternateAlleleVCF", "NumberSubmitters"]
NAME_RE = re.compile(r"^(?P<tx>[^(]+)\(BRCA1\):(?P<c>c\.[^ ]+)(?: \((?P<p>p\.[^)]+)\))?")


def open_source(arg):
    if arg is None:
        print(f"Downloading {URL} ...", file=sys.stderr)
        return io.TextIOWrapper(gzip.GzipFile(fileobj=urllib.request.urlopen(URL)), encoding="utf-8")
    if arg.endswith(".gz"):
        return gzip.open(arg, "rt", encoding="utf-8")
    return open(arg, encoding="utf-8")


def main():
    src = open_source(sys.argv[1] if len(sys.argv) > 1 else None)
    header = src.readline().rstrip("\n").lstrip("#").split("\t")
    missing = [c for c in NEEDED if c not in header]
    if missing:
        sys.exit(f"ClinVar format changed; missing columns: {missing}")
    idx = {c: header.index(c) for c in NEEDED}

    rows = []
    for line in src:
        f = line.rstrip("\n").split("\t")
        get = lambda c: f[idx[c]]
        if get("GeneSymbol") != "BRCA1" or get("Assembly") != "GRCh37":
            continue
        m = NAME_RE.match(get("Name"))
        if not m:
            continue  # large CNVs etc. without a c. name
        rows.append({
            "variation_id": get("VariationID"),
            "transcript": m.group("tx"),
            "hgvs_c": m.group("c"),
            "hgvs_p": m.group("p") or "",
            "name": get("Name"),
            "type": get("Type"),
            "clinical_significance": get("ClinicalSignificance"),
            "review_status": get("ReviewStatus"),
            "last_evaluated": get("LastEvaluated"),
            "rsid": "" if get("RS# (dbSNP)") in ("-1", "") else "rs" + get("RS# (dbSNP)"),
            "assembly": "GRCh37",
            "chrom": get("Chromosome"),
            "pos": get("PositionVCF"),
            "ref": get("ReferenceAlleleVCF"),
            "alt": get("AlternateAlleleVCF"),
            "number_submitters": get("NumberSubmitters"),
        })

    rows.sort(key=lambda r: int(r["variation_id"]))
    with open(OUT, "w", newline="", encoding="utf-8") as out:
        w = csv.DictWriter(out, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    print(f"Wrote {len(rows)} BRCA1 GRCh37 variants to {OUT}", file=sys.stderr)


if __name__ == "__main__":
    main()
