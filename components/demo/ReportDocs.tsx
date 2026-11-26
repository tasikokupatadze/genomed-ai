import { GENETIC_REPORT, LAB_REPORT, PATIENTS } from "@/lib/demo/fixtures";
import { formatDate, type Text } from "@/lib/demo/i18n";
import type { Lang } from "@/lib/demo/types";
import { Mono } from "./ui";

/** Read-only rendering of the original genetic report. It is never edited. */
export function GeneticReportDoc({ lang, T }: { lang: Lang; T: Text }) {
  const r = GENETIC_REPORT;
  const rows: [string, React.ReactNode][] = [
    [T.reportPatient, PATIENTS[r.patientId].name[lang]],
    [T.reportDate, formatDate(r.reportDate, lang)],
    [T.gene, <Mono key="g">{r.gene}</Mono>],
    [T.reportVariantId, <Mono key="v">{r.variant.id}</Mono>],
    [T.reportTranscript, <Mono key="t">{r.variant.transcript}</Mono>],
    [T.reportHgvs, <Mono key="h">{r.variant.hgvs}</Mono>],
    [T.condition, r.condition.name[lang]],
    [T.reportConditionId, <Mono key="c">{r.condition.id}</Mono>],
    [T.classification, r.classification],
    [T.reportSubmitter, r.source.name[lang]],
  ];
  return (
    <article className="rounded-md border border-hair bg-[#FCFCFB] p-5" aria-label={T.reportTitle}>
      <p className="mb-3 rounded bg-violet-50 px-2 py-1 text-xs font-bold text-violet-800">{T.reportDemoWarning}</p>
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-gray-300 pb-2">
        <h3 className="text-lg font-bold">{T.reportTitle}</h3>
        <span className="text-sm text-slate-600">{r.lab[lang]} · <Mono>{r.id}</Mono></span>
      </header>
      <dl className="mt-3 divide-y divide-slate-200 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[minmax(8rem,40%)_1fr] gap-3 py-1.5">
            <dt className="text-slate-600">{k}</dt><dd className="font-medium">{v}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

export function LabReportDoc({ lang, T }: { lang: Lang; T: Text }) {
  const r = LAB_REPORT;
  return (
    <article className="rounded-md border border-hair bg-[#FCFCFB] p-5" aria-label={T.labReportTitle}>
      <p className="mb-3 rounded bg-violet-50 px-2 py-1 text-xs font-bold text-violet-800">{T.demoBadge}: {T.fictional}</p>
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-gray-300 pb-2">
        <h3 className="text-lg font-bold">{T.labReportTitle}</h3>
        <span className="text-sm text-slate-600">{r.lab[lang]} · <Mono>{r.id}</Mono></span>
      </header>
      <p className="mt-2 text-sm">{T.reportPatient}: <b>{PATIENTS[r.patientId].name[lang]}</b></p>
      <p className="text-sm">{T.drawDate}: <b>{formatDate(r.drawDate, lang)}</b> · {T.reportDate}: {formatDate(r.reportDate, lang)}</p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-slate-300 text-left text-slate-600">
            <th className="py-1 pr-3">{T.test}</th><th className="pr-3">{T.result}</th><th className="pr-3">{T.refRange}</th><th>{T.flag}</th>
          </tr></thead>
          <tbody>
            {r.results.map((x) => (
              <tr key={x.test} className="border-b border-slate-200">
                <td className="py-1.5 pr-3 font-medium"><Mono>{x.test}</Mono></td>
                <td className="pr-3 font-bold">{x.value} {x.unit}</td>
                <td className="pr-3">{x.refLow}–{x.refHigh} {x.unit}</td>
                <td className="font-bold text-red-800">{x.flag} ({x.flag === "L" ? T.flagL : T.flagH})</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}
