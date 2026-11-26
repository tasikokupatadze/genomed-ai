// FICTIONAL demo data. The patients, gene symbol, variant, condition, classifications,
// submitters and updates below are invented for the hackathon and are labelled as demo data in the UI.
// The only real source is the American Thyroid Association article used for the biotin case.

import { CLASS_LABEL, CLASS_MEANING, formatDate } from "./i18n.ts";
import { normalizeClassification } from "./normalize.ts";
import type { Bilingual, EvidenceUpdate, GeneticReport, LabReport, PatientId } from "./types.ts";

export const PATIENTS: Record<PatientId, { name: Bilingual; age: number }> = {
  "pt-nino": { name: { en: "Nino Beridze (fictional)", ka: "ნინო ბერიძე (გამოგონილი)" }, age: 29 },
  "pt-davit": { name: { en: "Davit Kapanadze (fictional)", ka: "დავით კაპანაძე (გამოგონილი)" }, age: 34 },
};

const DEMO_LAB_SOURCE = {
  submitter: "DEMO-GENOMICS-LAB",
  name: { en: "Demo Genomics Lab (fictional)", ka: "სადემონსტრაციო გენომიკის ლაბორატორია (გამოგონილი)" },
  isDemo: true,
};

export const GENETIC_REPORT: GeneticReport = {
  id: "GR-DEMO-2026-0314",
  patientId: "pt-nino",
  reportDate: "2026-03-14",
  lab: DEMO_LAB_SOURCE.name,
  gene: "GNMD1",
  variant: { id: "SYN-VAR-000117", hgvs: "c.1847G>A", transcript: "NM_DEMO001.1" },
  condition: {
    id: "SYN-COND-0042",
    name: { en: "Hereditary heart rhythm condition (demo)", ka: "გულის რიტმის მემკვიდრეობითი დაავადება (დემო)" },
  },
  classification: "Uncertain significance",
  source: DEMO_LAB_SOURCE,
};

/**
 * The four simulated updates. Identifiers are deliberately written in different
 * formats (case, spaces) to show that matching normalises them.
 */
export const EVIDENCE_UPDATES: EvidenceUpdate[] = [
  {
    id: "EV-DEMO-A",
    controlTitle: { en: "Same gene and condition, different variant", ka: "იგივე გენი და დაავადება, სხვა ვარიანტი" },
    evidenceDate: "2026-08-02",
    gene: "gnmd1",
    variant: { id: "SYN-VAR-000245", hgvs: "c.2210C>T", transcript: "NM_DEMO001.1" },
    condition: { id: "syn-cond-0042", name: GENETIC_REPORT.condition.name },
    classification: "Likely pathogenic",
    source: {
      submitter: "DEMO-CARDIO-CONSORTIUM",
      name: { en: "Demo Cardiogenetics Consortium (fictional)", ka: "სადემონსტრაციო კარდიოგენეტიკის კონსორციუმი (გამოგონილი)" },
      isDemo: true,
    },
  },
  {
    id: "EV-DEMO-B",
    controlTitle: { en: "Same variant, different condition", ka: "იგივე ვარიანტი, სხვა დაავადება" },
    evidenceDate: "2026-08-19",
    gene: "GNMD1",
    variant: { id: "syn-var-000117", hgvs: "c.1847G>A", transcript: "NM_DEMO001.1" },
    condition: {
      id: "SYN-COND-0077",
      name: { en: "Hereditary muscle weakness condition (demo)", ka: "კუნთების სისუსტის მემკვიდრეობითი დაავადება (დემო)" },
    },
    classification: "Likely pathogenic",
    source: {
      submitter: "DEMO-NEUROMUSCULAR-NETWORK",
      name: { en: "Demo Neuromuscular Network (fictional)", ka: "სადემონსტრაციო ნეირომუსკულური ქსელი (გამოგონილი)" },
      isDemo: true,
    },
  },
  {
    id: "EV-DEMO-C",
    controlTitle: { en: "Same variant and condition, same interpretation", ka: "იგივე ვარიანტი და დაავადება, იგივე ინტერპრეტაცია" },
    evidenceDate: "2026-09-05",
    gene: "GNMD1",
    variant: { id: "SYN VAR 000117", hgvs: "c.1847G>A", transcript: "NM_DEMO001.1" },
    condition: { id: "SYN-COND-0042", name: GENETIC_REPORT.condition.name },
    classification: "VUS",
    source: {
      submitter: "DEMO-VARIANT-REGISTRY",
      name: { en: "Demo Variant Registry (fictional)", ka: "ვარიანტების სადემონსტრაციო რეესტრი (გამოგონილი)" },
      isDemo: true,
    },
  },
  {
    id: "EV-DEMO-D",
    controlTitle: { en: "Same variant and condition, changed interpretation", ka: "იგივე ვარიანტი და დაავადება, შეცვლილი ინტერპრეტაცია" },
    evidenceDate: "2026-10-21",
    gene: "GNMD1",
    variant: { id: "SYN-VAR-000117", hgvs: "c.1847G>A", transcript: "NM_DEMO001.1" },
    condition: { id: "SYN-COND-0042", name: GENETIC_REPORT.condition.name },
    classification: "Likely benign",
    source: {
      submitter: "DEMO-VARIANT-EXPERT-PANEL",
      name: { en: "Demo Variant Expert Panel (fictional)", ka: "ვარიანტების სადემონსტრაციო ექსპერტთა ჯგუფი (გამოგონილი)" },
      isDemo: true,
    },
  },
];

export const LAB_REPORT: LabReport = {
  id: "LR-DEMO-2026-1103",
  patientId: "pt-davit",
  drawDate: "2026-11-03",
  reportDate: "2026-11-04",
  lab: { en: "Demo City Laboratory (fictional)", ka: "ქალაქის სადემონსტრაციო ლაბორატორია (გამოგონილი)" },
  results: [{ test: "TSH", value: 0.08, unit: "mIU/L", refLow: 0.4, refHigh: 4.0, flag: "L" }],
  history: [
    { en: "Tiredness and trouble sleeping for about two months", ka: "დაღლილობა და ძილის პრობლემები დაახლოებით ორი თვის განმავლობაში" },
    { en: "No known thyroid disease", ka: "ფარისებრი ჯირკვლის ცნობილი დაავადება არ აქვს" },
    { en: "Prescription medicines: none recorded", ka: "გამოწერილი წამლები: არ არის ჩაწერილი" },
    { en: "Supplements: not recorded", ka: "დანამატები: არ არის ჩაწერილი" },
  ],
};

export const ATA_BIOTIN_SOURCE = {
  url: "https://www.thyroid.org/patient-thyroid-information/ct-for-patients/january-2022/vol-15-issue-1-p-7-8/",
  title: "Biotin use can interfere with the management of thyroid diseases, including thyroid cancer",
  publisher: "American Thyroid Association, Clinical Thyroidology for the Public, Vol. 15, Issue 1 (January 2022)",
};

export const EVO2_SOURCE = { url: "https://arcinstitute.org/tools/evo", name: "Arc Institute: Evo" };

// ---------- seeded bilingual drafts (clinicians edit these before sharing) ----------

export function seedGeneticDraft(report: GeneticReport, update: EvidenceUpdate): Bilingual {
  const code = normalizeClassification(update.classification);
  const make = (lang: "en" | "ka") => {
    const ev = formatDate(update.evidenceDate, lang);
    const rep = formatDate(report.reportDate, lang);
    const cls = CLASS_LABEL[code][lang].toLowerCase();
    const cond = report.condition.name[lang];
    const src = update.source.name[lang];
    return lang === "en"
      ? `There is new information about your genetic result. On ${ev}, ${src} reviewed the same DNA change found in your report (variant ${report.variant.id} in the ${report.gene} gene) for the same condition: ${cond}. They now classify it as ${cls}. ${CLASS_MEANING[code].en} Your original report from ${rep} has not been changed and is still in your records.`
      : `თქვენი გენეტიკური შედეგის შესახებ ახალი ინფორმაცია გვაქვს. ${ev}-ს ${src} განიხილა იგივე დნმ-ის ცვლილება, რომელიც თქვენს ანგარიშშია (ვარიანტი ${report.variant.id}, გენი ${report.gene}), იმავე დაავადებასთან მიმართებით: ${cond}. ახლა ეს ცვლილება შეფასებულია, როგორც ${cls}. ${CLASS_MEANING[code].ka} თქვენი ${rep}-ის თავდაპირველი ანგარიში არ შეცვლილა და კვლავ ინახება თქვენს ჩანაწერებში.`;
  };
  return { en: make("en"), ka: make("ka") };
}

export function seedBiotinDraft(lab: LabReport): Bilingual {
  return {
    en: `Thank you for answering our question. You told us you were taking a supplement containing biotin before your blood sample was collected on ${formatDate(lab.drawDate, "en")}. Biotin can interfere with some thyroid blood tests, so a result can look higher or lower than it really is. I will take this into account when I look at your TSH result. This does not mean biotin caused your result. Please talk to me before changing any medicine or supplement.`,
    ka: `გმადლობთ, რომ უპასუხეთ ჩვენს კითხვას. თქვენ გვითხარით, რომ ${formatDate(lab.drawDate, "ka")}-ს სისხლის ნიმუშის აღებამდე იღებდით ბიოტინის შემცველ დანამატს. ბიოტინმა შეიძლება ხელი შეუშალოს ფარისებრი ჯირკვლის ზოგიერთ ანალიზს, ამიტომ შედეგი შეიძლება რეალურზე მაღალი ან დაბალი ჩანდეს. თქვენი TSH-ის შედეგის განხილვისას ამას გავითვალისწინებ. ეს არ ნიშნავს, რომ თქვენი შედეგი ბიოტინმა გამოიწვია. გთხოვთ, ნებისმიერი წამლის ან დანამატის შეცვლამდე დამელაპარაკოთ.`,
  };
}
