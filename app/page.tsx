import Link from "next/link";
import { getLang } from "@/lib/i18n";
import { t } from "@/lib/translations";
import { listPatients } from "@/lib/store";

export default async function Home() {
  const d = t[await getLang()];
  const patients = listPatients();
  return (
    <div className="space-y-6">
      <section className="rounded-xl bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">{d.appName}</h1>
        <p className="mt-2 text-slate-600">{d.tagline}</p>
      </section>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/doctor" className="rounded-xl bg-white p-6 shadow-sm hover:ring-2 hover:ring-teal-600">
          <h2 className="text-lg font-semibold text-teal-800">{d.doctorArea} →</h2>
          <p className="mt-1 text-sm text-slate-600">{d.fictional}</p>
        </Link>
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-teal-800">{d.patientArea}</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {patients.map((p) => (
              <li key={p.id}>
                <Link href={`/patient/${p.id}`} className="text-teal-700 underline">{p.name}</Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
