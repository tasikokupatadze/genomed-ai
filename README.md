# GenoMed AI

A doctor-and-patient website that explains medical results in plain language (English and Georgian).
It checks a patient's medications, allergies, blood tests and genetic results against curated tables.
Everything the patient sees is approved by a doctor first.

> **Decision support only. Not a diagnosis.** All patients in `data/demo_patients.json` are fictional.

## Run locally

```bash
npm install
cp .env.example .env.local   # add ANTHROPIC_API_KEY
npm run dev                  # http://localhost:3000
```

Without an API key everything works except the AI draft: the doctor can still write and approve summaries by hand.

## Deploy to Vercel

1. Import this GitHub repo on vercel.com (Add New → Project). No build settings to change.
2. Project → Settings → Environment Variables: add `ANTHROPIC_API_KEY`.
3. Deploy.

Edits made on the live site (new labs, approvals) are kept in `/tmp` on the server, so they reset
when Vercel restarts the server. That is fine for a demo; use "Reset demo data" to start clean.

## How it works

| Area | Where |
|---|---|
| Doctor area (laptop) | `/doctor`, `/doctor/[id]`: profile, add entries, findings with sources, draft → edit → approve |
| Patient area (phone) | `/patient/[id]`: only doctor-approved summary, medication notes and questions |
| Checks (table lookups) | `lib/checks/labs.ts`, `allergies.ts`, `pgx.ts`, `variants.ts` |
| LLM rewrite | `lib/explain.ts`, prompt in `prompts/system.md`, input built in `lib/analyze.ts` |
| Patient-text rules | `lib/checkOutput.ts` (English + Georgian). Runs on every AI draft (retry once, then withheld) and on approval |
| UI text | `lib/translations.ts` |

### API

- `GET /api/patients/[id]`
- `POST /api/patients/[id]/labs`, `/medications` (returns allergy flags), `/allergies`, `/genetics` (extra: PGx result or BRCA1 variant)
- `POST /api/analyze/[id]` `{ "lang": "en" | "ka" }`: findings, template medication notes, AI draft, check results
- `POST /api/approve/[id]` `{ lang, patient_summary, patient_questions }`: refused (422) if the text breaks the rules
- `POST /api/reset`: restore demo data

## Data (`/data`)

| File | What | Status |
|---|---|---|
| `drug_lab_effects.csv` | Medication → lab effects. Seeded only with the brief's examples | **TODO: source_url, reviewed_by** |
| `drug_classes.csv` | Drug name → class, so "atorvastatin" matches "statin" rows | TODO: review |
| `allergy_classes.csv` | Penicillins demo; `cross_reactive_classes` is empty on purpose | **TODO: sources** |
| `pgx.csv` | 4 CPIC-based examples from the brief | **TODO: CPIC links + guideline_summary** |
| `lab_tests.csv` | Canonical lab names + aliases | |
| `brca1_clinvar.csv` | 15,480 BRCA1 variants, GRCh37, built from ClinVar by `pipeline/build_clinvar.py` | Real ClinVar data |
| `scores.csv` | Evo 2 scores (empty until the pipeline runs) | |
| `evo2_bands.json` | Band thresholds (null until calibrated → app shows "AI estimate unavailable") | |
| `context_facts.json` | Approved plain-language facts the LLM may use | **TODO: clinical + Georgian review** |

**Rule:** add a table row only when you have a source. Never invent drug–lab links, guideline text or scores.
Run `python pipeline/validate.py` to check the tables and list every open TODO.

Reference ranges always come from the patient's own lab report (`ref_low`, `ref_high`); none are hard-coded.
Allergies are never inferred from blood tests.

## Offline pipeline (`/pipeline`, Python)

```bash
pip install numpy requests
python pipeline/build_clinvar.py            # refresh data/brca1_clinvar.csv from NCBI
python pipeline/validate.py                 # table checks + TODO list
```

Evo 2 scoring (research-grade, clinician view only):

```bash
export NVIDIA_API_KEY=...
curl -O https://hgdownload.soe.ucsc.edu/goldenPath/hg19/chromosomes/chr17.fa.gz
python pipeline/score_variants.py --fasta chr17.fa.gz --probe      # ONE test call: verifies the response format
python pipeline/score_variants.py --fasta chr17.fa.gz --hgvs c.68_69del c.4402A>G
python pipeline/score_variants.py --fasta chr17.fa.gz --classes Pathogenic Benign "Likely benign" "Likely pathogenic" --snv-only --limit 200
python pipeline/validate.py --calibrate                             # proposes band thresholds
python pipeline/validate.py --calibrate --write-bands --by "Dr. Name"
```

The NVIDIA endpoint URL, the logits layer name (`--layer`, default `unembed`) and the response format
are **not yet verified**. `--probe` saves the raw response, decodes it, and checks the model's
next-base predictions against the sequence. Batch scoring refuses to run until the probe passes.
A failed score stays empty.

## Known limits

- **No temperature setting:** current Claude models reject `temperature`. Output is constrained instead by a
  JSON schema, the prompt, and the `checkOutput` rules.
- Georgian UI text, context facts and rule keywords need native-speaker review.
- Table contents (drug effects, condition names) are shown in English in both languages.
