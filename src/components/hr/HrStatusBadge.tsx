import type { ReactNode } from "react";
import { cn } from "../../modules/student-management/lib/utils";

type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "violet";

const toneClass: Record<Tone, string> = {
  neutral: "bg-slate-100 text-slate-700",
  info: "bg-sky-100 text-sky-800",
  success: "bg-[#DCFCE7] text-[#15803D]",
  warning: "bg-[#FEF3C7] text-[#B45309]",
  danger: "bg-[#FEE2E2] text-[#DC2626]",
  violet: "bg-violet-100 text-violet-800",
};

export function HrStatusBadge({ children, tone = "neutral", className = "", title }: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
  title?: string;
}) {
  return (
    <span className={cn("inline-flex max-w-full min-w-0 items-center rounded-sm px-2 py-0.5 text-xs font-semibold uppercase", toneClass[tone], className)} title={title}>
      <span className="block min-w-0 truncate">{children}</span>
    </span>
  );
}
