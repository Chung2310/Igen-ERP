import { Download, Send } from "lucide-react";

const EXPORT_LABELS = {
  detailed: "Bảng lương chi tiết",
  insurance: "Bảo hiểm",
  pit: "Thuế TNCN",
  bank_transfer: "Chuyển khoản",
} as const;

const ALLOWED_RUN_STATUSES = new Set(["closed", "partially_paid", "paid"]);

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
        {canManage && (
          <button
            type="button"
            onClick={onPublish}
            disabled={!canReleasePayslips}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send size={15} /> Phát hành phiếu lương ({publishedCount})
          </button>
        )}
        {(["detailed", "insurance", "pit", "bank_transfer"] as const).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => onExport(type)}
            disabled={!canReleasePayslips}
            className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Download size={15} /> {EXPORT_LABELS[type]}
          </button>
        ))}
      </div>
    </div>
  );
}
