import { HrEmptyIllustration, type HrEmptyIllustrationKind } from "../../../components/hr/HrEmptyIllustration";
import type { ReactNode } from "react";

export function FinanceEmptyState({ kind, children }: { kind: HrEmptyIllustrationKind; children: ReactNode }) {
  return <div className="flex flex-col items-center px-4 py-8 text-center text-pretty text-sm text-on-surface-variant">
    <HrEmptyIllustration kind={kind} />
    <p className="mt-1">{children}</p>
  </div>;
}
