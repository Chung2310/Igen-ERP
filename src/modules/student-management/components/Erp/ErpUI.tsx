/* eslint-disable react-refresh/only-export-components */
import React from 'react';
import { Plus, Search, LucideIcon, Trash2, ChevronDown, X } from 'lucide-react';
import { cn } from '../../lib/utils';
/**
 * Bộ UI primitives dùng chung cho các trang Khóa học / Lớp / Giảng viên / Tài nguyên.
 * Giao diện hợp nhất dùng nền sáng cố định (theme dark của bản demo ERP đã bỏ).
 */
const useErpTheme = () => ({ darkMode: false });

export function ErpCard({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  const { darkMode } = useErpTheme();
  return (
    <div style={style} className={cn(
      "rounded-2xl border transition-all duration-300",
      darkMode
        ? "bg-slate-900/60 border-slate-800/80 backdrop-blur-md"
        : "bg-white border-slate-200 shadow-sm shadow-slate-100/50",
      className
    )}>
      {children}
    </div>
  );
}

export function ErpPageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  const { darkMode } = useErpTheme();
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div className="flex items-center gap-2.5">
        <div className="h-5 w-1 shrink-0 rounded-full bg-[#00ADFC]" />
        <div>
          <h1 className={cn("text-xl font-bold tracking-tight normal-case", darkMode ? "text-white" : "text-slate-900")}>{title}</h1>
          {subtitle && <p className={cn("text-xs font-medium mt-0.5", darkMode ? "text-slate-400" : "text-slate-500")}>{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function ErpPrimaryButton({ children, icon: Icon = Plus, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { icon?: LucideIcon }) {
  return (
    <button
      {...props}
      className={cn(
        "flex items-center gap-1.5 px-3.5 py-2 bg-[#00ADFC] hover:bg-[#0095d9] active:bg-[#0085c2] text-white rounded-xl text-xs font-semibold shadow-xs active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer normal-case",
        props.className
      )}
    >
      <Icon className="w-4 h-4" />
      {children}
    </button>
  );
}

export interface ErpStatCardProps {
  name: string;
  value: React.ReactNode;
  change?: string;
  icon: LucideIcon;
  color?: string;
}

export const ErpStatCard: React.FC<ErpStatCardProps> = ({ name, value, change, icon: Icon }) => {
  const { darkMode } = useErpTheme();
  const isPendingWarning = name.toLowerCase().includes("cần trả") || name.toLowerCase().includes("nợ");

  return (
    <article className={cn(
      "p-4 rounded-2xl border flex items-center justify-between group transition-all duration-300 shadow-xs",
      darkMode
        ? "bg-slate-900/60 border-slate-800/80 backdrop-blur-md hover:border-[#B5E8FF]"
        : "bg-white border-slate-200/80 hover:border-[#B5E8FF]"
    )}>
      <div className="space-y-1">
        <p className="text-xs font-medium text-slate-600 normal-case">{name}</p>
        <h3 className={cn("text-xl font-bold tabular-nums tracking-tight", darkMode ? "text-white" : "text-slate-900")}>{value}</h3>
        {change && <span className="text-[10px] font-semibold text-[#00ADFC] bg-sky-50 px-2 py-0.5 rounded-full">{change}</span>}
      </div>
      <div className={cn(
        "w-9 h-9 rounded-xl flex items-center justify-center shadow-xs transition-all duration-300",
        isPendingWarning
          ? "bg-rose-50 text-rose-600"
          : "bg-[#E8F7FF] text-[#00ADFC]"
      )}>
        <Icon className="w-4.5 h-4.5" />
      </div>
    </article>
  );
};

export function ErpSearchBar({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const { darkMode } = useErpTheme();
  return (
    <div className="relative flex-1 max-w-md">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "w-full h-9 border rounded-xl pl-9 pr-3 text-xs font-normal outline-none focus:border-[#00ADFC] focus:ring-2 focus:ring-[#00ADFC]/10 transition-all shadow-xs",
          darkMode ? "bg-slate-900/60 border-slate-800/80 text-white" : "bg-white border-slate-200 text-slate-800 placeholder:text-slate-400"
        )}
      />
    </div>
  );
}

export interface ErpFilterTabProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

export const ErpFilterTab: React.FC<ErpFilterTabProps> = ({ active, onClick, children }) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3.5 py-1.5 rounded-lg text-xs transition-all duration-200 whitespace-nowrap cursor-pointer normal-case",
        active
          ? "bg-[#00ADFC] text-white font-semibold shadow-xs"
          : "text-slate-600 hover:text-slate-900 hover:bg-white/80 font-medium"
      )}
    >
      {children}
    </button>
  );
};

export function ErpFilterRail({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex gap-1 overflow-x-auto select-none rounded-xl bg-slate-100/70 p-1 shrink-0 no-scrollbar", className)}>
      {children}
    </div>
  );
}

export function ErpModal({
  isOpen = true,
  title,
  titleClassName,
  onClose,
  children,
  maxWidth = "max-w-md",
  zIndex = "z-50",
  className,
}: {
  isOpen?: boolean;
  onClose: () => void;
  title: string;
  titleClassName?: string;
  children: React.ReactNode;
  maxWidth?: string;
  zIndex?: string;
  className?: string;
}) {
  const { darkMode } = useErpTheme();
  if (!isOpen) return null;

  return (
    <div className={cn("fixed inset-0 flex items-center justify-center p-3 sm:p-4", zIndex)}>
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={onClose} />
      <div className={cn(
        "relative w-full p-4 sm:p-5 rounded-2xl border shadow-2xl space-y-3.5 transition-all duration-300 max-h-[90vh] overflow-y-auto",
        maxWidth,
        darkMode ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200/80 text-slate-900",
        className
      )}>
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="h-4 w-1 shrink-0 rounded-full bg-[#00ADFC]" />
            <h3 className={cn("text-sm sm:text-base font-bold tracking-tight normal-case", darkMode ? "text-white" : "text-slate-900", titleClassName)}>{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-rose-500 hover:bg-rose-600 active:scale-95 text-white flex items-center justify-center transition-all cursor-pointer shadow-xs shrink-0"
            title="Đóng"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ErpField({ label, children, actions, className }: { label: string; children: React.ReactNode; actions?: React.ReactNode; hint?: string; className?: string }) {
  return (
    <div className={cn("space-y-1 text-left", className)}>
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <div className="erp-field-label min-w-[8rem] flex-1 text-xs font-semibold text-slate-900 normal-case">{label}</div>
        {actions}
      </div>
      {children}
    </div>
  );
}

export const erpInputClass = (darkMode: boolean) => cn(
  "w-full h-9 border rounded-xl px-3 text-xs font-normal outline-none focus:border-[#00ADFC] focus:ring-2 focus:ring-[#00ADFC]/15 transition-all",
  darkMode ? "bg-slate-800 border-slate-700 text-white placeholder:text-slate-500" : "bg-white border-slate-200 text-slate-900 placeholder:text-slate-400"
);

export function ErpInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { darkMode } = useErpTheme();
  return <input {...props} className={cn(erpInputClass(darkMode), props.className)} />;
}

export function ErpSelect({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { darkMode } = useErpTheme();
  return (
    <div className="relative w-full">
      <select
        {...props}
        className={cn(
          erpInputClass(darkMode),
          "appearance-none pr-10 cursor-pointer",
          className
        )}
      >
        {children}
      </select>
      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
        <ChevronDown className="w-4 h-4" />
      </div>
    </div>
  );
}

export function ErpSubmitButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="submit"
      {...props}
      className={cn(
        "w-full py-2.5 bg-[#00ADFC] hover:bg-[#0095d9] active:bg-[#0085c2] text-white rounded-xl text-xs font-semibold shadow-xs active:scale-95 transition-all mt-3 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer normal-case",
        props.className
      )}
    >
      {children}
    </button>
  );
}

export function ErpEmptyState({ icon: Icon, title, subtitle }: { icon: LucideIcon; title: string; subtitle?: string }) {
  const { darkMode } = useErpTheme();
  return (
    <div className="p-16 text-center text-slate-400 space-y-3">
      <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center mx-auto shadow-xs", darkMode ? "bg-slate-800 text-slate-300" : "bg-[#E8F7FF] text-[#00ADFC]")}>
        <Icon className="w-7 h-7" />
      </div>
      <p className={cn("text-sm font-bold tracking-tight", darkMode ? "text-white" : "text-slate-900")}>{title}</p>
      {subtitle && <p className="text-xs text-slate-500 font-normal max-w-md mx-auto">{subtitle}</p>}
    </div>
  );
}

export function ErpLoadingState({ message = "Đang tải dữ liệu..." }: { message?: string }) {
  return (
    <div className="p-20 text-center text-slate-400 space-y-4">
      <div className="w-8 h-8 rounded-full border-4 border-[#00ADFC] border-t-transparent animate-spin mx-auto" />
      <p className="text-xs font-medium text-slate-600">{message}</p>
    </div>
  );
}

export function ErpTableHead({ columns }: { columns: string[] }) {
  const { darkMode } = useErpTheme();
  return (
    <thead>
      <tr className={cn(
        "border-b text-xs font-semibold",
        darkMode ? "border-slate-800/50 text-slate-400 bg-slate-950/20" : "border-slate-200/80 text-slate-600 bg-slate-50/70"
      )}>
        {columns.map((col) => (
          <th key={col} className="py-2.5 px-4 text-left font-semibold text-slate-700">{col}</th>
        ))}
      </tr>
    </thead>
  );
}

export function ErpConfirmModal({
  isOpen,
  title = "Xác nhận xóa",
  message,
  onConfirm,
  onCancel,
  confirmText = "Xác nhận xóa",
  cancelText = "Hủy",
  isDanger = true,
}: {
  isOpen: boolean;
  title?: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
}) {
  const { darkMode } = useErpTheme();
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={onCancel} />
      <div className={cn(
        "relative w-full max-w-sm p-5 rounded-2xl border shadow-2xl space-y-4 transition-all duration-300",
        darkMode ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200/80 text-slate-900"
      )}>
        <div className="flex flex-col items-center text-center space-y-3">
          <div className={cn(
            "w-12 h-12 rounded-2xl flex items-center justify-center",
            isDanger
              ? "bg-rose-50 text-rose-600"
              : "bg-[#E8F7FF] text-[#00ADFC]"
          )}>
            <Trash2 className="w-6 h-6" />
          </div>
          <h4 className={cn("text-sm font-bold tracking-tight", darkMode ? "text-white" : "text-slate-900")}>{title}</h4>
          <p className="text-xs text-slate-600 font-normal leading-relaxed px-2">{message}</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 cursor-pointer text-center"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={cn(
              "flex-1 py-2.5 rounded-xl text-xs font-semibold text-white shadow-xs active:scale-95 transition-all cursor-pointer text-center",
              isDanger
                ? "bg-rose-600 hover:bg-rose-700 shadow-rose-600/10"
                : "bg-[#00ADFC] hover:bg-[#0095d9] shadow-sky-500/10"
            )}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
