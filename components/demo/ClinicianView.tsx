"use client";
import { useState } from "react";
import { dispatch } from "@/lib/demo/useDemoStore";
import { ATA_BIOTIN_SOURCE, EVIDENCE_UPDATES, GENETIC_REPORT, LAB_REPORT, PATIENTS } from "@/lib/demo/fixtures";
import { BIOTIN_ANSWER, FOLLOW_UP_TEXT, OUTCOME_TEXT, formatDate, formatDateTime, type Text } from "@/lib/demo/i18n";
import { normalizeClassification } from "@/lib/demo/normalize";
import { canApprove, isStale, shareableLangs } from "@/lib/demo/state";
import type { CompareField, DemoState, Lang, Review } from "@/lib/demo/types";
import { btnDanger, btnPrimary, btnSecondary, card, ClassBadge, DemoTag, Mono, StatusBadge } from "./ui";

export default function ClinicianView({ s, T }: { s: DemoState; T: Text }) {
  const lang = s.lang;
  const reviews = s.reviews.slice().reverse();
  const selected = s.reviews.find((r) => r.id === s.selectedReviewId) ?? reviews.find((r) => r.status === "pending") ?? reviews[0];

  return (
    <div className="grid gap-4 xl:grid-cols-[300px_1fr]">
      <div className="space-y-4">
        <section className={card} aria-labelledby="queue-title">
          <h1 id="queue-title" className="text-lg font-bold">{T.reviewQueue}</h1>
          {!reviews.length && <p className="mt-2 text-sm text-slate-600">{T.emptyQueue}</p>}
          <ul className="mt-2 space-y-2">
            {reviews.map((r) => (
              <li key={r.id}>
                <button
                  onClick={() => dispatch({ type: "selectReview", reviewId: r.id })}
                  aria-current={selected?.id === r.id}
                  className={`w-full rounded-xl border p-3 text-left transition ${selected?.id === r.id ? "border-teal-600 bg-teal-50 ring-2 ring-teal-600" : "border-slate-200 bg-white hover:bg-slate-50"}`}
                >
                  <span className="block text-sm font-bold">{r.kind === "genetic" ? T.geneticReview : T.biotinReview}</span>
                  <span className="block text-xs text-slate-600">{PATIENTS[r.patientId].name[lang]} · <Mono>{r.id}</Mono></span>
                  <span className="mt-1 flex flex-wrap gap-1"><StatusBadge status={r.status} lang={lang} />{r.autoShared && <AutoTag T={T} />}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
        <StandingPanel key={s.standing?.["pt-nino"]?.setAt ?? "none"} s={s} T={T} />
        <EvidenceLog s={s} T={T} />
      </div>
      <div>
        {selected ? <ReviewDetail key={selected.id} r={selected} s={s} T={T} /> : <p className={`${card} text-slate-600`}>{T.selectReview}</p>}
      </div>
    </div>
  );
}

function EvidenceLog({ s, T }: { s: DemoState; T: Text }) {
  const lang = s.lang;
  return (
    <section className={card} aria-labelledby="log-title">
      <h2 id="log-title" className="font-bold">{T.evidenceLog}</h2>
      {!s.processed.length && <p className="mt-1 text-sm text-slate-600">{T.evidenceLogEmpty}</p>}
      <ul className="mt-2 space-y-2 text-sm">
        {s.processed.slice().reverse().map((p) => {
          const u = EVIDENCE_UPDATES.find((x) => x.id === p.updateId)!;
          return (
            <li key={p.fingerprint} className="rounded-lg bg-slate-50 p-2">
              <p className="font-semibold"><Mono>{u.variant.id}</Mono> · <Mono>{u.condition.id}</Mono></p>
              <p className="text-slate-700">{OUTCOME_TEXT[p.result.outcome][lang]}</p>
              <p className="text-xs text-slate-500">{u.source.name[lang]} · {formatDate(u.evidenceDate, lang)} · {T.received} {p.timesReceived}{T.times}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ReviewDetail({ r, s, T }: { r: Review; s: DemoState; T: Text }) {
  const lang = s.lang;
  return (
    <section className={`${card} space-y-5`} aria-labelledby="rev-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 id="rev-title" className="text-xl font-bold">{r.kind === "genetic" ? T.geneticReview : T.biotinReview}</h1>
        <div className="flex flex-wrap items-center gap-2"><DemoTag label={T.demoBadge} /><StatusBadge status={r.status} lang={lang} />{r.autoShared && <AutoTag T={T} />}</div>
      </div>
      <p className="-mt-3 text-sm text-slate-600">{PATIENTS[r.patientId].name[lang]} · <Mono>{r.id}</Mono> · {formatDateTime(r.createdAt, lang)}</p>

      {r.kind === "genetic" ? <GeneticComparison r={r} lang={lang} T={T} /> : <BiotinContext r={r} s={s} T={T} />}

      {r.status === "pending" && <Decision r={r} T={T} />}
      {r.status !== "pending" && <Outcome r={r} s={s} T={T} />}
    </section>
  );
}

function GeneticComparison({ r, lang, T }: { r: Review; lang: Lang; T: Text }) {
  const o = GENETIC_REPORT;
  const u = EVIDENCE_UPDATES.find((x) => x.id === r.updateId)!;
  const diff = new Set<CompareField>(r.match?.differences ?? []);
  const rows: { key: string; field?: CompareField; label: string; a: React.ReactNode; b: React.ReactNode }[] = [
    { key: "gene", field: "gene", label: T.gene, a: <Mono>{o.gene}</Mono>, b: <Mono>{u.gene}</Mono> },
    { key: "variant", field: "variant", label: T.variant, a: <><Mono>{o.variant.id}</Mono> · <Mono>{o.variant.hgvs}</Mono></>, b: <><Mono>{u.variant.id}</Mono> · <Mono>{u.variant.hgvs}</Mono></> },
    { key: "condition", field: "condition", label: T.condition, a: <>{o.condition.name[lang]} · <Mono>{o.condition.id}</Mono></>, b: <>{u.condition.name[lang]} · <Mono>{u.condition.id}</Mono></> },
    { key: "class", field: "classification", label: T.classification,
      a: <ClassBadge code={normalizeClassification(o.classification)} lang={lang} />,
      b: <ClassBadge code={normalizeClassification(u.classification)} lang={lang} /> },
    { key: "date", label: T.date, a: <>{T.reportDate}: {formatDate(o.reportDate, lang)}</>, b: formatDate(u.evidenceDate, lang) },
    { key: "source", label: T.source, a: o.source.name[lang], b: u.source.name[lang] },
  ];
  return (
    <div>
      <h2 className="text-lg font-bold">{T.whatChanged}</h2>
      <p className="text-sm text-slate-700">{r.match && OUTCOME_TEXT[r.match.outcome][lang]}</p>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[560px] border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="text-left">
              <th className="w-32 p-2" />
              <th className="p-2">{T.original} <span className="font-normal text-slate-500">(<Mono>{o.id}</Mono>)</span></th>
              <th className="p-2">{T.newEvidence} <span className="font-normal text-slate-500">(<Mono>{u.id}</Mono>)</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const changed = row.field ? diff.has(row.field) : false;
              return (
                <tr key={row.key} className={changed ? "bg-amber-100" : ""}>
                  <th scope="row" className="border-t border-slate-200 p-2 text-left align-top font-semibold text-slate-700">
                    {row.label}
                    {row.field && (
                      <span className={`mt-1 block w-fit rounded px-1.5 text-[11px] font-bold uppercase ${changed ? "bg-amber-500 text-white" : "bg-slate-200 text-slate-700"}`}>
                        {changed ? `▲ ${T.changed}` : `= ${T.same}`}
                      </span>
                    )}
                  </th>
                  <td className="border-t border-slate-200 p-2 align-top">{row.a}</td>
                  <td className={`border-t border-slate-200 p-2 align-top ${changed ? "font-semibold" : ""}`}>{row.b}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-sm text-slate-600">{T.originalPreserved}</p>
    </div>
  );
}

function BiotinContext({ r, s, T }: { r: Review; s: DemoState; T: Text }) {
  const lang = s.lang;
  const ans = s.biotinAnswers.find((a) => a.id === r.biotinAnswerId);
  const x = LAB_REPORT.results[0];
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg bg-red-50 p-3">
          <p className="text-xs font-semibold uppercase text-red-900">{T.flaggedResult}</p>
          <p className="font-bold"><Mono>{x.test}</Mono> {x.value} {x.unit} ({x.flag} · {x.flag === "L" ? T.flagL : T.flagH})</p>
          <p className="text-sm">{T.refRange}: {x.refLow}–{x.refHigh}</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase text-slate-600">{T.sampleDate}</p>
          <p className="font-bold">{formatDate(LAB_REPORT.drawDate, lang)}</p>
        </div>
        <div className="rounded-lg bg-amber-50 p-3">
          <p className="text-xs font-semibold uppercase text-amber-900">{T.patientAnswer}</p>
          <p className="font-bold">{ans ? BIOTIN_ANSWER[ans.answer][lang] : "–"}</p>
          {ans && <p className="text-xs text-slate-600">{formatDateTime(ans.recordedAt, lang)}</p>}
        </div>
      </div>
      <p className="rounded-lg border-l-4 border-teal-600 bg-teal-50 p-3 text-sm">{T.ruleExplanation}</p>
      <p className="text-sm">
        <span className="font-semibold">{T.supportingSource}:</span>{" "}
        <a href={ATA_BIOTIN_SOURCE.url} target="_blank" rel="noreferrer" className="text-teal-800 underline">{T.ataSource}</a>
        <span className="block text-xs text-slate-500">{ATA_BIOTIN_SOURCE.publisher}</span>
      </p>
    </div>
  );
}

function Decision({ r, T }: { r: Review; T: Text }) {
  const [texts, setTexts] = useState<Record<Lang, string>>({ en: r.drafts.en.text, ka: r.drafts.ka.text });
  const [dismissing, setDismissing] = useState(false);
  const [reason, setReason] = useState("");
  const approve = canApprove(r);
  const shareable = shareableLangs(r);

  const commit = (l: Lang) => dispatch({ type: "editDraft", reviewId: r.id, lang: l, text: texts[l] });

  return (
    <div className="space-y-5 border-t border-slate-200 pt-4">
      <fieldset>
        <legend className="text-lg font-bold">{T.decision}</legend>
        <p className="text-sm text-slate-700">{T.followUpQ}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {(["recommended", "not_needed"] as const).map((f) => (
            <label key={f} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold ${r.followUp === f ? "border-teal-700 bg-teal-50" : "border-slate-300"}`}>
              <input type="radio" name={`fu-${r.id}`} checked={r.followUp === f}
                onChange={() => dispatch({ type: "setFollowUp", reviewId: r.id, followUp: f })} />
              {f === "recommended" ? T.followUpYes : T.followUpNo}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <h2 className="text-lg font-bold">{T.draftTitle}</h2>
        <p className="text-sm text-slate-600">{T.draftHint}</p>
        <div className="mt-2 grid gap-3 lg:grid-cols-2">
          {(["en", "ka"] as const).map((l) => {
            const stale = isStale(r, l);
            return (
              <div key={l}>
                <label className="block text-sm font-semibold" htmlFor={`draft-${r.id}-${l}`}>
                  {l === "en" ? "English" : "ქართული"}
                  {stale && <span className="ml-2 rounded bg-amber-500 px-1.5 text-[11px] font-bold uppercase text-white">⚠ {T.willNotBeShared}</span>}
                </label>
                <textarea
                  id={`draft-${r.id}-${l}`}
                  lang={l}
                  value={texts[l]}
                  onChange={(e) => setTexts((t) => ({ ...t, [l]: e.target.value }))}
                  onBlur={() => commit(l)}
                  rows={8}
                  className={`mt-1 w-full rounded-lg border p-2 text-[15px] leading-relaxed ${stale ? "border-amber-500 bg-amber-50" : "border-slate-300"}`}
                />
                {stale && (
                  <div className="mt-1 text-sm text-amber-900">
                    <p>{T.staleWarning}</p>
                    <button className={`${btnSecondary} mt-1`} onClick={() => dispatch({ type: "confirmTranslation", reviewId: r.id, lang: l })}>
                      ✓ {T.confirmMatches}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-bold">{T.preview}</h2>
        <div className="mt-2 grid gap-3 lg:grid-cols-2">
          {(["en", "ka"] as const).map((l) => (
            <div key={l} className={`rounded-xl border-2 p-3 ${shareable.includes(l) ? "border-teal-600" : "border-dashed border-slate-300 opacity-60"}`} lang={l}>
              <p className="text-xs font-bold uppercase text-slate-500">{l === "en" ? "English" : "ქართული"}</p>
              {shareable.includes(l) ? (
                <>
                  <p className="mt-1 whitespace-pre-line text-[15px] leading-relaxed">{texts[l]}</p>
                  {r.followUp && <p className="mt-2 rounded bg-slate-50 p-2 text-sm font-semibold">{FOLLOW_UP_TEXT[r.followUp][l]}</p>}
                </>
              ) : <p className="mt-1 text-sm">{T.willNotBeShared}</p>}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-3 border-t border-slate-200 pt-4">
        <div>
          <button className={btnPrimary} disabled={!approve.ok} onClick={() => dispatch({ type: "approve", reviewId: r.id })}>
            ✓ {T.approveShare}
          </button>
          {!approve.ok && approve.reason === "follow_up" && <p className="mt-1 text-sm text-slate-700">{T.approveNeedsFollowUp}</p>}
          {!approve.ok && approve.reason === "text" && <p className="mt-1 text-sm text-slate-700">{T.approveNeedsText}</p>}
        </div>
        {!dismissing ? (
          <button className={btnDanger} onClick={() => setDismissing(true)}>✕ {T.dismiss}</button>
        ) : (
          <div className="w-full max-w-md rounded-lg border border-red-200 bg-red-50 p-3">
            <label className="block text-sm font-semibold" htmlFor={`dismiss-${r.id}`}>{T.dismissReason}</label>
            <textarea id={`dismiss-${r.id}`} value={reason} onChange={(e) => setReason(e.target.value)} rows={2}
              className="mt-1 w-full rounded border border-red-300 bg-white p-2 text-sm" />
            <div className="mt-2 flex gap-2">
              <button className={btnDanger} disabled={!reason.trim()}
                onClick={() => dispatch({ type: "dismiss", reviewId: r.id, reason })}>{T.dismissConfirm}</button>
              <button className={btnSecondary} onClick={() => setDismissing(false)}>{T.cancel}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Outcome({ r, s, T }: { r: Review; s: DemoState; T: Text }) {
  const lang = s.lang;
  const msg = s.messages.find((m) => m.id === r.messageId);
  return (
    <div className="space-y-2 border-t border-slate-200 pt-4">
      {r.decidedAt && <p className="text-sm text-slate-600">{T.decidedOn}: {formatDateTime(r.decidedAt, lang)}</p>}
      {r.autoShared && msg?.autoShared && (
        <p className="rounded bg-sky-50 p-2 text-sm text-sky-950">⚙ {T.autoSharedReview.replace("{date}", formatDateTime(msg.autoShared.standingSetAt, lang))}</p>
      )}
      {r.status === "dismissed" && <p><span className="font-semibold">{T.dismissedReason}:</span> {r.dismissReason}</p>}
      {r.status === "withdrawn" && <p className="rounded bg-slate-100 p-2">↺ {T.withdrawnNote}</p>}
      {msg && (
        <div>
          <h2 className="font-bold">{T.sharedMessage} · {formatDateTime(msg.sharedAt, lang)}</h2>
          {msg.answerCorrectedAt && <p className="mt-1 rounded bg-slate-100 p-2 text-sm">↺ {T.answerCorrectedNote} {formatDateTime(msg.answerCorrectedAt, lang)}.</p>}
          <div className="mt-2 grid gap-3 lg:grid-cols-2">
            {(["en", "ka"] as const).map((l) => (
              <div key={l} className={`rounded-xl border-2 p-3 ${msg.texts[l] ? "border-emerald-600" : "border-dashed border-slate-300"}`} lang={l}>
                <p className="text-xs font-bold uppercase text-slate-500">{l === "en" ? "English" : "ქართული"}</p>
                {msg.texts[l] ? <p className="mt-1 whitespace-pre-line text-[15px]">{msg.texts[l]}</p> : <p className="mt-1 text-sm">{T.willNotBeShared}</p>}
                {msg.texts[l] && <p className="mt-2 rounded bg-slate-50 p-2 text-sm font-semibold">{FOLLOW_UP_TEXT[msg.followUp][l]}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AutoTag({ T }: { T: Text }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-sky-300 bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-900">
      <span aria-hidden>⚙</span>{T.autoSharedTag}
    </span>
  );
}

/** The doctor's one-time instruction for Nino's genetic finding. */
function StandingPanel({ s, T }: { s: DemoState; T: Text }) {
  const lang = s.lang;
  const current = s.standing?.["pt-nino"];
  const [enabled, setEnabled] = useState(current?.enabled ?? false);
  const [followUp, setFollowUp] = useState<"recommended" | "not_needed">(current?.followUp ?? "not_needed");
  const changed = enabled !== (current?.enabled ?? false) || followUp !== (current?.followUp ?? "not_needed");
  return (
    <section className={card} aria-labelledby="standing-title">
      <h2 id="standing-title" className="font-bold">{T.standingTitle}</h2>
      <p className="text-xs text-slate-600">{PATIENTS["pt-nino"].name[lang]} · {T.standingHint}</p>
      <label className="mt-2 flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        <span>{T.standingToggle}</span>
      </label>
      <fieldset className="mt-2 text-sm" disabled={!enabled}>
        <legend className="text-xs font-semibold text-slate-600">{T.standingFollowUp}</legend>
        {(["not_needed", "recommended"] as const).map((f) => (
          <label key={f} className="mt-1 flex items-center gap-2">
            <input type="radio" name="standing-fu" checked={followUp === f} onChange={() => setFollowUp(f)} />
            {f === "recommended" ? T.followUpYes : T.followUpNo}
          </label>
        ))}
      </fieldset>
      <p className="mt-2 rounded bg-amber-50 p-2 text-xs text-amber-950">{T.standingSafety}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button className={btnPrimary} disabled={!changed}
          onClick={() => dispatch({ type: "setStanding", patientId: "pt-nino", enabled, followUp })}>{T.standingSave}</button>
        <span className="text-xs text-slate-600">
          {current?.enabled ? `✓ ${T.standingActive} ${formatDateTime(current.setAt, lang)}` : T.standingOff}
        </span>
      </div>
    </section>
  );
}
