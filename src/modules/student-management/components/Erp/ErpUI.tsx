/* eslint-disable react-refresh/only-export-components */
import React from 'react';
import { Plus, Search, LucideIcon, Trash2, ChevronDown } from 'lucide-react';
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
      <div>
        <h3 className={cn("text-lg font-black tracking-tight", darkMode ? "text-white" : "text-slate-800")}>{title}</h3>
        {subtitle && <p className={cn("text-xs font-bold", darkMode ? "text-slate-400" : "text-slate-500")}>{subtitle}</p>}
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
        "flex items-center gap-1.5 px-3.5 py-2 bg-brand-primary hover:bg-brand-primary/95 text-white rounded-lg text-xs font-black shadow-md shadow-brand-primary/10 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer",
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
  color: string; // tailwind gradient, ví dụ "from-blue-600 to-cyan-500"
}

export const ErpStatCard: React.FC<ErpStatCardProps> = ({ name, value, change, icon: Icon, color }) => {
  const { darkMode } = useErpTheme();
  return (
    <div className={cn(
      "p-4 rounded-2xl border flex items-center justify-between group transition-all duration-300",
      darkMode
        ? "bg-slate-900/60 border-slate-800/80 backdrop-blur-md hover:border-brand-primary/30"
        : "bg-white border-slate-200 shadow-sm shadow-slate-100/50 hover:border-brand-primary/30"
    )}>
      <div className="space-y-0.5">
        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{name}</p>
        <h3 className={cn("text-xl font-extrabold", darkMode ? "text-white" : "text-slate-855")}>{value}</h3>
        {change && <span className="text-[9px] font-bold text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded">{change}</span>}
      </div>
      <div className={cn(
        "w-9 h-9 rounded-xl bg-gradient-to-tr flex items-center justify-center shadow-sm group-hover:scale-105 transition-all duration-300",
        color
      )}>
        <Icon className="w-4 h-4 text-white" />
      </div>
    </div>
  );
};

export function ErpSearchBar({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const { darkMode } = useErpTheme();
  return (
    <div className="relative flex-1 max-w-md">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "w-full h-9 border rounded-lg pl-8.5 pr-3 text-xs font-semibold outline-none focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/5 transition-all",
          darkMode ? "bg-slate-900/60 border-slate-800/80 text-white" : "bg-white border-slate-200 text-slate-800"
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
  const { darkMode } = useErpTheme();
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer",
        active
          ? "bg-brand-primary text-white"
          : darkMode
            ? "bg-slate-900/60 text-slate-400 border border-slate-800/60 hover:bg-slate-800"
            : "bg-white text-slate-500 border border-slate-200 hover:border-slate-300 hover:bg-slate-50"
      )}
    >
      {children}
    </button>
  );
};

export function ErpFilterRail({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("w-full md:w-[26rem] lg:w-[28rem] overflow-x-auto no-scrollbar", className)}>
      <div className="flex min-w-max items-center gap-2 pr-1">
        {children}
      </div>
    </div>
  );
}

export function ErpModal({ title, onClose, children, maxWidth = "max-w-md" }: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  const { darkMode } = useErpTheme();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={onClose} />
      <div className={cn(
        "relative w-full p-5 rounded-2xl border shadow-2xl space-y-4 transition-all duration-300 max-h-[90vh] overflow-y-auto",
        maxWidth,
        darkMode ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-100 text-slate-850"
      )}>
        <div className="flex items-center justify-between">
          <h3 className={cn("text-base font-black uppercase tracking-wider", darkMode ? "text-white" : "text-slate-800")}>{title}</h3>
          <button
            onClick={onClose}
            className={cn(
              "p-1.5 rounded-lg transition-colors",
              darkMode ? "bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200" : "bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-850"
            )}
          >
            <Plus className="w-4 h-4 rotate-45" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ErpField({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">{label}</div>
      {children}
      {hint && <p className="text-[9px] font-bold text-slate-400 italic">{hint}</p>}
    </div>
  );
}

export const erpInputClass = (darkMode: boolean) => cn(
  "w-full h-9 border rounded-lg px-3 text-xs font-semibold outline-none focus:border-brand-primary transition-all",
  darkMode ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-200 text-slate-800"
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
        "w-full py-2.5 bg-gradient-to-r from-brand-primary to-sky-600 hover:from-brand-primary/90 hover:to-sky-700 text-white rounded-lg text-xs font-black uppercase tracking-wider shadow-md shadow-brand-primary/20 active:scale-95 transition-all mt-3 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 disabled:from-slate-400 disabled:to-slate-500 cursor-pointer",
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
    <div className="p-20 text-center text-slate-400 space-y-3">
      <div className={cn("w-16 h-16 rounded-3xl flex items-center justify-center mx-auto text-slate-500", darkMode ? "bg-slate-800/40" : "bg-slate-100")}>
        <Icon className="w-8 h-8" />
      </div>
      <p className={cn("text-sm font-black tracking-tight", darkMode ? "text-white" : "text-slate-800")}>{title}</p>
      {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
    </div>
  );
}

export function ErpLoadingState({ message = "Đang tải dữ liệu..." }: { message?: string }) {
  return (
    <div className="p-20 text-center text-slate-400 space-y-4">
      <div className="w-8 h-8 rounded-full border-4 border-brand-primary border-t-transparent animate-spin mx-auto" />
      <p className="text-xs font-bold uppercase tracking-wider">{message}</p>
    </div>
  );
}

export function ErpTableHead({ columns }: { columns: string[] }) {
  const { darkMode } = useErpTheme();
  return (
    <thead>
      <tr className={cn(
        "border-b text-[9px] font-black uppercase tracking-wider",
        darkMode ? "border-slate-800/50 text-slate-400 bg-slate-950/20" : "border-slate-100 text-slate-550 bg-slate-50/50"
      )}>
        {columns.map((col) => (
          <th key={col} className="py-2.5 px-4 text-left">{col}</th>
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
        darkMode ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-100 text-slate-850"
      )}>
        <div className="flex flex-col items-center text-center space-y-3">
          <div className={cn(
            "w-12 h-12 rounded-2xl flex items-center justify-center animate-pulse",
            isDanger 
              ? (darkMode ? "bg-rose-500/10 text-rose-450" : "bg-rose-50 text-rose-600")
              : (darkMode ? "bg-amber-500/10 text-amber-450" : "bg-amber-50 text-amber-600")
          )}>
            <Trash2 className="w-6 h-6" />
          </div>
          <h4 className={cn("text-xs font-black uppercase tracking-wider", darkMode ? "text-white" : "text-slate-800")}>{title}</h4>
          <p className={cn("text-[11px] font-bold leading-relaxed px-2", darkMode ? "text-slate-400" : "text-slate-500")}>{message}</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className={cn(
              "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border cursor-pointer text-center",
              darkMode
                ? "bg-slate-800 hover:bg-slate-750 text-slate-300 border-slate-700"
                : "bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200"
            )}
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={cn(
              "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-wider text-white shadow-lg active:scale-95 transition-all cursor-pointer text-center",
              isDanger
                ? "bg-rose-600 hover:bg-rose-550 shadow-rose-600/10"
                : "bg-brand-primary hover:bg-brand-primary/95 shadow-brand-primary/10"
            )}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
