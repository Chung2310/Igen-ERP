import { useCallback, useEffect, useId, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { ErpTableHead } from "../../components/common/ErpTableHead";
import { HrEmptyIllustration, type HrEmptyIllustrationKind } from "../../components/hr/HrEmptyIllustration";
import { HrStatusBadge } from "../../components/hr/HrStatusBadge";
import { cn } from "../student-management/lib/utils";
import { ApiClientError } from "../../services/apiClientError";
import type { HealthcareApi } from "./api";

export const panelClass = "min-w-0 space-y-4 rounded-xl border border-outline-variant bg-surface-container-lowest p-4 sm:p-5";
export const controlClass = "min-h-10 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none disabled:opacity-60";
export const buttonClass = "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm font-medium text-on-surface hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50";
export const primaryClass = "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-primary bg-primary-container px-4 py-2 text-sm font-semibold text-on-primary-container hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50";

export const visitLabels = { registered: "Đã tiếp đón", in_progress: "Đang khám", completed: "Hoàn tất", cancelled: "Đã hủy", imported: "Đã nhập Excel" };
export const appointmentLabels = { scheduled: "Chờ xác nhận", confirmed: "Đã xác nhận", arrived: "Đã đến", completed: "Hoàn tất", cancelled: "Đã hủy", no_show: "Vắng hẹn" };
export const careLabels = { open: "Chờ xử lý", in_progress: "Đang xử lý", completed: "Hoàn tất", cancelled: "Đã hủy" };
export const catalogLabels = { doctor: "Bác sĩ", room: "Phòng khám", service: "Dịch vụ" };

const statusTones = {
  in_progress: "info", confirmed: "info", arrived: "info",
  completed: "success", cancelled: "danger", no_show: "warning",
} as const;

export function StatusBadge({ status, label }: { status: string; label: string }) {
  const tone = statusTones[status as keyof typeof statusTones];
  return <HrStatusBadge dot tone={tone} className={cn("whitespace-nowrap", !tone && "bg-surface-container text-on-surface-variant")}>{label}</HrStatusBadge>;
}

export function messageOf(error: unknown) {
  return error instanceof Error ? error.message : "Thao tác chưa hoàn tất. Vui lòng thử lại.";
}

export function useHealthcareQuery<T>(api: HealthcareApi, path: string | null, body?: string, { keepPreviousData = false } = {}) {
  const [state, setState] = useState<{ path: string; body?: string; version: number; data?: T; error?: string }>();
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion(value => value + 1), []);
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    const options = body === undefined ? { signal: controller.signal } : { method: "POST", body, signal: controller.signal };
    void api.json<T>(path, options).then(data => {
      if (!controller.signal.aborted) setState({ path, body, version, data });
    }).catch(error => {
      if (!controller.signal.aborted) setState({ path, body, version, error: messageOf(error) });
    });
    return () => controller.abort();
  }, [api, path, body, version]);
  const current = state?.path === path && (state.body === body || keepPreviousData) ? state : undefined;
  const refreshing = Boolean(path && (current?.version !== version || current?.body !== body));
  return {
    data: current?.data,
    error: refreshing ? undefined : current?.error,
    loading: refreshing && current?.data === undefined,
    refreshing,
    refresh,
  };
}

export function Feedback({ loading, error, onRetry }: { loading?: boolean; error?: string; onRetry?: () => void }) {
  if (loading) return <p role="status" className="text-sm text-on-surface-variant">Đang tải dữ liệu…</p>;
  if (!error) return null;
  return <div className="space-y-2 rounded-lg border border-outline-variant p-3">
    <p role="alert" className="text-sm text-error">{error}</p>
    {onRetry && <button type="button" className={buttonClass} onClick={onRetry}>Thử lại</button>}
  </div>;
}

export function Table({ headers, children, empty, emptyKind = "search" }: {
  headers: string[]; children: ReactNode; empty?: string; emptyKind?: HrEmptyIllustrationKind;
}) {
  if (empty) return <div className="flex flex-col items-center gap-2 border-t border-outline-variant px-4 py-5 text-center">
    <HrEmptyIllustration kind={emptyKind} className="h-14 w-24" />
    <p className="text-pretty text-sm text-on-surface-variant">{empty}</p>
  </div>;
  return <div className="overflow-x-auto border-t border-outline-variant">
    <table className="w-full border-collapse text-left text-sm tabular-nums">
      <ErpTableHead columns={headers} />
      <tbody className="divide-y divide-outline-variant">{children}</tbody>
    </table>
  </div>;
}

export function Cell({ children }: { children?: ReactNode }) {
  return <td className="min-w-24 px-4 py-2.5 align-top text-on-surface">{children ?? "—"}</td>;
}

export function RowLink(props: { children: ReactNode } & ({ href: string } | { onClick: () => void })) {
  const className = "rounded-sm text-left text-sm font-medium text-on-surface underline decoration-primary underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
  return "href" in props
    ? <a href={props.href} className={className}>{props.children}</a>
    : <button type="button" onClick={props.onClick} className={className}>{props.children}</button>;
}

export function dayLabel(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.split("-").reverse().join("/") : "—";
}

const timeFormatter = new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" });
export function timeLabel(value: string) {
  return value ? timeFormatter.format(new Date(value)) : "—";
}

export function dateTimeControl(value = "") {
  return value ? new Date(Date.parse(value) + 7 * 3_600_000).toISOString().slice(0, 16) : "";
}

export function formError(error: unknown) {
  const fields = error instanceof ApiClientError && Array.isArray(error.details?.fields) ? error.details.fields.map(String) : [];
  return { message: messageOf(error), fields };
}
export type FormError = ReturnType<typeof formError>;

export function Field({ label, name, value, error, options, onSelectChange, ...props }: InputHTMLAttributes<HTMLInputElement> & {
  label: string; name: string; value?: string; error?: FormError; options?: { value: string; label: string }[]; onSelectChange?: (value: string) => void;
}) {
  const id = useId();
  const invalid = error?.fields.includes(name);
  const attrs = { id, name, defaultValue: value, required: props.required, disabled: props.disabled, "aria-invalid": invalid, "aria-describedby": invalid ? `${id}-error` : undefined };
  return <div className="min-w-0 space-y-1">
    <label htmlFor={id} className="block text-sm font-medium">{label}{props.required && <span aria-hidden="true"> *</span>}</label>
    {options ? <select {...attrs} className={cn(controlClass, invalid && "border-error")} onChange={event => onSelectChange?.(event.target.value)}>{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
      : <input {...props} {...attrs} className={cn(controlClass, invalid && "border-error")} />}
    {invalid && <p id={`${id}-error`} className="text-xs text-error">{error?.message}</p>}
  </div>;
}
