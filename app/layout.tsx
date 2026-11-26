import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { getLang } from "@/lib/i18n";
import { t } from "@/lib/translations";
import LangToggle from "./components/LangToggle";

export const metadata: Metadata = {
  title: "GenoMed AI",
  description: "Decision-support prototype: plain-language explanations of medical results, approved by a doctor.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const lang = await getLang();
  const d = t[lang];
  return (
    <html lang={lang} className="h-full antialiased">
      <body className="min-h-full flex flex-col">
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
          <p className="mx-auto max-w-6xl px-4 py-3 text-center text-sm font-medium text-amber-900">
            {d.disclaimer}
          </p>
        </footer>
      </body>
    </html>
  );
}
