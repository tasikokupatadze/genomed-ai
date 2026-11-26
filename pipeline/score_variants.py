#!/usr/bin/env python3
"""Offline Evo 2 scoring for BRCA1 variants -> data/scores.csv.

score = log-likelihood(variant window) - log-likelihood(reference window)
on an 8,192-bp window around each variant on chr17, GRCh37 (hg19) only.
More negative = the model finds the variant sequence less likely.

The response format of NVIDIA's hosted forward endpoint has NOT been verified
yet (docs were not reachable when this was written). So:
  1. Run `--probe` first. It makes ONE call, saves the raw response, decodes it
     and checks that the model's next-base predictions match the sequence
     (this confirms the logits layer and the byte tokenizer).
  2. Only after a passing probe will batch scoring run.
Any failure leaves the score empty. Scores are never generated or estimated.

Setup:
  pip install numpy requests
  export NVIDIA_API_KEY=...            # from build.nvidia.com
  # GRCh37 chr17 FASTA (hg19 uses "chr17"; same coordinates as GRCh37):
  curl -O https://hgdownload.soe.ucsc.edu/goldenPath/hg19/chromosomes/chr17.fa.gz

Usage:
  python pipeline/score_variants.py --fasta chr17.fa.gz --probe
  python pipeline/score_variants.py --fasta chr17.fa.gz --hgvs c.68_69del c.4402A>G
  python pipeline/score_variants.py --fasta chr17.fa.gz --classes Pathogenic Benign --snv-only --limit 200
"""
import argparse, base64, csv, datetime as dt, gzip, io, json, os, sys, time
from pathlib import Path

import numpy as np
import requests

ROOT = Path(__file__).resolve().parent.parent
CLINVAR = ROOT / "data" / "brca1_clinvar.csv"
SCORES = ROOT / "data" / "scores.csv"
PROBE_OK = ROOT / "pipeline" / ".probe_ok.json"
PROBE_RAW = ROOT / "pipeline" / "probe_response.json"
WINDOW = 8192
FIELDS = ["chrom", "pos", "ref", "alt", "hgvs_c", "score", "model", "window_bp", "scored_at"]

# UNVERIFIED defaults: confirm with --probe and override with flags/env if needed.
DEFAULT_URL = os.environ.get("EVO2_URL", "https://health.api.nvidia.com/v1/biology/arc/evo2-40b/forward")
DEFAULT_LAYER = os.environ.get("EVO2_LOGITS_LAYER", "unembed")
NVCF_STATUS = "https://api.nvcf.nvidia.com/v2/nvcf/pexec/status/{}"


# ---------- reference genome ----------
def load_chr17(path: str) -> str:
    opener = gzip.open if path.endswith(".gz") else open
    seq, on = [], False
    with opener(path, "rt") as f:
        for line in f:
            if line.startswith(">"):
                name = line[1:].split()[0]
                on = name in ("chr17", "17")
                continue
            if on:
                seq.append(line.strip())
    if not seq:
        sys.exit("chr17 not found in FASTA")
    return "".join(seq).upper()


def windows(chrom_seq: str, pos: int, ref: str, alt: str):
    """Reference and variant windows of exactly WINDOW bp, variant near the centre.
    pos is the 1-based VCF position. Returns (ref_window, alt_window) or raises."""
    i = pos - 1
    if chrom_seq[i:i + len(ref)] != ref:
        raise ValueError(f"REF mismatch at {pos}: genome has {chrom_seq[i:i+len(ref)]}, ClinVar has {ref}")
    start = i - WINDOW // 2
    if start < 0:
        raise ValueError("window runs off chromosome start")
    ref_win = chrom_seq[start:start + WINDOW]
    # Apply the change, then extend on the right so the alt window is also WINDOW bp.
    alt_full = chrom_seq[start:i] + alt + chrom_seq[i + len(ref):start + WINDOW + len(ref) + abs(len(ref) - len(alt))]
    alt_win = alt_full[:WINDOW]
    if len(ref_win) != WINDOW or len(alt_win) != WINDOW:
        raise ValueError("window runs off chromosome end")
    if set(ref_win + alt_win) - set("ACGTN"):
        raise ValueError("unexpected characters in window")
    return ref_win, alt_win


# ---------- API ----------
def call_forward(seq: str, url: str, layer: str, key: str) -> dict:
    headers = {"Authorization": f"Bearer {key}", "Accept": "application/json"}
    r = requests.post(url, headers=headers, json={"sequence": seq, "output_layers": [layer]}, timeout=300)
    # NVCF may answer 202 + NVCF-REQID and expect polling (unverified for this endpoint).
    while r.status_code == 202:
        req_id = r.headers.get("NVCF-REQID")
        if not req_id:
            raise RuntimeError("202 without NVCF-REQID header")
        time.sleep(5)
        r = requests.get(NVCF_STATUS.format(req_id), headers=headers, timeout=300)
    if r.status_code != 200:
        raise RuntimeError(f"HTTP {r.status_code}: {r.text[:500]}")
    return r.json()


def decode_logits(resp: dict, layer: str) -> np.ndarray:
    """Find a (L, V) logits array in the response. Handles a base64 .npz in a 'data'
    field, or nested lists. Raises if nothing logit-shaped is found."""
    arrays = {}
    data = resp.get("data")
    if isinstance(data, str):
        npz = np.load(io.BytesIO(base64.b64decode(data)), allow_pickle=False)
        arrays = {k: npz[k] for k in npz.files}
    for k, v in resp.items():
        if isinstance(v, list):
            try:
                arrays[k] = np.asarray(v, dtype=np.float32)
            except (ValueError, TypeError):
                pass
    for name, a in arrays.items():
        if layer in name or len(arrays) == 1:
            a = np.squeeze(a)
            if a.ndim == 2:
                return a.astype(np.float64)
    raise ValueError(f"no 2-D logits for layer '{layer}' in response; arrays: "
                     f"{ {k: getattr(v, 'shape', None) for k, v in arrays.items()} }")


def log_likelihood(seq: str, logits: np.ndarray) -> float:
    """Sum of log p(base_{t+1} | bases_<=t). Assumes Evo 2's byte tokenizer
    (token id = ASCII code); --probe checks this assumption."""
    ids = np.frombuffer(seq.encode("ascii"), dtype=np.uint8).astype(np.int64)
    if logits.shape[0] != len(seq) or logits.shape[1] <= ids.max():
        raise ValueError(f"logits shape {logits.shape} does not fit sequence length {len(seq)}")
    m = logits.max(axis=1, keepdims=True)
    logp = logits - m - np.log(np.exp(logits - m).sum(axis=1, keepdims=True))
    return float(logp[np.arange(len(seq) - 1), ids[1:]].sum())


def next_base_accuracy(seq: str, logits: np.ndarray) -> float:
    acgt = np.array([ord(c) for c in "ACGT"])
    pred = acgt[logits[:-1, acgt].argmax(axis=1)]
    ids = np.frombuffer(seq.encode("ascii"), dtype=np.uint8)[1:]
    return float((pred == ids).mean())


# ---------- main ----------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--fasta", required=True, help="GRCh37/hg19 chr17 FASTA (.fa or .fa.gz)")
    ap.add_argument("--probe", action="store_true", help="one test call to verify the response format")
    ap.add_argument("--url", default=DEFAULT_URL)
    ap.add_argument("--layer", default=DEFAULT_LAYER, help="output layer that holds the logits")
    ap.add_argument("--hgvs", nargs="*", help="only these c. variants (as in data/brca1_clinvar.csv)")
    ap.add_argument("--classes", nargs="*", help="only these ClinVar classifications")
    ap.add_argument("--snv-only", action="store_true")
    ap.add_argument("--limit", type=int, default=0)
    args = ap.parse_args()

    key = os.environ.get("NVIDIA_API_KEY")
    if not key:
        sys.exit("Set NVIDIA_API_KEY")
    chrom = load_chr17(args.fasta)
    rows = list(csv.DictReader(open(CLINVAR, encoding="utf-8")))

    if args.probe:
        r = next(x for x in rows if x["hgvs_c"] == "c.68_69del")
        ref_win, _ = windows(chrom, int(r["pos"]), r["ref"], r["alt"])
        resp = call_forward(ref_win, args.url, args.layer, key)
        PROBE_RAW.write_text(json.dumps(resp)[:2_000_000])
        print("Response keys:", list(resp.keys()))
        logits = decode_logits(resp, args.layer)
        acc = next_base_accuracy(ref_win, logits)
        print(f"logits shape {logits.shape}; next-base accuracy {acc:.2%} (chance ~25%)")
        if acc < 0.30:
            sys.exit("Probe FAILED: predictions do not track the sequence. Check --layer and the tokenizer. Nothing written.")
        PROBE_OK.write_text(json.dumps({"url": args.url, "layer": args.layer, "shape": list(logits.shape),
                                        "next_base_accuracy": acc, "at": dt.datetime.now().isoformat()}))
        print(f"Probe passed. Saved {PROBE_OK.name}. You can now run batch scoring.")
        return

    if not PROBE_OK.exists():
        sys.exit("Run --probe first: the response format must be verified before batch scoring.")
    ok = json.loads(PROBE_OK.read_text())
    if ok["url"] != args.url or ok["layer"] != args.layer:
        sys.exit("URL/layer differ from the verified probe. Re-run --probe.")

    sel = rows
    if args.hgvs:
        sel = [x for x in sel if x["hgvs_c"] in set(args.hgvs)]
    if args.classes:
        sel = [x for x in sel if x["clinical_significance"] in set(args.classes)]
    if args.snv_only:
        sel = [x for x in sel if len(x["ref"]) == 1 and len(x["alt"]) == 1]
    if args.limit:
        sel = sel[: args.limit]

    existing = {}
    if SCORES.exists():
        for x in csv.DictReader(open(SCORES, encoding="utf-8")):
            existing[(x["chrom"], x["pos"], x["ref"], x["alt"])] = x

    model = args.url.rstrip("/").split("/")[-2]  # e.g. evo2-40b
    for n, r in enumerate(sel, 1):
        k = (r["chrom"], r["pos"], r["ref"], r["alt"])
        out = {"chrom": r["chrom"], "pos": r["pos"], "ref": r["ref"], "alt": r["alt"], "hgvs_c": r["hgvs_c"],
               "score": "", "model": model, "window_bp": WINDOW, "scored_at": dt.date.today().isoformat()}
        try:
            ref_win, alt_win = windows(chrom, int(r["pos"]), r["ref"], r["alt"])
            ll_ref = log_likelihood(ref_win, decode_logits(call_forward(ref_win, args.url, args.layer, key), args.layer))
            ll_alt = log_likelihood(alt_win, decode_logits(call_forward(alt_win, args.url, args.layer, key), args.layer))
            out["score"] = f"{ll_alt - ll_ref:.6f}"
        except Exception as e:  # leave the score empty, never guess
            print(f"[{n}/{len(sel)}] {r['hgvs_c']}: FAILED ({e})", file=sys.stderr)
        else:
            print(f"[{n}/{len(sel)}] {r['hgvs_c']}: {out['score']}")
        if out["score"] or k not in existing or not existing[k].get("score"):
            existing[k] = out  # never replace an earlier good score with a failure
        with open(SCORES, "w", newline="", encoding="utf-8") as f:  # write as we go
            w = csv.DictWriter(f, fieldnames=FIELDS)
            w.writeheader()
            w.writerows(existing.values())


if __name__ == "__main__":
    main()
