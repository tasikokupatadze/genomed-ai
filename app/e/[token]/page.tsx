import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { getEmergencyCard } from "@/lib/store";
import { t } from "@/lib/translations";
import type { Lang } from "@/lib/types";

export const dynamic = "force-dynamic";
// Never indexed by search engines; reachable only through the bracelet QR link.
export const metadata: Metadata = { title: "Emergency information", robots: { index: false, follow: false } };

/** Public page a bystander sees after scanning the bracelet. Shows only what the patient chose. */
export default async function EmergencyPage({ params, searchParams }: PageProps<"/e/[token]">) {
  const { token } = await params;
  const q = (await searchParams).lang;
  const accept = (await headers()).get("accept-language") ?? "";
  const lang: Lang = q === "en" || q === "ka" ? q : accept.toLowerCase().startsWith("en") ? "en" : "ka";
  const d = t[lang];
  const card = getEmergencyCard(token);

  const shell = (children: React.ReactNode) => (
    <div lang={lang} className="mx-auto min-h-screen max-w-md bg-white px-4 py-5 text-[#14202e]">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-bold text-teal-800">GenoMed AI</p>
        <nav className="flex overflow-hidden rounded-md border border-slate-300 text-sm" aria-label={d.language}>
          {(["ka", "en"] as const).map((l) => (
            <Link key={l} href={`?lang=${l}`} aria-current={l === lang} className={`px-3 py-1.5 font-semibold ${l === lang ? "bg-teal-700 text-white" : "bg-white"}`}>
              {l === "ka" ? "ქართ" : "EN"}
            </Link>
          ))}
        </nav>
      </div>
      {children}
    </div>
  );

  if (!card) return shell(
    <div className="space-y-4">
      <p className="rounded-xl bg-slate-100 p-4 text-lg">{d.em_notFound}</p>
      <a href="tel:112" className="block rounded-2xl bg-red-700 p-5 text-center text-2xl font-bold text-white">📞 {d.em_call}</a>
    </div>,
  );

  const instructions = card.instructions[lang] ?? card.instructions[lang === "en" ? "ka" : "en"];
  return shell(
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-red-800">{d.em_header}</p>
        <h1 className="text-3xl font-bold">{card.display_name}</h1>
        {card.conditions.length > 0 && <p className="mt-1 text-xl font-semibold">{card.conditions.join(" · ")}</p>}
      </div>

      <a href="tel:112" className="block rounded-2xl bg-red-700 p-5 text-center text-2xl font-bold text-white hover:bg-red-800">📞 {d.em_call}</a>

      {instructions && (
        <section className="rounded-2xl border-2 border-amber-400 bg-amber-50 p-4">
          <h2 className="text-lg font-bold">{d.em_whatToDo}</h2>
          <p className="mt-1 whitespace-pre-line text-[17px] leading-relaxed">{instructions}</p>
        </section>
      )}

      {card.contacts.length > 0 && (
        <section>
          <h2 className="text-lg font-bold">{d.em_contacts}</h2>
          <ul className="mt-2 space-y-2">
            {card.contacts.map((c, i) => (
              <li key={i} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
                <span><b>{c.name}</b>{c.relation && <span className="text-slate-600"> · {c.relation}</span>}<span className="block text-sm text-slate-600">{c.phone}</span></span>
                {c.phone && <a href={`tel:${c.phone.replace(/[^\d+]/g, "")}`} className="rounded-lg bg-teal-700 px-4 py-3 font-semibold text-white">📞 {d.em_callContact}</a>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {card.allergies.length > 0 && (
        <section><h2 className="font-bold">{d.em_allergies}</h2><p className="text-lg">{card.allergies.join(", ")}</p></section>
      )}
      {card.medications.length > 0 && (
        <section><h2 className="font-bold">{d.em_meds}</h2><p className="text-lg">{card.medications.join(", ")}</p></section>
      )}

      <p className="border-t border-slate-200 pt-3 text-sm text-slate-600">{d.em_disclaimer}</p>
      <p className="text-xs text-slate-500">{d.em_updated}: {card.updated_at.slice(0, 10)}</p>
    </div>,
  );
}
