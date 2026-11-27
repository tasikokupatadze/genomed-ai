"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import type { Dict } from "@/lib/translations";
import type { Patient } from "@/lib/types";
import { PUBLIC_SITE_URL } from "@/lib/site";

const input = "w-full rounded-md border border-slate-300 px-2.5 py-2 text-base";
const btn = "min-h-11 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50";
const primary = `${btn} bg-teal-700 text-white hover:bg-teal-800`;
const secondary = `${btn} border border-slate-300 bg-white hover:bg-slate-50`;
const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);
// Version 2 = 25x25 squares. "M" error correction keeps ~15% damage tolerance and still
// fits HTTPS://<domain>/B/<CODE> in capitals (capitals let the QR use its compact mode).
const V2 = { version: 2, errorCorrectionLevel: "M" as const, margin: 2 };
const FALLBACK = { errorCorrectionLevel: "M" as const, margin: 2 };

/** Smallest options that hold the text: version 2 when it fits, else the next size up. */
function qrOptions(text: string): { opts: typeof FALLBACK & { version?: number }; version: number } {
  try {
    return { opts: V2, version: QRCode.create(text, V2).version };
  } catch {
    return { opts: FALLBACK, version: QRCode.create(text, FALLBACK).version };
  }
}

export default function EmergencyCardEditor({ patient, d }: { patient: Patient; d: Dict }) {
  const router = useRouter();
  const e = patient.emergency;
  const [f, setF] = useState({
    display_name: e?.display_name ?? "",
    conditions: (e?.conditions ?? []).join("\n"),
    en: e?.instructions.en ?? "",
    ka: e?.instructions.ka ?? "",
    allergies: (e?.allergies ?? []).join("\n"),
    medications: (e?.medications ?? []).join("\n"),
    contacts: e?.contacts?.length ? e.contacts : [{ name: "", relation: "", phone: "" }],
  });
  const [msg, setMsg] = useState<string | null>(null);
  const [svg, setSvg] = useState("");
  // The QR always points at the stable public domain, so a printed bracelet keeps working.
  const origin = PUBLIC_SITE_URL;
  const base = `/api/patients/${patient.id}/emergency`;
  const url = e?.token && origin ? `${origin}/e/${e.token}` : "";
  // What the bracelet QR holds: the short link in capitals when there is a short code.
  const qrText = e?.short_code && origin ? `${origin}/B/${e.short_code}`.toUpperCase() : url;
  const qr = qrText ? qrOptions(qrText) : null;

  useEffect(() => {
    if (!qrText) return;
    QRCode.toString(qrText, { ...qrOptions(qrText).opts, type: "svg" }).then(setSvg);
  }, [qrText]);

  async function save() {
    const r = await fetch(base, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        display_name: f.display_name, conditions: lines(f.conditions), instructions: { en: f.en, ka: f.ka },
        allergies: lines(f.allergies), medications: lines(f.medications), contacts: f.contacts,
      }),
    });
    const j = await r.json();
    setMsg(r.ok ? d.cardSaved : j.error);
    router.refresh();
    return r.ok;
  }
  async function token(action: "create" | "regenerate" | "disable" | "enable") {
    if (action === "create" && !(await save())) return;
    await fetch(`${base}/token`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    router.refresh();
  }
  function download(name: string, href: string) {
    const a = document.createElement("a"); a.href = href; a.download = name; a.click();
  }
  // 21 mm at 600 dpi = 496 px; the PNG is a little larger so it stays sharp when scaled.
  async function downloadPng() { download("genomed-bracelet-qr.png", await QRCode.toDataURL(qrText, { ...qr!.opts, width: 1024 })); }
  function downloadSvg() { download("genomed-bracelet-qr.svg", URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }))); }
  function print() {
    const w = window.open("", "_blank", "width=480,height=640");
    if (!w) return;
    w.document.write(`<!doctype html><meta charset="utf-8"><title>QR</title>
      <style>body{font-family:sans-serif;text-align:center;margin:12mm}.qr{width:21mm;height:21mm;margin:0 auto}
      .qr svg{width:100%;height:100%}p{margin:2mm 0;font-size:9pt}</style>
      <div class="qr">${svg}</div><p><b>${d.qrScanLabel}</b></p><p>☎ 112</p>`);
    w.document.close(); w.focus(); w.print();
  }

  const fillFromProfile = () => setF({
    ...f,
    conditions: [...patient.conditions, ...(patient.clinic_conditions ?? []).map((c) => c.text)].join("\n"),
    allergies: patient.allergies.map((a) => a.drug).join("\n"),
    medications: patient.medications.map((m) => m.name).join("\n"),
  });

  return (
    <section className="rounded-xl bg-white p-5 shadow-sm" aria-labelledby="em-title">
      <h2 id="em-title" className="font-semibold">🆘 {d.emergencyTitle}</h2>
      <p className="text-sm text-slate-600">{d.emergencyHint}</p>

      <div className="mt-3 space-y-3">
        <label className="block text-sm font-medium">{d.displayName}
          <input className={input} value={f.display_name} onChange={(x) => setF({ ...f, display_name: x.target.value })} /></label>
        <button className={secondary} onClick={fillFromProfile}>{d.fillFromProfile}</button>
        <label className="block text-sm font-medium">{d.emConditions}
          <textarea rows={2} className={input} value={f.conditions} onChange={(x) => setF({ ...f, conditions: x.target.value })} /></label>
        <label className="block text-sm font-medium">{d.emInstructionsKa}
          <textarea rows={4} lang="ka" className={input} value={f.ka} onChange={(x) => setF({ ...f, ka: x.target.value })} /></label>
        <label className="block text-sm font-medium">{d.emInstructionsEn}
          <textarea rows={4} lang="en" className={input} value={f.en} onChange={(x) => setF({ ...f, en: x.target.value })} /></label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium">{d.emAllergies}
            <textarea rows={2} className={input} value={f.allergies} onChange={(x) => setF({ ...f, allergies: x.target.value })} /></label>
          <label className="block text-sm font-medium">{d.emMeds}
            <textarea rows={2} className={input} value={f.medications} onChange={(x) => setF({ ...f, medications: x.target.value })} /></label>
        </div>
        <fieldset>
          <legend className="text-sm font-medium">{d.emContacts}</legend>
          {f.contacts.map((c, i) => (
            <div key={i} className="mt-1 grid grid-cols-3 gap-2">
              {(["name", "relation", "phone"] as const).map((k) => (
                <input key={k} aria-label={k === "name" ? d.contactName : k === "relation" ? d.relation : d.phone}
                  placeholder={k === "name" ? d.contactName : k === "relation" ? d.relation : d.phone}
                  type={k === "phone" ? "tel" : "text"} className={input} value={c[k]}
                  onChange={(x) => setF({ ...f, contacts: f.contacts.map((y, j) => (j === i ? { ...y, [k]: x.target.value } : y)) })} />
              ))}
            </div>
          ))}
          {f.contacts.length < 3 && (
            <button className={`${secondary} mt-2`} onClick={() => setF({ ...f, contacts: [...f.contacts, { name: "", relation: "", phone: "" }] })}>+ {d.add}</button>
          )}
        </fieldset>
        <div className="flex flex-wrap items-center gap-2">
          <button className={primary} onClick={save} disabled={!f.display_name.trim()}>{d.saveCard}</button>
          {!e?.token && <button className={primary} onClick={() => token("create")} disabled={!f.display_name.trim()}>▦ {d.generateQr}</button>}
          {msg && <span role="status" className="text-sm">{msg}</span>}
        </div>
      </div>

      {e?.token && (
        <div className="mt-5 border-t border-slate-200 pt-4">
          <h3 className="font-semibold">{d.qrTitle}</h3>
          {!e.enabled && <p className="mt-1 rounded bg-slate-100 p-2 text-sm">{d.pageOff}</p>}
          <div className="mt-2 flex flex-wrap items-start gap-4">
            <div className={`w-44 rounded-lg border border-slate-200 bg-white p-1 ${e.enabled ? "" : "opacity-40"}`}
              role="img" aria-label={`QR: ${url}`} dangerouslySetInnerHTML={{ __html: svg }} />
            <div className="min-w-0 flex-1 space-y-2">
              <p className="break-all font-mono text-xs text-slate-600">{qrText}</p>
              {qr && (
                <p className={`text-xs font-semibold ${qr.version <= 3 ? "text-emerald-800" : "text-amber-800"}`}>
                  {(qr.version <= 3 ? `✓ ${d.qrV2}` : `⚠ ${d.qrBigger}`).replace("{n}", String(qr.version)).replaceAll("{s}", String(17 + 4 * qr.version))}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <button className={secondary} onClick={downloadPng} disabled={!svg}>⬇ {d.downloadPng}</button>
                <button className={secondary} onClick={downloadSvg} disabled={!svg}>⬇ {d.downloadSvg}</button>
                <button className={secondary} onClick={print} disabled={!svg}>🖨 {d.printQr}</button>
                <a className={secondary} href={url} target="_blank" rel="noreferrer">↗ {d.openPage}</a>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className={secondary} onClick={() => token("regenerate")}>↻ {d.regenerateQr}</button>
                {e.enabled
                  ? <button className={`${secondary} text-red-800`} onClick={() => token("disable")}>{d.disableQr}</button>
                  : <button className={secondary} onClick={() => token("enable")}>{d.enableQr}</button>}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
