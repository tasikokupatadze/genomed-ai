"use client";
import { useRouter } from "next/navigation";
import { setLang } from "../actions";
import type { Lang } from "@/lib/types";

export default function LangToggle({ lang, label }: { lang: Lang; label: string }) {
  const router = useRouter();
  return (
    <div role="group" aria-label={label} className="flex overflow-hidden rounded-md border border-slate-300">
      {(["en", "ka"] as const).map((l) => (
        <button
          key={l}
          onClick={async () => { await setLang(l); router.refresh(); }}
          aria-pressed={lang === l}
          className={`px-2.5 py-1 text-xs font-medium ${lang === l ? "bg-teal-700 text-white" : "bg-white text-slate-700 hover:bg-slate-100"}`}
        >
          {l === "en" ? "EN" : "ქარ"}
        </button>
      ))}
    </div>
  );
}
