import React, { useEffect, useRef } from "react";
import { AlertTriangle, CircleHelp, Loader2, X } from "lucide-react";

type ConfirmDialogProps = {
  appearance?: "default" | "erp";
  cancelLabel?: string;
  confirmLabel?: string;
  description: string;
  icon?: "alert" | "question";
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
  icon = "alert",
  isOpen,
  isSubmitting = false,
  onClose,
  onConfirm,
  showCancel = true,
  title,
  tone = "danger",
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusable = () => Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') || []);
    focusable()[0]?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSubmitting) onClose();
      if (event.key === "Tab") {
        const controls = focusable();
        if (!controls.length) { event.preventDefault(); return; }
        const first = controls[0]; const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  const styles = toneStyles[tone];
  const DialogIcon = icon === "question" ? CircleHelp : AlertTriangle;

  if (appearance === "erp") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-2xs" role="presentation">
        <div ref={dialogRef} className="w-full max-w-[480px] overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest text-left text-on-surface shadow-xl" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-description">
          <div className="flex items-center justify-between gap-3 border-b border-outline-variant px-5 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="h-5 w-1 shrink-0 rounded-full bg-primary" aria-hidden="true" />
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-container text-on-primary-container" aria-hidden="true">
                <DialogIcon className="size-4" />
              </span>
              <h3 id="confirm-dialog-title" className="text-sm font-medium text-on-surface text-balance">{title}</h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[#E8F4FF] text-[#087BDF] transition-colors hover:bg-[#D9EDFF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00ADFC]/30 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Đóng"
             data-erp-modal-close>
              <X className="h-4 w-4" />
            </button>
          </div>
          <p id="confirm-dialog-description" className="px-5 py-5 text-sm leading-6 text-on-surface-variant text-pretty">{description}</p>
          <div className="flex justify-end gap-2 border-t border-outline-variant px-5 py-4">
            {showCancel && (
              <button type="button" onClick={onClose} disabled={isSubmitting} className="inline-flex h-10 min-w-20 cursor-pointer items-center justify-center rounded-xl border border-outline-variant px-4 text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50">
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-2xs" role="presentation">
      <div ref={dialogRef} className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-outline-variant bg-surface-container-lowest text-on-surface shadow-xl" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-description">
        <div className="flex items-center justify-between border-b border-outline-variant px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="h-5 w-1 shrink-0 rounded-full bg-primary" aria-hidden="true" />
            <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${styles.accent}`} aria-hidden="true">
              <DialogIcon className="size-4" />
            </span>
            <h3 id="confirm-dialog-title" className="text-sm font-medium text-on-surface text-balance">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="w-7 h-7 rounded-full bg-rose-500 hover:bg-rose-600 active:scale-95 text-white flex items-center justify-center transition-all cursor-pointer shadow-xs shrink-0 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Đóng"
           data-erp-modal-close>
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>

        <p id="confirm-dialog-description" className="px-5 py-5 text-sm leading-6 text-on-surface-variant text-pretty">{description}</p>

        <div className="flex flex-col-reverse justify-end gap-3 border-t border-outline-variant px-5 py-4 sm:flex-row">
          {showCancel && <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="min-h-10 rounded-xl border border-outline-variant px-4 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cancelLabel}
          </button>}
          <button
            type="button"
            onClick={() => void onConfirm()}
            disabled={isSubmitting}
            className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-on-primary transition-colors focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${styles.button}`}
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isSubmitting ? "Đang xử lý..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
