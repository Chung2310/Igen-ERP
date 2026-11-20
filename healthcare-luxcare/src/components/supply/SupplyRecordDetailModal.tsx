import React, { useEffect } from "react";
import { Info, Pencil, X } from "lucide-react";

export interface SupplyDetailField {
  label: string;
  value?: React.ReactNode;
  wide?: boolean;
}

interface Props {
  open: boolean;
  title: string;
  subtitle?: string;
  status?: { label: string; active: boolean };
  fields: SupplyDetailField[];
  onClose: () => void;
  onEdit?: () => void;
}

export function SupplyRecordDetailModal({ open, title, subtitle, status, fields, onClose, onEdit }: Props) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
      role="presentation"
      onMouseDown={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`Chi tiết ${title}`}
        className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 bg-slate-50/70 p-5">
          <div className="flex min-w-0 items-start gap-3">
            <span className="rounded-xl bg-emerald-100 p-2.5 text-emerald-700">
              <Info className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900">{title}</h3>
                {status && (
                  <span
                    className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${status.active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-100 text-slate-500"}`}
                  >
                    {status.label}
                  </span>
                )}
              </div>
              {subtitle && <p className="mt-1 break-all text-sm text-slate-500">{subtitle}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-200/70 hover:text-slate-700"
            aria-label="Đóng chi tiết"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="max-h-[65vh] overflow-y-auto p-5">
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {fields.map((field, index) => (
              <div
                key={`${field.label}-${index}`}
                className={`rounded-xl border border-slate-100 bg-slate-50/60 p-3.5 ${field.wide ? "sm:col-span-2" : ""}`}
              >
                <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{field.label}</dt>
                <dd className="mt-1.5 whitespace-pre-wrap break-words text-sm font-medium text-slate-800">
                  {field.value === undefined || field.value === null || field.value === "" ? "—" : field.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <footer className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/50 px-5 py-4">
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
            >
              <Pencil className="h-4 w-4" />
              Chỉnh sửa
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
          >
            Đóng
          </button>
        </footer>
      </section>
    </div>
  );
}
