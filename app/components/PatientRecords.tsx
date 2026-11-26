"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Dict } from "@/lib/translations";
import { RECORD_CATEGORIES, type Patient, type RecordCategory } from "@/lib/types";
import { catLabel, ConsentLog, ProvenanceTag } from "./RecordBits";

const btn = "min-h-11 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50";
const primary = `${btn} bg-teal-700 text-white hover:bg-teal-800`;
const secondary = `${btn} border border-slate-300 bg-white hover:bg-slate-50`;
const card = "rounded-xl bg-white p-5 shadow-sm";

async function post(url: string, data: object) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  return { ok: r.ok, json: await r.json() };
}

export default function PatientRecords({ patient, clinics, d }: { patient: Patient; clinics: { id: string; name: string }[]; d: Dict }) {
  const router = useRouter();
  const [clinic, setClinic] = useState(clinics[0]?.id ?? "");
  const [cats, setCats] = useState<RecordCategory[]>([...RECORD_CATEGORIES]);
  const [msg, setMsg] = useState<string | null>(null);
  const base = `/api/patients/${patient.id}`;
  const requests = (patient.record_requests ?? []).slice().reverse();

  const imported = [
    ...patient.labs.filter((x) => x.provenance).map((x) => ({ id: x.id!, label: `${x.test}: ${x.value} ${x.unit} (${x.date})`, prov: x.provenance, note: x.patient_note })),
    ...patient.medications.filter((x) => x.provenance).map((x) => ({ id: x.id!, label: `${x.name} ${x.dose} · ${d.started} ${x.start_date}`, prov: x.provenance, note: x.patient_note })),
    ...patient.allergies.filter((x) => x.provenance).map((x) => ({ id: x.id!, label: `${d.allergies}: ${x.drug} (${x.reaction})`, prov: x.provenance, note: x.patient_note })),
    ...(patient.clinic_conditions ?? []).map((x) => ({ id: x.id!, label: `${x.text}${x.onset ? ` (${x.onset})` : ""}`, prov: x.provenance, note: x.patient_note })),
    ...(patient.procedures ?? []).map((x) => ({ id: x.id!, label: `${d.procedures}: ${x.text}${x.date ? ` (${x.date})` : ""}`, prov: x.provenance, note: x.patient_note })),
  ];

  return (
    <section className={`${card} space-y-4`} aria-labelledby="records-title">
      <div>
        <h2 id="records-title" className="font-semibold">{d.recordsTitle}</h2>
        <p className="text-sm text-slate-600">{d.recordsHint}</p>
      </div>

      <form className="space-y-2 rounded-lg border border-slate-200 p-3" onSubmit={async (e) => {
        e.preventDefault();
        const r = await post(`${base}/record-requests`, { clinic_id: clinic, categories: cats });
        setMsg(r.ok ? null : r.json.error);
        if (r.ok) router.refresh();
      }}>
        <label className="block text-sm font-medium">{d.chooseClinic}
          <select className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2" value={clinic} onChange={(e) => setClinic(e.target.value)}>
            {clinics.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <fieldset>
          <legend className="text-sm font-medium">{d.categoriesLabel}</legend>
          <div className="mt-1 grid grid-cols-2 gap-1 sm:grid-cols-3">
            {RECORD_CATEGORIES.map((c) => (
              <label key={c} className="flex min-h-11 items-center gap-2 text-sm">
                <input type="checkbox" checked={cats.includes(c)} onChange={(e) => setCats(e.target.checked ? [...cats, c] : cats.filter((x) => x !== c))} />
                {catLabel(c, d)}
              </label>
            ))}
          </div>
        </fieldset>
        {msg && <p role="alert" className="text-sm text-red-800">{msg}</p>}
        <button className={primary} disabled={!cats.length || !clinic}>{d.requestRecords}</button>
      </form>

      {requests.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold">{d.recordRequests}</h3>
          <ul className="mt-1 space-y-2">
            {requests.map((r) => {
              const s = r.syncs?.at(-1);
              const tone = r.status === "approved" ? "bg-emerald-100 text-emerald-900" : r.status === "declined" ? "bg-slate-200 text-slate-800" : "bg-amber-100 text-amber-900";
              const icon = r.status === "approved" ? "✓" : r.status === "declined" ? "✕" : "●";
              return (
                <li key={r.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${tone}`}>{icon} {d[`status_${r.status}` as const]}</span>
                    <b>{r.clinic_name}</b>
                  </div>
                  <p className="text-slate-600">{d.requestedOn} {r.requested_at.slice(0, 10)} · {r.categories.map((c) => catLabel(c, d)).join(", ")}</p>
                  {r.status === "approved" && r.approved_categories && <p className="text-slate-600">{d.status_approved}: {r.approved_categories.map((c) => catLabel(c, d)).join(", ")}</p>}
                  {s && (
                    <p className="mt-1">
                      {Object.values(s.imported).some(Boolean)
                        ? <>{d.importedSummary}: {(Object.entries(s.imported) as [RecordCategory, number][]).filter(([, n]) => n).map(([c, n]) => `${catLabel(c, d)} ${n}`).join(", ")}</>
                        : d.nothingImported}
                      {Object.values(s.skipped_duplicates).some(Boolean) && <span className="text-slate-600"> · {Object.values(s.skipped_duplicates).reduce((a, b) => a + b, 0)} {d.skippedDup}</span>}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {(patient.consents ?? []).length > 0 && (
        <div>
          <h3 className="text-sm font-semibold">{d.activeAccess}</h3>
          <ul className="mt-1 space-y-2">
            {patient.consents!.map((c) => (
              <li key={c.clinic_id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-3 text-sm">
                <span><b>{c.clinic_name}</b> · {c.categories.map((x) => catLabel(x, d)).join(", ")}</span>
                {c.active
                  ? <button className={`${secondary} text-red-800`} onClick={async () => { await post(`${base}/consent/revoke`, { clinic_id: c.clinic_id }); router.refresh(); }}>{d.revokeAccess}</button>
                  : <span className="text-slate-600">{d.revokedNote}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold">{d.importedRecords}</h3>
        <p className="text-xs text-slate-500">{d.readOnlyClinic}</p>
        {!imported.length && <p className="text-sm text-slate-500">{d.noRecordsYet}</p>}
        <ul className="mt-1 space-y-2">
          {imported.map((x) => <ImportedItem key={x.id} item={x} base={base} d={d} />)}
        </ul>
      </div>

      <details>
        <summary className="cursor-pointer text-sm font-semibold">{d.consentLog}</summary>
        <div className="mt-2"><ConsentLog events={patient.consent_log ?? []} d={d} /></div>
      </details>
    </section>
  );
}

function ImportedItem({ item, base, d }: { item: { id: string; label: string; prov?: Patient["labs"][number]["provenance"]; note?: string }; base: string; d: Dict }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(item.note ?? "");
  return (
    <li className="rounded-lg bg-slate-50 p-2 text-sm">
      <span className="font-medium">{item.label}</span> <ProvenanceTag prov={item.prov} d={d} />
      {item.note && !editing && <span className="mt-0.5 block italic text-slate-700">💬 {d.yourNote}: {item.note}</span>}
      {editing ? (
        <div className="mt-1 flex flex-wrap gap-2">
          <input aria-label={d.yourNote} className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1.5" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
          <button className={primary} onClick={async () => { await post(`${base}/notes`, { item_id: item.id, note }); setEditing(false); router.refresh(); }}>{d.saveNote}</button>
        </div>
      ) : (
        <button className="mt-1 block text-xs font-semibold text-teal-800 underline" onClick={() => setEditing(true)}>💬 {d.addNote}</button>
      )}
    </li>
  );
}
