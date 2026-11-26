import { EVO2_SOURCE } from "@/lib/demo/fixtures";
import type { Text } from "@/lib/demo/i18n";
import { card } from "./ui";

// No genuine, attributable Evo 2 predictions exist in this repository (data/scores.csv is empty),
// so this page shows the plan and an honest status. Nothing here reaches patients.
export default function ResearchView({ T }: { T: Text }) {
  const cols = [T.colVariant, T.colModel, T.colScore, T.colExpert, T.colSource, T.colAgreement];
  return (
    <div className="space-y-4">
      <section className={card}>
        <h1 className="text-2xl font-bold">{T.researchTitle}</h1>
        <h2 className="mt-4 text-sm font-semibold uppercase tracking-wide text-slate-500">{T.researchQuestion}</h2>
        <p className="mt-1 text-lg">{T.researchQuestionText}</p>
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border-2 border-slate-400 bg-slate-50 p-4">
          <span className="text-sm font-semibold uppercase tracking-wide text-slate-600">{T.researchStatus}</span>
          <span className="rounded-full border border-slate-500 bg-white px-3 py-1 font-bold">○ {T.researchStatusText}</span>
          <p className="w-full text-sm text-slate-700">{T.researchStatusNote}</p>
        </div>
      </section>

      <section className={card}>
        <h2 className="text-lg font-bold">{T.researchPlan}</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          {T.researchPlanText.map((x) => <li key={x}>{x}</li>)}
        </ol>
        <h3 className="mt-4 font-bold">{T.researchFields}</h3>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-slate-100"><tr>{cols.map((c) => <th key={c} className="p-2">{c}</th>)}</tr></thead>
            <tbody><tr><td colSpan={cols.length} className="p-4 text-center text-slate-600">{T.researchEmpty}</td></tr></tbody>
          </table>
        </div>
      </section>

      <section className={card}>
        <h2 className="text-lg font-bold">{T.researchSafety}</h2>
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
