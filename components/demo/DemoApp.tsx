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
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
          <div className="mr-auto min-w-0">
            <p className="text-lg font-bold text-teal-800">{T.appName}</p>
            <p className="hidden text-xs text-slate-600 md:block">{T.tagline}</p>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden rounded border border-dashed border-violet-400 bg-violet-50 px-1.5 py-0.5 text-[11px] font-bold uppercase text-violet-800 sm:inline">{T.roleLabel}</span>
            <div role="group" aria-label={T.roleLabel} className="flex overflow-hidden rounded-lg border border-slate-300">
              {roles.map((r) => (
                <button
                  key={r.id}
                  onClick={() => dispatch({ type: "setRole", role: r.id })}
                  aria-pressed={s.role === r.id}
                  className={`px-3 py-1.5 text-sm font-semibold ${s.role === r.id ? "bg-slate-900 text-white" : "bg-white text-slate-800 hover:bg-slate-100"}`}
                >
                  {r.label}
                  {r.id === "clinician" && pending > 0 && (
                    <span className="ml-1.5 rounded-full bg-amber-400 px-1.5 text-xs font-bold text-amber-950" aria-label={`${pending} pending`}>{pending}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div role="group" aria-label={T.language} className="flex overflow-hidden rounded-lg border border-slate-300">
            {(["ka", "en"] as Lang[]).map((l) => (
              <button
                key={l}
                onClick={() => dispatch({ type: "setLang", lang: l })}
                aria-pressed={s.lang === l}
                lang={l}
                className={`px-2.5 py-1.5 text-sm font-semibold ${s.lang === l ? "bg-teal-700 text-white" : "bg-white text-slate-800 hover:bg-slate-100"}`}
              >{l === "ka" ? "ქართ" : "EN"}</button>
            ))}
          </div>

          <button
            onClick={() => setControlsOpen((v) => !v)}
            aria-expanded={controlsOpen}
            aria-controls="demo-controls"
            className="rounded-lg border-2 border-dashed border-violet-500 bg-violet-50 px-2.5 py-1 text-sm font-bold text-violet-900 lg:hidden"
          >⚙ {controlsOpen ? T.hideControls : T.showControls}</button>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-7xl flex-1 gap-5 px-4 py-5 lg:grid-cols-[minmax(0,1fr)_330px]">
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

      <footer className="border-t border-amber-200 bg-amber-50">
        <p className="mx-auto max-w-7xl px-4 py-3 text-center text-sm font-medium text-amber-950">{T.footer}</p>
      </footer>
    </div>
  );
}
