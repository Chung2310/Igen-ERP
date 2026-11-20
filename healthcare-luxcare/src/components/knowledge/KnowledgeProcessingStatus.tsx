import React from "react";
import { Loader2, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import type { KnowledgeProgress } from "../../../shared/knowledge-progress";
import type { KnowledgeExtractionQuality } from "../../../shared/knowledge-extraction";

export default function KnowledgeProcessingStatus({
  status,
  progress,
  completedLabel = "Sẵn sàng",
  quality,
}: {
  status?: string;
  progress?: KnowledgeProgress;
  completedLabel?: string;
  quality?: KnowledgeExtractionQuality;
}) {
  const active = status === "processing";
  const labels: Record<KnowledgeProgress["stage"], string> = {
    reading: "Đang đọc tài liệu",
    ocr: "Đang đọc trang scan",
    chunking: "Đang chia nội dung",
    embedding: "Đang chuẩn bị dữ liệu tra cứu",
    publishing: "Đang lưu kết quả",
    complete: completedLabel,
  };
  const label =
    status === "queued"
      ? "Chờ xử lý"
      : status === "failed"
        ? "Xử lý lỗi"
        : active
          ? progress?.stage && progress.stage !== "complete"
            ? labels[progress.stage]
            : "Đang xử lý"
          : status === "indexed" && quality?.status === "partial"
            ? "Đọc được một phần"
            : completedLabel;
  const total = progress?.total;
  const measured =
    active &&
    typeof total === "number" &&
    Number.isFinite(total) &&
    total > 0 &&
    typeof progress?.completed === "number" &&
    Number.isFinite(progress.completed);
  const completed = measured ? Math.max(0, Math.min(progress!.completed!, total!)) : 0;
  const percent = measured ? Math.floor((completed / total!) * 100) : undefined;
  const Icon = active
    ? Loader2
    : status === "queued"
      ? Clock
      : status === "failed" || quality?.status === "partial"
        ? AlertCircle
        : CheckCircle2;
  return (
    <div className="min-w-0 space-y-1.5 text-xs" role="status" aria-live="polite">
      <div
        className={`flex items-center gap-1.5 ${status === "failed" ? "text-rose-600" : active ? "text-indigo-600 dark:text-indigo-300" : "text-slate-600 dark:text-slate-300"}`}
      >
        <Icon className={`h-3.5 w-3.5 shrink-0 ${active ? "animate-spin" : ""}`} />
        <span>{label}</span>
      </div>
      {status === "indexed" &&
        quality?.warnings.map((warning, index) => (
          <p key={index} className="whitespace-normal text-amber-700">
            {warning}
          </p>
        ))}
      {measured && (
        <>
          <div className="flex items-center justify-between gap-3 text-slate-500 dark:text-slate-400">
            <span>
              {completed}/{total} {progress?.unit === "pages" ? "trang" : "đoạn"}
            </span>
            <span>{percent}%</span>
          </div>
          <div
            role="progressbar"
            aria-label={label}
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={completed}
            aria-valuetext={`${completed}/${total} ${progress?.unit === "pages" ? "trang" : "đoạn"}`}
            className="h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
          >
            <div
              className="h-full rounded-full bg-indigo-500 transition-[width] duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>
        </>
      )}
    </div>
  );
}
