import { Check, X } from "lucide-react";

type Adjustment = {
  _id: string;
  employeeName?: string;
  employeeId: string;
  kind: string;
  amount: number;
  reason: string;
  status: string;
};

export function PayrollReviewQueue({ adjustments, onApprove, onReject }: {
  adjustments: Adjustment[];
  onApprove: (adjustment: Adjustment) => void;
  onReject: (adjustment: Adjustment) => void;
}) {
  if (!adjustments.length) return <p className="rounded-xl bg-[#FFF0DF] px-3 py-2 text-sm font-normal text-[#A65E16]">Chưa có khoản nào.</p>;

  // Sort: pending first
  const sorted = [...adjustments].sort((a, b) => {
    if (a.status === "pending" && b.status !== "pending") return -1;
    if (a.status !== "pending" && b.status === "pending") return 1;
    return 0;
  });

  return (
    <div className="space-y-2">
      {sorted.map((item) => (
        <div key={item._id} className="flex items-center justify-between gap-3 rounded-xl border border-[#DCE7F4] bg-white p-3">
          <div className="min-w-0">
            <p className="font-normal text-slate-700">{item.employeeName || item.employeeId}</p>
            <p className="text-xs text-slate-500">
              {item.kind === "bonus" ? "Thưởng / Cộng thêm" : item.kind === "deduction" ? "Khấu trừ / Phạt" : item.kind} · {item.reason}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-4">
            <strong className={`font-normal ${item.kind === "deduction" ? "text-rose-600" : "text-slate-700"}`}>
              {item.kind === "deduction" ? "-" : ""}{item.amount.toLocaleString()} đ
            </strong>
            {item.status === "pending" ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  title="Duyệt điều chỉnh"
                  onClick={() => onApprove(item)}
                  className="rounded-lg p-2 text-[#008C75] transition-colors hover:bg-[#E7F8F4] cursor-pointer"
                >
                  <Check size={16} />
                </button>
                <button
                  type="button"
                  title="Từ chối điều chỉnh"
                  onClick={() => onReject(item)}
                  className="rounded-lg p-2 text-rose-500 transition-colors hover:bg-rose-50 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
            ) : item.status === "approved" ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-normal bg-[#E7F8F4] text-[#008C75]">
                Đã duyệt
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-normal bg-slate-100 text-slate-500">
                Đã từ chối
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
