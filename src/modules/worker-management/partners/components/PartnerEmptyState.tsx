import { HrEmptyIllustration, type HrEmptyIllustrationKind } from "../../../../components/hr/HrEmptyIllustration";

export function PartnerEmptyState({ kind, message }: { kind: HrEmptyIllustrationKind; message: string }) {
  return <div className="flex min-h-52 flex-col items-center justify-center px-4 py-7 text-center">
    <HrEmptyIllustration kind={kind} />
    <p className="mt-1 text-pretty text-sm text-on-surface-variant">{message}</p>
  </div>;
}
