import React from "react";
import { AnimatePresence, motion } from "motion/react";
import { Loader2, Save, X } from "lucide-react";

type EntityAddModalProps = {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  onSubmit?: (event: React.FormEvent<HTMLFormElement>) => void;
  error?: string | null;
  submitting?: boolean;
  submitLabel?: string;
};

export function EntityAddModal({
  isOpen,
  title,
  onClose,
  children,
  onSubmit,
  error,
  submitting = false,
  submitLabel = "Lưu hồ sơ",
}: EntityAddModalProps) {
  return (
    <AnimatePresence>
      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5">
          <motion.button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            onClick={onClose}
            disabled={submitting}
            className="absolute inset-0 bg-slate-900/45 backdrop-blur-[2px] disabled:cursor-not-allowed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            className="relative flex max-h-[calc(100dvh-1.5rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest text-on-surface shadow-xl"
            initial={{ opacity: 0, scale: 0.98, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 12 }}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-outline-variant px-5 py-4 sm:px-6">
              <h2 className="border-l-4 border-primary pl-3 text-sm font-medium text-on-surface text-balance">{title}</h2>
              <button type="button" aria-label="Đóng" onClick={onClose} disabled={submitting} className="grid h-8 w-8 place-items-center rounded-full bg-rose-500 text-white hover:bg-rose-600 disabled:opacity-50" data-erp-modal-close>
                <X className="h-4 w-4" />
              </button>
            </div>
            <form className="space-y-3 overflow-y-auto p-5 sm:p-6" onSubmit={onSubmit}>
              {error ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-600">{error}</div> : null}
              {children}
              <div className="sticky bottom-0 flex justify-end gap-3 border-t border-outline-variant bg-surface-container-lowest/95 pt-3 backdrop-blur">
                <button type="button" onClick={onClose} disabled={submitting} className="rounded-xl border border-outline-variant px-4 py-2 text-sm text-on-surface-variant hover:bg-surface-container disabled:opacity-50">Hủy</button>
                <button type="submit" disabled={submitting} className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-sm font-medium text-on-primary hover:bg-primary/90 disabled:opacity-50">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {submitting ? "Đang lưu..." : submitLabel}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
