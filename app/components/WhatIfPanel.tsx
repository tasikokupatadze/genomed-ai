"use client";
import { useState } from "react";
import type { Dict } from "@/lib/translations";
import type { WhatIf } from "@/lib/research/tables";

const chip = (s: "in_range" | "below" | "above", d: Dict) =>
  s === "in_range" ? <span className="rounded-full bg-green-100 px-2 text-xs font-medium text-green-800">✓ {d.inRange}</span>
    : <span className="rounded-full bg-red-100 px-2 text-xs font-medium text-red-800">{s === "below" ? "↓" : "↑"} {s === "below" ? d.belowRange : d.aboveRange}</span>;

/** "What if this patient started <drug>?" Nothing is saved; table lookups only. */
export default function WhatIfPanel({ patientId, drugs, d }: { patientId: string; drugs: string[]; d: Dict }) {
  const [drug, setDrug] = useState("");
  const [res, setRes] = useState<WhatIf | null>(null);
  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await fetch(`/api/whatif/${patientId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ drug }) });
    if (r.ok) setRes(await r.json());
  };
  const empty = res && !res.labs.length && !res.pgx.length && !res.allergy.length;
  return (
    <section className="rounded-lg border border-edge bg-white p-5" aria-labelledby="whatif-title">
      <h2 id="whatif-title" className="font-semibold">{d.whatIfTitle}</h2>
      <p className="text-sm text-gray-500">{d.whatIfHint}</p>
      <form onSubmit={run} className="mt-3 flex gap-2">
        <input list="whatif-drugs" aria-label={d.whatIfDrug} placeholder={d.whatIfDrug} value={drug} onChange={(e) => setDrug(e.target.value)}
          className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm" required />
        <datalist id="whatif-drugs">{drugs.map((x) => <option key={x} value={x} />)}</datalist>
        <button className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800">{d.whatIfRun}</button>
      </form>
      {res && (
        <div className="mt-4 space-y-3 text-sm" role="status">
          <p className="font-medium text-ink">{res.drug}{res.drugClass ? <span className="font-normal text-gray-500"> · {res.drugClass}</span> : null}</p>
          {!res.known && <p className="rounded-md bg-amber-50 p-2 text-amber-900">{d.whatIfUnknown}</p>}
          {res.known && empty && <p className="rounded-md bg-canvas p-2 text-gray-700">{d.whatIfNothing}</p>}
          {res.allergy.length > 0 && (
            <div className="rounded-md bg-red-50 p-3 text-red-900"><b>{d.whatIfAllergy}:</b> {res.allergy.map((a) => `${a.allergy}${a.group ? ` (${a.group})` : ""}`).join(", ")}</div>
          )}
          {res.pgx.length > 0 && (
            <div><p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-gray-500">{d.whatIfGenes}</p>
              <ul className="mt-1 space-y-1">{res.pgx.map((g) => <li key={g.gene}><b className="font-mono">{g.gene}</b> {g.result}: {g.effect}</li>)}</ul></div>
          )}
          {res.labs.length > 0 && (
            <div><p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-gray-500">{d.whatIfLabs}</p>
              <ul className="mt-1 divide-y divide-hair">
                {res.labs.map((l) => (
                  <li key={l.test} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span><b className="text-ink">{l.test}</b> <span className="text-gray-600">{d[`dir_${l.direction}` as const]}</span></span>
                    <span className="flex items-center gap-2 text-gray-600">
                      {l.latest ? <><span className="font-mono">{d.whatIfLatest} {l.latest.value} {l.latest.unit} · {l.latest.date}</span>{chip(l.latest.status, d)}</> : <span>{d.whatIfNoResult}</span>}
                    </span>
                  </li>
                ))}
              </ul></div>
          )}
          {res.allergyUnchecked && <p className="text-xs text-gray-500">{d.allergyUnchecked}</p>}
        </div>
      )}
    </section>
  );
}
