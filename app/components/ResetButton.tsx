"use client";
import { useRouter } from "next/navigation";

export default function ResetButton({ label }: { label: string }) {
  const router = useRouter();
  return (
    <button
      onClick={async () => { await fetch("/api/reset", { method: "POST" }); router.refresh(); }}
      className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-100"
    >
      {label}
    </button>
  );
}
