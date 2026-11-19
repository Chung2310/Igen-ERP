import { useId, type ReactNode } from 'react';

export interface ProgressSectionProps {
  title: string;
  description?: string;
  count?: number;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export default function ProgressSection({
  title,
  description,
  count,
  action,
  children,
  className = '',
}: ProgressSectionProps) {
  const titleId = useId();

  return (
    <section
      aria-labelledby={titleId}
      className={`pt-card ${className}`}
    >
      <div className="pt-card-body">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 id={titleId} className="text-base font-bold text-[#003b70] m-0 tracking-tight sm:text-lg">
                {title}
              </h2>
              {typeof count === 'number' && (
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[0.7rem] font-bold uppercase tracking-wide text-slate-600">
                  {count.toLocaleString('vi-VN')} mục
                </span>
              )}
            </div>
            {description && <p className="mt-1 text-xs text-slate-500 leading-relaxed">{description}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
        {children}
      </div>
    </section>
  );
}
