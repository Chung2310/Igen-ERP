import React from "react";
import { X } from "lucide-react";

export function RecruitmentDialog({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={title}>
    <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white shadow-xl">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
        <h3 className="text-base font-bold text-slate-900">{title}</h3>
        <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-md text-slate-500 hover:bg-slate-100" title="Đóng"><X className="h-4 w-4" /></button>
      </div>
      <div className="p-5">{children}</div>
    </div>
  </div>;
}

export const fieldClass = "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100";
export const labelClass = "grid gap-1 text-xs font-semibold text-slate-700";
export const primaryButton = "inline-flex h-9 items-center justify-center gap-2 rounded-md bg-cyan-700 px-3 text-sm font-semibold text-white hover:bg-cyan-800 disabled:opacity-50";
export const secondaryButton = "inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50";

export function ViewState({ loading, error, empty }: { loading?: boolean; error?: string; empty?: string }) {
  if (loading) return <div className="grid min-h-48 place-items-center text-sm text-slate-500">Đang tải...</div>;
  if (error) return <div className="m-4 border-l-4 border-red-500 bg-red-50 p-4 text-sm text-red-700">{error}</div>;
  if (empty) return <div className="grid min-h-48 place-items-center border-y border-dashed border-slate-300 text-sm text-slate-500">{empty}</div>;
  return null;
}
