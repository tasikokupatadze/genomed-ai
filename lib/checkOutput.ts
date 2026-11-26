import type { Lang } from "./types";

/**
 * Rules for any text a patient will see. "errors" block the text (draft is rejected,
 * approval is refused); "warnings" are style limits shown to the doctor.
 * Georgian lists are a starting point: have a native speaker review and extend them.
 */
const RULES: { id: string; patterns: Record<Lang, RegExp[]> }[] = [
  {
    id: "stop_medication",
    patterns: {
      en: [/\bstop (taking|using|your)\b/i, /\bdiscontinue\b/i, /\b(don'?t|do not) take\b/i, /\bquit (taking|your)\b/i],
      ka: [/შეწყვიტ/, /აღარ მიიღო/, /ნუ მიიღებ/],
    },
  },
  {
    id: "false_reassurance",
    patterns: {
      en: [/\byou('| a)re safe\b/i, /\b(don'?t|do not|no need to) worry\b/i, /\bnothing to worry\b/i, /\bno cause for concern\b/i],
      ka: [/უსაფრთხოდ ხართ/, /უსაფრთხო ხართ/, /არ ინერვიულო/, /ნუ ინერვიულებ/, /სანერვიულო არაფერია/],
    },
  },
  {
    id: "diagnosis_claim",
    patterns: {
      en: [/\byou (have|will (get|develop)|won'?t (get|develop)|will not (get|develop))\b.*\b(cancer|disease|syndrome)\b/i],
      ka: [/თქვენ გაქვთ (კიბო|დაავადება)/, /არ განუვითარდებ/, /განგივითარდებათ/],
    },
  },
  {
    id: "ai_mention",
    patterns: {
      en: [/\bAI\b/, /artificial intelligence/i, /\bevo ?2\b/i, /\bmodels?\b/i, /\bscores?\b/i, /algorithm/i, /machine learning/i],
      ka: [/ხელოვნური ინტელექტ/, /მოდელ/, /ქულ[აი]/, /ალგორითმ/, /\bevo ?2\b/i],
    },
  },
];

const ERROR_TEXT: Record<string, string> = {
  stop_medication: 'Tells the patient to stop or not take a medication',
  false_reassurance: 'Falsely reassures ("you are safe", "don\'t worry")',
  diagnosis_claim: "States or rules out a diagnosis",
  ai_mention: "Mentions AI, models, scores or Evo 2",
  numbers: "Contains numbers not in the input",
};

const numbersIn = (s: string) => new Set(s.match(/\d+(?:[.,]\d+)?/g) ?? []);
const wordCount = (s: string) => (s.match(/\S+/g) ?? []).length;

export interface PatientText {
  patient_summary: string;
  patient_questions: string[];
  medication_notes?: string[];
}
export interface CheckResult {
  ok: boolean;
  errors: { rule: string; message: string; found: string }[];
  warnings: string[];
}

export function checkOutput(text: PatientText, input: unknown, lang: Lang): CheckResult {
  const all = [text.patient_summary, ...text.patient_questions, ...(text.medication_notes ?? [])].join("\n");
  const errors: CheckResult["errors"] = [];

  for (const rule of RULES) {
    // Check both languages: an English phrase in Georgian text is still a problem.
    for (const re of [...rule.patterns[lang], ...rule.patterns[lang === "en" ? "ka" : "en"]]) {
      const m = all.match(re);
      if (m) {
        errors.push({ rule: rule.id, message: ERROR_TEXT[rule.id], found: m[0] });
        break;
      }
    }
  }

  const allowed = numbersIn(JSON.stringify(input));
  const extra = [...numbersIn(all)].filter((n) => !allowed.has(n) && !allowed.has(n.replace(",", ".")));
  if (extra.length) errors.push({ rule: "numbers", message: ERROR_TEXT.numbers, found: extra.join(", ") });
  if (all.includes("%") && !JSON.stringify(input).includes("%"))
    errors.push({ rule: "numbers", message: ERROR_TEXT.numbers, found: "%" });

  const warnings: string[] = [];
  const n = wordCount(text.patient_summary);
  if (n < 80 || n > 150) warnings.push(`Patient summary has ${n} words (aim for 80–150).`);
  const q = text.patient_questions.length;
  if (q < 2 || q > 4) warnings.push(`${q} patient questions (aim for 2–4).`);

  return { ok: errors.length === 0, errors, warnings };
}
