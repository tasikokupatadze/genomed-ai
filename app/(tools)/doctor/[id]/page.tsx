import { notFound } from "next/navigation";
import { getLang } from "@/lib/i18n";
import { t } from "@/lib/translations";
import { getPatient } from "@/lib/store";
import { runChecks } from "@/lib/analyze";
import { knownLabTests } from "@/lib/data";
import { pgxOptions } from "@/lib/checks/pgx";
import { buildLabTrends } from "@/lib/checks/labs";
import DoctorWorkspace from "@/app/components/DoctorWorkspace";

export const dynamic = "force-dynamic";

export default async function DoctorPatientPage({ params }: PageProps<"/doctor/[id]">) {
  const { id } = await params;
  const lang = await getLang();
  const p = getPatient(id);
  if (!p) notFound();
  return (
    <DoctorWorkspace
      patient={p}
      findings={runChecks(p)}
      trends={buildLabTrends(p)}
      lang={lang}
      d={t[lang]}
      labTests={knownLabTests()}
      pgxOptions={pgxOptions()}
    />
  );
}
