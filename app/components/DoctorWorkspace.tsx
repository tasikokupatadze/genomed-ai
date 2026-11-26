"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { checkOutput, type CheckResult } from "@/lib/checkOutput";
import type { Dict } from "@/lib/translations";
import type { DraftSummary, Finding, Lang, LabTrend, Patient } from "@/lib/types";
import Findings from "./Findings";

interface AnalyzeResponse {
  lang: Lang;
  findings: Finding[];
  medication_notes: string[];
  draft: DraftSummary;
  check_output: CheckResult | null;
  attempts: number;
  llm_input: unknown;
}

const input = "w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-teal-600 focus:outline-none";
const btn = "rounded-md bg-teal-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50";
const panel = "rounded-xl bg-white p-4 shadow-sm";

export default function DoctorWorkspace({
  patient, findings, trends, lang, d, labTests, pgxOptions,
}: {
  patient: Patient; findings: Finding[]; trends: LabTrend[]; lang: Lang; d: Dict;
  labTests: string[]; pgxOptions: { gene: string; result: string }[];
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ tone: "ok" | "warn" | "err"; text: string } | null>(null);

  async function post(url: string, data: object) {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    const json = await res.json();
    if (!res.ok) { setMsg({ tone: "err", text: `${d.error}: ${json.error}` }); return null; }
    router.refresh();
    return json;
  }

  function submit(url: string, fields: string[], extra: object = {}) {
    return async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const form = e.currentTarget;
      const fd = new FormData(form);
      const data = Object.fromEntries(fields.map((f) => [f, fd.get(f)]));
      const json = await post(url, { ...data, ...extra });
      if (!json) return;
      form.reset();
      const flags = (json.allergy_findings ?? []).filter((f: Finding) => f.kind === "allergy");
      setMsg(flags.length
        ? { tone: "err", text: `${d.allergyFlag}: ${flags.map((f: Extract<Finding, { kind: "allergy" }>) => `${f.medication} ↔ ${f.allergy.drug}`).join(", ")}` }
        : { tone: "ok", text: d.added });
    };
  }

  const base = `/api/patients/${patient.id}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link href="/doctor" className="text-sm text-teal-700">← {d.back}</Link>
          <h1 className="text-2xl font-semibold">{patient.name}</h1>
          <p className="text-sm text-slate-500">{patient.age} · {patient.sex} · {d.fictional}</p>
        </div>
        <Link href={`/patient/${patient.id}`} className="rounded-md border border-teal-700 px-3 py-1.5 text-sm text-teal-800 hover:bg-teal-50">
          {d.viewAsPatient} →
        </Link>
      </div>

      {msg && (
        <p role="status" className={`rounded-md p-2 text-sm ${msg.tone === "err" ? "bg-red-100 text-red-900" : msg.tone === "warn" ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-900"}`}>
          {msg.text}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        {/* ---------- profile ---------- */}
        <div className="space-y-4">
          <section className={panel}>
            <h2 className="font-semibold">{d.conditions}</h2>
            <p className="mt-1 text-sm text-slate-700">{patient.conditions.join(", ") || d.none}</p>
          </section>

          <section className={panel}>
            <h2 className="font-semibold">{d.medications}</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {patient.medications.map((m, i) => <li key={i}><b>{m.name}</b> <span className="text-slate-600">{m.dose}</span> <span className="text-xs text-slate-500">· {d.started} {m.start_date ?? "?"}{m.end_date ? ` · ${d.stopped} ${m.end_date}` : ""}</span></li>)}
              {!patient.medications.length && <li className="text-slate-500">{d.none}</li>}
            </ul>
            <form onSubmit={submit(`${base}/medications`, ["name", "dose", "start_date", "end_date"])} className="mt-3 grid grid-cols-2 gap-2">
              <input name="name" placeholder={d.name} required className={input} />
              <input name="dose" placeholder={d.dose} className={input} />
              <label className="text-xs text-slate-600">{d.startDate} *<input name="start_date" type="date" required className={input} /></label>
              <label className="text-xs text-slate-600">{d.endDate}<input name="end_date" type="date" className={input} /></label>
              <button className={`${btn} col-span-2 sm:col-span-1`}>{d.add}</button>
            </form>
          </section>

          <section className={panel}>
            <h2 className="font-semibold">{d.allergies}</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {patient.allergies.map((a, i) => <li key={i}><b>{a.drug}</b> <span className="text-slate-600">{a.reaction}</span></li>)}
              {!patient.allergies.length && <li className="text-slate-500">{d.none}</li>}
            </ul>
            <form onSubmit={submit(`${base}/allergies`, ["drug", "reaction"])} className="mt-3 grid grid-cols-[1fr_1fr_auto] gap-2">
              <input name="drug" placeholder={d.drug} required className={input} />
              <input name="reaction" placeholder={d.reaction} className={input} />
              <button className={btn}>{d.add}</button>
            </form>
            <p className="mt-2 text-xs text-slate-500">{d.allergyNote}</p>
          </section>

          <section className={panel}>
            <h2 className="font-semibold">{d.labs}</h2>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-slate-500">
                  <tr><th className="py-1">{d.test}</th><th>{d.value}</th><th>{d.refRange}</th><th>{d.date}</th></tr>
                </thead>
                <tbody>
                  {patient.labs.map((l, i) => {
                    const dir = l.value < l.ref_low ? "low" : l.value > l.ref_high ? "high" : null;
                    return (
                      <tr key={i} className="border-t border-slate-100">
                        <td className="py-1.5">{l.test}</td>
                        <td className={dir ? "font-semibold text-red-700" : ""}>{l.value} {l.unit}{dir && ` (${d[dir]})`}</td>
                        <td className="text-slate-600">{l.ref_low}–{l.ref_high}</td>
                        <td className="whitespace-nowrap text-slate-500">{l.date}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <form onSubmit={submit(`${base}/labs`, ["test", "value", "unit", "ref_low", "ref_high", "date"])} className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              <input name="test" list="lab-tests" placeholder={d.test} required className={input} />
              <datalist id="lab-tests">{labTests.map((x) => <option key={x} value={x} />)}</datalist>
              <input name="value" type="number" step="any" placeholder={d.value} required className={input} />
              <input name="unit" placeholder={d.unit} className={input} />
              <input name="ref_low" type="number" step="any" placeholder={`${d.refLow} *`} required className={input} />
              <input name="ref_high" type="number" step="any" placeholder={`${d.refHigh} *`} required className={input} />
              <input name="date" type="date" required aria-label={d.date} className={input} />
              <p className="col-span-2 text-xs text-slate-500 sm:col-span-2">* {d.refRange}</p>
              <button className={btn}>{d.add}</button>
            </form>
          </section>

          <section className={panel}>
            <h2 className="font-semibold">{d.genetics}</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {patient.genetics.pgx.map((g, i) => <li key={`p${i}`}><b>{g.gene}</b>: {g.result}</li>)}
              {patient.genetics.variants.map((v, i) => <li key={`v${i}`}><b>{v.gene}</b>: {v.hgvs_c}</li>)}
            </ul>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const [gene, result] = String(new FormData(form).get("pgx")).split("||");
                if (await post(`${base}/genetics`, { type: "pgx", gene, result })) { form.reset(); setMsg({ tone: "ok", text: d.added }); }
              }}
              className="mt-3 grid grid-cols-[1fr_auto] gap-2"
            >
              <select name="pgx" className={input} required>
                {pgxOptions.map((o) => <option key={o.gene + o.result} value={`${o.gene}||${o.result}`}>{o.gene}: {o.result}</option>)}
              </select>
              <button className={btn}>{d.add}</button>
            </form>
            <form onSubmit={submit(`${base}/genetics`, ["hgvs_c"], { type: "variant" })} className="mt-2 grid grid-cols-[1fr_auto] gap-2">
              <input name="hgvs_c" placeholder={`BRCA1 ${d.variant}, e.g. c.68_69delAG`} required className={input} />
              <button className={btn}>{d.add}</button>
            </form>
          </section>
        </div>

        {/* ---------- findings + summary ---------- */}
        <div className="space-y-4">
          <section className={panel}>
            <h2 className="font-semibold">{d.findings}</h2>
            <div className="mt-2"><Findings findings={findings} trends={trends} d={d} /></div>
          </section>
          <SummaryPanel key={lang} patient={patient} lang={lang} d={d} />
        </div>
      </div>
    </div>
  );
}

function SummaryPanel({ patient, lang, d }: { patient: Patient; lang: Lang; d: Dict }) {
  const router = useRouter();
  const approved = patient.approved?.[lang];
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<AnalyzeResponse | null>(null);
  const [summary, setSummary] = useState(approved?.patient_summary ?? "");
  const [questions, setQuestions] = useState(approved?.patient_questions.join("\n") ?? "");
  const [status, setStatus] = useState<string | null>(null);
  const [serverCheck, setServerCheck] = useState<CheckResult | null>(null);

  const qList = questions.split("\n").map((q) => q.trim()).filter(Boolean);
  const live = useMemo(
    () => (res && summary ? checkOutput({ patient_summary: summary, patient_questions: qList, medication_notes: res.medication_notes }, res.llm_input, lang) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [res, summary, questions, lang],
  );

  async function analyze() {
    setBusy(true); setStatus(null); setServerCheck(null);
    try {
      const r = await fetch(`/api/analyze/${patient.id}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lang }),
      });
      const json = (await r.json()) as AnalyzeResponse;
      setRes(json);
      setSummary(json.draft.patient_summary ?? "");
      setQuestions((json.draft.patient_questions ?? []).join("\n"));
    } finally {
      setBusy(false);
    }
  }

  async function approve() {
    const r = await fetch(`/api/approve/${patient.id}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lang, patient_summary: summary, patient_questions: qList }),
    });
    const json = await r.json();
    if (r.ok) { setStatus(d.approved); setServerCheck(null); router.refresh(); }
    else { setStatus(`${d.error}: ${json.error}`); setServerCheck(json.check_output ?? null); }
  }

  const check = serverCheck ?? live;
  const draft = res?.draft;

  return (
    <section className={panel}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">{d.patientDraft} · {lang.toUpperCase()}</h2>
        <button onClick={analyze} disabled={busy} className={btn}>{busy ? d.analyzing : d.analyze}</button>
      </div>

      {approved && (
        <p className="mt-2 text-xs text-emerald-700">✓ {d.approvedOn} {new Date(approved.approved_at).toLocaleString()}</p>
      )}

      {draft?.error && (
        <p className="mt-3 rounded-md bg-red-50 p-2 text-sm text-red-900">
          {draft.error === "rejected_by_check_output" ? d.draftRejected : `${d.llmError}: ${draft.error}`}
        </p>
      )}

      {draft?.clinician_summary && (
        <div className="mt-3">
          <h3 className="text-sm font-semibold">{d.clinicianSummary}</h3>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
            {draft.clinician_summary.map((b, i) => <li key={i}>{b}</li>)}
          </ul>
        </div>
      )}

      {(res || approved) && (
        <div className="mt-4 space-y-3">
          <label className="block text-sm font-semibold">
            {d.patientDraft}
            <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={8} className={`${input} mt-1 font-normal`} />
          </label>
          <label className="block text-sm font-semibold">
            {d.patientQuestions} <span className="font-normal text-slate-500">({d.onePerLine})</span>
            <textarea value={questions} onChange={(e) => setQuestions(e.target.value)} rows={4} className={`${input} mt-1 font-normal`} />
          </label>
          {res && res.medication_notes.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold">{d.medicationNotes}</h3>
              <ul className="mt-1 space-y-1 text-sm">
                {res.medication_notes.map((n) => <li key={n} className="rounded bg-sky-50 p-2">{n}</li>)}
              </ul>
            </div>
          )}

          {check && (
            <div className="text-sm">
              {check.ok ? <p className="text-emerald-700">✓ {d.checkOk}</p> : (
                <div className="rounded-md bg-red-50 p-2 text-red-900">
                  <p className="font-semibold">{d.checkProblems}</p>
                  <ul className="list-disc pl-5">{check.errors.map((e, i) => <li key={i}>{e.message}: “{e.found}”</li>)}</ul>
                </div>
              )}
              {check.warnings.length > 0 && (
                <div className="mt-2 text-amber-800">
                  <p className="font-semibold">{d.checkWarnings}</p>
                  <ul className="list-disc pl-5">{check.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
                </div>
              )}
            </div>
          )}

          <button onClick={approve} disabled={!summary.trim() || (live !== null && !live.ok)} className={btn}>
            {d.approve}
          </button>
          {status && <p className="text-sm">{status}</p>}
        </div>
      )}
    </section>
  );
}
