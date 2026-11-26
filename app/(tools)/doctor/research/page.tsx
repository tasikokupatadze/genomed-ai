import Link from "next/link";
import { getLang } from "@/lib/i18n";
import { t } from "@/lib/translations";
import { listPatients } from "@/lib/store";
import { evaluatePredictions, observedChanges, summarize, type Point } from "@/lib/research/predict";
import { knownDrugs, tables, whatIf } from "@/lib/research/tables";

export const dynamic = "force-dynamic";

const card = "rounded-lg border border-edge bg-white p-6";
const th = "py-2 pr-4 text-left text-[11px] font-semibold uppercase tracking-[0.09em] text-gray-500";
const td = "border-t border-hair py-2.5 pr-4 align-top";
const pct = (x: number | null) => (x === null ? "–" : `${Math.round(x * 100)}%`);

// Predict, then check: research view for doctors. Fictional demo data only; never shown to patients.
export default async function PredictionCheck({ searchParams }: PageProps<"/doctor/research">) {
  const d = t[await getLang()];
  const patients = listPatients();
  const tb = tables();
  const rows = evaluatePredictions(patients, tb);
  const changes = observedChanges(patients, tb);
  const s = summarize(rows, changes);
  const evaluable = rows.filter((r) => r.outcome !== "not_evaluable");
  const notEvaluable = rows.filter((r) => r.outcome === "not_evaluable");
  const q = (await searchParams).drug;
  const drug = typeof q === "string" ? q.trim() : "";
  const cohort = drug ? patients.map((p) => ({ p, w: whatIf(p, drug) })) : [];
  const flagged = cohort.filter(({ w }) => w.labs.length || w.pgx.length || w.allergy.length).length;

  const pt = (x?: Point) => x
    ? <><span className="font-mono">{x.value} {x.unit}</span> <span className={x.status === "in_range" ? "text-green-700" : "text-red-700"}>{x.status === "in_range" ? "✓" : x.status === "below" ? "↓" : "↑"}</span><span className="block text-xs text-gray-500">{x.date}</span></>
    : "–";
  const outcomeChip = (o: string) => (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${o === "came_true" ? "bg-green-100 text-green-800" : o === "did_not" ? "bg-gray-100 text-gray-700" : "bg-amber-100 text-amber-800"}`}>
      {o === "came_true" ? "✓ " : o === "did_not" ? "○ " : "? "}{d[`outcome_${o}` as "outcome_came_true"]}
    </span>
  );

  return (
    <div className="space-y-6">
      <div>
        <Link href="/doctor" className="text-sm text-teal-700">← {d.back}</Link>
        <h1 className="mt-1 text-2xl font-semibold">{d.predTitle}</h1>
        <p className="mt-1 max-w-3xl text-gray-600">{d.predLead}</p>
        <p className="mt-3 inline-block rounded-md bg-amber-50 px-3 py-1.5 text-sm text-amber-900">{d.predFictional}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <section className={card}>
          <p className={th}>{d.predCameTrue}</p>
          <p className="font-mono text-3xl font-medium text-ink">{pct(s.precision)}</p>
          <p className="text-sm text-gray-600">{s.cameTrue} / {s.evaluable}</p>
        </section>
        <section className={card}>
          <p className={th}>{d.predCaught}</p>
          <p className="font-mono text-3xl font-medium text-ink">{pct(s.recall)}</p>
          <p className="text-sm text-gray-600">{s.explained} / {s.changes}</p>
        </section>
      </div>
      <p className="-mt-2 text-sm text-gray-500">{d.predHow}</p>

      <section className={card}>
        <h2 className="text-lg font-semibold">{d.predTable}</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead><tr><th className={th}>{d.predPatient}</th><th className={th}>{d.predMedicine}</th><th className={th}>{d.predLab}</th><th className={th}>{d.predBefore}</th><th className={th}>{d.predAfter}</th><th className={th}>{d.status}</th></tr></thead>
            <tbody>
              {evaluable.map((r, i) => (
                <tr key={i}>
                  <td className={td}><Link className="text-teal-700 underline" href={`/doctor/${r.patientId}`}>{r.patientName}</Link></td>
                  <td className={td}>{r.medication}<span className="block text-xs text-gray-500">{d.predStart} {r.start}</span></td>
                  <td className={td}>{r.test} <span className="text-gray-500">{d[`dir_${r.predicted}` as const]}</span></td>
                  <td className={td}>{pt(r.baseline)}</td>
                  <td className={td}>{pt(r.after)}</td>
                  <td className={td}>{outcomeChip(r.outcome)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-gray-600">{d.predShowAll} ({notEvaluable.length})</summary>
          <ul className="mt-2 space-y-1 text-gray-600">
            {notEvaluable.map((r, i) => <li key={i}>{r.patientName} · {r.medication} → {r.test}: {d[`reason_${r.reason}` as "reason_no_baseline"]}</li>)}
          </ul>
        </details>
      </section>

      <section className={card}>
        <h2 className="text-lg font-semibold">{d.predChanges}</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead><tr><th className={th}>{d.predPatient}</th><th className={th}>{d.predLab}</th><th className={th}>{d.predBefore}</th><th className={th}>{d.predAfter}</th><th className={th}>{d.predExplainedBy}</th></tr></thead>
            <tbody>
              {changes.map((c, i) => (
                <tr key={i}>
                  <td className={td}>{c.patientName}</td><td className={td}>{c.test}</td><td className={td}>{pt(c.before)}</td><td className={td}>{pt(c.after)}</td>
                  <td className={td}>{c.explainedBy.length ? c.explainedBy.join(", ") : <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">{d.predNotPredicted}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={card}>
        <h2 className="text-lg font-semibold">{d.cohortTitle}</h2>
        <p className="text-sm text-gray-600">{d.cohortHint}</p>
        <form className="mt-3 flex max-w-md gap-2" method="get">
          <input name="drug" list="cohort-drugs" defaultValue={drug} aria-label={d.whatIfDrug} placeholder={d.whatIfDrug} required
            className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm" />
          <datalist id="cohort-drugs">{knownDrugs().map((x) => <option key={x} value={x} />)}</datalist>
          <button className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800">{d.cohortRun}</button>
        </form>
        {drug && (
          <div className="mt-4">
            <p className="text-sm"><b className="font-mono text-ink">{flagged} / {cohort.length}</b> {d.cohortFlagged} · <span className="font-medium">{drug}</span></p>
            <table className="mt-2 w-full text-sm">
              <tbody>
                {cohort.map(({ p, w }) => (
                  <tr key={p.id}>
                    <td className={`${td} w-1/3`}>{p.name}</td>
                    <td className={td}>
                      {!w.labs.length && !w.pgx.length && !w.allergy.length && <span className="text-gray-500">{d.cohortNone}</span>}
                      {w.allergy.map((a) => <span key={a.allergy} className="mr-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">{d.whatIfAllergy}: {a.allergy}</span>)}
                      {w.pgx.map((g) => <span key={g.gene} className="mr-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">{g.gene} {g.result}</span>)}
                      {w.labs.map((l) => (
                        <span key={l.test} className="mr-1 inline-block rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                          {l.test} {d[`dir_${l.direction}` as const]}{l.latest && l.latest.status !== "in_range" ? ` · ${l.latest.status === "below" ? d.belowRange : d.aboveRange}` : ""}
                        </span>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
