import type { Dict } from "@/lib/translations";
import type { ConsentEvent, Medication, Provenance, RecordCategory } from "@/lib/types";

export const catLabel = (c: RecordCategory, d: Dict) => d[`cat_${c}` as const];
const day = (iso: string) => iso.slice(0, 10);
const time = (iso: string) => iso.slice(0, 16).replace("T", " ");

/** "Clinic record (simulated) · clinic · imported date" on every imported item. */
export function ProvenanceTag({ prov, d }: { prov?: Provenance; d: Dict }) {
  if (!prov) return null;
  return (
    <span className="ml-1 inline-flex flex-wrap items-center gap-1 rounded border border-dashed border-sky-400 bg-sky-50 px-1.5 py-0.5 text-[11px] font-semibold text-sky-900">
      🏥 {d.fromClinic} · {prov.clinic_name} · {day(prov.imported_at)}
    </span>
  );
}

export function EntryTag({ m, d }: { m: Medication; d: Dict }) {
  return (
    <>
      {m.entered_by === "patient_scan" && <span className="ml-1 rounded bg-slate-100 px-1.5 text-[11px] font-semibold text-slate-700">📷 {d.fromScan}</span>}
      {m.entered_by === "patient_typed" && <span className="ml-1 rounded bg-slate-100 px-1.5 text-[11px] font-semibold text-slate-700">⌨ {d.fromTyped}</span>}
      {m.match_status === "unmatched" && <span className="ml-1 rounded bg-amber-500 px-1.5 text-[11px] font-bold text-white">? {d.unmatchedBadge}</span>}
      <ProvenanceTag prov={m.provenance} d={d} />
    </>
  );
}

export function NoteLine({ note, d }: { note?: string; d: Dict }) {
  return note ? <span className="mt-0.5 block text-xs italic text-slate-700">💬 {d.patientNote}: {note}</span> : null;
}

export function ConsentLog({ events, d }: { events: ConsentEvent[]; d: Dict }) {
  if (!events.length) return <p className="text-sm text-slate-500">–</p>;
  return (
    <ol className="space-y-1 border-l-2 border-slate-300 pl-3 text-sm">
      {events.slice().reverse().map((e, i) => (
        <li key={i}>
          <span className="font-mono text-xs text-slate-500">{time(e.at)}</span>{" "}
          <b>{d[`ev_${e.event}` as const]}</b> · {d[`actor_${e.actor}` as const]} · {e.clinic_name}
          {e.categories?.length ? <span className="text-slate-600"> · {e.categories.map((c) => catLabel(c, d)).join(", ")}</span> : null}
          {e.detail && <span className="text-slate-600"> · {e.detail}</span>}
        </li>
      ))}
    </ol>
  );
}
