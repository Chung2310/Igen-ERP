import type { ReactNode } from "react";
import { cn } from "../../modules/student-management/lib/utils";

type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "violet";
type Variant = "default" | "hr";

const toneClass: Record<Tone, string> = {
  neutral: "border border-[#DCDCDC] bg-[#F3F4F6] text-[#555555]",
  info: "bg-[#D9EDF7] text-[#286090]",
  success: "bg-[#5CB85C] text-white",
  warning: "bg-[#F0AD4E] text-white",
  danger: "bg-[#E06666] text-white",
  violet: "bg-[#8E6CEF] text-white",
};

export function HrStatusBadge({ children, tone = "neutral", variant = "hr", className = "", title, dot = false }: {
  children: ReactNode;
  tone?: Tone;
  variant?: Variant;
  className?: string;
  title?: string;
  dot?: boolean;
}) {
  void variant;
  void dot;
  return (
    <span
      data-hr-badge-tone={tone}
      className={cn(
        "inline-flex max-w-full min-w-0 items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold leading-4 uppercase",
        toneClass[tone],
        className,
      )}
      title={title}
    >
      <span className="block min-w-0 truncate">{children}</span>
    </span>
  );
}
