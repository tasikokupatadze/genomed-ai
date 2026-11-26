import { notFound } from "next/navigation";
import { getLang } from "@/lib/i18n";
import { t } from "@/lib/translations";
import { getPatient } from "@/lib/store";

export const dynamic = "force-dynamic";

// Patient view: ONLY doctor-approved text. No findings, scores or drafts.
export default async function PatientPage({ params }: PageProps<"/patient/[id]">) {
  const { id } = await params;
  const lang = await getLang();
  const d = t[lang];
  const p = getPatient(id);
  if (!p) notFound();
  const a = p.approved?.[lang];

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-xl font-semibold">{d.yourResults}</h1>
      <p className="text-sm text-slate-500">{p.name}</p>
      {!a ? (
        <p className="rounded-xl bg-white p-5 text-slate-700 shadow-sm">{d.notApprovedYet}</p>
      ) : (
        <>
          <section className="rounded-xl bg-white p-5 shadow-sm">
            <p className="whitespace-pre-line text-[17px] leading-relaxed">{a.patient_summary}</p>
            <p className="mt-3 text-xs text-slate-500">{d.approvedOn} {new Date(a.approved_at).toLocaleDateString(lang === "ka" ? "ka-GE" : "en-GB")}</p>
          </section>
          {a.medication_notes.length > 0 && (
            <section className="rounded-xl bg-white p-5 shadow-sm">
              <h2 className="font-semibold">{d.medicationNotes}</h2>
              <ul className="mt-2 space-y-2">
                {a.medication_notes.map((n) => (
                  <li key={n} className="rounded-lg bg-sky-50 p-3 text-[15px]">{n}</li>
                ))}
              </ul>
            </section>
          )}
          <section className="rounded-xl bg-white p-5 shadow-sm">
            <h2 className="font-semibold">{d.questionsToAsk}</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[15px]">
              {a.patient_questions.map((q) => <li key={q}>{q}</li>)}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
