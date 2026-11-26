import type { Finding } from "@/lib/types";
import type { Dict } from "@/lib/translations";

const Source = ({ url, reviewed, d }: { url: string; reviewed?: string; d: Dict }) => (
  <p className="mt-1 text-xs text-slate-500">
    {d.source}:{" "}
    {url ? <a href={url} target="_blank" rel="noreferrer" className="text-teal-700 underline">{url}</a> : <span className="text-amber-700">{d.sourceMissing}</span>}
    {reviewed !== undefined && <> · {d.reviewedBy}: {reviewed || <span className="text-amber-700">{d.notReviewed}</span>}</>}
  </p>
);

const Card = ({ tone, title, children }: { tone: "red" | "amber" | "sky" | "slate"; title: string; children: React.ReactNode }) => {
  const tones = {
    red: "border-red-300 bg-red-50",
    amber: "border-amber-300 bg-amber-50",
    sky: "border-sky-300 bg-sky-50",
    slate: "border-slate-200 bg-slate-50",
  };
  return (
    <div className={`rounded-lg border p-3 ${tones[tone]}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">{title}</p>
      <div className="mt-1 text-sm">{children}</div>
    </div>
  );
};

export default function Findings({ findings, d }: { findings: Finding[]; d: Dict }) {
  const unchecked = findings.filter((f) => f.kind === "allergy_unchecked");
  const main = findings.filter((f) => f.kind !== "allergy_unchecked");
  if (!main.length && !unchecked.length) return <p className="text-sm text-slate-500">{d.noFindings}</p>;

  return (
    <div className="space-y-2">
      {main.map((f, i) => {
        switch (f.kind) {
          case "allergy":
            return (
              <Card key={i} tone="red" title={d.allergyFlag}>
                <p><b>{f.medication}</b> ↔ {f.allergy.drug} ({f.allergy.reaction})</p>
                <p className="text-slate-700">
                  {f.match === "same_drug" ? d.allergySameDrug : f.match === "same_class" ? d.allergySameClass : d.allergyCross}
                  {f.allergy_class && ` · ${f.allergy_class}`}
                </p>
                <Source url={f.source_url} reviewed={f.reviewed_by} d={d} />
              </Card>
            );
          case "pgx":
            return (
              <Card key={i} tone={f.patient_takes.length ? "red" : "amber"} title={`${d.pgx} · ${f.gene}`}>
                <p><b>{f.result}</b> → {f.drug}: {f.effect}</p>
                <p className="text-slate-700">
                  {f.patient_takes.length ? `${d.patientTakes}: ${f.patient_takes.join(", ")}` : d.notTaking}
                </p>
                <p className="text-slate-700">{f.guideline_summary || <span className="text-amber-700">{d.guidelinePending}</span>}</p>
                <Source url={f.source_url} d={d} />
              </Card>
            );
          case "lab_medication":
            return (
              <Card key={i} tone="amber" title={`${f.lab.test} ${d[f.direction]} · ${d.onePossibleReason}`}>
                <p>
                  {f.lab.test}: <b>{f.lab.value} {f.lab.unit}</b> ({d.refRange}: {f.lab.ref_low}–{f.lab.ref_high})
                </p>
                <p className="text-slate-700"><b>{f.medication}</b> — {f.effect_description}</p>
                <Source url={f.source_url} reviewed={f.reviewed_by} d={d} />
              </Card>
            );
          case "lab_unexplained":
            return (
              <Card key={i} tone="slate" title={`${f.lab.test} ${d[f.direction]}`}>
                <p>
                  {f.lab.test}: <b>{f.lab.value} {f.lab.unit}</b> ({d.refRange}: {f.lab.ref_low}–{f.lab.ref_high})
                </p>
                <p className="text-slate-600">{d.noMedLink}</p>
              </Card>
            );
          case "variant":
            return (
              <Card key={i} tone="sky" title={`${f.gene} ${f.hgvs_c}`}>
                {f.found && f.clinvar ? (
                  <>
                    <p>{f.clinvar.name}</p>
                    <p>{d.classification}: <b>{f.clinvar.clinical_significance}</b></p>
                    <p>{d.reviewStatus}: {f.clinvar.review_status}</p>
                    <p className="text-slate-600">{d.lastEvaluated}: {f.clinvar.last_evaluated} · GRCh37</p>
                    <p className="mt-2 rounded border border-dashed border-violet-300 bg-violet-50 p-2 text-violet-900">
                      {d.evo2}: {f.evo2.available ? <b>{f.evo2.label}</b> : d.evo2Unavailable}
                      <span className="block text-xs">{d.evo2Label}</span>
                    </p>
                    <Source url={f.clinvar.url} d={d} />
                  </>
                ) : (
                  <p className="text-slate-600">{d.notInClinvar}</p>
                )}
              </Card>
            );
        }
      })}
      {unchecked.length > 0 && (
        <p className="text-xs text-slate-500">
          {d.allergyUnchecked}: {unchecked.map((u) => u.kind === "allergy_unchecked" && u.medication).join(", ")}
        </p>
      )}
    </div>
  );
}
