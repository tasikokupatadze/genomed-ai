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
| Evo 2 agreement study | **Planned**: benchmark not yet run, no scores exist |

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

