import { Download, Send } from "lucide-react";

const ALLOWED_RUN_STATUSES = new Set(["closed", "paid"]);

export function PayrollPayslipsPanel({
  canManage,
  canExport = true,
  publishedCount,
  runStatus,
  onPublish,
  onExport,
}: {
  canManage: boolean;
  canExport?: boolean;
  publishedCount: number;
  runStatus?: string;
  onPublish: () => void;
  onExport: (type: "detailed" | "insurance" | "pit" | "bank_transfer") => void;
}) {
  const canReleasePayslips = ALLOWED_RUN_STATUSES.has(runStatus || "");
  return (
    <div className="space-y-3">
      {!canReleasePayslips && (
        <p className="text-pretty text-xs text-on-surface-variant">
          Cần chốt kỳ lương trước khi phát hành phiếu lương hoặc xuất báo cáo.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {canManage && canReleasePayslips && (
          <button
            type="button"
            onClick={onPublish}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-on-primary hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-primary"
          >
            <Send size={15} aria-hidden="true" /> {publishedCount > 0 ? "Phát hành lại phiếu lương" : "Phát hành phiếu lương"}
          </button>
        )}
        {canExport && <button
          type="button"
          onClick={() => onExport("detailed")}
          disabled={!canReleasePayslips}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-outline bg-surface-container-lowest px-3 py-2 text-sm text-on-surface hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Download size={15} aria-hidden="true" /> Xuất bảng lương chi tiết
        </button>}
      </div>
    </div>
  );
}
