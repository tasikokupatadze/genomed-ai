import { notFound } from "next/navigation";
import { getLang } from "@/lib/i18n";
import { t } from "@/lib/translations";
import { getPatient } from "@/lib/store";
import LabTrendChart from "@/app/components/LabTrendChart";
import AddMedication from "@/app/components/AddMedication";
import PatientRecords from "@/app/components/PatientRecords";
import { EntryTag, NoteLine } from "@/app/components/RecordBits";
import { getEhrConnector } from "@/lib/ehr";

export const dynamic = "force-dynamic";

// Patient view: explanations shown here are ONLY doctor-approved text (no findings, scores or drafts).
// Below them, the patient manages their own medication list and record requests.
export default async function PatientPage({ params }: PageProps<"/patient/[id]">) {
  const { id } = await params;
  const lang = await getLang();
  const d = t[lang];
  const p = getPatient(id);
  if (!p) notFound();
  const a = p.approved?.[lang];
  const clinics = await getEhrConnector().listClinics();

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
          {(a.trends ?? []).length > 0 && (
            <section className="space-y-3 rounded-xl bg-white p-5 shadow-sm">
              <h2 className="font-semibold">{d.trendsTitle}</h2>
              {(a.trends ?? []).map((tr) => (
                <div key={tr.test} className="space-y-2">
                  <LabTrendChart trend={tr} d={d} />
                  {(tr.notes ?? []).map((n) => (
                    <p key={n} className="rounded-lg bg-sky-50 p-3 text-[15px]">{n}</p>
                  ))}
                  {(tr.notes ?? []).length > 0 && <p className="text-sm font-semibold text-slate-700">{d.possibleReasonNote}</p>}
                </div>
              ))}
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
      <section className="rounded-xl bg-white p-5 shadow-sm" aria-labelledby="mymeds-title">
        <h2 id="mymeds-title" className="font-semibold">{d.myMedications}</h2>
        <ul className="mt-2 space-y-2 text-[15px]">
          {p.medications.map((m, i) => (
            <li key={m.id ?? i}>
              <b>{m.name}</b>{m.brand_name && m.brand_name !== m.name ? ` (${m.brand_name})` : ""}{" "}
              <span className="text-slate-600">{[m.dose, m.frequency].filter(Boolean).join(", ")}</span>
              <span className="block text-xs text-slate-500">{d.started} {m.start_date}{m.end_date ? ` · ${d.stopped} ${m.end_date}` : ""}</span>
              <EntryTag m={m} d={d} />
              <NoteLine note={m.patient_note} d={d} />
            </li>
          ))}
          {!p.medications.length && <li className="text-slate-500">{d.none}</li>}
        </ul>
      </section>
      <AddMedication patientId={p.id} d={d} />
      <PatientRecords patient={p} clinics={clinics} d={d} />
    </div>
  );
}
