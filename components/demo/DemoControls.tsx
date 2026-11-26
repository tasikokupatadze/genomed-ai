"use client";
import { dispatch } from "@/lib/demo/useDemoStore";
import { EVIDENCE_UPDATES, GENETIC_REPORT } from "@/lib/demo/fixtures";
import { CLASS_LABEL, OUTCOME_TEXT, type Text } from "@/lib/demo/i18n";
import { updateFingerprint } from "@/lib/demo/matching";
import type { DemoState, PatientId } from "@/lib/demo/types";
import { Mono, StatusBadge } from "./ui";

/** Judge-only simulation panel. Visually separate from the patient and clinician interfaces. */
export default function DemoControls({ s, T }: { s: DemoState; T: Text }) {
  const lang = s.lang;
  const ev = s.lastEvent?.kind === "genetic" ? s.lastEvent : null;
  const evUpdate = ev ? EVIDENCE_UPDATES.find((u) => u.id === ev.updateId) : null;
  const evReview = ev?.reviewId ? s.reviews.find((r) => r.id === ev.reviewId) : null;

  const caseBtn = (id: PatientId, label: string) => (
    <button
      onClick={() => dispatch({ type: "setPatient", patientId: id })}
      aria-pressed={s.patientId === id}
      className={`rounded-lg border px-2.5 py-2 text-left text-sm font-semibold ${s.patientId === id ? "border-violet-700 bg-violet-700 text-white" : "border-violet-300 bg-white text-violet-950 hover:bg-violet-100"}`}
    >{label}</button>
  );

  const check = (ok: boolean, label: string) => (
    <li className="flex items-center gap-2">
      <span aria-hidden className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold text-white ${ok ? "bg-emerald-600" : "bg-red-600"}`}>{ok ? "✓" : "✕"}</span>
      <span>{label}: <b>{ok ? T.matched : T.differed}</b></span>
    </li>
  );

  return (
    <div className="rounded-lg border border-dashed border-violet-300 bg-violet-50 p-5 text-violet-950">
      <div className="flex items-center gap-2">
        <span className="rounded bg-violet-700 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-white">{T.demoControls}</span>
      </div>
      <p className="mt-1 text-xs">{T.demoControlsNote}</p>

      <h3 className="mt-4 text-sm font-bold">{T.casePicker}</h3>
      <div className="mt-1 grid grid-cols-2 gap-2">
        {caseBtn("pt-nino", T.caseGenetic)}
        {caseBtn("pt-davit", T.caseThyroid)}
      </div>

      <h3 className="mt-4 text-sm font-bold">{T.simulateUpdate}</h3>
      <p className="text-xs">{T.simulateHint}</p>
      <div className="mt-2 space-y-2">
        {EVIDENCE_UPDATES.map((u, i) => {
          const seen = s.processed.find((p) => p.fingerprint === updateFingerprint(GENETIC_REPORT.id, u));
          return (
            <button
              key={u.id}
              onClick={() => dispatch({ type: "processUpdate", updateId: u.id })}
              className="flex w-full items-start gap-2 rounded-lg border border-violet-300 bg-white p-2.5 text-left text-sm hover:bg-violet-100"
            >
              <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded bg-violet-200 text-xs font-bold">{i + 1}</span>
              <span className="flex-1 font-semibold">{u.controlTitle[lang]}</span>
              {seen && <span className="shrink-0 rounded bg-violet-200 px-1.5 text-xs font-bold">{T.received} {seen.timesReceived}{T.times}</span>}
            </button>
          );
        })}
      </div>

      {ev && evUpdate && (
        <div className="mt-4 rounded-lg border border-violet-300 bg-white p-3 text-sm" role="status" aria-live="polite">
          <p className="text-xs font-bold uppercase tracking-wide text-violet-700">{T.lastResult}</p>
          <p className="font-semibold">{evUpdate.controlTitle[lang]}</p>
          {ev.duplicate && <p className="mt-1 rounded bg-amber-100 p-2 font-semibold text-amber-950">⟳ {T.duplicate}</p>}
          <ul className="mt-2 space-y-1">
            {check(ev.result.geneMatch, `${T.fieldGene} (${evUpdate.gene})`)}
            <li className="flex items-center gap-2">
              <span aria-hidden className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold text-white ${ev.result.variantMatch ? "bg-emerald-600" : "bg-red-600"}`}>{ev.result.variantMatch ? "✓" : "✕"}</span>
              <span>{T.fieldVariant} (<Mono>{evUpdate.variant.id}</Mono>): <b>{ev.result.variantMatch ? T.matched : T.differed}</b></span>
            </li>
            <li className="flex items-center gap-2">
              <span aria-hidden className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold text-white ${ev.result.conditionMatch ? "bg-emerald-600" : "bg-red-600"}`}>{ev.result.conditionMatch ? "✓" : "✕"}</span>
              <span>{T.fieldCondition} (<Mono>{evUpdate.condition.id}</Mono>): <b>{ev.result.conditionMatch ? T.matched : T.differed}</b></span>
            </li>
            <li className="pl-7">
              {T.fieldClassification}: {CLASS_LABEL[ev.result.previousClassification][lang]} → <b>{CLASS_LABEL[ev.result.newClassification][lang]}</b>
            </li>
          </ul>
          <p className="mt-2">{OUTCOME_TEXT[ev.result.outcome][lang]}</p>
          <p className={`mt-2 rounded p-2 font-bold ${ev.reviewId ? "bg-emerald-100 text-emerald-900" : "bg-slate-100 text-slate-800"}`}>
            {ev.reviewId
              ? ev.duplicate ? `${T.existingReview}: ${ev.reviewId}`
                : ev.autoShared ? `⚙ ${T.autoSharedResult}: ${ev.reviewId}` : `✓ ${T.reviewOpened}: ${ev.reviewId}`
              : `○ ${T.noReview}`}
          </p>
          {evReview && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusBadge status={evReview.status} lang={lang} />
              <button
                className="rounded-lg bg-violet-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-violet-800"
                onClick={() => { dispatch({ type: "selectReview", reviewId: evReview.id }); dispatch({ type: "setRole", role: "clinician" }); }}
              >{T.openReview} →</button>
            </div>
          )}
        </div>
      )}

      <div className="mt-4 border-t border-violet-300 pt-3">
        <button
          className="rounded-lg border border-violet-700 bg-white px-3 py-1.5 text-sm font-semibold text-violet-900 hover:bg-violet-100"
          onClick={() => { if (window.confirm(T.resetConfirm)) dispatch({ type: "reset" }); }}
        >↺ {T.resetDemo}</button>
        <p className="mt-2 text-xs">{T.storageNote}</p>
      </div>
    </div>
  );
}
