import { useEffect, useId, useState, type ReactNode } from "react";
import { ErpModal } from "../../components/common/ErpModal";
import { ConfirmDialog } from "../../components/common/ConfirmDialog";
import { primaryCreateButtonClass } from "../../components/common/primaryCreateButton";
import { StyledSelect } from "../../components/common/StyledSelect";
import { HrEmptyIllustration, type HrEmptyIllustrationKind } from "../../components/hr/HrEmptyIllustration";
import { AdminDatePicker } from "../../components/user-admin/AdminDatePicker";
import { cn } from "../student-management/lib/utils";
import type { GymApi } from "./api";
import type { GymRecord } from "../../../shared/gym/types";
export const primary = primaryCreateButtonClass;
export const control =
  "w-full rounded-md border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none disabled:opacity-50";
export const panel =
  "rounded-md border border-outline-variant bg-surface-container-lowest p-4 text-on-surface";
export const secondary =
  "inline-flex min-h-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-outline-variant bg-surface-container-lowest px-3 text-xs font-medium text-on-surface transition-colors hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50";

export function GymEmptyState({
  kind = "task",
  title,
  filtered = false,
}: {
  kind?: HrEmptyIllustrationKind;
  title: string;
  filtered?: boolean;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 text-center">
      <HrEmptyIllustration kind={filtered ? "search" : kind} />
      <p className="mt-1 text-pretty text-sm text-on-surface-variant">
        {title}
      </p>
    </div>
  );
}

export function GymAvatar({ name, size = "md" }: { name?: string; size?: "sm" | "md" }) {
  const trimmed = (name || "?").trim();
  const parts = trimmed.split(/\s+/);
  const initial = parts.length > 1
    ? `${parts[parts.length - 1][0] || ""}`.toUpperCase()
    : trimmed.slice(0, 1).toUpperCase() || "?";
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-primary/12 font-semibold text-primary",
        size === "sm" ? "size-7 text-xs" : "size-9 text-sm",
      )}
    >
      {initial}
    </span>
  );
}
export const messageOf = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Không thực hiện được thao tác. Vui lòng thử lại.";
export const dateLabel = (value: unknown) =>
  typeof value === "string" && Number.isFinite(Date.parse(value))
    ? new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }).format(
        new Date(value),
      )
    : "—";
export function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
  placeholder,
  min,
  max,
  options,
  multiline,
  disabled,
}: {
  label: string;
  value: any;
  onChange: (value: any) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  min?: number | string;
  max?: number | string;
  options?: [string, string][];
  multiline?: boolean;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="space-y-1">
      <label
        htmlFor={options || type === "date" ? undefined : id}
        className="block text-sm text-on-surface"
      >
        {label}
        {required && " *"}
      </label>
      {options ? (
        <StyledSelect
          appearance="erp"
          ariaLabel={label}
          required={required}
          disabled={disabled}
          value={String(value ?? "")}
          onChange={onChange}
          options={options.map(([value, label]) => ({ value, label }))}
        />
      ) : type === "date" ? (
        <AdminDatePicker
          label={label}
          value={String(value ?? "")}
          onChange={onChange}
          min={typeof min === "string" ? min : undefined}
          max={typeof max === "string" ? max : undefined}
          disabled={disabled}
          required={required}
          hideLabel
        />
      ) : multiline ? (
        <textarea
          id={id}
          className={control}
          rows={3}
          required={required}
          disabled={disabled}
          value={value ?? ""}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          id={id}
          className={control}
          type={type}
          required={required}
          disabled={disabled}
          min={min}
          max={max}
          step={type === "number" ? "any" : undefined}
          value={value ?? ""}
          placeholder={placeholder}
          onChange={(e) =>
            onChange(
              type === "number" && e.target.value !== ""
                ? Number(e.target.value)
                : e.target.value,
            )
          }
        />
      )}
    </div>
  );
}
export function Feedback({
  error,
  loading,
}: {
  error?: string;
  loading?: boolean;
}) {
  return error ? (
    <p
      role="alert"
      className="rounded-lg border border-error/30 bg-error-container/20 px-3 py-2 text-xs font-medium text-error"
    >
      {error}
    </p>
  ) : loading ? (
    <p role="status" className="py-3 text-xs text-on-surface-variant">
      Đang tải dữ liệu...
    </p>
  ) : null;
}
export function FormDialog({
  title,
  children,
  onClose,
  onSubmit,
  submitLabel = "Lưu thay đổi",
  dirty = false,
  maxWidth = "max-w-3xl",
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  onSubmit: () => Promise<void>;
  submitLabel?: string;
  dirty?: boolean;
  maxWidth?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [discard, setDiscard] = useState(false);
  const close = () => {
    if (!busy) dirty ? setDiscard(true) : onClose();
  };
  return (
    <ErpModal
      native
      title={title}
      onClose={close}
      closeDisabled={busy}
      maxWidth={maxWidth}
    >
      <form
        className="space-y-4"
        aria-busy={busy}
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          setBusy(true);
          setError("");
          try {
            await onSubmit();
          } catch (error) {
            setError(messageOf(error));
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset
          disabled={busy}
          className="max-h-[calc(85dvh-10rem)] space-y-4 overflow-y-auto pr-1"
        >
          {children}
        </fieldset>
        <Feedback error={error} />
        <div className="flex justify-end gap-2 border-t border-outline-variant pt-3">
          <button
            type="button"
            className={secondary}
            onClick={close}
            disabled={busy}
          >
            Hủy
          </button>
          <button className={cn(primary, "min-h-9")} disabled={busy}>
            {busy ? "Đang lưu..." : submitLabel}
          </button>
        </div>
      </form>
      <ConfirmDialog
        native
        appearance="erp"
        isOpen={discard}
        title="Bỏ thay đổi?"
        description="Các thay đổi chưa lưu sẽ bị mất."
        confirmLabel="Bỏ thay đổi"
        onClose={() => setDiscard(false)}
        onConfirm={onClose}
      />
    </ErpModal>
  );
}
export function useGymQuery<T>(api: GymApi, path: string, refresh = 0) {
  const [state, setState] = useState<{
    data?: T;
    error: string;
    loading: boolean;
  }>({ error: "", loading: true });
  useEffect(() => {
    const controller = new AbortController();
    setState({ loading: true, error: "" });
    api
      .request<T>(path, "GET", undefined, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted)
          setState({ data, loading: false, error: "" });
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setState({ error: messageOf(e), loading: false });
      });
    return () => controller.abort();
  }, [api, path, refresh]);
  return state;
}
export function CustomerPicker({
  api,
  value,
  onChange,
  disabled,
}: {
  api: GymApi;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [search, setSearch] = useState("");
  const { data, error } = useGymQuery<{ data: GymRecord[] }>(
    api,
    `/customers?limit=100&search=${encodeURIComponent(search)}`,
  );
  const options: [string, string][] = [
    ["", "Chọn hoặc tìm học viên..."],
    ...(data?.data || []).map(
      (c) => [c._id, `${c.fullName} — ${c.phone}`] as [string, string],
    ),
  ];
  if (value && !options.some(([id]) => id === value))
    options.push([value, "Học viên đã chọn"]);
  return (
    <div className="space-y-2">
      <label className="block text-sm text-on-surface">Học viên / Khách hàng *</label>
      <StyledSelect
        ariaLabel="Học viên / Khách hàng"
        value={value}
        onChange={onChange}
        options={options.map(([value, label]) => ({ value, label }))}
        placeholder="Chọn hoặc tìm học viên..."
        disabled={disabled}
        required
        searchable={!disabled}
        searchPlaceholder="Tìm tên hoặc SĐT..."
        onSearchChange={setSearch}
      />
      <Feedback error={error} />
    </div>
  );
}
export function Tabs({
  items,
  value,
  onChange,
}: {
  items: [string, string][];
  value: string;
  onChange: (key: string) => void;
}) {
  return (
    <nav
      className="flex gap-1 overflow-x-auto border-b border-outline-variant"
      aria-label="Nội dung"
    >
      {items.map(([key, label]) => {
        const active = value === key;
        return (
          <button
            key={key}
            type="button"
            aria-pressed={active}
            className={cn(
              "shrink-0 cursor-pointer border-b-2 px-3.5 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary",
              active
                ? "border-primary font-semibold text-primary"
                : "border-transparent font-medium text-on-surface-variant hover:border-outline-variant hover:text-on-surface",
            )}
            onClick={() => onChange(key)}
          >
            {label}
          </button>
        );
      })}
    </nav>
  );
}
