import { useState } from "react";
import { money } from "./ManagementUI";
import "../finance-charts.css";

type TrendRow = { date: string; revenue: number; cost: number | null; expense: number };
const series = [
  { label: "Doanh thu", color: "var(--color-primary)", get: (r: TrendRow) => r.revenue },
  { label: "Giá vốn", color: "var(--color-tertiary)", get: (r: TrendRow) => r.cost },
  { label: "Lãi gộp", color: "var(--color-secondary)", get: (r: TrendRow) => r.cost == null ? null : r.revenue - r.cost },
  { label: "Lãi ròng", color: "var(--color-secondary)", get: (r: TrendRow) => r.cost == null ? null : r.revenue - r.cost - r.expense },
];
const axisMoney = (value: number) => {
  const magnitude = Math.abs(value);
  const divisor = magnitude >= 1e9 ? 1e9 : magnitude >= 1e6 ? 1e6 : magnitude >= 1e3 ? 1e3 : 1;
  const unit = divisor === 1e9 ? " tỉ" : divisor === 1e6 ? " triệu" : divisor === 1e3 ? " nghìn" : "";
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: divisor === 1 ? 0 : 1 }).format(value / divisor) + unit;
};
const dateLabel = (date: string) => date.split("-").reverse().join("/");
export default function FinanceTrendChart({ data }: { data: TrendRow[] }) {
  const [activeDate, setActiveDate] = useState<string>();
  if (!data.length) return null;
  const rows = [...data].sort((a, b) => a.date.localeCompare(b.date));
  const values = rows.flatMap(r => series.map(s => s.get(r)).filter((v): v is number => v != null));
  const min = Math.min(0, ...values), max = Math.max(1, ...values);
  const y = (v: number) => 214 - (v - min) / (max - min) * 192;
  const start = Date.parse(rows[0].date), end = Date.parse(rows[rows.length - 1].date);
  const x = (i: number) => end === start ? 445 : 70 + (Date.parse(rows[i].date) - start) / (end - start) * 750;
  const active = rows.findIndex(r => r.date === activeDate);
  const ticks = [...new Set(Array.from({ length: Math.min(6, rows.length) }, (_, i) =>
    Math.round(i * (rows.length - 1) / Math.max(1, Math.min(6, rows.length) - 1))))];
  return <div className="chart-fade-in relative flex flex-col justify-between rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 shadow-xs transition-shadow hover:shadow-md">
    <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-outline-variant mb-2">
      <div className="flex items-center gap-2">
        <h3 className="text-base font-bold text-on-surface">Diễn biến theo ngày</h3>
      </div>
      <div className="flex flex-wrap gap-3.5 text-xs font-semibold">
        {series.map(s => (
          <span key={s.label} className="inline-flex items-center gap-1.5" style={{ color: s.color }}>
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
    <p className="mb-2 text-xs text-on-surface-variant">Đơn vị: VND · Rê chuột hoặc chạm vào biểu đồ để xem chi tiết.</p>
    {active >= 0 && <div role="status" className="absolute right-5 top-16 z-10 max-w-[calc(100%-2.5rem)] rounded-xl border border-outline-variant bg-surface-container-lowest/95 p-3.5 text-xs shadow-xl backdrop-blur-xs pointer-events-none">
      <div className="mb-2 font-bold text-on-surface">{dateLabel(rows[active].date)}</div>
      {series.map(s => <div key={s.label} className="flex justify-between gap-5 py-0.5"><span className="font-semibold" style={{ color: s.color }}>{s.label}</span><span className="font-bold text-on-surface">{money(s.get(rows[active]))}</span></div>)}
    </div>}
    <div className="overflow-x-auto" onPointerLeave={() => setActiveDate(undefined)}>
      <svg viewBox="0 0 850 260" role="group" aria-label="Diễn biến doanh thu, giá vốn và lợi nhuận theo ngày" className="w-full min-w-[600px] select-none"
        onKeyDown={e => { if (e.key === "Escape") setActiveDate(undefined); }}>
        {[0, 1, 2, 3].map(i => { const value = min + (max - min) * i / 3; return <g key={i}>
          <line x1="70" x2="820" y1={y(value)} y2={y(value)} stroke="var(--color-outline-variant)" strokeDasharray="3 3"/>
          <text x="60" y={y(value) + 4} textAnchor="end" fontSize="10" fill="var(--color-on-surface-variant)">{axisMoney(value)}</text>
        </g>; })}
        <line x1="70" x2="820" y1={y(0)} y2={y(0)} stroke="var(--color-outline)" strokeWidth="1"/>
        {ticks.map(i => <text key={i} x={x(i)} y="242" textAnchor={i === 0 && rows.length > 1 ? "start" : i === rows.length - 1 && rows.length > 1 ? "end" : "middle"} fontSize="10" fill="var(--color-on-surface-variant)" fontWeight="500">{dateLabel(rows[i].date)}</text>)}
        {series.map(s => <g key={s.label}>
          <path fill="none" stroke={s.color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" d={rows.map((r, i) => s.get(r) == null ? "" : `${i === 0 || s.get(rows[i - 1]) == null ? "M" : "L"}${x(i)},${y(s.get(r)!)}`).join(" ")}/>
          {rows.map((r, i) => s.get(r) != null && (i === active || (i === 0 || s.get(rows[i - 1]) == null) && (i === rows.length - 1 || s.get(rows[i + 1]) == null)) ? <circle key={r.date} cx={x(i)} cy={y(s.get(r)!)} r="3" fill={s.color} stroke="var(--color-surface-container-lowest)" strokeWidth="1.5"/> : null)}
        </g>)}
        {active >= 0 && <line x1={x(active)} x2={x(active)} y1="22" y2="214" stroke="var(--color-on-surface-variant)" strokeDasharray="3 3"/>}
        {rows.map((r, i) => { const left = i === 0 ? 70 : (x(i - 1) + x(i)) / 2; const right = i === rows.length - 1 ? 820 : (x(i) + x(i + 1)) / 2; return <rect key={r.date} x={left} y="12" width={right - left} height="214" fill="transparent" tabIndex={0} role="button" aria-label={"Xem ngày " + dateLabel(r.date)} className="cursor-crosshair focus:outline-none focus:stroke-primary"
          onPointerEnter={() => setActiveDate(r.date)} onPointerDown={() => setActiveDate(r.date)} onClick={() => setActiveDate(r.date)} onFocus={() => setActiveDate(r.date)} onBlur={() => setActiveDate(undefined)} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setActiveDate(r.date); } }}/>;
        })}
      </svg>
    </div>
  </div>;
}
