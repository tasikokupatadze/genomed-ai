"use client";
import { useState } from "react";
import { dispatch } from "@/lib/demo/useDemoStore";
import { EVIDENCE_UPDATES, GENETIC_REPORT, LAB_REPORT, PATIENTS } from "@/lib/demo/fixtures";
import { BIOTIN_ANSWER, BIOTIN_CONSEQUENCE, FOLLOW_UP_TEXT, formatDate, formatDateTime, type Text } from "@/lib/demo/i18n";
import { normalizeClassification } from "@/lib/demo/normalize";
import { currentBiotinAnswer, patientMessages } from "@/lib/demo/state";
import type { BiotinAnswer, DemoState, Lang, PublishedMessage } from "@/lib/demo/types";
import { GeneticReportDoc, LabReportDoc } from "./ReportDocs";
import { btnPrimary, btnSecondary, card, ClassBadge, DemoTag, Fact, Mono } from "./ui";

export default function PatientView({ s, T }: { s: DemoState; T: Text }) {
  return s.patientId === "pt-nino" ? <GeneticCase s={s} T={T} /> : <ThyroidCase s={s} T={T} />;
}

/** A message exactly as the doctor approved it. Falls back to the other language with a notice. */
function MessageCard({ m, lang, T }: { m: PublishedMessage; lang: Lang; T: Text }) {
  const text = m.texts[lang];
  const otherLang: Lang = lang === "en" ? "ka" : "en";
  const shown = text ?? m.texts[otherLang] ?? "";
  const update = m.basedOn.updateId ? EVIDENCE_UPDATES.find((u) => u.id === m.basedOn.updateId) : null;
  return (
    <article className="rounded-lg border border-edge border-l-[3px] border-l-teal-700 bg-white p-5">
      <p className="text-sm font-semibold text-teal-900">
        {T.sharedOn} {formatDate(m.sharedAt, lang)}
      </p>
      {m.kind === "genetic" && <h3 className="mt-1 text-lg font-bold">{T.whatChanged}</h3>}
      {!text && (
        <p className="mt-2 rounded bg-amber-100 px-2 py-1 text-sm text-amber-950">
          {otherLang === "en" ? T.onlyInOtherLang : T.onlyInOtherLangKa}
        </p>
      )}
      <p className="mt-2 whitespace-pre-line text-[16px] leading-relaxed" lang={text ? lang : otherLang}>{shown}</p>
      {update && (
        <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-700">
          <ClassBadge code={normalizeClassification(GENETIC_REPORT.classification)} lang={lang} />
          <span aria-hidden>→</span>
          <ClassBadge code={normalizeClassification(update.classification)} lang={lang} />
        </p>
      )}
      <div className="mt-3 rounded-md bg-canvas p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{T.clinicianRecommendation}</p>
        <p className="mt-0.5 font-semibold">{FOLLOW_UP_TEXT[m.followUp][lang]}</p>
      </div>
      {m.autoShared && (
        <p className="mt-2 rounded bg-sky-50 px-2 py-1 text-sm text-sky-950">
          ⚙ {T.autoSharedPatient.replace("{date}", formatDate(m.autoShared.standingSetAt, lang))}
        </p>
      )}
      {m.answerCorrectedAt && (
        <p className="mt-2 rounded bg-slate-100 px-2 py-1 text-sm text-slate-800">
          ↺ {T.answerCorrectedNote} {formatDateTime(m.answerCorrectedAt, lang)}.
        </p>
      )}
    </article>
  );
}

function GeneticCase({ s, T }: { s: DemoState; T: Text }) {
  const lang = s.lang;
  const r = GENETIC_REPORT;
  const msgs = patientMessages(s, "pt-nino").slice().reverse();
  const [showReport, setShowReport] = useState(true);

  return (
    <div className="space-y-4">
      <section className={card} aria-labelledby="gen-title">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 id="gen-title" className="text-2xl font-bold">{T.yourGeneticResult}</h1>
          <DemoTag label={T.demoBadge} />
        </div>
        <p className="mt-1 text-sm text-slate-600">{PATIENTS[r.patientId].name[lang]} · {T.reportDate}: <b>{formatDate(r.reportDate, lang)}</b></p>
        <div className="mt-4"><ClassBadge code={normalizeClassification(r.classification)} lang={lang} large /></div>
        <dl className="mt-4 grid gap-3 sm:grid-cols-3">
          <Fact label={T.gene}><Mono>{r.gene}</Mono></Fact>
          <Fact label={T.variant}><Mono>{r.variant.id}</Mono><br /><span className="text-sm text-slate-600"><Mono>{r.variant.hgvs}</Mono></span></Fact>
          <Fact label={T.condition}>{r.condition.name[lang]}<br /><span className="text-sm text-slate-600"><Mono>{r.condition.id}</Mono></span></Fact>
        </dl>
        <div className="mt-5 rounded-md bg-canvas p-4">
          <h2 className="font-bold">{T.whatItMeans}</h2>
          <p className="mt-1 text-[17px] leading-relaxed">{T.vusExplanation}</p>
          <p className="mt-1 text-slate-700">{T.vusNotDiagnosis}</p>
        </div>
      </section>

      <section className={card} aria-labelledby="upd-title">
        <h2 id="upd-title" className="text-lg font-bold">{T.updatesTitle}</h2>
        <div className="mt-3 space-y-3">
          {msgs.length ? msgs.map((m) => <MessageCard key={m.id} m={m} lang={lang} T={T} />)
            : <p className="text-slate-600">{T.noUpdates}</p>}
        </div>
      </section>

      <section className={card} aria-labelledby="track-title">
        <h2 id="track-title" className="text-lg font-bold">{T.whatWeTrack}</h2>
        <p className="mt-1 leading-relaxed text-slate-800">{T.whatWeTrackText}</p>
        <p className="mt-2 text-sm text-slate-600">
          <Mono>{r.variant.id}</Mono> · <Mono>{r.condition.id}</Mono>
        </p>
      </section>

      <section className={card} aria-labelledby="orig-title">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="orig-title" className="text-lg font-bold">{T.originalReport}</h2>
          <button className={btnSecondary} aria-expanded={showReport} onClick={() => setShowReport((v) => !v)}>
            {showReport ? T.hideOriginal : T.viewOriginal}
          </button>
        </div>
        <p className="mt-1 text-sm text-slate-600">{T.originalPreserved}</p>
        {showReport && <div className="mt-3"><GeneticReportDoc lang={lang} T={T} /></div>}
        <h3 className="mt-5 font-bold">{T.history}</h3>
        <ol className="mt-2 space-y-2 border-l-2 border-slate-300 pl-4 text-sm">
          <li><b>{formatDate(r.reportDate, lang)}</b>: {T.historyReport}</li>
          {patientMessages(s, "pt-nino").map((m) => (
            <li key={m.id}><b>{formatDate(m.sharedAt, lang)}</b>: {T.historyUpdate}</li>
          ))}
        </ol>
      </section>
    </div>
  );
}

const ANSWERS: BiotinAnswer[] = ["yes_before", "started_after", "no", "unsure"];

function ThyroidCase({ s, T }: { s: DemoState; T: Text }) {
  const lang = s.lang;
  const lab = LAB_REPORT;
  const current = currentBiotinAnswer(s);
  const [changing, setChanging] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const msgs = patientMessages(s, "pt-davit").slice().reverse();
  const answers = s.biotinAnswers.filter((a) => a.labReportId === lab.id);
  const askNow = !current || changing;

  return (
    <div className="space-y-4">
      <section className={card} aria-labelledby="lab-title">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 id="lab-title" className="text-2xl font-bold">{T.yourLabResult}</h1>
          <DemoTag label={T.demoBadge} />
        </div>
        <p className="mt-1 text-sm text-slate-600">{PATIENTS[lab.patientId].name[lang]} · {T.drawDate}: <b>{formatDate(lab.drawDate, lang)}</b></p>
        {lab.results.map((x) => (
          <div key={x.test} className="mt-4 flex flex-wrap items-center gap-3 rounded-md bg-red-50 p-4">
            <span className="text-xs font-semibold uppercase tracking-wide text-red-900">{T.flaggedResult}</span>
            <span className="text-lg font-bold"><Mono>{x.test}</Mono> {x.value} {x.unit}</span>
            <span className="rounded-full bg-white px-2.5 py-0.5 text-sm font-semibold text-red-800">
              {x.flag === "L" ? "↓" : "↑"} {x.flag} · {x.flag === "L" ? T.flagL : T.flagH}
            </span>
            <span className="text-sm text-slate-700">{T.refRange}: {x.refLow}–{x.refHigh} {x.unit}</span>
          </div>
        ))}
        <h2 className="mt-4 font-bold">{T.yourHistory}</h2>
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-slate-800">
          {lab.history.map((h) => <li key={h.en}>{h[lang]}</li>)}
        </ul>
      </section>

      <section className={`${card} border-l-[3px] border-l-teal-700`} aria-labelledby="q-title">
        <h2 id="q-title" className="text-sm font-semibold uppercase tracking-wide text-teal-800">{T.oneQuestion}</h2>
        <p className="mt-1 text-xl font-bold leading-snug">{T.biotinQuestion}</p>
        <p className="mt-1 text-slate-700">{T.biotinWhy}</p>

        {current && !changing && (
          <div className="mt-4 rounded-lg bg-slate-50 p-4">
            <p className="text-sm text-slate-600">{T.yourAnswer} ({formatDateTime(current.recordedAt, lang)})</p>
            <p className="text-lg font-bold">{BIOTIN_ANSWER[current.answer][lang]}</p>
            <p className="mt-2 leading-relaxed">{BIOTIN_CONSEQUENCE[current.answer][lang]}</p>
            <button className={`${btnSecondary} mt-3`} onClick={() => setChanging(true)}>{T.changeAnswer}</button>
          </div>
        )}

        {askNow && (
          <div className="mt-4 grid gap-2 sm:grid-cols-2" role="group" aria-label={T.biotinQuestion}>
            {ANSWERS.map((a) => (
              <button
                key={a}
                aria-pressed={current?.answer === a}
                onClick={() => { dispatch({ type: "answerBiotin", answer: a }); setChanging(false); }}
                className={`${current?.answer === a ? btnPrimary : btnSecondary} min-h-12 justify-start text-left text-base`}
              >
                {BIOTIN_ANSWER[a][lang]}
              </button>
            ))}
          </div>
        )}
      </section>

      <section className={card} aria-labelledby="tmsg-title">
        <h2 id="tmsg-title" className="text-lg font-bold">{T.updatesTitle}</h2>
        <div className="mt-3 space-y-3">
          {msgs.length ? msgs.map((m) => <MessageCard key={m.id} m={m} lang={lang} T={T} />)
            : <p className="text-slate-600">{T.noMessagesThyroid}</p>}
        </div>
      </section>

      <section className={card} aria-labelledby="ahist-title">
        <h2 id="ahist-title" className="text-lg font-bold">{T.answerHistory}</h2>
        {answers.length ? (
          <ol className="mt-2 space-y-1 border-l-2 border-slate-300 pl-4 text-sm">
            {answers.map((a) => (
              <li key={a.id}>
                <b>{formatDateTime(a.recordedAt, lang)}</b>: {BIOTIN_ANSWER[a.answer][lang]}
                <span className="text-slate-500"> ({a.corrects ? T.correctedOn : T.answeredOn})</span>
              </li>
            ))}
          </ol>
        ) : <p className="mt-1 text-slate-600">{T.noAnswerYet}</p>}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-bold">{T.originalReport}</h3>
          <button className={btnSecondary} aria-expanded={showReport} onClick={() => setShowReport((v) => !v)}>
            {showReport ? T.hideOriginal : T.viewOriginal}
          </button>
        </div>
        {showReport && <div className="mt-3"><LabReportDoc lang={lang} T={T} /></div>}
      </section>
    </div>
  );
}
