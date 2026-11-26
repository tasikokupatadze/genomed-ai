import type { ClassificationCode, ReviewStatus, Lang } from "@/lib/demo/types";
import { CLASS_LABEL, STATUS_LABEL } from "@/lib/demo/i18n";

export const card = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm";
export const btn = "inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";
export const btnPrimary = `${btn} bg-teal-700 text-white hover:bg-teal-800`;
export const btnSecondary = `${btn} border border-slate-300 bg-white text-slate-800 hover:bg-slate-50`;
export const btnDanger = `${btn} border border-red-300 bg-white text-red-800 hover:bg-red-50`;

/** Status always shown with an icon AND words, never colour alone. */
export function StatusBadge({ status, lang }: { status: ReviewStatus; lang: Lang }) {
  const style: Record<ReviewStatus, [string, string]> = {
    pending: ["bg-amber-100 text-amber-900 border-amber-300", "●"],
    approved: ["bg-emerald-100 text-emerald-900 border-emerald-300", "✓"],
    dismissed: ["bg-slate-100 text-slate-700 border-slate-300", "✕"],
    withdrawn: ["bg-slate-100 text-slate-700 border-slate-300", "↺"],
  };
  const [cls, icon] = style[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${cls}`}>
      <span aria-hidden>{icon}</span>{STATUS_LABEL[status][lang]}
    </span>
  );
}

export function ClassBadge({ code, lang, large }: { code: ClassificationCode; lang: Lang; large?: boolean }) {
  const style: Record<ClassificationCode, string> = {
    pathogenic: "bg-red-100 text-red-900 border-red-300",
    likely_pathogenic: "bg-red-50 text-red-900 border-red-300",
    vus: "bg-amber-50 text-amber-950 border-amber-400",
    likely_benign: "bg-emerald-50 text-emerald-900 border-emerald-300",
    benign: "bg-emerald-100 text-emerald-900 border-emerald-300",
    unknown: "bg-slate-100 text-slate-800 border-slate-300",
  };
  return (
    <span className={`inline-block rounded-md border font-semibold ${style[code]} ${large ? "px-3 py-1.5 text-base" : "px-2 py-0.5 text-sm"}`}>
      {CLASS_LABEL[code][lang]}
    </span>
  );
}

export function DemoTag({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded border border-dashed border-violet-400 bg-violet-50 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-violet-800">
      {label}
    </span>
  );
}

export function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-[15px] text-slate-900">{children}</dd>
    </div>
  );
}

export const Mono = ({ children }: { children: React.ReactNode }) => (
  <span className="font-mono text-[0.92em]" translate="no">{children}</span>
);
