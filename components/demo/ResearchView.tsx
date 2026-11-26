"use client";
import Link from "next/link";
import { CartesianGrid, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";
import { EVO2_SOURCE } from "@/lib/demo/fixtures";
import type { Text } from "@/lib/demo/i18n";
import { RESULTS, VARIANT_SET } from "@/lib/demo/research";
import { card } from "./ui";

// Shows the real, pre-registered variant set and plan. Numbers appear ONLY when
// data/research/results.json holds a real Evo 2 run; otherwise "Benchmark not yet run".
// Research output never reaches patients and never changes a classification.
export default function ResearchView({ T }: { T: Text }) {
  const cols = [T.colVariant, T.colModel, T.colScore, T.colExpert, T.colSource, T.colAgreement];
  const done = RESULTS.status === "complete" ? RESULTS : null;
  const v = VARIANT_SET;
  const total = (x: { pathogenic: number; benign: number }) => x.pathogenic + x.benign;

  return (
    <div className="space-y-4">
      <section className={card}>
        <h1 className="text-2xl font-bold">{T.researchTitle}</h1>
        <h2 className="mt-4 text-sm font-semibold uppercase tracking-wide text-slate-500">{T.researchQuestion}</h2>
        <p className="mt-1 text-lg">{T.researchQuestionText}</p>
        <div className={`mt-4 flex flex-wrap items-center gap-3 rounded-lg border p-4 ${done ? "border-green-200 bg-green-50" : "border-edge bg-canvas"}`}>
          <span className="text-sm font-semibold uppercase tracking-wide text-slate-600">{T.researchStatus}</span>
          <span className="rounded-full border border-slate-500 bg-white px-3 py-1 font-bold">
            {done ? `✓ ${T.researchStatusDone}` : `○ ${T.researchStatusText}`}
          </span>
          {!done && <p className="w-full text-sm text-slate-700">{T.researchStatusNote}</p>}
          {done && <p className="w-full text-sm text-slate-700">{done.model} · {done.method} · {done.scored_on.join(", ")}</p>}
        </div>
      </section>

      <section className={card}>
        <h2 className="text-lg font-bold">{T.researchSet}</h2>
        <p className="mt-1">{T.researchSetText}</p>
        <p className="mt-2 rounded-lg bg-sky-50 p-3 text-sm">{T.researchWhyMissense}</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="bg-slate-100">
              <tr><th className="p-2" /><th className="p-2">{T.researchHarmful}</th><th className="p-2">{T.researchHarmless}</th><th className="p-2">Σ</th></tr>
            </thead>
            <tbody>
              {([[T.researchEligible, v.eligible], [T.researchCalibration, v.selected.calibration], [T.researchTest, v.selected.test]] as const).map(([label, x]) => (
                <tr key={label} className="border-t border-slate-200">
                  <th scope="row" className="p-2 font-semibold">{label}</th><td className="p-2">{x.pathogenic}</td><td className="p-2">{x.benign}</td><td className="p-2">{total(x)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {v.gene} · {v.assembly} · {v.source} · {v.selection} · seed {v.seed} · <span className="font-mono">data/research/variant_set.csv</span>
        </p>
      </section>

      <section className={card}>
        <h2 className="text-lg font-bold">{T.researchMethod}</h2>
        <p className="mt-1">{done?.method === "forward" ? T.methodForward : T.methodNextBase}</p>
        <h3 className="mt-4 font-bold">{T.researchPlan}</h3>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          {T.researchPlanText.map((x) => <li key={x}>{x}</li>)}
        </ol>
        <p className="mt-3 text-sm text-slate-600">{T.researchRunIt}</p>
      </section>

      {done ? <Results r={done} T={T} cols={cols} /> : (
        <section className={card}>
          <h2 className="text-lg font-bold">{T.researchFields}</h2>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-slate-100"><tr>{cols.map((c) => <th key={c} className="p-2">{c}</th>)}</tr></thead>
              <tbody><tr><td colSpan={cols.length} className="p-4 text-center text-slate-600">{T.researchEmpty}</td></tr></tbody>
            </table>
          </div>
        </section>
      )}

      <section className={`${card} border-l-[3px] border-l-teal-700`}>
        <h2 className="text-lg font-bold">{T.predCardTitle}</h2>
        <p className="mt-1">{T.predCardText}</p>
        <Link href="/doctor/research" className="mt-3 inline-flex rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800">{T.predCardLink} →</Link>
      </section>

      <section className={card}>
        <h2 className="text-lg font-bold">{T.researchLimits}</h2>
        <p className="mt-1">{T.researchLimitsText}</p>
        <h2 className="mt-4 text-lg font-bold">{T.researchSafety}</h2>
        <p className="mt-1">{T.researchSafetyText}</p>
        <h2 className="mt-4 text-lg font-bold">{T.researchCite}</h2>
        <p className="mt-1">
          {T.researchCiteText}{" "}
          <a href={EVO2_SOURCE.url} target="_blank" rel="noreferrer" className="text-teal-800 underline">{EVO2_SOURCE.url}</a>
        </p>
      </section>
    </div>
  );
}

function Results({ r, T, cols }: { r: Extract<typeof RESULTS, { status: "complete" }>; T: Text; cols: string[] }) {
  const test = r.variants.filter((x) => x.split === "test").sort((a, b) => Number(a.agrees) - Number(b.agrees) || a.score - b.score);
  // Spread points vertically by expert class (with a little deterministic jitter) for a strip plot.
  const pts = (label: number) => r.variants.map((x, i) => ({ ...x, y: label + ((i * 37) % 11 - 5) / 40 })).filter((x) => x.expert_label === label);
  return (
    <section className={card}>
      <h2 className="text-lg font-bold">{T.researchResults}</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div className="rounded-md bg-canvas p-4">
          <p className="text-xs font-semibold uppercase text-slate-600">{T.researchAuroc}</p>
          <p className="text-2xl font-bold">{r.auroc_test.toFixed(2)}</p>
          <p className="text-xs text-slate-600">{T.researchCi}: {r.auroc_test_ci95[0].toFixed(2)}–{r.auroc_test_ci95[1].toFixed(2)} · {T.researchAurocHelp}</p>
        </div>
        <div className="rounded-md bg-canvas p-4">
          <p className="text-xs font-semibold uppercase text-slate-600">{T.researchAgreement}</p>
          <p className="text-2xl font-bold">{Math.round(r.test_agreement * 100)}% <span className="text-base font-normal">({Math.round(r.test_agreement * r.n_test)}/{r.n_test})</span></p>
          <p className="text-xs text-slate-600">{T.researchCutoff}: {r.cutoff}</p>
        </div>
        <div className="rounded-md bg-canvas p-4">
          <p className="text-xs font-semibold uppercase text-slate-600">{T.researchScored}</p>
          <p className="text-2xl font-bold">{r.n_scored}</p>
          <p className="text-xs text-slate-600">{r.n_failed} {T.researchFailedN}</p>
        </div>
      </div>

      <h3 className="mt-5 font-bold">{T.researchChart}</h3>
      <div className="mt-2 h-56 w-full" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 16, bottom: 20, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis type="number" dataKey="score" name="score" tick={{ fontSize: 11 }}
              label={{ value: `${r.model} score`, position: "insideBottom", offset: -12, fontSize: 11 }} />
            <YAxis type="number" dataKey="y" domain={[-0.5, 1.5]} ticks={[0, 1]} width={110} tick={{ fontSize: 11 }}
              tickFormatter={(t) => (t === 1 ? T.researchHarmful.split(" / ")[0] : T.researchHarmless.split(" / ")[0])} />
            <ReferenceLine x={r.cutoff} stroke="#64748b" strokeDasharray="5 4" />
            <Tooltip formatter={(val) => [val, "score"]} labelFormatter={() => ""} />
            <Scatter data={pts(1)} fill="#b91c1c" />
            <Scatter data={pts(0)} fill="#0f766e" />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      <h3 className="mt-4 font-bold">{T.researchTable}</h3>
      <div className="mt-2 max-h-96 overflow-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="sticky top-0 bg-slate-100"><tr>{cols.map((c) => <th key={c} className="p-2">{c}</th>)}</tr></thead>
          <tbody>
            {test.map((x) => (
              <tr key={x.variation_id} className={`border-t border-slate-200 ${x.agrees ? "" : "bg-amber-50"}`}>
                <td className="p-2 font-mono text-xs">{x.hgvs_c}<br />{x.hgvs_p}</td>
                <td className="p-2 text-xs">{r.model}<br />{r.method}</td>
                <td className="p-2">{x.score.toFixed(3)}<br /><span className="text-xs text-slate-600">{x.model_call ? T.researchCallDisruptive : T.researchCallTolerated}</span></td>
                <td className="p-2">{x.clinical_significance}</td>
                <td className="p-2"><a className="text-teal-800 underline" href={x.source_url} target="_blank" rel="noreferrer">ClinVar {x.variation_id}</a></td>
                <td className="p-2 font-semibold">{x.agrees ? `✓ ${T.researchAgree}` : `✕ ${T.researchDisagree}`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-500">{T.researchProvenance}: {r.model} · {r.method} · window {r.window_bp} bp · {r.scored_on.join(", ")} · {r.generated_at}</p>
    </section>
  );
}
