#!/usr/bin/env python3
"""Offline Evo 2 scoring for BRCA1 variants (GRCh37 / hg19 only). Research use only.

Two methods (the probe decides which one your key can use):

  next_base  (default; uses the DOCUMENTED hosted /generate endpoint)
      Give Evo 2 the 8,191 bases to the LEFT of the variant and ask for 1 token with
      logits. score = log p(alt base) - log p(ref base) at the variant position.
      Single-letter variants only. Uses left context only.

  forward    (whole-window likelihood; hosted /forward is NOT documented by NVIDIA,
              the catalog lists "evo2-40b-forward" - the probe tells you if it works)
      score = log-likelihood(variant window) - log-likelihood(reference window)
      on an 8,192-base window around the variant, from the "output_layer" logits.

More negative = the model finds the variant less likely. Facts used, from NVIDIA's
bionemo-evo2-nim skill (github.com/NVIDIA/skills): Bearer auth; generate fields
sequence/num_tokens/top_k/enable_logits; logits shape [num_tokens, 512]; vocab 512 with
A=65, C=67, G=71, T=84; forward returns base64 NPZ in "data"; logits layer "output_layer".

Scores are never generated or estimated: any failure leaves the score empty.

Usage:
  pip install numpy requests
  export NVIDIA_API_KEY=nvapi-...
  curl -O https://hgdownload.soe.ucsc.edu/goldenPath/hg19/chromosomes/chr17.fa.gz
  python pipeline/score_variants.py --fasta chr17.fa.gz --probe
  python pipeline/score_variants.py --fasta chr17.fa.gz \
      --input data/research/variant_set.csv --output data/research/scores.csv
"""
import argparse, base64, csv, datetime as dt, gzip, io, json, os, sys, time
from pathlib import Path

import numpy as np
import requests

ROOT = Path(__file__).resolve().parent.parent
PROBE_OK = ROOT / "pipeline" / ".probe_ok.json"
PROBE_RAW = ROOT / "pipeline" / "probe_response.json"
WINDOW = 8192
FIELDS = ["chrom", "pos", "ref", "alt", "hgvs_c", "score", "model", "method", "window_bp", "scored_at", "error"]
HOST = "https://health.api.nvidia.com/v1/biology/arc"
ACGT = {"A": 65, "C": 67, "G": 71, "T": 84}


# ---------- reference genome ----------
def load_chr17(path: str) -> str:
    opener = gzip.open if path.endswith(".gz") else open
    seq, on = [], False
    with opener(path, "rt") as f:
        for line in f:
            if line.startswith(">"):
                on = line[1:].split()[0] in ("chr17", "17")
                continue
            if on:
                seq.append(line.strip())
    if not seq:
        sys.exit("chr17 not found in FASTA")
    return "".join(seq).upper()


def check_ref(chrom_seq: str, pos: int, ref: str):
    got = chrom_seq[pos - 1: pos - 1 + len(ref)]
    if got != ref:
        raise ValueError(f"REF mismatch at {pos}: genome has {got}, ClinVar has {ref} (wrong genome build?)")


def windows(chrom_seq: str, pos: int, ref: str, alt: str):
    """Reference and variant windows of exactly WINDOW bases, variant near the centre (1-based VCF pos)."""
    check_ref(chrom_seq, pos, ref)
    i = pos - 1
    start = i - WINDOW // 2
    if start < 0:
        raise ValueError("window runs off chromosome start")
    ref_win = chrom_seq[start:start + WINDOW]
    alt_win = (chrom_seq[start:i] + alt + chrom_seq[i + len(ref):start + WINDOW + len(ref) + abs(len(ref) - len(alt))])[:WINDOW]
    if len(ref_win) != WINDOW or len(alt_win) != WINDOW:
        raise ValueError("window runs off chromosome end")
    return ref_win, alt_win


def left_context(chrom_seq: str, pos: int, ref: str) -> str:
    check_ref(chrom_seq, pos, ref)
    i = pos - 1
    ctx = chrom_seq[max(0, i - (WINDOW - 1)):i]
    if "N" in ctx[-100:]:
        raise ValueError("unknown bases (N) right before the variant")
    return ctx


# ---------- API ----------
def is_warming_up(r) -> bool:
    """NVIDIA answers HTTP 422 'Instance is restarting' while a hosted model starts up: wait, don't fail."""
    return r.status_code == 422 and "restarting" in r.text.lower()


def post(url: str, payload: dict, key: str, retries: int = 8) -> dict:
    headers = {"Authorization": f"Bearer {key}", "Accept": "application/json", "Content-Type": "application/json"}
    for attempt in range(retries):
        r = requests.post(url, headers=headers, json=payload, timeout=300)
        if r.status_code == 202 and r.headers.get("NVCF-REQID"):  # async: poll until ready
            req_id = r.headers["NVCF-REQID"]
            while r.status_code == 202:
                time.sleep(5)
                r = requests.get(f"https://api.nvcf.nvidia.com/v2/nvcf/pexec/status/{req_id}", headers=headers, timeout=300)
        if is_warming_up(r) and attempt < retries - 1:
            wait = 30 * (attempt + 1)
            print(f"  Model is starting up ({r.text[:80]}), waiting {wait}s...", file=sys.stderr)
            time.sleep(wait)
            continue
        if r.status_code in (429, 500, 502, 503, 504) and attempt < retries - 1:
            wait = int(r.headers.get("Retry-After", 0)) or 2 ** (attempt + 2)
            print(f"  HTTP {r.status_code}, retrying in {wait}s", file=sys.stderr)
            time.sleep(wait)
            continue
        if r.status_code != 200:
            raise RuntimeError(f"HTTP {r.status_code}: {r.text[:300]}")
        return r.json()
    raise RuntimeError("gave up after retries")


def log_softmax(z: np.ndarray) -> np.ndarray:
    m = z.max(axis=-1, keepdims=True)
    return z - m - np.log(np.exp(z - m).sum(axis=-1, keepdims=True))


def next_base_logits(resp: dict) -> np.ndarray:
    logits = resp.get("logits")
    if logits is None:
        raise ValueError(f"no logits in response (keys: {list(resp)})")
    a = np.asarray(logits, dtype=np.float64).reshape(-1, 512)
    if not np.isfinite(a[0]).all():
        raise ValueError("non-finite logits")
    return a[0]


def forward_logits(resp: dict, layer: str) -> np.ndarray:
    data = resp.get("data")
    if not isinstance(data, str):
        raise ValueError(f"no base64 'data' in response (keys: {list(resp)})")
    npz = np.load(io.BytesIO(base64.b64decode(data)), allow_pickle=False)
    for name in npz.files:
        if layer in name or len(npz.files) == 1:
            a = np.squeeze(npz[name]).astype(np.float64)
            if a.ndim == 2:
                return a if a.shape[-1] == 512 else a.T
    raise ValueError(f"no 2-D logits for '{layer}'; arrays: { {k: npz[k].shape for k in npz.files} }")


def seq_log_likelihood(seq: str, logits: np.ndarray) -> float:
    ids = np.frombuffer(seq.encode("ascii"), dtype=np.uint8).astype(np.int64)
    if logits.shape[0] != len(seq):
        raise ValueError(f"logits length {logits.shape[0]} != sequence length {len(seq)}")
    lp = log_softmax(logits)
    return float(lp[np.arange(len(seq) - 1), ids[1:]].sum())


def score_next_base(chrom, r, url, key):
    ref, alt = r["ref"], r["alt"]
    if len(ref) != 1 or len(alt) != 1 or ref not in ACGT or alt not in ACGT:
        raise ValueError("next_base works for single-letter A/C/G/T changes only")
    ctx = left_context(chrom, int(r["pos"]), ref)
    lp = log_softmax(next_base_logits(post(url, {"sequence": ctx, "num_tokens": 1, "top_k": 1, "enable_logits": True}, key)))
    return float(lp[ACGT[alt]] - lp[ACGT[ref]])


def score_forward(chrom, r, url, key, layer):
    ref_win, alt_win = windows(chrom, int(r["pos"]), r["ref"], r["alt"])
    ll = lambda s: seq_log_likelihood(s, forward_logits(post(url, {"sequence": s, "output_layers": [layer]}, key), layer))
    return ll(alt_win) - ll(ref_win)


# ---------- main ----------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--fasta", required=True, help="GRCh37/hg19 chr17 FASTA (.fa or .fa.gz)")
    ap.add_argument("--probe", action="store_true", help="one test call to verify the endpoint and response format")
    ap.add_argument("--method", choices=["next_base", "forward"], default="next_base")
    ap.add_argument("--model", default=os.environ.get("EVO2_MODEL", "evo2-40b"), help="evo2-40b or evo2-7b")
    ap.add_argument("--url", help="override the endpoint URL")
    ap.add_argument("--layer", default="output_layer")
    ap.add_argument("--input", default=str(ROOT / "data" / "research" / "variant_set.csv"))
    ap.add_argument("--output", default=str(ROOT / "data" / "research" / "scores.csv"))
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--sleep", type=float, default=1.0, help="seconds between calls (be kind to rate limits)")
    args = ap.parse_args()

    key = os.environ.get("NVIDIA_API_KEY") or os.environ.get("NGC_API_KEY")
    if not key:
        sys.exit("Set NVIDIA_API_KEY")
    url = args.url or f"{HOST}/{args.model}/{'generate' if args.method == 'next_base' else 'forward'}"
    chrom = load_chr17(args.fasta)
    rows = list(csv.DictReader(open(args.input, encoding="utf-8")))

    if args.probe:
        r = next((x for x in rows if len(x["ref"]) == 1 and len(x["alt"]) == 1), rows[0])
        print(f"Probe: {args.method} via {url}")
        if args.method == "next_base":
            resp = post(url, {"sequence": left_context(chrom, int(r["pos"]), r["ref"]), "num_tokens": 1, "top_k": 1, "enable_logits": True}, key)
            PROBE_RAW.write_text(json.dumps(resp)[:2_000_000])
            print("Response keys:", list(resp))
            p = np.exp(log_softmax(next_base_logits(resp)))
            mass = float(sum(p[v] for v in ACGT.values()))
            print(f"Probability on A/C/G/T: {mass:.3f} (should be close to 1 if the byte vocabulary is right)")
            ok, detail = mass > 0.9, {"acgt_mass": mass}
        else:
            ref_win, _ = windows(chrom, int(r["pos"]), r["ref"], r["alt"])
            resp = post(url, {"sequence": ref_win, "output_layers": [args.layer]}, key)
            PROBE_RAW.write_text(json.dumps(resp)[:2_000_000])
            print("Response keys:", list(resp))
            lg = forward_logits(resp, args.layer)
            acgt = np.array(list(ACGT.values()))
            ids = np.frombuffer(ref_win.encode(), dtype=np.uint8)[1:]
            acc = float((acgt[lg[:-1, acgt].argmax(axis=1)] == ids).mean())
            print(f"logits shape {lg.shape}; next-base accuracy {acc:.2%} (chance ~25%)")
            ok, detail = acc > 0.30, {"next_base_accuracy": acc, "shape": list(lg.shape)}
        if not ok:
            sys.exit("Probe FAILED: the output does not look like Evo 2 base predictions. Nothing written.")
        PROBE_OK.write_text(json.dumps({"url": url, "method": args.method, "layer": args.layer, "model": args.model,
                                        **detail, "at": dt.datetime.now().isoformat()}))
        print(f"Probe passed. Saved {PROBE_OK.name}. You can now run scoring.")
        return

    if not PROBE_OK.exists():
        sys.exit("Run --probe first: the response format must be verified before scoring.")
    ok = json.loads(PROBE_OK.read_text())
    if ok["url"] != url or ok["method"] != args.method:
        sys.exit(f"URL/method differ from the verified probe ({ok['method']} {ok['url']}). Re-run --probe.")

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    existing = {}
    if out_path.exists():
        for x in csv.DictReader(open(out_path, encoding="utf-8")):
            existing[(x["chrom"], x["pos"], x["ref"], x["alt"])] = x
    todo = [r for r in rows if not existing.get((r["chrom"], r["pos"], r["ref"], r["alt"]), {}).get("score")]
    if args.limit:
        todo = todo[: args.limit]
    print(f"{len(todo)} variants to score ({len(rows) - len(todo)} already done)")

    for n, r in enumerate(todo, 1):
        k = (r["chrom"], r["pos"], r["ref"], r["alt"])
        out = {"chrom": r["chrom"], "pos": r["pos"], "ref": r["ref"], "alt": r["alt"], "hgvs_c": r["hgvs_c"], "score": "",
               "model": f"arc/{args.model}", "method": args.method,
               "window_bp": WINDOW - 1 if args.method == "next_base" else WINDOW,
               "scored_at": dt.date.today().isoformat(), "error": ""}
        try:
            s = score_next_base(chrom, r, url, key) if args.method == "next_base" else score_forward(chrom, r, url, key, args.layer)
            out["score"] = f"{s:.6f}"
            print(f"[{n}/{len(todo)}] {r['hgvs_c']}: {out['score']}")
        except Exception as e:  # leave the score empty, never guess
            out["error"] = str(e)[:200]
            print(f"[{n}/{len(todo)}] {r['hgvs_c']}: FAILED ({e})", file=sys.stderr)
        existing[k] = out
        with open(out_path, "w", newline="", encoding="utf-8") as f:  # write as we go: safe to stop and resume
            w = csv.DictWriter(f, fieldnames=FIELDS)
            w.writeheader()
            w.writerows(existing.values())
        time.sleep(args.sleep)


if __name__ == "__main__":
    main()
