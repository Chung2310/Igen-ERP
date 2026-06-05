import { LucideIcon } from "lucide-react";

export function SummaryCard({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value: number; tone: "blue" | "green" }) {
  const toneClass = tone === "blue" ? "border-blue-100 bg-blue-50/70 text-blue-700" : "border-green-100 bg-green-50/70 text-green-700";

  return (
    <div className={`rounded-2xl border p-5 ${toneClass}`}>
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white shadow-xs">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide">{label}</p>
          <p className="font-mono text-2xl font-bold text-slate-800">{value}</p>
        </div>
      </div>
    </div>
  );
}
