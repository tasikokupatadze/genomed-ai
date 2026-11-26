"use client";
import { useState } from "react";
import {
  CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { Dict } from "@/lib/translations";
import type { LabTrend, TrendEntry } from "@/lib/types";

const DAY = 86_400_000;
const ts = (d: string) => Date.parse(d + "T00:00:00Z");
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

/** Out-of-range dots are red triangles (down = below, up = above), so status is not shown by colour alone. */
function Dot(props: { cx?: number; cy?: number; payload?: TrendEntry }) {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null || !payload) return null;
  if (payload.status === "in_range") return <circle cx={cx} cy={cy} r={5} fill="#0f766e" stroke="#fff" strokeWidth={2} />;
  const s = 8;
  const d = payload.status === "below"
    ? `M${cx - s},${cy - s / 1.5} L${cx + s},${cy - s / 1.5} L${cx},${cy + s} Z`
    : `M${cx - s},${cy + s / 1.5} L${cx + s},${cy + s / 1.5} L${cx},${cy - s} Z`;
  return <path d={d} fill="#b91c1c" stroke="#fff" strokeWidth={1.5} />;
}

export default function LabTrendChart({ trend, d }: { trend: LabTrend; d: Dict }) {
  const [showAll, setShowAll] = useState(false);
  const { entries, units } = trend;
  const statusText = (e: TrendEntry) => (e.status === "in_range" ? d.inRange : e.status === "below" ? d.belowRange : d.aboveRange);
  const title = `${trend.test} ${d.trendTitle}`;

  // Different units must never be drawn on one axis.
  if (units.length > 1) {
    return (
      <figure className="rounded-lg border border-slate-200 bg-white p-3">
        <figcaption className="font-semibold">{title}</figcaption>
        <p className="mt-1 rounded bg-amber-50 p-2 text-sm text-amber-900">{d.unitsDiffer} {units.join(", ")}</p>
        <ValuesTable trend={trend} d={d} statusText={statusText} />
      </figure>
    );
  }

  const unit = units[0];
  const latest = entries[entries.length - 1];
  const data = entries.map((e) => ({ ...e, t: ts(e.date) }));
  const first = data[0].t, last = data[data.length - 1].t;
  const xMin = first - 30 * DAY, xMax = last + 15 * DAY;

  const meds = trend.medications.filter((m) => showAll || m.linked);
  const inView = meds.filter((m) => ts(m.start_date) >= xMin && ts(m.start_date) <= xMax);
  const before = meds.filter((m) => ts(m.start_date) < xMin);

  const values = entries.map((e) => e.value);
  const lo = Math.min(...values, latest.ref_low), hi = Math.max(...values, latest.ref_high);
  const pad = (hi - lo) * 0.15 || 1;
  const yDomain = [Math.max(0, +(lo - pad).toFixed(2)), +(hi + pad).toFixed(2)];

  return (
    <figure className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <figcaption className="font-semibold">{title}</figcaption>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
          {d.showAllMeds}
        </label>
      </div>

      <div className="mt-2 h-64 w-full" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 24, right: 16, bottom: 8, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <ReferenceArea y1={latest.ref_low} y2={latest.ref_high} fill="#10b981" fillOpacity={0.12} stroke="#10b981" strokeOpacity={0.3} ifOverflow="extendDomain" />
            <XAxis dataKey="t" type="number" scale="time" domain={[xMin, xMax]} tickFormatter={iso} tick={{ fontSize: 11 }} minTickGap={24} />
            <YAxis domain={yDomain} tick={{ fontSize: 11 }} width={56}
              label={{ value: `${trend.test} (${unit})`, angle: -90, position: "insideLeft", style: { fontSize: 11, textAnchor: "middle" } }} />
            {inView.map((m, i) => (
              <ReferenceLine key={m.name} x={ts(m.start_date)} stroke={m.linked ? "#7c3aed" : "#64748b"} strokeDasharray="6 4"
                label={{ value: m.name, position: i % 2 ? "insideBottomRight" : "insideTopRight", fontSize: 11, fill: m.linked ? "#5b21b6" : "#475569" }} />
            ))}
            <Tooltip
              labelFormatter={(t) => iso(Number(t))}
              formatter={(v, _n, item) => [`${v} ${unit} · ${statusText(item.payload as TrendEntry)}`, trend.test]}
            />
            <Line type="linear" dataKey="value" stroke="#0f766e" strokeWidth={2} dot={<Dot />} activeDot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <ul className="mt-1 space-y-0.5 text-xs text-slate-600">
        <li>{d.bandNote} ({latest.ref_low}–{latest.ref_high} {unit})</li>
        <li>{d.lineNote}</li>
        {trend.ranges_differ && <li className="font-semibold text-amber-800">⚠ {d.rangesDiffer}</li>}
        {!showAll && !trend.medications.some((m) => m.linked) && <li>{d.noLinkedMeds}</li>}
        {before.map((m) => <li key={m.name}>{d.startedBefore}: {m.name} ({d.started} {m.start_date})</li>)}
        {meds.filter((m) => m.end_date).map((m) => <li key={m.name + "end"}>{m.name}: {d.stopped} {m.end_date}</li>)}
      </ul>

      <ValuesTable trend={trend} d={d} statusText={statusText} />
    </figure>
  );
}

function ValuesTable({ trend, d, statusText }: { trend: LabTrend; d: Dict; statusText: (e: TrendEntry) => string }) {
  return (
    <table className="mt-3 w-full text-left text-sm">
      <caption className="sr-only">{trend.test} {d.tableCaption}</caption>
      <thead className="text-xs text-slate-500">
        <tr><th scope="col" className="py-1 pr-3">{d.date}</th><th scope="col" className="pr-3">{d.value}</th><th scope="col" className="pr-3">{d.refRange}</th><th scope="col">{d.status}</th></tr>
      </thead>
      <tbody>
        {trend.entries.map((e) => (
          <tr key={e.date + e.value} className="border-t border-slate-100">
            <td className="py-1 pr-3 whitespace-nowrap">{e.date}</td>
            <td className="pr-3 whitespace-nowrap">{e.value} {e.unit}</td>
            <td className="pr-3 whitespace-nowrap">{e.ref_low}–{e.ref_high}</td>
            <td className={e.status === "in_range" ? "" : "font-semibold text-red-800"}>
              {e.status === "below" ? "↓ " : e.status === "above" ? "↑ " : "✓ "}{statusText(e)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
