import { Download } from "lucide-react";

const ALLOWED_RUN_STATUSES = new Set(["calculated", "approved", "closed", "partially_paid", "paid"]);

export function PayrollPayslipsPanel({
  runStatus,
  onExport,
}: {
  canManage: boolean;
  publishedCount: number;
  runStatus?: string;
  onPublish: () => void;
  onExport: (type: "detailed" | "insurance" | "pit" | "bank_transfer") => void;
}) {
  const canReleasePayslips = ALLOWED_RUN_STATUSES.has(runStatus || "");
  return (
    <div className="space-y-3">
      {!canReleasePayslips && (
        <p className="text-xs text-amber-700">
          Cần chốt kỳ lương trước khi phát hành phiếu lương hoặc xuất báo cáo.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onExport("detailed")}
          disabled={!canReleasePayslips}
          className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer hover:bg-slate-50"
        >
          <Download size={15} /> Xuất bảng lương chi tiết
        </button>
      </div>
    </div>
  );
}
