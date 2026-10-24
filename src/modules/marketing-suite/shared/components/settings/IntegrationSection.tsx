import type { ReactNode } from "react";
import { ChevronDown, type LucideIcon } from "lucide-react";

interface IntegrationSectionProps {
  title: string;
  description: string;
  icon: LucideIcon;
  children: ReactNode;
}

/** Keep form state mounted when a secondary setting is collapsed. */
export default function IntegrationSection({ title, description, icon: Icon, children }: IntegrationSectionProps) {
  return (
    <details className="integration-section group/disclosure min-w-0 rounded-2xl border border-slate-200 bg-white">
      <summary className="flex cursor-pointer list-none items-center gap-3 rounded-2xl p-4 text-left transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 sm:p-5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
          <Icon className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-slate-800">{title}</span>
          <span className="mt-1 block text-xs leading-relaxed text-slate-500">{description}</span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open/disclosure:rotate-180" />
      </summary>
      <div className="integration-section-body border-t border-slate-100 p-4 sm:p-5">{children}</div>
    </details>
  );
}
