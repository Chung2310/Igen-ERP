import React, { useEffect } from "react";
import { AlertTriangle, Loader2, X } from "lucide-react";

type ConfirmDialogProps = {
  appearance?: "default" | "erp";
  cancelLabel?: string;
  confirmLabel?: string;
  description: string;
  isOpen: boolean;
  isSubmitting?: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  showCancel?: boolean;
  title: string;
  tone?: "danger" | "warning";
};

const toneStyles = {
  danger: {
    accent: "bg-red-50 text-red-600",
    button: "bg-red-600 hover:bg-red-700 focus:ring-red-500",
  },
  warning: {
    accent: "bg-orange-50 text-orange-600",
    button: "bg-orange-500 hover:bg-orange-600 focus:ring-orange-500",
  },
};

export function ConfirmDialog({
  appearance = "default",
  cancelLabel = "Hủy",
  confirmLabel = "Xác nhận",
  description,
  isOpen,
  isSubmitting = false,
  onClose,
  onConfirm,
  showCancel = true,
  title,
  tone = "danger",
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSubmitting) onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  const styles = toneStyles[tone];

  if (appearance === "erp") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]" role="presentation">
        <div className="w-full max-w-[480px] overflow-hidden rounded-2xl bg-white text-left shadow-[0_20px_60px_rgba(13,48,78,0.2)]" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-description">
          <div className="flex items-center justify-between gap-3 bg-[#F7FBFF] px-5 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${styles.accent}`} aria-hidden="true">
                <AlertTriangle className="h-5 w-5" />
              </span>
              <h3 id="confirm-dialog-title" className="text-base font-medium text-[#15396C]">{title}</h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[#E8F4FF] text-[#087BDF] transition-colors hover:bg-[#D9EDFF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00ADFC]/30 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Đóng"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p id="confirm-dialog-description" className="px-5 py-6 text-sm leading-6 text-[#536B8F]">{description}</p>
          <div className="flex justify-end gap-2 border-t border-[#E7F0F8] bg-[#FAFCFE] px-5 py-4">
            {showCancel && (
              <button type="button" onClick={onClose} disabled={isSubmitting} className="inline-flex h-10 min-w-20 cursor-pointer items-center justify-center rounded-xl bg-[#E8F4FF] px-4 text-sm font-medium text-[#087BDF] transition-colors hover:bg-[#D9EDFF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00ADFC]/30 disabled:cursor-not-allowed disabled:opacity-50">
                {cancelLabel}
              </button>
            )}
            <button
              type="button"
              onClick={() => void onConfirm()}
              disabled={isSubmitting}
              className={`inline-flex h-10 min-w-24 cursor-pointer items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${styles.button}`}
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSubmitting ? "Đang xử lý..." : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 p-0 backdrop-blur-xs sm:items-center sm:p-4" role="presentation">
      <div className="max-h-[calc(100dvh-1rem)] w-full max-w-md overflow-y-auto rounded-t-3xl border border-gray-200/70 bg-white shadow-2xl sm:rounded-3xl" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
        <div className="flex items-start justify-between border-b border-gray-100 bg-gray-50 px-6 py-5">
          <div className="flex items-start gap-3">
            <span className={`mt-0.5 rounded-2xl p-2.5 ${styles.accent}`}>
              <AlertTriangle className="h-5 w-5" />
            </span>
            <div>
              <h3 id="confirm-dialog-title" className="text-base font-bold text-slate-800">{title}</h3>
              <p className="mt-1 text-sm leading-6 text-gray-500">{description}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="w-7 h-7 rounded-full bg-rose-500 hover:bg-rose-600 active:scale-95 text-white flex items-center justify-center transition-all cursor-pointer shadow-xs shrink-0 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Đóng"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>

        <div className="flex flex-col-reverse justify-end gap-3 border-t border-gray-100 px-4 py-4 sm:flex-row sm:px-6">
          {showCancel && <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="min-h-11 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cancelLabel}
          </button>}
          <button
            type="button"
            onClick={() => void onConfirm()}
            disabled={isSubmitting}
            className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-colors focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${styles.button}`}
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isSubmitting ? "Đang xử lý..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
