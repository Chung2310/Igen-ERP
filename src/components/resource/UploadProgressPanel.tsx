import React from "react";
import { CheckCircle2, XCircle, Loader2, Upload, X, FileIcon } from "lucide-react";

export interface UploadQueueItem {
  name: string;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
}

/** Panel nổi góc phải dưới hiển thị tiến trình tải lên nhiều tệp. */
export default function UploadProgressPanel({
  queue,
  onClose,
}: {
  queue: UploadQueueItem[];
  onClose: () => void;
}) {
  if (queue.length === 0) return null;

  const done = queue.filter((q) => q.status === "done").length;
  const failed = queue.filter((q) => q.status === "error").length;
  const finished = done + failed === queue.length;
  const percent = Math.round(((done + failed) / queue.length) * 100);

  return (
    <div className="fixed bottom-4 right-4 z-[70] w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
      <div className="flex items-center justify-between gap-2 px-4 py-3 bg-slate-50 border-b border-slate-100">
        <div className="flex items-center gap-2 min-w-0">
          {finished ? (
            failed > 0 ? (
              <XCircle className="w-4.5 h-4.5 text-red-500 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500 shrink-0" />
            )
          ) : (
            <Upload className="w-4.5 h-4.5 text-blue-500 shrink-0" />
          )}
          <span className="text-sm font-bold text-slate-800 truncate">
            {finished
              ? failed > 0
                ? `Đã tải lên ${done}/${queue.length} tệp (${failed} lỗi)`
                : `Đã tải lên ${done} tệp`
              : `Đang tải lên ${done + failed}/${queue.length} tệp...`}
          </span>
        </div>
        {finished && (
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition cursor-pointer"
            title="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Thanh tiến trình tổng */}
      <div className="h-1 bg-slate-100">
        <div
          className={`h-full transition-all duration-300 ${failed > 0 && finished ? "bg-amber-500" : "bg-blue-500"}`}
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* Danh sách từng tệp */}
      <div className="max-h-44 overflow-y-auto divide-y divide-slate-50">
        {queue.map((f, idx) => (
          <div key={`${f.name}-${idx}`} className="flex items-center gap-2.5 px-4 py-2">
            <FileIcon className="w-3.5 h-3.5 text-slate-300 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-700 truncate">{f.name}</p>
              {f.status === "error" && f.error && (
                <p className="text-[10px] text-red-500 truncate">{f.error}</p>
              )}
            </div>
            {f.status === "pending" && <span className="text-[10px] text-slate-400 shrink-0">Chờ...</span>}
            {f.status === "uploading" && <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin shrink-0" />}
            {f.status === "done" && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
            {f.status === "error" && <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
          </div>
        ))}
      </div>
    </div>
  );
}
