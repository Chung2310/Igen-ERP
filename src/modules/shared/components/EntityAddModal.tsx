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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            onClick={onClose}
            disabled={submitting}
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px] disabled:cursor-not-allowed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            className="relative flex max-h-[95vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            initial={{ opacity: 0, scale: 0.95, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 30 }}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
              <h2 className="text-base font-bold text-slate-800">{title}</h2>
              <button type="button" aria-label="Đóng" onClick={onClose} disabled={submitting} className="rounded-full p-1.5 hover:bg-slate-100 disabled:opacity-50">
                <X className="h-4 w-4 text-slate-400" />
              </button>
            </div>
            <form className="space-y-4 overflow-y-auto p-6" onSubmit={onSubmit}>
              {error ? <div role="alert" className="rounded-xl border border-rose-100 bg-rose-50 p-3 text-sm font-bold text-rose-600">{error}</div> : null}
              {children}
              <div className="flex justify-end gap-4 border-t border-slate-100 pt-4">
                <button type="button" onClick={onClose} disabled={submitting} className="text-xs font-bold text-slate-500 hover:text-slate-800 disabled:opacity-50">Hủy</button>
                <button type="submit" disabled={submitting} className="flex items-center gap-2 rounded-xl bg-cyan-600 px-6 py-2.5 text-xs font-bold text-white disabled:opacity-50">
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
