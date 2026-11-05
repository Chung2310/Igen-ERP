import type { ReactNode } from "react";

/** Main heading used across the Human Resources workspace. */
export function HrPageTitle({ children, level = 2, testId }: { children: ReactNode; level?: 1 | 2 | 3; testId?: string }) {
  const Heading = level === 1 ? "h1" : level === 3 ? "h3" : "h2";

  return (
    <div className="flex min-w-0 items-center gap-3">
      <span aria-hidden="true" className="h-5 w-1 shrink-0 rounded-full bg-primary" />
      <Heading data-testid={testId} className="min-w-0 text-balance text-lg font-semibold text-on-surface">
        {children}
      </Heading>
    </div>
  );
}
