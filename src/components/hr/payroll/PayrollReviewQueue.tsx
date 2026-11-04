import { Check, Printer, X } from "lucide-react";

type Adjustment = {
  _id: string;
  employeeName?: string;
  employeeId: string;
  kind: string;
  amount: number;
  reason: string;
  status: string;
  advanceDetails?: { date: string; method: "transfer" | "cash"; note?: string };
};

export function PayrollReviewQueue({ adjustments, onApprove, onReject, onPrintAdvance }: {
  adjustments: Adjustment[];
  onApprove: (adjustment: Adjustment) => void;
  onReject: (adjustment: Adjustment) => void;
  onPrintAdvance?: (adjustment: Adjustment) => void;
}) {
  if (!adjustments.length) return <p className="px-4 py-8 text-pretty text-center text-sm text-on-surface-variant">Chưa có phiếu điều chỉnh. Có thể tạo phiếu tạm ứng hoặc khoản điều chỉnh cho kỳ này.</p>;

  // Sort: pending first
  const sorted = [...adjustments].sort((a, b) => {
    if (a.status === "pending" && b.status !== "pending") return -1;
    if (a.status !== "pending" && b.status === "pending") return 1;
    return 0;
  });

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-2xl text-left text-sm">
        <thead className="bg-surface-container-low text-on-surface-variant">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium">Nhân viên</th>
            <th scope="col" className="px-4 py-3 font-medium">Khoản điều chỉnh</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">Số tiền</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">Thao tác</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-outline-variant">
      {sorted.map((item) => (
        <tr key={item._id} className="hover:bg-surface-container-low">
          <td className="px-4 py-3 font-medium text-on-surface">{item.employeeName || item.employeeId}</td>
          <td className="px-4 py-3 text-on-surface-variant">
              {item.kind === "bonus" ? "Thưởng / Cộng thêm" : item.kind === "deduction" ? "Khấu trừ / Phạt" : item.kind === "advance" ? "Tạm ứng lương" : item.kind} · {item.reason}
          </td>
          <td className={`whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums ${item.kind === "deduction" || item.kind === "advance" ? "text-error" : "text-on-surface"}`}>
              {item.kind === "deduction" || item.kind === "advance" ? "-" : ""}{item.amount.toLocaleString()} đ
          </td>
          <td className="px-4 py-2 text-right">
            <div className="flex items-center justify-end gap-1">
            {item.kind === "advance" && onPrintAdvance && <button type="button" aria-label={`In phiếu tạm ứng của ${item.employeeName || item.employeeId}`} onClick={() => onPrintAdvance(item)} className="flex size-10 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-primary"><Printer className="size-4" aria-hidden="true" /></button>}
            {item.status === "pending" ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label={`Duyệt điều chỉnh của ${item.employeeName || item.employeeId}`}
                  title="Duyệt điều chỉnh"
                  onClick={() => onApprove(item)}
                  className="flex size-10 items-center justify-center rounded-lg text-primary hover:bg-primary-container focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <Check size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label={`Từ chối điều chỉnh của ${item.employeeName || item.employeeId}`}
                  title="Từ chối điều chỉnh"
                  onClick={() => onReject(item)}
                  className="flex size-10 items-center justify-center rounded-lg text-error hover:bg-error-container focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </div>
            ) : item.status === "approved" ? (
              <span className="rounded-full bg-primary-container px-2 py-0.5 text-xs text-on-primary-container">
                Đã duyệt
              </span>
            ) : (
              <span className="rounded-full bg-surface-container-low px-2 py-0.5 text-xs text-on-surface-variant">
                Đã từ chối
              </span>
            )}
            </div>
          </td>
        </tr>
      ))}
        </tbody>
      </table>
    </div>
  );
}
