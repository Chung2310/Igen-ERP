import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, Calculator, Download, Plus, RefreshCw, X } from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import { useBranchOptional } from "../../../context/BranchContext";
import { financialReportRequest as request } from "../api/financialReporting.api";
import { getStatConfig } from "../components/ManagementUI";

const money = (n: number) => (n || 0).toLocaleString("vi-VN") + " ₫";
const today = () => new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
const inputClass = "w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3.5 py-2 text-sm font-medium text-on-surface outline-none transition-all placeholder:text-on-surface-variant focus:border-primary focus:ring-4 focus:ring-primary disabled:bg-surface-container-low";
const buttonClass = "inline-flex items-center gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2 text-xs font-semibold text-on-surface transition-colors hover:bg-surface-container-low disabled:opacity-50";
const kinds: Record<string, string> = { customer: "Khách hàng", dealer: "Đại lý", collaborator: "CTV", supplier: "Nhà cung cấp" };
const buckets: Record<string, string> = { unscheduled: "Chưa có hạn trả", notDue: "Chưa đến hạn", dueToday: "Đến hạn hôm nay", "1-30": "Quá hạn 1–30 ngày", "31-60": "Quá hạn 31–60 ngày", "61-90": "Quá hạn 61–90 ngày", over90: "Quá hạn trên 90 ngày" };

type Field = { key: string; label: string; type?: string; options?: { value: string; label: string }[]; min?: number; max?: number; optional?: boolean };

export function EntryDialog({ title, fields, initial, onClose, onSave, note, submitLabel = "Lưu" }: { title: string; fields: Field[]; initial: any; onClose: () => void; onSave: (value: any) => Promise<void>; note?: string; submitLabel?: string }) {
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const busyRef = useRef(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const focus = document.activeElement as HTMLElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();

    const listener = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busyRef.current) closeRef.current();
      if (event.key !== "Tab") return;
      const elements = Array.from(ref.current?.querySelectorAll<HTMLElement>('input:not(:disabled), select:not(:disabled), button:not(:disabled)') || []);
      const first = elements[0];
      const last = elements.at(-1);
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && (document.activeElement === last || document.activeElement === ref.current)) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", listener);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", listener);
      focus?.focus();
    };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-container p-4 backdrop-blur-xs">
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-surface-container-lowest shadow-2xl outline-none"
      >
        <div className="flex items-center justify-between border-b border-outline-variant bg-surface-container-low px-6 py-4">
          <h2 className="text-base font-bold text-on-surface">{title}</h2>
          <button
            type="button"
            aria-label="Đóng"
            disabled={busy}
            onClick={onClose}
            className="rounded-xl border border-outline-variant p-2 text-on-surface-variant transition-colors hover:bg-surface-container-lowest hover:text-on-surface"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {note && (
            <div className="rounded-2xl border border-primary bg-primary-container p-4 text-xs font-medium whitespace-pre-line text-on-primary-container">
              {note}
            </div>
          )}
          {error && (
            <div role="alert" className="rounded-2xl border border-error bg-error-container p-4 text-xs font-medium text-on-error-container">
              {error}
            </div>
          )}

          <form
            id="entry-dialog-form"
            onSubmit={async (event) => {
              event.preventDefault();
              if (busyRef.current) return;
              busyRef.current = true;
              setBusy(true);
              setError("");
              try {
                await onSave(form);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                busyRef.current = false;
                setBusy(false);
              }
            }}
          >
            <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
              {fields.map((field) => (
                <label key={field.key} className="block text-xs font-semibold text-on-surface">
                  <span>{field.label}</span>
                  {field.options ? (
                    <select
                      className={inputClass + " mt-1.5"}
                      required={!field.optional}
                      value={form[field.key] ?? ""}
                      onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                    >
                      {field.options.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className={inputClass + " mt-1.5"}
                      required={!field.optional}
                      maxLength={field.type === "number" ? undefined : 240}
                      type={field.type || "text"}
                      min={field.min}
                      max={field.max}
                      step={field.type === "number" ? 1 : undefined}
                      value={form[field.key] ?? ""}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          [field.key]: field.type === "number" && e.target.value !== "" ? Number(e.target.value) : e.target.value,
                        })
                      }
                    />
                  )}
                </label>
              ))}
            </fieldset>
          </form>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-outline-variant bg-surface-container-low px-6 py-4">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded-xl border border-outline-variant bg-surface-container-lowest px-5 py-2.5 text-xs font-semibold text-on-surface transition-colors hover:bg-surface-container-low disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            form="entry-dialog-form"
            disabled={busy}
            className="rounded-xl bg-primary px-6 py-2.5 text-xs font-bold text-on-primary shadow-sm shadow-sm transition-all hover:shadow-md disabled:opacity-50"
          >
            {busy ? "Đang lưu…" : submitLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function Cards({ rows }: { rows: Array<[string, number | null, (boolean | string)?]> }) {
  return (
    <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
      {rows.map(([label, value, count]) => {
        const theme = getStatConfig(label);
        const Icon = theme.icon;
        return (
          <div
            key={label}
            className={`group relative flex flex-col justify-between overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest px-3.5 py-3 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${theme.borderColor}`}
          >
            <div className="flex items-start justify-between gap-2.5">
              <span className="text-[11px] sm:text-xs font-semibold text-on-surface-variant line-clamp-1 group-hover:text-on-surface transition-colors">
                {label}
              </span>
              <div
                className={`flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-105 ${theme.iconBg} ${theme.iconColor}`}
              >
                <Icon className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-1.5 min-w-0">
              <p
                className={`break-words ${
                  value == null
                    ? "text-xs sm:text-sm font-medium text-on-surface-variant"
                    : `text-base sm:text-lg font-bold ${
                        value < 0 ? "text-error" : theme.valueColor
                      }`
                }`}
              >
                {value == null
                  ? "Chưa xác định"
                  : count
                    ? value.toLocaleString("vi-VN") + " " + (count === true ? "máy" : count)
                    : money(value)}
              </p>
            </div>
            <div
              className={`absolute bottom-0 left-0 right-0 h-0.5 bg-primary opacity-0 group-hover:opacity-100 transition-opacity`}
            />
          </div>
        );
      })}
    </div>
  );
}

export function Table({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-outline-variant bg-surface-container-lowest shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-outline-variant bg-surface-container-low text-[11px] font-bold uppercase text-on-surface-variant">
            <tr>
              {headers.map((header) => (
                <th key={header} className="whitespace-nowrap px-5 py-3.5">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, i) => (
              <tr key={i} className="transition-colors hover:bg-surface-container-low">
                {row.map((cell, j) => (
                  <td key={j} className="px-5 py-4 align-top">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <p className="p-8 text-center text-sm font-medium text-on-surface-variant">Chưa có dữ liệu.</p>
        )}
      </div>
    </div>
  );
}

export function exportCsv(name: string, rows: unknown[][]) {
  const escape = (value: unknown) => {
    const str = String(value ?? "");
    return '"' + (/^[=+@\-\t\r]/.test(str) ? "'" : "") + str.replaceAll('"', '""') + '"';
  };
  const url = URL.createObjectURL(
    new Blob(["\uFEFF", rows.map((row) => row.map(escape).join(",")).join("\r\n")], {
      type: "text/csv;charset=utf-8",
    }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name + ".csv";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function FinancialReportsPage({ permissions }: { permissions: readonly string[] }) {
  const { userProfile } = useAuth();
  const branch = useBranchOptional();
  const scope = {
    ...(userProfile?.companyCode ? { companyCode: userProfile.companyCode } : {}),
    ...(branch?.activeBranchId ? { branchId: branch.activeBranchId } : {}),
  };
  const scopeKey = JSON.stringify(scope);
  const [view, setView] = useState("debts");
  const [mode, setMode] = useState("month");
  const [month, setMonth] = useState(today().slice(0, 7));
  const [year, setYear] = useState(today().slice(0, 4));
  const [quarter, setQuarter] = useState(String(Math.ceil(Number(today().slice(5, 7)) / 3)));
  const [from, setFrom] = useState(today().slice(0, 7) + "-01");
  const [to, setTo] = useState(today());
  const [warningDays, setWarningDays] = useState("5");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [dialog, setDialog] = useState<any>(null);
  const [sourceDocument, setSourceDocument] = useState<any>(null);
  const currentScope = useRef(scopeKey); currentScope.current = scopeKey;
  const showDocument = async (r: any) => { try { const document = await request(`/documents/${r.source}/${r.sourceId}`, scope as Record<string, string>); if (currentScope.current === scopeKey) setSourceDocument({ ...document, scopeKey }); } catch (e) { if (currentScope.current === scopeKey) setError((e as Error).message); } };
  const documentLink = (r: any) => r.sourceId ? <button className="font-semibold text-on-primary-container underline" onClick={() => showDocument(r)}>{r.code || r.reference}</button> : r.code || r.reference;
  const [partyFilter, setPartyFilter] = useState("");
  const [agingFilter, setAgingFilter] = useState("");
  const canManage = permissions.includes("*") || permissions.includes("finance-wallet:manage");
  const period = mode === "quarter" ? `${year}-Q${quarter}` : mode === "year" ? year : month;
  const query =
    view === "debts"
      ? { warningDays }
      : view === "breakeven"
        ? { month }
        : mode === "custom" && view === "profit"
          ? { from, to }
          : { period: view === "vat" && !["quarter", "month"].includes(mode) ? month : period };
  const requestKey = JSON.stringify({ scope, view, query });
  const [loadedKey, setLoadedKey] = useState("");
  const visible = loadedKey === requestKey ? data : null;

  useEffect(() => {
    setDialog(null); setSourceDocument(null);
  }, [scopeKey, view]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setData(null);
    request(`/${view}`, { ...scope, ...query } as Record<string, string>, "GET", undefined, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setData(result);
          setLoadedKey(requestKey);
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [requestKey, revision]);

  const open = (title: string, fields: Field[], initial: any, path: string, method = "POST", note = "") =>
    setDialog({ title, fields, initial, path, method, note, scopeKey });
  const numeric = (key: string, label: string, min = 0): Field => ({ key, label, type: "number", min });

  const newDebt = (receipt?: any) =>
    open(
      "Ghi nhận công nợ",
      [
        { key: "direction", label: "Loại nợ", options: [{ value: "receivable", label: "Phải thu" }, { value: "payable", label: "Phải trả NCC" }] },
        { key: "partyKind", label: "Nhóm đối tượng", options: Object.entries(kinds).map(([value, label]) => ({ value, label })) },
        { key: "partyName", label: "Tên khách / đối tác" },
        { key: "reference", label: "Số chứng từ" },
        numeric("amount", "Số tiền còn nợ (₫)", receipt ? 0 : 1),
        { key: "occurredOn", label: "Ngày ghi nhận", type: "date" },
        { key: "dueOn", label: "Hạn thanh toán", type: "date" },
      ],
      {
        direction: receipt ? "payable" : "receivable",
        partyKind: receipt ? "supplier" : "customer",
        partyName: receipt?.supplierName || "",
        reference: receipt?.receiptCode || "",
        amount: receipt?.subtotal || "",
        occurredOn: today(),
        dueOn: today(),
        ...(receipt ? { sourceReceiptId: receipt._id } : {}),
      },
      "/debts",
      "POST",
    );

  const newInvoice = () =>
    open(
      "Ghi nhận hóa đơn VAT",
      [
        { key: "direction", label: "Bảng kê", options: [{ value: "input", label: "Đầu vào" }, { value: "output", label: "Đầu ra" }] },
        { key: "series", label: "Ký hiệu hóa đơn" },
        { key: "invoiceNumber", label: "Số hóa đơn" },
        { key: "issuedOn", label: "Ngày hóa đơn", type: "date" },
        { key: "partyName", label: "Tên khách / nhà cung cấp" },
        { key: "taxId", label: "Mã số thuế (bắt buộc với đầu vào)", optional: true },
        numeric("taxableAmount", "Giá trị trước VAT (₫)", -1e14),
        numeric("vatAmount", "Tiền VAT trên hóa đơn (₫)", -1e14),
        numeric("deductibleVat", "VAT đầu vào đủ điều kiện khấu trừ (₫)", -1e14),
        {
          key: "adjustmentOf",
          label: "Điều chỉnh cho hóa đơn (nếu có)",
          optional: true,
          options: [
            { value: "", label: "Hóa đơn thông thường" },
            ...(visible?.adjustmentOptions || []).map((item: any) => ({
              value: item._id,
              label: `${item.issuedOn} · ${item.series}/${item.invoiceNumber} · ${item.partyName}`,
            })),
          ],
        },
        { key: "note", label: "Ghi chú", optional: true },
      ],
      { direction: "input", issuedOn: today(), deductibleVat: 0, adjustmentOf: "" },
      "/vat/invoices",
      "POST",
      "Báo cáo theo phương pháp khấu trừ. Nhập số VAT từ hóa đơn thực tế; chỉ nhập phần đủ điều kiện khấu trừ. Hóa đơn đầu ra bỏ qua trường VAT đầu vào. Số âm dùng cho điều chỉnh giảm.",
    );

  const newExpense = () =>
    open(
      "Ghi nhận chi phí thực tế",
      [
        {
          key: "category",
          label: "Nhóm chi phí",
          options: [
            { value: "rent", label: "Mặt bằng" },
            { value: "utilities", label: "Điện nước" },
            { value: "marketing", label: "Marketing" },
            { value: "payroll_manual", label: "Lương ngoài bảng lương" },
            { value: "income_tax", label: "Thuế thu nhập doanh nghiệp" },
            { value: "other", label: "Chi phí khác" },
          ],
        },
        { key: "description", label: "Nội dung / chứng từ" },
        numeric("amount", "Chi phí ghi nhận (₫)", 1),
        { key: "incurredOn", label: "Ngày phát sinh", type: "date" },
      ],
      { category: "rent", incurredOn: today(), key: crypto.randomUUID() },
      "/expenses",
      "POST",
      "Nhập chi phí sau khi loại VAT được khấu trừ. Không nhập lại lương đã có trong bảng lương chốt, hoa hồng hoặc khấu hao: hệ thống đã tổng hợp các khoản đó.",
    );

  const download = () => {
    if (!visible) return;
    if (view === "vat")
      exportCsv(`vat-${period}`, [
        ["Loại", "Ngày", "Ký hiệu", "Số HĐ", "Đối tác", "MST", "Trước thuế", "VAT", "Khấu trừ"],
        ...visible.items.map((r: any) => [
          r.direction,
          r.issuedOn,
          r.series,
          r.invoiceNumber,
          r.partyName,
          r.taxId,
          r.taxableAmount,
          r.vatAmount,
          r.deductibleVat,
        ]),
        [],
        ...Object.entries(visible.totals),
      ]);
    if (view === "debts")
      exportCsv("cong-no-" + visible.asOf, [
        ["Đối tượng", "Nhóm", "Chứng từ", "Loại nợ", "Còn nợ", "Hạn trả", "Tuổi nợ"],
        ...visible.items.map((r: any) => [
          r.partyName,
          kinds[r.partyKind],
          r.reference,
          r.direction,
          r.balance,
          r.dueOn,
          buckets[r.bucket],
        ]),
      ]);
    if (view === "profit")
      exportCsv("lai-lo-" + visible.range.from + "-" + visible.range.to, [
        ["Trạng thái", visible.completeness?.label || "Tạm tính"],
        ...(visible.completeness?.issues || []).map((issue: string) => ["Cần kiểm tra", issue]),
        ["Chỉ tiêu", "Số tiền"],
        ...Object.entries(visible.totals).filter(([, value]) => typeof value === "number"),
        [],
        ["Ngày", "Chứng từ", "Nguồn", "Doanh thu", "Giá vốn", "Lãi gộp"],
        ...visible.movements.map((r: any) => [r.date, r.code, r.source, r.revenue, r.cost, r.grossProfit]),
        [], ["Ngày", "Chi phí", "Nguồn", "Số tiền"],
        ...(visible.expenseDetails || []).map((r: any) => [r.date, r.reference, r.source, r.amount]),
      ]);
    if (view === "breakeven")
      exportCsv("hoa-von-" + month, [
        ["Ngày", "Đóng góp", "Lũy kế", "Còn thiếu"],
        ...visible.result.series.map((r: any) => [r.date, r.contribution, r.cumulative, r.remaining]),
      ]);
  };

  return (
    <section className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col gap-4 rounded-3xl border border-outline-variant bg-surface-container-lowest p-6 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-on-primary shadow-md shadow-sm">
            <Calculator className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-on-surface">Báo cáo tài chính</h1>
            <p className="text-xs text-on-surface-variant">
              {branch?.activeBranch?.name || "Chi nhánh hiện tại"} · Đơn vị VND · Múi giờ Việt Nam
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className={buttonClass}
            onClick={() => setRevision((r) => r + 1)}
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Tải lại
          </button>
          <button type="button" className={buttonClass} disabled={!visible} onClick={download}>
            <Download size={14} />
            Xuất CSV
          </button>
        </div>
      </div>

      {/* Sub-view selection tabs */}
      <div className="flex gap-1.5 overflow-x-auto rounded-2xl border border-outline-variant bg-surface-container-low p-1.5 shadow-xs">
        {[
          ["debts", "Công nợ tổng hợp"],
          ["vat", "Thuế VAT"],
          ["profit", "Lãi lỗ / Xả lỗ"],
          ["breakeven", "Điểm hòa vốn"],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setView(key)}
            className={`whitespace-nowrap rounded-xl px-4 py-2 text-xs font-semibold transition-all sm:text-sm ${view === key
                ? "bg-primary text-on-primary shadow-sm shadow-sm"
                : "text-on-surface-variant hover:bg-surface-container-lowest hover:text-on-surface"
              }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Filter and Command Toolbar */}
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 shadow-xs">
        {view === "debts" ? (
          <>
            <label className="text-xs font-semibold text-on-surface">
              <span>Cảnh báo NCC trước hạn</span>
              <select
                aria-label="Cảnh báo NCC trước hạn"
                className={inputClass + " mt-1"}
                value={warningDays}
                onChange={(e) => setWarningDays(e.target.value)}
              >
                {[3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n} ngày
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold text-on-surface">
              <span>Đối tượng</span>
              <select
                aria-label="Đối tượng"
                className={inputClass + " mt-1"}
                value={partyFilter}
                onChange={(e) => setPartyFilter(e.target.value)}
              >
                <option value="">Tất cả</option>
                {Object.entries(kinds).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold text-on-surface">
              <span>Tuổi nợ</span>
              <select
                aria-label="Tuổi nợ"
                className={inputClass + " mt-1"}
                value={agingFilter}
                onChange={(e) => setAgingFilter(e.target.value)}
              >
                <option value="">Tất cả</option>
                {Object.entries(buckets).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : (
          <>
            {view !== "breakeven" && (
              <label className="text-xs font-semibold text-on-surface">
                <span>Kỳ báo cáo</span>
                <select
                  aria-label="Kỳ báo cáo"
                  className={inputClass + " mt-1"}
                  value={view === "vat" && !["quarter", "month"].includes(mode) ? "month" : mode}
                  onChange={(e) => setMode(e.target.value)}
                >
                  <option value="month">Tháng</option>
                  <option value="quarter">Quý</option>
                  {view === "profit" && (
                    <>
                      <option value="year">Năm</option>
                      <option value="custom">Từ ngày – đến ngày</option>
                    </>
                  )}
                </select>
              </label>
            )}
            {view === "breakeven" || mode === "month" || (view === "vat" && !["quarter", "month"].includes(mode)) ? (
              <label className="text-xs font-semibold text-on-surface">
                <span>Tháng</span>
                <input
                  type="month"
                  aria-label="Tháng"
                  className={inputClass + " mt-1"}
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                />
              </label>
            ) : mode === "custom" ? (
              <>
                <label className="text-xs font-semibold text-on-surface">
                  <span>Từ ngày</span>
                  <input
                    type="date"
                    aria-label="Từ ngày"
                    className={inputClass + " mt-1"}
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                  />
                </label>
                <label className="text-xs font-semibold text-on-surface">
                  <span>Đến ngày</span>
                  <input
                    type="date"
                    aria-label="Đến ngày"
                    className={inputClass + " mt-1"}
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                  />
                </label>
              </>
            ) : (
              <>
                <label className="text-xs font-semibold text-on-surface">
                  <span>Năm</span>
                  <input
                    type="number"
                    min="2000"
                    max="2100"
                    aria-label="Năm"
                    className={inputClass + " mt-1"}
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                  />
                </label>
                {mode === "quarter" && (
                  <label className="text-xs font-semibold text-on-surface">
                    <span>Quý</span>
                    <select
                      aria-label="Quý"
                      className={inputClass + " mt-1"}
                      value={quarter}
                      onChange={(e) => setQuarter(e.target.value)}
                    >
                      {[1, 2, 3, 4].map((q) => (
                        <option key={q}>{q}</option>
                      ))}
                    </select>
                  </label>
                )}
              </>
            )}
          </>
        )}

        {canManage && (
          <button
            type="button"
            className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-on-primary shadow-sm shadow-sm transition-all hover:shadow-md disabled:opacity-50"
            onClick={() =>
              view === "debts"
                ? newDebt()
                : view === "vat"
                  ? newInvoice()
                  : view === "profit"
                    ? newExpense()
                    : open(
                      "Dự toán hòa vốn tháng " + month,
                      [
                        numeric("rent", "Mặt bằng / tháng (₫)"),
                        numeric("payroll", "Lương / tháng (₫)"),
                        numeric("otherFixed", "Định phí khác / tháng (₫)"),
                        numeric("expectedUnitPrice", "Giá bán bình quân / máy, chưa VAT (₫)"),
                        numeric("expectedUnitCost", "Giá vốn bình quân / máy (₫)"),
                        numeric("variableCostPerUnit", "Biến phí khác / máy, chưa gồm hoa hồng (₫)"),
                        numeric("expectedCommissionPerUnit", "Hoa hồng dự kiến / máy (₫)"),
                      ],
                      visible?.plan || {
                        month,
                        rent: 0,
                        payroll: 0,
                        otherFixed: 0,
                        expectedUnitPrice: 0,
                        expectedUnitCost: 0,
                        variableCostPerUnit: 0,
                        expectedCommissionPerUnit: 0,
                        version: 0,
                      },
                      "/plan",
                      "PUT",
                      "Dự toán chỉ dùng tính mục tiêu hòa vốn, không tự ghi thành chi phí thực tế. Dùng giá bình quân chưa VAT. Mốc thực tế dùng lãi gộp trừ hoa hồng và biến phí khác.",
                    )
            }
            disabled={view === "breakeven" && !visible}
          >
            <Plus size={14} />
            {view === "debts" ? "Ghi nhận nợ" : view === "vat" ? "Thêm hóa đơn" : view === "profit" ? "Thêm chi phí" : "Cấu hình hòa vốn"}
          </button>
        )}
      </div>

      {error && (
        <div role="alert" className="rounded-2xl border border-error bg-error-container p-4 text-sm font-medium text-on-error-container">
          {error}
        </div>
      )}

      {loading && (
        <div role="status" className="flex flex-col items-center justify-center py-12 text-on-surface-variant">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-cyan-600" />
          <p className="mt-3 text-sm font-medium">Đang tính báo cáo…</p>
        </div>
      )}

      {visible?.completeness && <div role="status" className="rounded-2xl border border-tertiary bg-tertiary-container p-4 text-sm text-on-tertiary-container"><strong>{visible.completeness.label}</strong>{visible.completeness.issues.map((issue: string) => <p key={issue} className="mt-1">{issue}</p>)}</div>}

      {/* View 1: Debts / Công nợ tổng hợp */}
      {visible && view === "debts" && (
        <div className="space-y-4">
          <Cards
            rows={[
              ["Phải thu", visible.totals.receivable],
              ["Phải thu quá hạn", visible.totals.overdueReceivable],
              ["Phải trả NCC", visible.totals.payable],
              ["NCC cần thanh toán / quá hạn", visible.totals.upcomingPayable],
            ]}
          />

          <p className="text-xs text-on-surface-variant">
            Số dư hiện tại ngày {visible.asOf}. Nhắc trong ứng dụng chạy hằng ngày từ 08:15; NCC được cảnh báo trong 5 ngày trước hạn. Không tự gửi tin nhắn cho đối tác.
          </p>

          <Table
            headers={["Đối tượng", "Nhóm", "Chứng từ", "Còn nợ", "Hạn trả / Tuổi nợ", "Thao tác"]}
            rows={visible.items
              .filter((r: any) => (!partyFilter || r.partyKind === partyFilter) && (!agingFilter || r.bucket === agingFilter))
              .map((r: any) => [
                r.partyName,
                kinds[r.partyKind],
                r.reference,
                <span className={r.alert ? "font-bold text-error" : "font-semibold text-on-surface"}>{money(r.balance)}</span>,
                <>
                  <span className="font-medium text-on-surface">{r.dueOn || "Chưa có hạn trả"}</span>
                  <p className="text-xs text-on-surface-variant">{buckets[r.bucket]}</p>
                </>,
                r.source === "manual" && canManage ? (
                  <button
                    className="font-bold text-on-primary-container hover:text-on-primary-container"
                    onClick={() =>
                      open(
                        r.direction === "payable" ? "Ghi nhận thanh toán NCC" : "Ghi nhận thu nợ",
                        [{ ...numeric("amount", "Số tiền (₫)", 1), max: r.balance }, { key: "reference", label: "Tham chiếu thanh toán", optional: true }],
                        { amount: r.balance, key: crypto.randomUUID(), version: r.version },
                        `/debts/${r.id}/payments`,
                        "POST",
                        "Dùng để ghi nhận khoản đã thanh toán ngoài sổ quỹ. Sau đó gán giao dịch tại Sổ quỹ → Giao dịch nguồn. Nếu cần duyệt trước khi thanh toán, lập phiếu tại Sổ quỹ → Phiếu thu / chi.",
                      )
                    }
                  >
                    Thanh toán
                  </button>
                ) : (
                  <span className="text-xs text-on-surface-variant">
                    Xử lý tại {r.source === "receivable" ? "Công nợ" : r.source === "repair" ? "Sửa chữa" : "Bán hàng"}
                  </span>
                ),
              ])}
          />

          <Table
            headers={["Nhóm", ...Object.values(buckets)]}
            rows={Object.entries(visible.aging).map(([kind, amounts]: [string, any]) => [
              kinds[kind],
              ...Object.keys(buckets).map((b) => money(amounts[b] || 0)),
            ])}
          />

          {!!visible.unrecordedReceipts.length && (
            <details className="overflow-hidden rounded-2xl border border-tertiary bg-tertiary-container p-4">
              <summary className="cursor-pointer text-sm font-bold text-on-tertiary-container">
                {visible.unrecordedReceipts.length} phiếu nhập chưa đối soát công nợ
              </summary>
              <p className="my-3 text-xs text-on-tertiary-container">
                Phiếu nhập cũ chưa có hạn trả và số tiền đã thanh toán. Xác nhận khoản còn nợ để đưa vào cảnh báo; không mặc định mọi phiếu nhập đều còn nợ.
              </p>
              <Table
                headers={["Phiếu nhập", "NCC", "Giá trị", "Thao tác"]}
                rows={visible.unrecordedReceipts.map((r: any) => [
                  r.receiptCode,
                  r.supplierName,
                  money(r.subtotal),
                  canManage && (
                    <button onClick={() => newDebt(r)} className="font-bold text-on-primary-container hover:underline">
                      Đối soát công nợ
                    </button>
                  ),
                ])}
              />
            </details>
          )}
        </div>
      )}

      {/* View 2: VAT / Thuế VAT */}
      {visible && view === "vat" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-primary bg-primary-container p-4 text-xs text-on-primary-container">
            Bảng kê theo phương pháp khấu trừ, dựa trên hóa đơn đã nhập. Phiếu bán/nhập kho không tự coi là hóa đơn thuế. Số dư đầu kỳ cần xác nhận cho từng tháng hoặc quý, không cộng dồn đồng thời cả hai.
          </div>

          <Cards
            rows={[
              ["VAT đầu ra", visible.totals.outputVat],
              ["VAT đầu vào đủ điều kiện khấu trừ", visible.totals.deductibleVat],
              ["VAT phải nộp", visible.totals.payable],
              ["VAT chuyển kỳ sau", visible.totals.closingCredit],
            ]}
          />

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 text-sm">
            <span>
              Khấu trừ chuyển từ kỳ trước: <strong>{money(visible.totals.openingCredit)}</strong>{" "}
              {visible.openingCreditConfirmed ? "(đã xác nhận)" : "(chưa xác nhận)"}
            </span>
            {canManage && (
              <button
                className={buttonClass}
                onClick={() =>
                  open(
                    "Xác nhận VAT đầu kỳ",
                    [numeric("openingCredit", "VAT còn được khấu trừ kỳ trước (₫)")],
                    visible.settings,
                    "/vat/period",
                    "PUT",
                    "Lấy số đã đối soát từ kỳ kê khai trước. Không cộng lại số khấu trừ của các tháng nằm trong quý này.",
                  )
                }
              >
                Cập nhật đầu kỳ
              </button>
            )}
          </div>

          {["input", "output"].map((direction) => (
            <div key={direction} className="space-y-2">
              <h3 className="text-sm font-bold text-on-surface">
                Bảng kê {direction === "input" ? "đầu vào" : "đầu ra"}
              </h3>
              <Table
                headers={["Ngày / Số hóa đơn", "Đối tác / MST", "Trước VAT", "VAT", "Khấu trừ"]}
                rows={visible.items
                  .filter((r: any) => r.direction === direction)
                  .map((r: any) => [
                    <>
                      <span className="font-medium text-on-surface">{r.issuedOn}</span>
                      <p className="font-semibold text-on-surface">
                        {r.series}/{r.invoiceNumber}
                      </p>
                      {r.adjustmentOf && <small className="text-on-primary-container">Điều chỉnh</small>}
                    </>,
                    <>
                      <span className="font-medium text-on-surface">{r.partyName}</span>
                      <p className="text-xs text-on-surface-variant">{r.taxId}</p>
                    </>,
                    money(r.taxableAmount),
                    money(r.vatAmount),
                    direction === "input" ? money(r.deductibleVat) : "—",
                  ])}
              />
            </div>
          ))}
        </div>
      )}

      {/* View 3: Profit / Lãi lỗ */}
      {visible && view === "profit" && (
        <div className="space-y-4">
          <Cards
            rows={[
              ["Doanh thu", visible.totals.revenue],
              ["Giá vốn", visible.totals.costOfGoods],
              ["Lợi nhuận gộp", visible.totals.grossProfit],
              ["Lợi nhuận ròng đã ghi nhận", visible.totals.netProfit],
            ]}
          />

          <Table
            headers={["Chỉ tiêu", "Số tiền"]}
            rows={[
              ["Chi phí mặt bằng", money(visible.totals.rent)],
              ["Chi phí lương", money(visible.totals.payroll)],
              ["Hoa hồng phát sinh", money(visible.totals.commission)],
              ["Chi phí khác / khấu hao", money(visible.totals.otherExpenses)],
              ["Lợi nhuận trước thuế", money(visible.totals.profitBeforeTax)],
              ["Thuế TNDN đã ghi nhận", money(visible.totals.incomeTax)],
              ["Lợi nhuận ròng đã ghi nhận", money(visible.totals.netProfit)],
            ]}
          />

          <div className="space-y-2">
            <h3 className="text-sm font-bold text-on-surface">Bán dưới giá vốn</h3>
            <p className="text-xs text-on-surface-variant">
              Giữ giá vốn gốc tại lúc bán. Khoản lỗ đã nằm trong lợi nhuận gộp, không cộng thêm lần nữa vào chi phí. Đây là lỗ đã phát sinh; chưa phải dự phòng giảm giá hàng chưa bán.
            </p>
            <Table
              headers={["Ngày", "Chứng từ", "Doanh thu", "Giá vốn", "Lỗ gộp"]}
              rows={visible.lossSales.map((r: any) => [
                r.date,
                documentLink(r),
                money(r.revenue),
                money(r.cost),
                <strong className="text-error">{money(r.grossProfit)}</strong>,
              ])}
            />
          </div>

          <details className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-4">
            <summary className="cursor-pointer text-sm font-bold text-on-surface">
              Chi tiết doanh thu và giá vốn
            </summary>
            <div className="mt-3">
              <Table
                headers={["Ngày", "Chứng từ", "Nguồn", "Doanh thu", "Giá vốn", "Lãi gộp"]}
                rows={visible.movements.map((r: any) => [
                  r.date,
                  documentLink(r),
                  r.source,
                  money(r.revenue),
                  money(r.cost),
                  money(r.grossProfit),
                ])}
              />
            </div>
          </details>
        </div>
      )}

      {visible && view === "profit" && <details className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-4"><summary className="cursor-pointer font-bold">Chi tiết chi phí cấu thành lợi nhuận</summary><Table headers={["Ngày / kỳ", "Nhóm", "Chứng từ", "Số tiền phân bổ trong kỳ"]} rows={(visible.expenseDetails || []).map((r: any) => [r.date, r.category, documentLink(r), money(r.amount)])} /></details>}
      {/* View 4: Breakeven / Điểm hòa vốn */}
      {visible && view === "breakeven" && (
        <div className="space-y-4">
          {canManage && <button className={buttonClass} onClick={() => open("Cơ cấu bán dự kiến", ["phone", "accessory", "repair"].flatMap(segment => { const label = ({ phone: "Điện thoại", accessory: "Phụ kiện", repair: "Sửa chữa" } as any)[segment]; return [numeric(segment + "_weight", label + " — tỷ trọng số lượng (%)"), numeric(segment + "_price", label + " — giá bán chưa VAT"), numeric(segment + "_cost", label + " — giá vốn"), numeric(segment + "_variable", label + " — biến phí khác"), numeric(segment + "_commission", label + " — hoa hồng")]; }), { ...visible.plan, editMix: true, ...Object.fromEntries(["phone", "accessory", "repair"].flatMap(segment => ["weight", "price", "cost", "variable", "commission"].map(field => [segment + "_" + field, visible.plan.salesMix?.find((r: any) => r.segment === segment)?.[field] || 0]))) }, "/plan", "PUT", "Tỷ trọng theo số lượng máy, phụ kiện và lượt sửa chữa; tổng 100%. Nhóm không kinh doanh để 0%. Tổng 0% sẽ trở lại mô hình bình quân mỗi máy.")}>Cấu hình cơ cấu bán</button>}
          {!!visible.result.mixUnits?.length && <Table headers={["Nhóm", "Số lượng theo cơ cấu để hòa vốn"]} rows={visible.result.mixUnits.map((r: any) => [({ phone: "Điện thoại", accessory: "Phụ kiện", repair: "Lượt sửa chữa" } as any)[r.segment], r.units ?? "Chưa xác định"])} />}
          {visible.actualExpenses && <Table headers={["Khoản chi", "Dự toán", "Đã ghi nhận", "Chênh lệch thực tế − dự toán"]} rows={([["rent", "Mặt bằng"], ["payroll", "Lương"], ["otherFixed", "Chi phí khác (thực tế gồm cả khoản không cố định)"]]).map(([key, label]) => [label, money(visible.plan[key] || 0), money(visible.actualExpenses[key] || 0), money((visible.actualExpenses[key] || 0) - (visible.plan[key] || 0))])} />}
          {!visible.configured && (
            <div className="rounded-2xl border border-tertiary bg-tertiary-container p-4 text-xs text-on-tertiary-container">
              Chưa cấu hình định phí và giá bán/giá vốn dự kiến cho tháng này.
            </div>
          )}

          <Cards
            rows={[
              ["Định phí mục tiêu", visible.configured ? visible.result.fixedCosts : null],
              ["Doanh thu tối thiểu hòa vốn", visible.configured ? visible.result.revenue : null],
              [visible.plan.salesMix?.length ? "Số đơn vị dự kiến theo cơ cấu" : "Số máy tối thiểu hòa vốn", visible.configured ? visible.result.units : null, visible.plan.salesMix?.length ? "đơn vị" : true],
              ["Đóng góp thực tế còn thiếu", visible.configured ? visible.result.remaining : null],
            ]}
          />

          <div className="rounded-3xl border border-outline-variant bg-surface-container-lowest p-6 shadow-xs">
            <p className="text-base font-bold text-on-surface">
              {!visible.configured
                ? "Cần cấu hình trước khi đánh giá hòa vốn"
                : visible.result.firstReachedOn
                  ? `Ngày đầu đạt hòa vốn: ${visible.result.firstReachedOn}`
                  : "Chưa đạt hòa vốn trong tháng"}
            </p>
            <p className="mt-2 text-sm text-on-surface-variant">
              {visible.configured &&
                (visible.result.currentlyReached
                  ? "Đóng góp lũy kế hiện đang đủ bù định phí."
                  : "Đóng góp lũy kế hiện chưa đủ bù định phí; hoàn hàng hoặc đơn bán lỗ có thể làm giảm kết quả.")}
            </p>
            {visible.configured && visible.result.unitContribution <= 0 && (
              <p className="mt-2 text-sm font-semibold text-error">
                Lãi đóng góp mỗi máy không dương: bán thêm theo mức giá/chi phí này không thể bù định phí.
              </p>
            )}
            <p className="mt-3 text-xs text-on-surface-variant">
              Số lượng là kịch bản theo giá bình quân hoặc cơ cấu đã cấu hình; từng nhóm được làm tròn lên, không phải cam kết sản lượng thực tế. Mốc ngày dùng đóng góp thực tế của các nguồn doanh thu, sau hoa hồng và biến phí ước tính; không phải thời điểm dòng tiền thu về.
            </p>
          </div>

          <Table
            headers={["Ngày", "Đóng góp trong ngày", "Lũy kế", "Còn thiếu"]}
            rows={visible.result.series.map((r: any) => [
              r.date,
              money(r.contribution),
              money(r.cumulative),
              money(r.remaining),
            ])}
          />
        </div>
      )}

      {!!visible?.warnings?.length && (
        <div className="space-y-2 rounded-2xl border border-tertiary bg-tertiary-container p-4 text-xs text-on-tertiary-container">
          <p className="flex items-center gap-2 font-bold">
            <AlertCircle size={16} />
            Cơ sở số liệu cần lưu ý
          </p>
          {visible.warnings.map((warning: string) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      )}

      {sourceDocument?.scopeKey === scopeKey && <EntryDialog submitLabel="Đóng" title={"Chứng từ " + sourceDocument.code} fields={[]} initial={{}} onClose={() => setSourceDocument(null)} onSave={async () => setSourceDocument(null)} note={[
        "Nguồn: " + sourceDocument.source, "Trạng thái: " + sourceDocument.status, "Ngày: " + (sourceDocument.date ? new Date(sourceDocument.date).toLocaleDateString("vi-VN") : "—"), sourceDocument.partyName, sourceDocument.description, "Giá trị chứng từ: " + money(sourceDocument.amount || 0), ...sourceDocument.items.map((i: any) => i.name + " · SL " + i.quantity + " · Vốn " + money(i.unitCost || 0) + " · Thành tiền " + money(i.lineTotal || 0)), "Số tiền gốc có thể khác số phân bổ trong báo cáo (VAT, trả hàng, phân bổ theo ngày)."
      ].filter(Boolean).join("\n")} />}
      {dialog && dialog.scopeKey === scopeKey && (
        <EntryDialog
          {...dialog}
          onClose={() => setDialog(null)}
          onSave={async (values) => {
            if (values.editMix) values = { ...values, salesMix: ["phone", "accessory", "repair"].map(segment => ({ segment, ...Object.fromEntries(["weight", "price", "cost", "variable", "commission"].map(field => [field, Number(values[segment + "_" + field] || 0)])) })).filter((r: any) => r.weight > 0) };
            await request(dialog.path, scope as Record<string, string>, dialog.method, values);
            setDialog(null);
            setRevision((r) => r + 1);
          }}
        />
      )}
    </section>
  );
}
