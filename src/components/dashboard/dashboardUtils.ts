export type Tone = "blue" | "amber" | "slate" | "indigo" | "emerald";

export const toneClass: Record<Tone, { soft: string; text: string; fill: string; strong: string }> = {
  blue: { soft: "bg-blue-50", text: "text-blue-600", fill: "bg-blue-500", strong: "text-blue-700" },
  amber: { soft: "bg-amber-50", text: "text-amber-600", fill: "bg-amber-500", strong: "text-amber-700" },
  slate: { soft: "bg-slate-100", text: "text-slate-600", fill: "bg-slate-600", strong: "text-slate-700" },
  indigo: { soft: "bg-indigo-50", text: "text-indigo-650", fill: "bg-indigo-600", strong: "text-indigo-750" },
  emerald: { soft: "bg-emerald-50/60", text: "text-emerald-600", fill: "bg-emerald-500", strong: "text-emerald-700" },
};

export const formatDashboardCurrency = (val: number, decimalDigits: number = 1, useK: boolean = true): string => {
  if (val === 0) return "0";
  if (!isFinite(val) || isNaN(val)) return "0";

  const absVal = Math.abs(val);
  const sign = val < 0 ? "-" : "";

  if (absVal >= 1e15) {
    return `${sign}${absVal.toExponential(2)}`;
  }
  if (absVal >= 1e12) {
    return `${sign}${(absVal / 1e12).toFixed(decimalDigits)}T`;
  }
  if (absVal >= 1e9) {
    return `${sign}${(absVal / 1e9).toFixed(decimalDigits)}B`;
  }
  if (absVal >= 1e6) {
    return `${sign}${(absVal / 1e6).toFixed(decimalDigits)}M`;
  }
  if (useK && absVal >= 1e3) {
    return `${sign}${(absVal / 1e3).toFixed(0)}K`;
  }
  return `${sign}${Math.round(absVal).toLocaleString("vi-VN")}`;
};

export const buildPctSegments = (
  parts: Array<{ label: string; value: number; color: string }>,
  unit: string
): Array<{ label: string; value: number; color: string; display: string }> => {
  const total = parts.reduce((acc, p) => acc + Math.max(0, p.value), 0);
  let used = 0;
  return parts.map((p, i) => {
    const count = Math.max(0, p.value);
    let pct = 0;
    if (total > 0) {
      pct = i === parts.length - 1 ? Math.max(0, 100 - used) : Math.round((count / total) * 100);
      used += pct;
    }
    return { ...p, value: pct, display: `${count.toLocaleString("vi-VN")} ${unit} (${pct}%)` };
  });
};
