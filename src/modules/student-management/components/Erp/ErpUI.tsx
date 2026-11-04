/* eslint-disable react-refresh/only-export-components */
import React from 'react';
import { Plus, Search, LucideIcon, Trash2, ChevronDown, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { StudentEmptyIllustration, type StudentEmptyIllustrationKind } from './StudentEmptyIllustration';
import { primaryCreateButtonClass } from '../../../../components/common/primaryCreateButton';
import '../../student-workspace.css';
/**
 * Bộ UI primitives dùng chung cho các trang Khóa học / Lớp / Giảng viên / Tài nguyên.
 * Giao diện hợp nhất dùng nền sáng cố định (theme dark của bản demo ERP đã bỏ).
 */
const useErpTheme = () => ({ darkMode: false });

export function ErpCard({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div style={style} className={cn(
      "rounded-md border border-outline-variant bg-surface-container-lowest shadow-sm",
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
        <div className="h-5 w-1 shrink-0 rounded-full bg-primary" />
        <div>
          <h1 className={cn("text-balance text-lg font-semibold normal-case", darkMode ? "text-white" : "text-on-surface")}>{title}</h1>
          {subtitle && <p className={cn("mt-0.5 text-xs font-normal", darkMode ? "text-slate-400" : "text-on-surface-variant")}>{subtitle}</p>}
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
        primaryCreateButtonClass,
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

export const ErpStatCard: React.FC<ErpStatCardProps> = ({ name, value, change, icon: Icon, color }) => {
  const tone = color?.includes('emerald') ? 'green' : color?.includes('rose') ? 'rose' : color?.includes('indigo') ? 'purple' : 'cyan';

  return (
    <article className={cn("student-stat-card group flex min-w-0 items-center justify-between gap-3 rounded-md p-3", `student-stat-card--${tone}`)}>
      <div className="min-w-0 space-y-1">
        <p className="text-pretty text-xs font-medium normal-case">{name}</p>
        <h3 className="break-words text-lg font-semibold leading-tight tabular-nums sm:text-xl">{value}</h3>
        {change && <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold">{change}</span>}
      </div>
      <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-white/15">
        <Icon className="size-5" aria-hidden="true" />
      </div>
    </article>
  );
};

export function ErpSearchBar({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative flex-1 max-w-md">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-md border border-outline-variant bg-surface-container-lowest pl-9 pr-3 text-sm font-normal text-on-surface outline-none placeholder:text-on-surface-variant focus:border-primary focus:ring-2 focus:ring-primary/10"
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
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "relative min-h-9 cursor-pointer whitespace-nowrap px-3.5 py-1.5 text-sm font-medium text-on-surface hover:text-primary focus-visible:outline-2 focus-visible:outline-primary",
        active
          ? "text-primary after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:bg-primary"
          : ""
      )}
    >
      {children}
    </button>
  );
};

export function ErpFilterRail({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("no-scrollbar flex shrink-0 select-none gap-1 overflow-x-auto border-b border-outline-variant", className)}>
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
  if (!isOpen) return null;

  return (
    <div className={cn("fixed inset-0 flex items-center justify-center p-3 sm:p-4", zIndex)}>
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={onClose} />
      <div className={cn(
        "relative max-h-[90vh] w-full space-y-3.5 overflow-y-auto rounded-md border border-outline-variant bg-surface-container-lowest p-4 text-on-surface shadow-lg sm:p-5",
        maxWidth,
        className
      )}>
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="h-4 w-1 shrink-0 rounded-full bg-[#00ADFC]" />
            <h3 className={cn("text-sm font-semibold text-on-surface normal-case sm:text-base", titleClassName)}>{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full bg-rose-500 text-white shadow-xs hover:bg-rose-600 focus-visible:outline-2 focus-visible:outline-primary"
            title="Đóng"
           data-erp-modal-close>
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

export const erpInputClass = (_darkMode: boolean) =>
  "h-9 w-full rounded-md border border-outline-variant bg-surface-container-lowest px-3 text-sm font-normal text-on-surface outline-none placeholder:text-on-surface-variant focus:border-primary focus:ring-2 focus:ring-primary/15";

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
          "appearance-none pr-10 cursor-pointer text-sm font-normal",
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
        "mt-3 w-full rounded-md bg-primary py-2.5 text-xs font-semibold text-on-primary shadow-xs hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50",
        props.className
      )}
    >
      {children}
    </button>
  );
}

export function ErpEmptyState({ icon: Icon, illustration, title, subtitle }: { icon?: LucideIcon; illustration?: StudentEmptyIllustrationKind; title: string; subtitle?: string }) {
  const { darkMode } = useErpTheme();
  return (
    <div className={cn('text-center', illustration ? 'flex flex-col items-center justify-center px-4 py-4' : 'space-y-3 p-16 text-slate-400')}>
      {illustration ? <StudentEmptyIllustration kind={illustration} /> : Icon ? (
        <div className={cn("mx-auto flex size-14 items-center justify-center rounded-2xl shadow-xs", darkMode ? "bg-slate-800 text-slate-300" : "bg-[#E8F7FF] text-[#00ADFC]")}>
          <Icon className="size-7" aria-hidden="true" />
        </div>
      ) : null}
      <p className={cn(illustration ? 'mt-1 text-balance text-sm font-semibold' : 'text-sm font-bold', darkMode ? 'text-white' : 'text-on-surface')}>{title}</p>
      {subtitle && <p className={cn('mx-auto max-w-md text-xs font-normal text-on-surface-variant', illustration ? 'mt-1 text-pretty' : '')}>{subtitle}</p>}
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
  return (
    <thead>
      <tr className="border-b border-outline-variant bg-surface-container-low text-xs font-medium text-on-surface-variant">
        {columns.map((col) => (
          <th key={col} className="px-4 py-2.5 text-left font-medium text-on-surface-variant">{col}</th>
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
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-sm space-y-4 rounded-md border border-outline-variant bg-surface-container-lowest p-5 text-on-surface shadow-lg">
        <div className="flex flex-col items-center text-center space-y-3">
          <div className={cn(
            "w-12 h-12 rounded-2xl flex items-center justify-center",
            isDanger
              ? "bg-rose-50 text-rose-600"
              : "bg-[#E8F7FF] text-[#00ADFC]"
          )}>
            <Trash2 className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-semibold text-on-surface">{title}</h4>
          <p className="text-xs text-slate-600 font-normal leading-relaxed px-2">{message}</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 cursor-pointer rounded-md border border-outline-variant bg-surface-container-lowest py-2.5 text-center text-xs font-semibold text-on-surface hover:bg-surface focus-visible:outline-2 focus-visible:outline-primary"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={cn(
              "flex-1 cursor-pointer rounded-md py-2.5 text-center text-xs font-semibold text-white shadow-xs focus-visible:outline-2 focus-visible:outline-primary",
              isDanger
                ? "bg-rose-600 hover:bg-rose-700 shadow-rose-600/10"
                : "bg-primary hover:bg-primary/90"
            )}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
