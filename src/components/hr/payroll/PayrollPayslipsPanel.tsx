import { Download, Send } from "lucide-react";

const ALLOWED_RUN_STATUSES = new Set(["closed", "paid"]);

export function PayrollPayslipsPanel({
  canManage,
  publishedCount,
  runStatus,
  onPublish,
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
        {canManage && canReleasePayslips && (
          <button
            type="button"
            onClick={onPublish}
            className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 px-3 py-2 text-sm font-semibold text-white cursor-pointer hover:bg-cyan-700"
          >
            <Send size={15} /> {publishedCount > 0 ? "Phát hành lại phiếu lương" : "Phát hành phiếu lương"}
          </button>
        )}
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
