import type { ClassificationCode, ReviewStatus, Lang } from "@/lib/demo/types";
import { CLASS_LABEL, STATUS_LABEL } from "@/lib/demo/i18n";

export const card = "rounded-lg border border-edge bg-white p-6";
export const btn = "inline-flex items-center justify-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50";
export const btnPrimary = `${btn} bg-teal-700 text-white hover:bg-teal-800`;
export const btnSecondary = `${btn} border border-gray-300 bg-white text-ink hover:bg-canvas`;
export const btnDanger = `${btn} border border-transparent bg-transparent text-red-800 hover:bg-red-50`;

/** Status always shown with an icon AND words, never colour alone. */
export function StatusBadge({ status, lang }: { status: ReviewStatus; lang: Lang }) {
  const style: Record<ReviewStatus, [string, string]> = {
    pending: ["bg-amber-100 text-amber-800", "●"],
    approved: ["bg-green-100 text-green-800", "✓"],
    dismissed: ["bg-gray-100 text-gray-700", "✕"],
    withdrawn: ["bg-gray-100 text-gray-700", "↺"],
  };
  const [cls, icon] = style[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      <span aria-hidden>{icon}</span>{STATUS_LABEL[status][lang]}
    </span>
  );
}

export function ClassBadge({ code, lang, large }: { code: ClassificationCode; lang: Lang; large?: boolean }) {
  const style: Record<ClassificationCode, string> = {
    pathogenic: "bg-red-100 text-red-800",
    likely_pathogenic: "bg-red-100 text-red-800",
    vus: "bg-amber-100 text-amber-800",
    likely_benign: "bg-green-100 text-green-800",
    benign: "bg-green-100 text-green-800",
    unknown: "bg-gray-100 text-gray-700",
  };
  return (
    <span className={`inline-block rounded-full font-medium ${style[code]} ${large ? "px-3.5 py-1 text-[15px]" : "px-2.5 py-0.5 text-[13px]"}`}>
      {CLASS_LABEL[code][lang]}
    </span>
  );
}

export function DemoTag({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
      {label}
    </span>
  );
}

export function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-[0.09em] text-gray-500">{label}</dt>
      <dd className="mt-1 text-[15px] text-ink">{children}</dd>
    </div>
  );
}

export const Mono = ({ children }: { children: React.ReactNode }) => (
  <span className="font-mono text-[0.92em]" translate="no">{children}</span>
);
