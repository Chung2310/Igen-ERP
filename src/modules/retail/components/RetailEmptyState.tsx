import type { ReactNode } from "react";
import { StudentEmptyIllustration, type StudentEmptyIllustrationKind } from "../../student-management/components/Erp/StudentEmptyIllustration";
import { cn } from "../../student-management/lib/utils";

type Props = {
  children: ReactNode;
  kind?: StudentEmptyIllustrationKind;
  compact?: boolean;
  className?: string;
};

export function RetailEmptyState({ children, kind = "generic", compact = false, className }: Props) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center text-on-surface-variant", compact ? "gap-1 py-3" : "gap-1 px-4 py-6", className)}>
      <StudentEmptyIllustration kind={kind} className={compact ? "h-16 w-28" : undefined} />
      <p className="text-pretty text-sm">{children}</p>
    </div>
  );
}
