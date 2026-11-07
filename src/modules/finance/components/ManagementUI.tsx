import '../../../components/dashboard/overview-dashboard.css';
import '../finance-workspace.css';
import { useEffect, useRef, useState, type FormEvent, type ReactNode, type ElementType } from "react";
import {
  X,
  TrendingUp,
  TrendingDown,
  Package,
  Boxes,
  Wallet,
  Receipt,
  Scale,
  Clock,
  AlertTriangle,
  AlertCircle,
  FileCheck,
  FileSpreadsheet,
  Calculator,
  History,
  Lock,
  PieChart,
  Target,
  Hourglass,
  ArrowDownLeft,
  ArrowUpRight,
  Landmark,
  Coins,
  Users,
  Building2,
  DollarSign,
} from "lucide-react";
import { HrEmptyIllustration } from "../../../components/hr/HrEmptyIllustration";
import { primaryCreateButtonClass } from "../../../components/common/primaryCreateButton";

export const money = (n: number | null | undefined) =>
  n == null ? "Chưa có dữ liệu" : `${Math.round(n).toLocaleString("vi-VN")} đ`;
export const inputClass =
  "w-full rounded-md border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface outline-none focus:border-primary";
export const buttonClass =
  `${primaryCreateButtonClass} min-h-9 disabled:opacity-50`;

export interface StatTheme {
  icon: ElementType;
  iconBg: string;
  iconColor: string;
  borderColor: string;
  accentBar: string;
  valueColor: string;
}

export function getStatConfig(title: string): StatTheme {
  const t = title.toLowerCase();

  if (t.includes("lãi ròng") || t.includes("lợi nhuận sau thuế")) {
    return {
      icon: Wallet,
      iconBg: "bg-primary-container border border-primary",
      iconColor: "text-primary",
      borderColor: "hover:border-primary hover:shadow-sm",
      accentBar: "bg-primary",
      valueColor: "text-on-primary-container",
    };
  }
  if (t.includes("lãi gộp") || t.includes("lợi nhuận gộp")) {
    return {
      icon: Coins,
      iconBg: "bg-primary-container border border-primary",
      iconColor: "text-primary",
      borderColor: "hover:border-primary hover:shadow-sm",
      accentBar: "bg-primary",
      valueColor: "text-on-primary-container",
    };
  }
  if (t.includes("doanh thu") || t.includes("thu thực tế") || t.includes("thu dự kiến") || t.includes("đã tất toán") || t.includes("khớp thực tế")) {
    return {
      icon: TrendingUp,
      iconBg: "bg-secondary-container border border-secondary",
      iconColor: "text-secondary",
      borderColor: "hover:border-secondary hover:shadow-sm",
      accentBar: "bg-primary",
      valueColor: "text-on-secondary-container",
    };
  }
  if (t.includes("giá vốn") || t.includes("chi phí cố định") || t.includes("định phí")) {
    return {
      icon: Package,
      iconBg: "bg-surface-container-low border border-outline-variant",
      iconColor: "text-on-surface-variant",
      borderColor: "hover:border-outline-variant",
      accentBar: "bg-primary",
      valueColor: "text-on-surface",
    };
  }
  if (t.includes("tồn kho") || t.includes("tài sản") || t.includes("nguyên giá")) {
    return {
      icon: Boxes,
      iconBg: "bg-tertiary-container border border-tertiary",
      iconColor: "text-tertiary",
      borderColor: "hover:border-tertiary hover:shadow-sm",
      accentBar: "bg-primary",
      valueColor: "text-on-tertiary-container",
    };
  }
  if (t.includes("quá hạn") || t.includes("đến hạn") || t.includes("thiếu") || t.includes("cần thanh toán") || t.includes("chênh lệch thiếu")) {
    return {
      icon: AlertCircle,
      iconBg: "bg-error-container border border-error",
      iconColor: "text-error",
      borderColor: "hover:border-error hover:shadow-sm",
      accentBar: "bg-primary",
      valueColor: "text-on-error-container",
    };
  }
  if (t.includes("phải thu") || t.includes("còn nợ")) {
    return {
      icon: ArrowDownLeft,
      iconBg: "bg-primary-container border border-primary",
      iconColor: "text-primary",
      borderColor: "hover:border-primary hover:shadow-sm",
      accentBar: "bg-primary",
      valueColor: "text-on-primary-container",
    };
  }
  if (t.includes("phải trả") || t.includes("tổng chi") || t.includes("chi công nợ")) {
    return {
      icon: ArrowUpRight,
      iconBg: "bg-tertiary-container border border-tertiary",
      iconColor: "text-tertiary",
      borderColor: "hover:border-tertiary hover:shadow-sm",
      accentBar: "bg-primary",
      valueColor: "text-on-tertiary-container",
    };
  }
  if (t.includes("dòng tiền") || t.includes("số dư") || t.includes("dư cuối")) {
    return {
      icon: Landmark,
      iconBg: "bg-primary-container border border-primary",
      iconColor: "text-primary",
      borderColor: "hover:border-primary hover:shadow-sm",
      accentBar: "bg-primary",
      valueColor: "text-on-primary-container",
    };
  }
  if (t.includes("chi phí") || t.includes("khấu hao")) {
    return {
      icon: Receipt,
      iconBg: "bg-primary-container border border-primary",
      iconColor: "text-primary",
      borderColor: "hover:border-primary hover:shadow-sm",
      accentBar: "bg-primary",
      valueColor: "text-on-primary-container",
    };
  }
  if (t.includes("vat đầu vào")) {
    return {
      icon: FileCheck,
      iconBg: "bg-secondary-container border border-secondary",
      iconColor: "text-secondary",
      borderColor: "hover:border-secondary hover:shadow-sm",
      accentBar: "bg-primary",
      valueColor: "text-on-secondary-container",
    };
  }
  if (t.includes("vat đầu ra")) {
    return {
      icon: FileSpreadsheet,
      iconBg: "bg-primary-container border border-primary",
      iconColor: "text-primary",
      borderColor: "hover:border-primary hover:shadow-sm",
      accentBar: "bg-primary",
      valueColor: "text-on-primary-container",
    };
  }
  if (t.includes("vat phải nộp")) {
    return {
      icon: Calculator,
      iconBg: "bg-error-container border border-error",
      iconColor: "text-error",
      borderColor: "hover:border-error hover:shadow-sm",
      accentBar: "bg-primary",
      valueColor: "text-on-error-container",
    };
  }
  if (t.includes("chuyển kỳ")) {
    return {
      icon: History,
      iconBg: "bg-primary-container border border-primary",
      iconColor: "text-primary",
      borderColor: "hover:border-primary hover:shadow-sm",
      accentBar: "bg-primary",
      valueColor: "text-on-primary-container",
    };
  }
  if (t.includes("hòa vốn")) {
    return {
      icon: Target,
      iconBg: "bg-secondary-container border border-secondary",
      iconColor: "text-secondary",
      borderColor: "hover:border-secondary hover:shadow-sm",
      accentBar: "bg-primary",
      valueColor: "text-on-secondary-container",
    };
  }
  if (t.includes("tỷ lệ đóng góp")) {
    return {
      icon: PieChart,
      iconBg: "bg-primary-container border border-primary",
      iconColor: "text-primary",
      borderColor: "hover:border-primary hover:shadow-sm",
      accentBar: "bg-primary",
      valueColor: "text-on-primary-container",
    };
  }
  if (t.includes("đối tượng") || t.includes("khách hàng") || t.includes("tổng số khoản")) {
    return {
      icon: Users,
      iconBg: "bg-primary-container border border-primary",
      iconColor: "text-primary",
      borderColor: "hover:border-primary hover:shadow-sm",
      accentBar: "bg-primary",
      valueColor: "text-on-primary-container",
    };
  }

  return {
    icon: Scale,
    iconBg: "bg-surface-container-low border border-outline-variant",
    iconColor: "text-on-surface-variant",
    borderColor: "hover:border-outline-variant",
    accentBar: "bg-primary",
    valueColor: "text-on-surface",
  };
}

export function getFinanceStatTone(title: string) {
    const label = title.toLocaleLowerCase("vi");
    if (/quá hạn|còn thiếu|phải trả|tổng chi|chi phí|giá vốn|phải nộp|chênh lệch thiếu/.test(label)) return "expense";
    if (/doanh thu|tổng thu|phải thu|lãi|lợi nhuận|đã tất toán/.test(label)) return "income";
    if (/dòng tiền|số dư|còn chuyển|tồn kho|tài sản|nguyên giá/.test(label)) return "balance";
    return "neutral";
}
export function Stats({ values, overview = false }: { values: [string, ReactNode][]; overview?: boolean }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {values.map(([title, value]) => {
        const Icon = getStatConfig(title).icon;
        return <div key={title} className={overview ? "overview-kpi" : `finance-stat-card finance-stat-card--${getFinanceStatTone(title)} flex min-w-0 items-center justify-between gap-3 rounded-md p-3 text-on-primary`}>
          <div className="min-w-0"><p className="truncate text-pretty text-xs font-medium" title={title}>{title}</p>
          <div className="mt-1 break-words text-xl font-semibold leading-tight tabular-nums">{value}</div></div>
          {!overview && <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-on-primary/15"><Icon className="size-5" aria-hidden="true" /></span>}
        </div>
      })}
    </div>
  );
}
export function DataTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: ReactNode[][];
}) {
  const [page, setPage] = useState(0);
  const safePage = Math.min(page, Math.max(0, Math.ceil(rows.length / 25) - 1));
  const amountColumn = (header: string) => /số tiền|doanh thu|giá vốn|lãi|chi phí|còn nợ|đã trả|giá trị|dư|tổng|vat|rủi ro/i.test(header);
  return (
    <div className="overflow-hidden rounded-md border border-outline-variant bg-surface-container-lowest shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-outline-variant bg-surface-container-low text-xs font-medium text-on-surface-variant">
            <tr>
              {headers.map((h) => (
                <th key={h} scope="col" className={`whitespace-nowrap px-4 py-3 ${amountColumn(h) ? "text-right" : ""}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {rows.slice(safePage * 25, safePage * 25 + 25).map((row, i) => (
              <tr key={i} className="hover:bg-surface-container-low transition-colors">
                {row.map((cell, j) => (
                  <td key={j} className={`px-4 py-3 text-on-surface ${amountColumn(headers[j]) ? "text-right font-semibold tabular-nums text-on-primary-container" : ""}`}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td
                  colSpan={headers.length}
                  className="px-4 py-8 text-center text-on-surface-variant"
                >
                  <HrEmptyIllustration kind="payroll" className="mx-auto" />
                  <p className="mt-1 text-pretty text-sm">Không có dữ liệu trong phạm vi đã chọn.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {rows.length > 25 && (
        <div className="flex items-center justify-end gap-3 border-t border-outline-variant p-3 text-sm text-on-surface-variant">
          <button
            disabled={!safePage}
            onClick={() => setPage(safePage - 1)}
            className="rounded-md border border-outline-variant px-3 py-1 font-medium hover:bg-surface-container-low disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
          >
            Trước
          </button>
          <span className="text-xs font-semibold">
            {safePage + 1} / {Math.ceil(rows.length / 25)}
          </span>
          <button
            disabled={(safePage + 1) * 25 >= rows.length}
            onClick={() => setPage(safePage + 1)}
            className="rounded-md border border-outline-variant px-3 py-1 font-medium hover:bg-surface-container-low disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
          >
            Sau
          </button>
        </div>
      )}
    </div>
  );
}
export type Field = {
    key: string;
    label: string;
    type?: string;
    options?: [
        string,
        string
    ][];
    required?: boolean;
    initial?: string | number;
};
export function EntryForm({ title, fields, onSave, onClose }: {
  title: string;
  fields: Field[];
  onSave: (value: any) => Promise<void>;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    return () => { if (dialog.open && typeof dialog.close === "function") dialog.close(); else dialog.removeAttribute("open"); };
  }, []);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const values = Object.fromEntries(fields.map((field) => [
      field.key,
      field.type === "number" ? Number(form.get(field.key)) : String(form.get(field.key) || ""),
    ]));
    setBusy(true);
    setError("");
    try {
      await onSave(values);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không lưu được chứng từ.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onCancel={(event) => { if (busy) event.preventDefault(); }}
      aria-label={title}
      className="m-auto max-h-[90dvh] w-[min(100%-2rem,36rem)] rounded-md border border-outline-variant bg-surface-container-lowest p-0 text-on-surface shadow-xl backdrop:bg-inverse-surface/50"
    >
      <form onSubmit={save} className="max-h-[90dvh] space-y-3 overflow-y-auto p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-balance text-lg font-semibold">{title}</h2>
          <button type="button" disabled={busy} onClick={onClose} aria-label="Đóng" className="rounded-md p-2 focus-visible:outline-2 focus-visible:outline-primary" data-erp-modal-close>
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {fields.map((field) => (
            <label key={field.key} className="space-y-1 text-sm">
              <span>{field.label}</span>
              {field.options ? (
                <select className={`${inputClass} finance-select`} name={field.key} required={field.required !== false} defaultValue={field.initial}>
                  {field.options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              ) : (
                <input className={inputClass} name={field.key} type={field.type || "text"} required={field.required !== false} defaultValue={field.initial} min={field.type === "number" ? 0 : undefined} step={field.type === "number" ? "any" : undefined} />
              )}
            </label>
          ))}
        </div>
        {error && <p role="alert" className="text-sm text-error">{error}</p>}
        <button disabled={busy} className={buttonClass}>{busy ? "Đang lưu…" : "Lưu"}</button>
      </form>
    </dialog>
  );
}
export function exportCsv(name: string, headers: string[], rows: unknown[][]) {
    const escape = (value: unknown) => { let text = String(value ?? ""); if (/^[=+@-]/.test(text))
        text = `'${text}`; return `"${text.replace(/"/g, '""')}"`; };
    const blob = new Blob(["\uFEFF", [headers, ...rows].map(r => r.map(escape).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}
