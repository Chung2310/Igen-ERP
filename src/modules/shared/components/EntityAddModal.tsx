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
            className="relative flex max-h-[calc(100dvh-1.5rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[#DCE7F4] bg-white shadow-[0_24px_70px_rgba(11,65,99,0.18)]"
            initial={{ opacity: 0, scale: 0.98, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 12 }}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-[#E7EFF7] px-5 py-4 sm:px-6">
              <h2 className="border-l-[3px] border-[#00ADFC] pl-3 text-lg font-medium text-slate-900">{title}</h2>
              <button type="button" aria-label="Đóng" onClick={onClose} disabled={submitting} className="grid h-8 w-8 place-items-center rounded-full bg-rose-500 text-white hover:bg-rose-600 disabled:opacity-50">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form className="space-y-3 overflow-y-auto p-5 sm:p-6" onSubmit={onSubmit}>
              {error ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-600">{error}</div> : null}
              {children}
              <div className="sticky bottom-0 flex justify-end gap-3 border-t border-[#E7EFF7] bg-white/95 pt-3 backdrop-blur">
                <button type="button" onClick={onClose} disabled={submitting} className="rounded-xl border border-[#DCE7F4] px-4 py-2 text-sm text-slate-600 hover:bg-[#F5FAFE] disabled:opacity-50">Hủy</button>
                <button type="submit" disabled={submitting} className="flex items-center gap-2 rounded-xl bg-[#00ADFC] px-5 py-2 text-sm font-medium text-white hover:bg-[#0097dc] disabled:opacity-50">
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
