"use client";
import { useState } from "react";
import { dispatch, useDemoState } from "@/lib/demo/useDemoStore";
import { TEXT } from "@/lib/demo/i18n";
import type { Lang, Role } from "@/lib/demo/types";
import ClinicianView from "./ClinicianView";
import DemoControls from "./DemoControls";
import PatientView from "./PatientView";
import ResearchView from "./ResearchView";

export default function DemoApp() {
  const s = useDemoState();
  const [controlsOpen, setControlsOpen] = useState(false);

  if (!s) {
    return <div className="flex min-h-screen items-center justify-center text-slate-500" aria-busy>GenoMed AI…</div>;
  }
  const T = TEXT[s.lang];
  const pending = s.reviews.filter((r) => r.status === "pending").length;

  const roles: { id: Role; label: string }[] = [
    { id: "patient", label: T.rolePatient },
    { id: "clinician", label: T.roleClinician },
    { id: "research", label: T.roleResearch },
  ];

  return (
    <div lang={s.lang} className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-hair bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-8 gap-y-1 px-4 sm:px-6">
          <div className="flex min-h-14 items-center gap-2.5">
            <span aria-hidden className="h-2.5 w-2.5 rounded-[2px] bg-teal-700" />
            <div>
              <p className="text-[15px] font-semibold tracking-tight text-ink">{T.appName}</p>
              <p className="hidden text-[11.5px] text-gray-500 xl:block">{T.tagline}</p>
            </div>
          </div>

          <nav role="group" aria-label={T.roleLabel} className="order-3 flex w-full items-stretch gap-6 sm:order-none sm:w-auto">
            <span className="hidden self-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600 lg:inline">{T.roleLabel}</span>
            {roles.map((r) => (
              <button
                key={r.id}
                onClick={() => dispatch({ type: "setRole", role: r.id })}
                aria-pressed={s.role === r.id}
                className={`flex min-h-12 items-center border-b-2 text-sm font-medium transition sm:min-h-14 ${s.role === r.id ? "border-teal-700 text-ink" : "border-transparent text-gray-500 hover:text-ink"}`}
              >
                {r.label}
                {r.id === "clinician" && pending > 0 && (
                  <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 text-xs font-semibold text-amber-800" aria-label={`${pending} pending`}>{pending}</span>
                )}
              </button>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <div role="group" aria-label={T.language} className="flex items-center gap-1 text-[13px]">
              {(["ka", "en"] as Lang[]).map((l, i) => (
                <span key={l} className="flex items-center gap-1">
                  {i > 0 && <span aria-hidden className="text-gray-300">·</span>}
                  <button
                    onClick={() => dispatch({ type: "setLang", lang: l })}
                    aria-pressed={s.lang === l}
                    lang={l}
                    className={`rounded px-1.5 py-1 ${s.lang === l ? "font-semibold text-ink" : "text-gray-500 hover:text-ink"}`}
                  >{l === "ka" ? "ქართ" : "EN"}</button>
                </span>
              ))}
            </div>
            <button
              onClick={() => setControlsOpen((v) => !v)}
              aria-expanded={controlsOpen}
              aria-controls="demo-controls"
              className="rounded-md border border-dashed border-violet-400 bg-violet-50 px-2.5 py-1 text-[13px] font-medium text-violet-800 lg:hidden"
            >{controlsOpen ? T.hideControls : T.showControls}</button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-7xl flex-1 gap-6 px-4 py-7 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <aside id="demo-controls" aria-label={T.demoControls}
          className={`${controlsOpen ? "block" : "hidden"} lg:order-2 lg:block`}>
          <div className="lg:sticky lg:top-20"><DemoControls s={s} T={T} /></div>
        </aside>
        <main className="min-w-0 lg:order-1">
          {s.role === "patient" && <div className="mx-auto max-w-2xl"><PatientView s={s} T={T} /></div>}
          {s.role === "clinician" && <ClinicianView s={s} T={T} />}
          {s.role === "research" && <ResearchView T={T} />}
        </main>
      </div>

      <footer className="border-t border-hair bg-white">
        <p className="mx-auto max-w-7xl px-4 py-4 text-center text-[13px] text-gray-500 sm:px-6">{T.footer}</p>
      </footer>
    </div>
  );
}
