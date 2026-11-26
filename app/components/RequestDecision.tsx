"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Dict } from "@/lib/translations";
import type { RecordCategory, RecordRequest } from "@/lib/types";
import { catLabel } from "./RecordBits";

const btn = "min-h-10 rounded-md px-3 py-1.5 text-sm font-semibold disabled:opacity-50";

/** Doctor decides on a pending record request; categories can be unticked, never added. */
export function RequestDecision({ patientId, patientName, request, d }: { patientId: string; patientName?: string; request: RecordRequest; d: Dict }) {
  const router = useRouter();
  const [cats, setCats] = useState<RecordCategory[]>(request.categories);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const decide = async (decision: "approve" | "decline") => {
    setBusy(true); setErr(null);
    const r = await fetch(`/api/patients/${patientId}/record-requests/${request.id}/decision`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision, categories: cats }),
    });
    if (!r.ok) setErr((await r.json()).error);
    setBusy(false);
    router.refresh();
  };
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
      <p><b>{patientName ? `${patientName} · ` : ""}{request.clinic_name}</b> <span className="rounded bg-sky-100 px-1.5 text-[11px] font-semibold text-sky-900">{d.simulatedBadge}</span></p>
      <p className="text-slate-600">{d.requestedOn} {request.requested_at.slice(0, 16).replace("T", " ")} · {request.id}</p>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {request.categories.map((c) => (
          <label key={c} className="flex items-center gap-1.5">
            <input type="checkbox" checked={cats.includes(c)} onChange={(e) => setCats(e.target.checked ? [...cats, c] : cats.filter((x) => x !== c))} />
            {catLabel(c, d)}
          </label>
        ))}
      </div>
      {err && <p role="alert" className="mt-1 text-red-800">{err}</p>}
      <div className="mt-2 flex gap-2">
        <button className={`${btn} bg-teal-700 text-white hover:bg-teal-800`} disabled={busy || !cats.length} onClick={() => decide("approve")}>✓ {d.approveRequest}</button>
        <button className={`${btn} border border-red-300 bg-white text-red-800 hover:bg-red-50`} disabled={busy} onClick={() => decide("decline")}>✕ {d.declineRequest}</button>
      </div>
    </div>
  );
}

export function SyncAgain({ patientId, request, d }: { patientId: string; request: RecordRequest; d: Dict }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button className={`${btn} border border-slate-300 bg-white hover:bg-slate-50`} onClick={async () => {
        const r = await fetch(`/api/patients/${patientId}/record-requests/${request.id}/sync`, { method: "POST" });
        setMsg(r.ok ? null : (await r.json()).error);
        router.refresh();
      }}>⟳ {d.syncAgain}</button>
      {msg && <span role="alert" className="text-sm text-red-800">{msg}</span>}
    </span>
  );
}
