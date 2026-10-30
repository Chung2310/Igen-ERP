import React, { useEffect } from "react";
import { AlertTriangle, Loader2, X } from "lucide-react";

type ConfirmDialogProps = {
  cancelLabel?: string;
  confirmLabel?: string;
  description: string;
  isOpen: boolean;
  isSubmitting?: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
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
  cancelLabel = "Hủy",
  confirmLabel = "Xác nhận",
  description,
  isOpen,
  isSubmitting = false,
  onClose,
  onConfirm,
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs" role="presentation" onClick={(e) => { if (e.target === e.currentTarget && !isSubmitting) onClose(); }}>
      <div className="max-h-[calc(100dvh-2rem)] w-full max-w-sm overflow-y-auto rounded-2xl border border-gray-200/70 bg-white shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
        {/* Header with icon and title */}
        <div className="flex items-center justify-between px-6 pt-6 pb-2">
          <div className="flex items-center gap-3">
            <span className={`rounded-xl p-2 ${styles.accent}`}>
              <AlertTriangle className="h-5 w-5" />
            </span>
            <h3 id="confirm-dialog-title" className="text-base font-bold text-slate-800">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Đóng"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Description body */}
        <div className="px-6 py-4">
          <p className="text-sm leading-relaxed text-gray-500">{description}</p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => void onConfirm()}
            disabled={isSubmitting}
            className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-colors focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${styles.button}`}
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isSubmitting ? "Đang xử lý..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
