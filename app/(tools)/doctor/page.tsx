import Link from "next/link";
import { getLang } from "@/lib/i18n";
import { t } from "@/lib/translations";
import { listPatients } from "@/lib/store";
import { runChecks } from "@/lib/analyze";
import ResetButton from "@/app/components/ResetButton";

export const dynamic = "force-dynamic";

export default async function DoctorHome() {
  const d = t[await getLang()];
  const patients = listPatients();
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{d.patients}</h1>
        <ResetButton label={d.resetDemo} />
      </div>
      <p className="text-sm text-slate-600">{d.fictional}</p>
      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-2">{d.name}</th>
              <th className="px-4 py-2">{d.conditions}</th>
              <th className="px-4 py-2">{d.findings}</th>
              <th className="px-4 py-2">{d.approved}</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {patients.map((p) => {
              const n = runChecks(p).filter((f) => f.kind !== "allergy_unchecked").length;
              return (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium">{p.name}<div className="text-xs text-slate-500">{p.age} · {p.sex}</div></td>
                  <td className="px-4 py-3 text-slate-600">{p.conditions.join(", ")}</td>
                  <td className="px-4 py-3">{n}</td>
                  <td className="px-4 py-3">{Object.keys(p.approved ?? {}).join(", ").toUpperCase() || "–"}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/doctor/${p.id}`} className="rounded-md bg-teal-700 px-3 py-1.5 text-white hover:bg-teal-800">{d.open}</Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
