import Link from "next/link";
import { getLang } from "@/lib/i18n";
import { t } from "@/lib/translations";
import LangToggle from "@/app/components/LangToggle";

// Earlier prototype: server-side table checks + LLM drafts (needs ANTHROPIC_API_KEY for drafts).
export default async function ToolsLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLang();
  const d = t[lang];
  return (
    <div className="flex min-h-screen flex-col bg-[#f7f8fa] text-[#1a2230]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="text-lg font-semibold text-teal-800">{d.appName}</Link>
          <nav className="flex items-center gap-3 text-sm">
            <Link href="/doctor" className="text-slate-700 hover:text-teal-800">{d.doctorArea}</Link>
            <LangToggle lang={lang} label={d.language} />
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
      <footer className="border-t border-amber-200 bg-amber-50">
        <p className="mx-auto max-w-6xl px-4 py-3 text-center text-sm font-medium text-amber-900">{d.disclaimer}</p>
      </footer>
    </div>
  );
}
