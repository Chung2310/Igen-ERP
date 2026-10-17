import React from "react";
import { History, Lock } from "lucide-react";
import { toDisplayDate } from "../utils/contractDate";
import { workerContractStatusLabel } from "../types";
import type { WorkerLaborContract } from "../types";

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
      <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
        {emptyText || "Chưa có hợp đồng nào."}
      </p>
    );
  }

  return (
    <ol className="space-y-2">
      {ordered.map((contract) => (
        <li
          key={contract._id}
          className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3"
        >
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs text-slate-600">
            {contract.sequence || 1}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-slate-900">{contract.code}</span>
              <span className="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-500">
                {workerContractStatusLabel[contract.status]}
              </span>
              {contract.lockedAt && (
                <span
                  title="Kỳ đã kết thúc, không thể sửa ngày và điều khoản"
                  className="flex items-center gap-1 text-xs text-slate-500"
                >
                  <Lock className="h-3 w-3" />
                  Đã khóa
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-slate-600">
              {contract.clientName} · {toDisplayDate(contract.startDate)} →{" "}
              {toDisplayDate(contract.endDate)}
            </p>
            {contract.previousEndDate && (
              <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                <History className="h-3 w-3" />
                Gia hạn từ kỳ trước kết thúc {toDisplayDate(contract.previousEndDate)}
              </p>
            )}
            {contract.note && (
              <p className="mt-0.5 text-xs italic text-slate-500">{contract.note}</p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

export default WorkerContractHistory;
