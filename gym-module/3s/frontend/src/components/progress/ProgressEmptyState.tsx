import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export interface ProgressEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}

export default function ProgressEmptyState({
  icon: Icon,
  title,
  description,
  action,
}: ProgressEmptyStateProps) {
  return (
    <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 px-6 py-10 text-center font-montserrat">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-secondary shadow-[0_8px_24px_rgba(0,59,112,0.08)] ring-1 ring-slate-200" aria-hidden="true">
        <Icon size={22} strokeWidth={2} />
      </span>
      <h3 className="mt-4 font-oswald text-xl font-bold uppercase tracking-tight text-primary">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
