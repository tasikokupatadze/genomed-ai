# GenoMed AI

**Future of Care: Reinventing Healthcare** · Alte University hackathon prototype (Tbilisi)

> *“If the science changes, who will tell me?”*

GenoMed helps doctors answer two questions:
**What context are we missing today? Has anything changed since we last explained this result to the patient?**
The patient receives a doctor-approved explanation in **Georgian or English**.

All patients, the gene symbol `GNMD1`, variants, conditions, classifications, submitters and evidence updates are **fictional demo data** and are labelled as such on screen.

## Start it

Needs Node.js 20 or newer. No API keys, GPU, database or internet service is needed for the demo.

```bash
npm install
npm run dev
```

Open http://localhost:3000. The app starts on the patient's original genetic report.

Production build:

```bash
npm run build
npm run start
```

Logic tests (matching, supplement rule, duplicates, approvals, corrections):

```bash
npm test
```

Deploying to Vercel: import the GitHub repo, then click Deploy. No environment variables are needed for the demo.

## 90-second demo script

1. **(0:00) Patient view.** "Nino got a genetic report in March: *variant of uncertain significance*. GenoMed explains it plainly and tells her exactly what we keep tracking: this variant, this condition." Click **ქართ** to show Georgian, then back.
2. **(0:15) Demo controls, the misleading update.** Click **1 · Same gene and condition, different variant**. "Same gene, but the matching engine compares the variant ID and the condition ID, not just the gene name. Different variant, so no review." Click **2 · Same variant, different condition** for the same result.
3. **(0:30) The genuine change.** Click **4 · Same variant and condition, changed interpretation**. "Now the variant and condition match and the classification changed, so a review opens." Click it again: "Already processed: no duplicates."
4. **(0:40) Clinician.** Click **Open the review**. "Original and new evidence side by side, with dates and sources. Only the classification is highlighted." Choose **Recommend follow-up**, edit the English text, and point out that Georgian is now marked *will not be shared*, because an old translation must not pass as a translation of the edit. **Approve and share**.
5. **(1:00) Patient.** Switch to **Patient**: a dated message saying what changed and the doctor's recommendation, exactly as approved. The original report and its history are still there.
6. **(1:10) Second case.** In demo controls choose **Davit · thyroid test**. A flagged TSH and one question: *"Were you taking a supplement containing biotin when this blood sample was collected?"* Answer **I started after the blood draw**: "timing rules it out for this sample." Change to **Yes, before the blood draw**: "now the doctor gets a review, with the American Thyroid Association source, to check whether the testing method is susceptible."
7. **(1:25) Research tab.** "Our Evo 2 study is planned, not run. We show no invented scores." Use **Reset demo** before the next judge.

## What is real, what is simulated, what is planned

| | Status |
|---|---|
| Matching new evidence to a saved finding (normalised variant ID + condition ID + classification), duplicate blocking, clinician review, edit, approve or dismiss, patient messages, history | **Working** (`lib/demo/`) |
| Supplement timing rule, answer corrections that withdraw stale flags and mark earlier messages as corrected | **Working** (`lib/demo/biotin.ts`, `lib/demo/state.ts`) |
| English/Georgian UI and seeded bilingual drafts | **Working.** Georgian should still be reviewed by a native speaker |
| The four evidence updates, both patients, the genetic report and the lab report | **Simulated**: fictional fixtures in `lib/demo/fixtures.ts`. A real system would receive updates from clinical databases such as ClinVar |
| Saving demo state | **Demo only**: browser `localStorage`, key `genomed-demo-v1`. Role switching has no login |
| Evo 2 agreement study | **Ready to run**: real variant set fixed, scoring + analysis + Colab notebook built; no scores yet |

Research predictions never trigger patient notifications or change a clinical classification.

## Sources

- **Biotin and thyroid tests (medical explanation):** American Thyroid Association, *“Biotin use can interfere with the management of thyroid diseases, including thyroid cancer”*, Clinical Thyroidology for the Public, Vol. 15, Issue 1 (January 2022). https://www.thyroid.org/patient-thyroid-information/ct-for-patients/january-2022/vol-15-issue-1-p-7-8/
- **Model (planned research):** Arc Institute, Evo 2. https://arcinstitute.org/tools/evo

## Code map

| File | What it does |
|---|---|
| `lib/demo/types.ts` | Original reports, evidence updates, reviews and published messages are separate types with stable IDs, statuses and dates |
| `lib/demo/matching.ts` | `matchUpdate()`: does new evidence concern the same variant and condition, and did the classification change? |
| `lib/demo/normalize.ts` | Normalises IDs (`syn var 000117` → `SYN-VAR-000117`) and classifications (`VUS` = `Uncertain significance`) |
| `lib/demo/biotin.ts` | Supplement timing rule for one blood sample |
| `lib/demo/state.ts` | Every state change (process update, edit, approve, dismiss, answer, reset) as one pure function |
| `lib/demo/i18n.ts` | All English and Georgian text, side by side |
| `lib/demo/fixtures.ts` | Fictional patients, reports, the four updates, seeded drafts |
| `components/demo/` | Patient, Clinician and Research views, report viewer, demo controls |

Dates are kept apart: **report date** (lab issued the report), **evidence date** (the update was published), **sample date** (blood draw), **shared date** (doctor sent the message).

## Broader vision

GenoMed could later connect medical history, medications, supplements, allergies, lab results and pharmacogenomic findings. An earlier server-side prototype of these table-based checks is still in this repo at **`/doctor`** (`app/(tools)/`, `lib/checks/`, `data/`). It includes a real ClinVar BRCA1 table and an optional LLM draft that needs `ANTHROPIC_API_KEY`. The offline Evo 2 scoring and validation scripts are in `pipeline/` (see `pipeline/score_variants.py`; nothing has been scored yet). None of this is needed for the hackathon demo.

### Lab results over time (in `/doctor`)

For any lab test with 2 or more dated results, the doctor sees a Recharts line chart next to the related finding
(`app/components/LabTrendChart.tsx`, data from `buildLabTrends()` in `lib/checks/labs.ts`):

- **Line and dots:** dots outside each report's own range are red triangles (down = below, up = above).
- **Normal range:** the shaded band uses the most recent report's range. If ranges differ, the chart notes "Reference ranges differ between labs."
- **Medication markers:** a dashed vertical line marks each medication's `start_date`. By default only medications linked to that test in `data/drug_lab_effects.csv` are marked; "Show all medications" shows every start date.
- **Mixed units:** results in different units are never plotted together; a message is shown instead.
- **Table:** an accessible table of the same values sits under every chart.

The patient sees the chart only after the doctor approves. It is saved with the approval, together with the "one possible reason – ask your doctor" lines. The chart shows timing only, never cause.
Demo: Nino (`p001`) has three fictional potassium results: in range before furosemide started, then below range after.
Lab entries need a `date` and medications a `start_date` (YYYY-MM-DD); `end_date` is optional.


### Medicine photo scan (in `/patient/[id]`)

"Add medication" offers **Scan the box** or **Type it in**.
- **Upload:** the photo is shrunk and re-encoded as JPEG in the browser (this drops camera metadata). It is sent to `POST /api/scan/medicine`, which passes **only the image** to Claude's vision model and keeps it in memory. Nothing is stored, and the route takes no patient name or ID.
- **What Claude returns:** strict JSON (`brand_name`, `active_ingredients`, `form`, `confidence`, `unreadable`). The prompt says to read only what is printed and to return null with low confidence rather than guess.
- **Matching:** each ingredient is matched against `data/drug_list.csv`: exact name, then synonyms (including Georgian), then small typos. Anything that doesn't match is saved as **unmatched** and flagged for the doctor. The drug class is never guessed.
- **Confirmation:** a confirm screen shows the photo next to editable fields, with low-confidence fields highlighted. Nothing is saved until the patient confirms and adds how they take it (dose, frequency, start date). The allergy check runs right after saving.
- **Fallback:** if the scan fails, **Type it in** keeps whatever was already read.

Scanning needs `ANTHROPIC_API_KEY` on the server. Without it, the scan returns an error and the patient types the medication in. **Test with photos of 2–3 real medicine boxes** taken by the team; the scan has not yet been tested against real photos.

### Simulated doctor record sync

The clinic system is **simulated**: `data/mock_ehr.json` holds fictional FHIR-shaped resources (Observation, Condition, Procedure, MedicationRequest, AllergyIntolerance).
- **Connector:** all sync code goes through `EhrConnector` (`lib/ehr/types.ts`); `MockEhrConnector` is the only implementation. Swap `getEhrConnector()` in `lib/ehr/index.ts` for a real one later.
- **Flow:**
  1. The patient requests records and picks the categories.
  2. The doctor (on `/doctor`) can untick categories, then approves or declines.
  3. On approval, records are fetched through the connector and imported, tagged "Clinic record (simulated)" with the clinic and import date.
- **Duplicates are skipped:** a lab with the same test, date and value; a medication with the same name and start date; the same allergy, condition or procedure.
- **After import:** checks and charts re-run automatically. Imported records can't be edited; patients can add a note to them.
- **Revoking access** blocks future syncs, and imported records stay. Every event is in the consent log, shown to patient and doctor.

### Emergency bracelet QR (in `/patient/[id]`)

On their page, the patient fills in an **emergency card** with only what strangers should see:
- a display name (first name)
- conditions
- "what to do" in Georgian and English
- allergies and key medicines
- up to 3 emergency contacts

**Create QR code** makes a random link (`/e/<token>`), not the patient ID. The QR can be downloaded as PNG or SVG, or printed at about 30 mm for a bracelet tag.

Scanning opens a public page with a large **Call 112** button, the instructions, one-tap contact calls, and only the chosen fields. The page is never indexed by search engines, and it opens in Georgian unless the phone prefers English.

**New link** kills the old QR code. **Turn page off** hides the page.

The demo card for Nino uses the fixed link `/e/demo-nino-Qm7vX2pLk9`, so a printed test bracelet keeps working after demo resets. A QR created on `localhost` only works on that computer, so create real ones on the deployed site.

### Evo 2 research benchmark

Question: *how well do Evo 2's predictions agree with expert classifications?*

1. **Variant set:** `pipeline/research_variant_set.py` fixes the set **before** any scoring, using real ClinVar data.
   - 60 harmful and 60 harmless BRCA1 single-letter **missense** variants, all *reviewed by expert panel*, GRCh37.
   - Seed 2026; split into calibration and test halves.
   - Output: `data/research/variant_set.csv`.
2. **Scoring:** `pipeline/score_variants.py` calls NVIDIA's hosted Evo 2.
   - Default method `next_base`: uses the documented `/generate` endpoint with logits; score = log p(changed letter) − log p(original letter), given the 8,191 letters before the variant.
   - Optional method `forward`: whole-window likelihood difference.
   - A one-call `--probe` must pass first, and failed calls leave the score empty.
   - API facts come from NVIDIA's `bionemo-evo2-nim` skill (github.com/NVIDIA/skills).
3. **Analysis:** `pipeline/analyze_benchmark.py` writes `data/research/results.json` with:
   - AUROC with a 95% bootstrap range;
   - a cut-off chosen on the calibration half only, and agreement on the untouched test half;
   - every variant listed with its source.
4. **Run it:** open **`research/run_benchmark.ipynb` in Google Colab** with an `NVIDIA_API_KEY` secret. No GPU needed. Upload the two output files to `data/research/`.

The Research tab shows "Benchmark not yet run" until a real `results.json` exists. Research scores never reach patients.

