"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Dict } from "@/lib/translations";
import type { Finding, MedIngredient } from "@/lib/types";

type Level = "high" | "low";
interface Read {
  brand_name: string;
  form: string;
  ingredients: MedIngredient[];
  confidence: { brand_name: Level; active_ingredients: Level; form: Level };
  source: "patient_scan" | "patient_typed";
}
type Step = "choose" | "scanning" | "confirm" | "type" | "howtake" | "done";

const input = "w-full rounded-md border px-2.5 py-2 text-base focus:outline-none focus:ring-2 focus:ring-teal-600";
const btn = "min-h-11 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50";
const primary = `${btn} bg-teal-700 text-white hover:bg-teal-800`;
const secondary = `${btn} border border-slate-300 bg-white hover:bg-slate-50`;

const emptyRead = (): Read => ({
  brand_name: "", form: "", ingredients: [],
  confidence: { brand_name: "high", active_ingredients: "high", form: "high" }, source: "patient_typed",
});

const LowTag = ({ label }: { label: string }) => (
  <span className="ml-1 rounded bg-amber-500 px-1.5 text-[11px] font-bold text-white">⚠ {label}</span>
);

/** Shrink and re-encode as JPEG in the browser: smaller upload, and camera metadata (e.g. GPS) is dropped. */
async function shrink(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("encode"))), "image/jpeg", 0.85));
}

export default function AddMedication({ patientId, d }: { patientId: string; d: Dict }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("choose");
  const [read, setRead] = useState<Read>(emptyRead);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [typedName, setTypedName] = useState("");
  const [how, setHow] = useState({ dose: "", frequency: "", start_date: "", end_date: "" });
  const [result, setResult] = useState<{ allergy: boolean; unmatched: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // The photo preview only ever lives in this browser tab; release it when done.
  useEffect(() => () => { if (photoUrl) URL.revokeObjectURL(photoUrl); }, [photoUrl]);

  function reset() {
    setStep("choose"); setRead(emptyRead()); setPhotoUrl(null); setError(null); setTypedName("");
    setHow({ dose: "", frequency: "", start_date: "", end_date: "" }); setResult(null);
  }

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    setError(null); setStep("scanning");
    try {
      const small = await shrink(file);
      setPhotoUrl(URL.createObjectURL(small));
      const fd = new FormData();
      fd.append("image", small, "box.jpg");
      const r = await fetch("/api/scan/medicine", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || d.scanFailed);
      if (j.result.unreadable) { setError(d.scanUnreadable); setStep("confirm"); return; }
      setRead({
        brand_name: j.result.brand_name ?? "",
        form: j.result.form ?? "",
        ingredients: j.ingredients,
        confidence: j.result.confidence,
        source: "patient_scan",
      });
      setStep("confirm");
    } catch (e) {
      setError(`${d.scanFailed} ${e instanceof Error ? e.message : ""}`);
      setStep("confirm"); // keep whatever we have; the patient can retake or type it in
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function rematch(ingredients: MedIngredient[]) {
    const r = await fetch("/api/drugs/match", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ingredients }) });
    if (r.ok) { const j = await r.json(); setRead((x) => ({ ...x, ingredients: j.ingredients })); }
  }

  function setIng(i: number, patch: Partial<MedIngredient>) {
    setRead((x) => ({ ...x, ingredients: x.ingredients.map((g, k) => (k === i ? { ...g, ...patch } : g)) }));
  }

  /** Switch to typing without losing anything already read. */
  function toTyping() {
    setTypedName(read.brand_name || read.ingredients[0]?.name || "");
    setStep("type");
  }

  async function save() {
    const name = read.source === "patient_scan" ? (read.brand_name || read.ingredients[0]?.name || "") : typedName;
    const ingredients = read.ingredients.length ? read.ingredients : [{ name: typedName, strength: null, unit: null }];
    const r = await fetch(`/api/patients/${patientId}/medications`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name, brand_name: read.brand_name, form: read.form, ingredients,
        dose: how.dose, frequency: how.frequency, start_date: how.start_date, end_date: how.end_date || undefined,
        entered_by: read.source,
      }),
    });
    const j = await r.json();
    if (!r.ok) { setError(j.error); return; }
    setResult({
      allergy: (j.allergy_findings as Finding[]).some((f) => f.kind === "allergy"),
      unmatched: j.medication.match_status === "unmatched",
    });
    setStep("done");
    router.refresh();
  }

  const low = (k: keyof Read["confidence"]) => read.source === "patient_scan" && read.confidence[k] === "low";
  const field = (isLow: boolean) => `${input} ${isLow ? "border-amber-500 bg-amber-50" : "border-slate-300"}`;

  return (
    <section className="rounded-xl bg-white p-5 shadow-sm" aria-labelledby="addmed-title">
      <h2 id="addmed-title" className="font-semibold">{d.addMedication}</h2>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" aria-hidden tabIndex={-1}
        onChange={(e) => onPhoto(e.target.files?.[0])} />

      {step === "choose" && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <button className={`${primary} min-h-14 text-base`} onClick={() => fileRef.current?.click()}>📷 {d.scanBox}</button>
          <button className={`${secondary} min-h-14 text-base`} onClick={() => { setRead(emptyRead()); setStep("type"); }}>⌨ {d.typeIt}</button>
          <p className="text-xs text-slate-500 sm:col-span-2">{d.scanHint} {d.photoPrivacy}</p>
        </div>
      )}

      {step === "scanning" && <p className="mt-3 animate-pulse text-slate-700" role="status">{d.readingBox}</p>}

      {step === "confirm" && (
        <div className="mt-3 grid gap-4 md:grid-cols-[minmax(0,220px)_1fr]">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview, never uploaded or optimised */}
            {photoUrl && <img src={photoUrl} alt={d.scanBox} className="w-full rounded-lg border border-slate-200 object-contain" />}
            <button className={`${secondary} mt-2 w-full`} onClick={() => fileRef.current?.click()}>{d.retakePhoto}</button>
          </div>
          <div className="space-y-3">
            {error && <p role="alert" className="rounded bg-amber-100 p-2 text-sm text-amber-950">{error} {d.photoFallback}</p>}
            <h3 className="font-semibold">{d.checkDetails}</h3>
            <p className="text-sm text-slate-600">{d.checkDetailsHint}</p>
            <label className="block text-sm font-medium">{d.brandName}{low("brand_name") && <LowTag label={d.lowConfidence} />}
              <input className={field(low("brand_name"))} value={read.brand_name} onChange={(e) => setRead({ ...read, brand_name: e.target.value })} />
            </label>
            <fieldset>
              <legend className="text-sm font-medium">{d.ingredients}{low("active_ingredients") && <LowTag label={d.lowConfidence} />}</legend>
              <div className="mt-1 space-y-2">
                {read.ingredients.map((g, i) => (
                  <div key={i} className="rounded-lg border border-slate-200 p-2">
                    <div className="grid grid-cols-[1fr_5rem_4rem] gap-2">
                      <input aria-label={d.ingredientName} className={field(low("active_ingredients") || !g.name)} value={g.name}
                        onChange={(e) => setIng(i, { name: e.target.value, matched_ingredient: null, drug_class: null })}
                        onBlur={() => rematch(read.ingredients)} placeholder={d.ingredientName} />
                      <input aria-label={d.strength} className={field(low("active_ingredients") || !g.strength)} value={g.strength ?? ""}
                        onChange={(e) => setIng(i, { strength: e.target.value || null })} placeholder={d.strength} />
                      <input aria-label={d.unit} className={field(low("active_ingredients") || !g.unit)} value={g.unit ?? ""}
                        onChange={(e) => setIng(i, { unit: e.target.value || null })} placeholder="mg" />
                    </div>
                    <div className="mt-1 flex items-center justify-between text-xs">
                      {g.matched_ingredient
                        ? <span className="text-emerald-800">✓ {d.matchedAs}: {g.matched_ingredient}{g.drug_class ? ` · ${g.drug_class}` : ""}</span>
                        : <span className="font-semibold text-amber-800">? {d.notMatched}</span>}
                      <button className="text-red-700 underline" onClick={() => setRead({ ...read, ingredients: read.ingredients.filter((_, k) => k !== i) })}>{d.remove}</button>
                    </div>
                  </div>
                ))}
                <button className={secondary} onClick={() => setRead({ ...read, ingredients: [...read.ingredients, { name: "", strength: null, unit: null, matched_ingredient: null, drug_class: null }] })}>
                  + {d.addIngredient}
                </button>
              </div>
            </fieldset>
            <label className="block text-sm font-medium">{d.form}{low("form") && <LowTag label={d.lowConfidence} />}
              <input className={field(low("form"))} value={read.form} onChange={(e) => setRead({ ...read, form: e.target.value })} />
            </label>
            <div className="flex flex-wrap gap-2 pt-1">
              <button className={primary} disabled={!read.brand_name.trim() && !read.ingredients.some((g) => g.name.trim())}
                onClick={() => setStep("howtake")}>✓ {d.confirmDetails}</button>
              <button className={secondary} onClick={toTyping}>⌨ {d.typeIt}</button>
              <button className={secondary} onClick={reset}>{d.cancel}</button>
            </div>
          </div>
        </div>
      )}

      {step === "type" && (
        <div className="mt-3 space-y-3">
          {(read.brand_name || read.ingredients.length > 0) && <p className="text-sm text-slate-600">{d.photoFallback}</p>}
          <label className="block text-sm font-medium">{d.name}
            <input className={`${input} border-slate-300`} value={typedName} onChange={(e) => setTypedName(e.target.value)} autoFocus />
          </label>
          <div className="flex flex-wrap gap-2">
            <button className={primary} disabled={!typedName.trim()} onClick={() => {
              // Typed name becomes the ingredient to match unless the box was already read.
              setRead((x) => ({ ...x, source: "patient_typed", brand_name: x.brand_name || "", ingredients: x.ingredients.length ? x.ingredients : [{ name: typedName.trim(), strength: null, unit: null, matched_ingredient: null, drug_class: null }] }));
              setStep("howtake");
            }}>✓ {d.confirmDetails}</button>
            <button className={secondary} onClick={reset}>{d.cancel}</button>
          </div>
        </div>
      )}

      {step === "howtake" && (
        <div className="mt-3 space-y-3">
          <h3 className="font-semibold">{d.howTake}</h3>
          <p className="text-sm text-slate-600">{d.howTakeHint}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-sm font-medium">{d.doseAmount}<input className={`${input} border-slate-300`} value={how.dose} onChange={(e) => setHow({ ...how, dose: e.target.value })} /></label>
            <label className="text-sm font-medium">{d.frequency}<input className={`${input} border-slate-300`} value={how.frequency} onChange={(e) => setHow({ ...how, frequency: e.target.value })} /></label>
            <label className="text-sm font-medium">{d.startDate} *<input type="date" required className={`${input} border-slate-300`} value={how.start_date} onChange={(e) => setHow({ ...how, start_date: e.target.value })} /></label>
            <label className="text-sm font-medium">{d.endDate}<input type="date" className={`${input} border-slate-300`} value={how.end_date} onChange={(e) => setHow({ ...how, end_date: e.target.value })} /></label>
          </div>
          {error && <p role="alert" className="rounded bg-red-50 p-2 text-sm text-red-900">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button className={primary} disabled={!how.start_date} onClick={save}>{d.saveMedication}</button>
            <button className={secondary} onClick={() => setStep(read.source === "patient_scan" ? "confirm" : "type")}>{d.back}</button>
          </div>
        </div>
      )}

      {step === "done" && result && (
        <div className="mt-3 space-y-2" role="status">
          <p className="rounded bg-emerald-50 p-2 text-emerald-900">✓ {d.savedMed}</p>
          {result.allergy && <p className="rounded border-2 border-red-400 bg-red-50 p-3 font-semibold text-red-900">⚠ {d.allergyMatchWarning}</p>}
          {result.unmatched && <p className="rounded bg-amber-50 p-2 text-amber-950">{d.unmatchedSaved}</p>}
          <button className={secondary} onClick={reset}>{d.addMedication}</button>
        </div>
      )}
    </section>
  );
}
