import type { ReactNode } from "react";

/** Main heading used across the Human Resources workspace. */
export function HrPageTitle({ children, level = 2, testId }: { children: ReactNode; level?: 2 | 3; testId?: string }) {
  const Heading = level === 3 ? "h3" : "h2";

  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span className="h-5 w-1 shrink-0 rounded-full bg-primary" aria-hidden="true" />
      <Heading data-testid={testId} data-typography="page-title" className="min-w-0 text-on-surface">
        {children}
      </Heading>
    </div>
  );
}
