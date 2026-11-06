import React from "react";
import { History, Lock } from "lucide-react";
import { toDisplayDate } from "../utils/contractDate";
import { workerContractStatusLabel } from "../types";
import type { WorkerLaborContract } from "../types";
import { HrEmptyIllustration } from "../../../components/hr/HrEmptyIllustration";
import { HrStatusBadge } from "../../../components/hr/HrStatusBadge";

const statusTone: Record<WorkerLaborContract["status"], "neutral" | "success" | "info" | "danger"> = {
  draft: "neutral",
  active: "success",
  renewed: "info",
  expired: "danger",
  terminated: "neutral",
};

type Props = {
  contracts: WorkerLaborContract[];
  emptyText?: string;
};

/**
 * Timeline các kỳ hợp đồng theo thứ tự ký. Kỳ đã khóa hiện ổ khóa để nói rõ
 * ngày và điều khoản của kỳ đó không còn sửa được.
 */
export function WorkerContractHistory({ contracts, emptyText }: Props) {
  const ordered = React.useMemo(
    () => [...contracts].sort((a, b) => (a.sequence || 0) - (b.sequence || 0)),
    [contracts],
  );

  if (!ordered.length) {
    return (
      <div className="flex flex-col items-center rounded-md border border-outline-variant bg-surface-container-lowest px-4 py-6 text-center"><HrEmptyIllustration kind="contract" /><p className="mt-1 text-pretty text-sm text-on-surface-variant">{emptyText || "Chưa có hợp đồng nào."}</p></div>
    );
  }

  return (
    <ol className="space-y-2">
      {ordered.map((contract) => (
        <li
          key={contract._id}
          className="flex items-start gap-3 rounded-md border border-outline-variant bg-surface-container-lowest px-4 py-3 shadow-xs"
        >
          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-container-low text-xs tabular-nums text-on-surface-variant">
            {contract.sequence || 1}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-on-surface">{contract.code}</span>
              <HrStatusBadge tone={statusTone[contract.status]} dot>{workerContractStatusLabel[contract.status]}</HrStatusBadge>
              {contract.lockedAt && (
                <span
                  title="Kỳ đã kết thúc, không thể sửa ngày và điều khoản"
                  className="flex items-center gap-1 text-xs text-on-surface-variant"
                >
                  <Lock className="h-3 w-3" />
                  Đã khóa
                </span>
              )}
            </div>
            <p className="mt-1 text-pretty text-sm text-on-surface-variant">
              {contract.clientName} · {toDisplayDate(contract.startDate)} →{" "}
              {toDisplayDate(contract.endDate)}
            </p>
            {contract.previousEndDate && (
              <p className="mt-0.5 flex items-center gap-1 text-pretty text-xs text-on-surface-variant">
                <History className="h-3 w-3" />
                Gia hạn từ kỳ trước kết thúc {toDisplayDate(contract.previousEndDate)}
              </p>
            )}
            {contract.note && (
              <p className="mt-0.5 text-pretty text-xs italic text-on-surface-variant">{contract.note}</p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

export default WorkerContractHistory;
