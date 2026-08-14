import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, CheckCircle2, FileSpreadsheet, Inbox, Lock, Play, RefreshCw, Search, Trash2, X } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "../../pages/Toast";
import { payrollService } from "../../services/payrollService";
import { buildPayrollDetails } from "./payrollDetails";
import { PAYROLL_FORMULA_LIBRARY_ENABLED } from "../../config/payrollFeatureFlags";
import { PayrollReviewQueue } from "./payroll/PayrollReviewQueue";
import { PayrollPayslipsPanel } from "./payroll/PayrollPayslipsPanel";
import { PayrollReopenModal } from "./payroll/PayrollReopenModal";
import { canMarkPayrollPaid } from "./payroll/payrollPaidAction";
import { getPayrollProcessingAction, hasActivePolicyForMonth } from "./payroll/payrollProcessingAction";
import { PayrollPolicyManager } from "./payroll/PayrollPolicyManager";
import { PayrollFormulaLibrary } from "./payroll/PayrollFormulaLibrary";
import { PayrollCustomVariableManager } from "./payroll/PayrollCustomVariableManager";
import {
  PAYROLL_RESULT_FIELDS,
  buildLineOverrideRows,
  previewPayrollLine,
  restoreLineOverrideDraftField,
  retainFailedLineOverrideDrafts,
  setLineOverrideDraftValue,
  type PayrollLineOverrideDrafts,
  type PayrollLineOverrideField,
} from "./payroll/payrollLineOverrides";

type SortDir = "asc" | "desc";

function EmptyState({ icon: Icon, title, hint }: { icon: typeof Inbox; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 p-10 text-center">
      <Icon size={28} className="text-slate-300" />
      <p className="text-sm font-medium text-slate-500">{title}</p>
      {hint && <p className="text-xs text-slate-400 max-w-sm">{hint}</p>}
    </div>
  );
}

function SortHeader({ label, sortKey, activeKey, dir, onSort, align = "left" }: { label: string; sortKey: string; activeKey: string; dir: SortDir; onSort: (key: string) => void; align?: "left" | "right" | "center" }) {
  const isActive = activeKey === sortKey;
  const Icon = isActive ? (dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <th
      onClick={() => onSort(sortKey)}
      className={`p-3 font-semibold text-slate-500 cursor-pointer select-none whitespace-nowrap ${align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"}`}
    >
      <span className={`inline-flex items-center gap-1 ${align === "right" ? "flex-row-reverse" : ""}`}>
        {label}
        <Icon size={12} className={isActive ? "text-slate-600" : "text-slate-300"} />
      </span>
    </th>
  );
}

function ConfirmModal({ open, title, description, confirmLabel = "Xác nhận", onConfirm, onCancel, loading }: { open: boolean; title: string; description: string; confirmLabel?: string; onConfirm: () => void; onCancel: () => void; loading?: boolean }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" onClick={onCancel}>
      <div className="w-full max-w-sm max-h-[90dvh] overflow-y-auto overscroll-contain rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3 p-4 sm:p-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-100">
            <AlertTriangle size={20} className="text-rose-600" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-slate-900">{title}</h3>
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          </div>
          <button onClick={onCancel} className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer">
            <X size={16} />
          </button>
        </div>
        <div className="flex justify-end gap-2 rounded-b-2xl border-t border-slate-100 bg-slate-50 px-4 py-3 sm:px-5">
          <button onClick={onCancel} disabled={loading} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 cursor-pointer hover:bg-slate-50 disabled:opacity-50">
            Hủy
          </button>
          <button onClick={onConfirm} disabled={loading} className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-sm font-medium text-white cursor-pointer hover:bg-rose-700 disabled:opacity-50">
            {loading && <RefreshCw size={14} className="animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

const STEPS = [
  { key: "draft", label: "Nháp" },
  { key: "review", label: "Kiểm tra" },
  { key: "closed", label: "Chốt" },
  { key: "paid", label: "Đã thanh toán" },
] as const;

export default function PayrollTab({ canManage }: { canManage: boolean }) {
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7));
  const [run, setRun] = useState<any>(null);
  const [results, setResults] = useState<any[]>([]);
  const [adjustments, setAdjustments] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("employeeName");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [formulaRow, setFormulaRow] = useState<any>(null);
  const [formulaLoading, setFormulaLoading] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [markPaidConfirmOpen, setMarkPaidConfirmOpen] = useState(false);
  const [markingPaid, setMarkingPaid] = useState(false);
  const [processingPayroll, setProcessingPayroll] = useState(false);
  const [payrollPolicies, setPayrollPolicies] = useState<any[]>([]);
  const [policiesLoaded, setPoliciesLoaded] = useState(false);
  const [lineOverrides, setLineOverrides] = useState<any[]>([]);
  const [customVariables, setCustomVariables] = useState<any[]>([]);
  const [inputDrafts, setInputDrafts] = useState<PayrollLineOverrideDrafts>({});
  const [inputErrors, setInputErrors] = useState<Record<string, string>>({});
  const [inputSaveOpen, setInputSaveOpen] = useState(false);
  const [inputReason, setInputReason] = useState("");
  const [inputSaving, setInputSaving] = useState(false);

  // States for creating adjustments
  const [isAdjOpen, setIsAdjOpen] = useState(false);
  const [adjEmployeeId, setAdjEmployeeId] = useState("");
  const [adjKind, setAdjKind] = useState("bonus");
  const [adjAmount, setAdjAmount] = useState("");
  const [adjReason, setAdjReason] = useState("");
  const [adjSaving, setAdjSaving] = useState(false);

  const loadPolicies = async () => { setPoliciesLoaded(false); try { setPayrollPolicies(await payrollService.getPolicies()); } catch { setPayrollPolicies([]); } finally { setPoliciesLoaded(true); } };
  const loadLineOverrides = async () => {
    try { setLineOverrides(await payrollService.getLineOverrides(period)); } catch { setLineOverrides([]); }
    try {
      const variables = await payrollService.getPeriodInputVariables();
      setCustomVariables((Array.isArray(variables) ? variables : []).filter((item: any) => item.status === "active"));
    } catch { setCustomVariables([]); }
  };
  const clearLocalOverrideState = () => {
    setInputDrafts({});
    setInputErrors({});
    setLineOverrides([]);
    setInputSaveOpen(false);
    setInputReason("");
  };
  const reload = async () => { try { setRun(await payrollService.getRun(period)); } catch { setRun(null); } try { setResults(await payrollService.getResults(period)); } catch { setResults([]); } try { setAdjustments(await payrollService.getAdjustments(period)); } catch { setAdjustments([]); } };
  useEffect(() => { void reload(); void loadLineOverrides(); }, [period]);
  useEffect(() => { void loadPolicies(); }, []);
  useEffect(() => { setSearch(""); setSortKey("employeeName"); setSortDir("asc"); clearLocalOverrideState(); }, [period]);

  const exportCsv = () => { const rows = run?.lines || results; const csv = ["employeeId,adjustedBase,overtime,net", ...rows.map((line: any) => [line.employeeId, line.calculation?.adjustedBase || "", line.calculation?.overtime || "", line.calculation?.net || ""].join(","))].join("\\n"); const blob = new Blob([csv], { type: "text/csv;charset=utf-8" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `payroll-${period}.csv`; anchor.click(); URL.revokeObjectURL(url); };
  const exportExcel = () => {
    const rows = run
      ? run.lines.map((line: any) => {
          const originalResult = results.find((r) => r.employeeId === line.employeeId);
          return {
            "Mã nhân viên": line.employeeId,
            "Tên nhân viên": line.employeeName || originalResult?.employeeName || "",
            "Lương cơ bản": originalResult?.monthlySalary || line.calculation?.monthlySalary || 0,
            "Lương điều chỉnh": line.calculation?.adjustedBase || 0,
            "Tăng ca": line.calculation?.overtime || 0,
            "Thực nhận": line.calculation?.net || 0,
          };
        })
      : results.map((row: any) => ({
          "Mã nhân viên": row.employeeId,
          "Tên nhân viên": row.employeeName || "",
          "Lương cơ bản": row.monthlySalary || 0,
          "Ngày công": Number(row.workedDays ?? 0).toFixed(2),
          "Thiếu công (ngày)": Number(row.shortageDays ?? ((row.shortageMinutes || 0) / 480)).toFixed(2),
          "Trạng thái công": row.status === "locked" ? "Đã khóa" : "Bản nháp",
        }));
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "BangLuong");
    XLSX.writeFile(workbook, `bang-luong-${period}.xlsx`);
  };
  const action = async (fn: () => Promise<unknown>, success: string, onSuccess?: () => void | Promise<void>) => {
    try {
      await fn();
      await onSuccess?.();
      toast.success(success);
      await reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể thực hiện thao tác");
    }
  };

  const allLocked = results.length > 0 && results.every((r) => r.status === "locked");
  const currentStepIndex = run?.status === "paid" ? 3
    : run?.status === "closed" ? 2
    : run?.status === "review" ? 1
    : run || allLocked || results.length > 0 ? 0
    : -1;
  const inlineEditable = canManage && run?.status === "draft";

  const runRows = useMemo(() => {
    if (!run) return [];
    return (run.effectiveLines ?? []).map((line: any) => {
      const originalResult = results.find((r) => r.employeeId === line.employeeId);
      const preview = previewPayrollLine(line, inlineEditable ? inputDrafts[String(line.employeeId)] : undefined);
      const segment = line.segmentLines?.[0] ?? {};
      return {
        ...line,
        ...preview.values,
        employeeId: line.employeeId,
        employeeName: line.employeeName || originalResult?.employeeName || "",
        deductionTotal: preview.deductionTotal,
        net: preview.net,
        calculation: segment.calculation,
        attendance: segment.attendance,
        vietnam: segment.vietnam,
      };
    });
  }, [run, results, inputDrafts, inlineEditable]);

  const draftRows = useMemo(() => results.map((row: any) => ({
    employeeId: row.employeeId,
    employeeName: row.employeeName || "",
    monthlySalary: row.monthlySalary || 0,
    workedDays: Number(row.workedDays ?? 0),
    workedHours: Number(row.workedMinutes ?? 0) / 60,
    allowance: Number(row.calculation?.allowances ?? 0),
    bonus: Number(row.calculation?.bonuses ?? 0),
    deduction: Number(row.calculation?.otherDeductions ?? 0),
    shortageDays: Number(row.shortageDays ?? ((row.shortageMinutes || 0) / 480)),
    status: row.status,
  })), [results]);

  const filteredSortedRunRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = term ? runRows.filter((r: any) => r.employeeName.toLowerCase().includes(term) || r.employeeId.toLowerCase().includes(term)) : runRows;
    const sorted = [...filtered].sort((a: any, b: any) => {
      const va = a[sortKey]; const vb = b[sortKey];
      const cmp = typeof va === "string" ? va.localeCompare(vb) : (va || 0) - (vb || 0);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [runRows, search, sortKey, sortDir]);

  const filteredSortedDraftRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = term ? draftRows.filter((r: any) => r.employeeName.toLowerCase().includes(term) || r.employeeId.toLowerCase().includes(term)) : draftRows;
    const sorted = [...filtered].sort((a: any, b: any) => {
      const va = a[sortKey]; const vb = b[sortKey];
      const cmp = typeof va === "string" ? va.localeCompare(vb) : (va || 0) - (vb || 0);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [draftRows, search, sortKey, sortDir]);

  const onSort = (key: string) => { if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc")); else { setSortKey(key); setSortDir("asc"); } };

  const totalNet = runRows.reduce((sum: number, r: any) => sum + r.net, 0);
  const totalBase = runRows.reduce((sum: number, r: any) => sum + r.baseSalary, 0);
  const headcount = run ? runRows.length : draftRows.length;
  const shortageCount = draftRows.filter((r: any) => r.shortageDays > 0).length;
  const hasPayrollPolicy = policiesLoaded && hasActivePolicyForMonth(payrollPolicies, period);
  const processingAction = getPayrollProcessingAction(run?.status, processingPayroll, hasPayrollPolicy);

  const processPeriod = async (propagateError = false) => {
    if (processingPayroll) return;
    setProcessingPayroll(true);
    try {
      await payrollService.processPeriod(period);
      clearLocalOverrideState();
      await loadLineOverrides();
      toast.success(run ? "Đã cập nhật bảng lương" : "Đã tính bảng lương");
      await reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể xử lý bảng lương");
      if (propagateError) throw error;
    } finally {
      setProcessingPayroll(false);
    }
  };

  const openFormulaRow = async (line: any) => {
    setFormulaRow(line); setFormulaLoading(Boolean(run?._id));
    if (run?._id) { try { const detail = await payrollService.getLineDetail(String(run._id), line.employeeId); setFormulaRow({ ...line, calculation: detail.calculation || line.calculation, attendance: detail.attendance || line.attendance, vietnam: detail.vietnam || line.vietnam }); } catch { /* keep local detail */ } finally { setFormulaLoading(false); } }
  };

  const downloadExport = async (type: "detailed" | "insurance" | "pit" | "bank_transfer") => {
    if (!run?._id) return;
    try {
      const blob = await payrollService.exportWorkbook(String(run._id), type);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `payroll-${period}-${type}.xlsx`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success("Đã tải báo cáo xuất bảng lương");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể xuất bảng lương");
    }
  };
  const publishPayslips = () => { if (run?._id) void action(() => payrollService.publishPayslips(String(run._id), run.lines.map((line: any) => line.employeeId)), "Đã publish payslip"); };
  const handleCreateAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjEmployeeId || !adjAmount || !adjReason.trim()) {
      toast.error("Vui lòng nhập đầy đủ thông tin.");
      return;
    }
    setAdjSaving(true);
    try {
      await payrollService.createAdjustment(period, {
        employeeId: adjEmployeeId,
        kind: adjKind,
        amount: Number(adjAmount),
        reason: adjReason,
      });
      toast.success("Đã tạo yêu cầu điều chỉnh.");
      setIsAdjOpen(false);
      await reload();
    } catch (err: any) {
      toast.error(err.message || "Không thể tạo điều chỉnh.");
    } finally {
      setAdjSaving(false);
    }
  };

  const persistedOverride = (employeeId: string) => lineOverrides.find((item: any) => String(item.employeeId) === String(employeeId)) ?? {};
  const renderResultCell = (row: any, field: PayrollLineOverrideField, systemValue: number, effectiveValue: number) => {
    const employeeId = String(row.employeeId);
    const draft = inputDrafts[employeeId];
    const isDirty = Boolean(draft && (Object.prototype.hasOwnProperty.call(draft.values, field) || draft.clearFields.includes(field)));
    const persisted = persistedOverride(employeeId);
    const hasPersisted = field.startsWith("custom.")
      ? Object.prototype.hasOwnProperty.call(persisted.customValues ?? {}, field.slice("custom.".length))
      : Object.prototype.hasOwnProperty.call(persisted, field);
    const value = draft && Object.prototype.hasOwnProperty.call(draft.values, field)
      ? draft.values[field]
      : draft?.clearFields.includes(field)
        ? systemValue
        : effectiveValue;
    return <td key={field} className={`min-w-[145px] p-2 align-top ${isDirty ? "bg-amber-50" : hasPersisted ? "bg-cyan-50/70" : ""}`}>
      <input
        aria-label={`${field}-${employeeId}`}
        type="number"
        min="0"
        step="any"
        disabled={inputSaving}
        value={value}
        onChange={(event) => setInputDrafts(current => setLineOverrideDraftValue(current, employeeId, field, event.target.value === "" ? 0 : Number(event.target.value)))}
        className={`w-full rounded-md border px-2 py-1 text-right text-xs outline-none ${isDirty ? "border-amber-400 bg-amber-50" : hasPersisted ? "border-cyan-400 bg-cyan-50" : "border-slate-200"}`}
      />
      <div className="mt-1 flex items-center justify-between gap-1 text-[9px]">
        <span className={isDirty ? "font-bold text-amber-700" : hasPersisted ? "font-semibold text-cyan-700" : "text-slate-400"}>{isDirty ? "Chưa lưu" : `Hệ thống: ${Number(systemValue).toLocaleString()}`}</span>
        {field === "adjustedBase" && <button aria-label={`Chi tiết adjustedBase-${employeeId}`} type="button" onClick={() => void openFormulaRow(row)} className="text-slate-500 underline cursor-pointer">Chi tiết</button>}
        {hasPersisted && !draft?.clearFields.includes(field) && <button aria-label={`Khôi phục ${field}-${employeeId}`} type="button" onClick={() => setInputDrafts(current => restoreLineOverrideDraftField(current, employeeId, field))} className="text-cyan-700 underline cursor-pointer">Khôi phục</button>}
      </div>
    </td>;
  };

  const saveLineOverrides = async () => {
    if (!inputReason.trim()) { toast.error("Vui lòng nhập lý do đối soát"); return; }
    setInputSaving(true);
    try {
      const versionSources = lineOverrides.length ? lineOverrides : (run?.effectiveLines ?? []);
      const response = await payrollService.bulkSaveLineOverrides(period, buildLineOverrideRows(inputDrafts, versionSources, inputReason));
      const saveResults = Array.isArray(response) ? response : [];
      const retained = retainFailedLineOverrideDrafts(inputDrafts, saveResults);
      setInputDrafts(retained.drafts);
      setInputErrors(retained.errors);
      await loadLineOverrides();
      await reload();
      const failed = Object.keys(retained.errors).length;
      if (failed) toast.error(`${failed} nhân viên chưa lưu được; các dòng thành công đã được cập nhật`);
      else { toast.success("Đã lưu điều chỉnh kết quả lương"); setInputSaveOpen(false); setInputReason(""); }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể lưu điều chỉnh kết quả lương");
    } finally { setInputSaving(false); }
  };

  const canSeeTable = canManage || !!run;

  return <section className="flex-1 overflow-auto p-5 space-y-4 bg-slate-50">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-lg font-bold text-slate-800">Bảng lương</h2>
        <p className="text-xs text-slate-500">Kỳ lương và kết quả công đã khóa</p>
      </div>
      <div className="flex items-center gap-2">
        <input type="month" value={period} onChange={e => setPeriod(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
      </div>
    </div>

    {run?._id && <div className="rounded-xl border border-slate-200 bg-white p-4"><div className="mb-3 text-sm font-bold text-slate-800">Phiếu lương và xuất báo cáo</div><PayrollPayslipsPanel canManage={canManage} publishedCount={run.publishedEmployeeIds?.length || 0} runStatus={run.status} onPublish={publishPayslips} onExport={(type) => void downloadExport(type)} /></div>}
    {canManage && <PayrollPolicyManager canManage={canManage} onPoliciesChanged={loadPolicies} runStatus={run?.status} onRecalculate={() => processPeriod(true)} />}
    {PAYROLL_FORMULA_LIBRARY_ENABLED && canManage && <PayrollFormulaLibrary canManage={canManage} runStatus={run?.status} onRecalculate={() => processPeriod(true)} />}
    {canManage && <PayrollCustomVariableManager />}
    {canManage && (
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex justify-between items-center">
          <div className="text-sm font-bold text-slate-800">Điều chỉnh chờ duyệt</div>
          <button
            onClick={() => {
              const empId = run?.lines?.[0]?.employeeId || results?.[0]?.employeeId || "";
              setAdjEmployeeId(empId);
              setAdjKind("bonus");
              setAdjAmount("");
              setAdjReason("");
              setIsAdjOpen(true);
            }}
            className="px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 cursor-pointer"
          >
            + Tạo điều chỉnh
          </button>
        </div>
        <PayrollReviewQueue adjustments={adjustments} onApprove={(item) => void action(() => payrollService.approveAdjustment(period, item._id), "Đã duyệt điều chỉnh")} onReject={(item) => void action(() => payrollService.rejectAdjustment(period, item._id), "Đã từ chối điều chỉnh")} />
      </div>
    )}
    {/* Quy trình xử lý kỳ lương */}
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <ol className="flex flex-col sm:flex-row sm:items-start sm:justify-between">
        {STEPS.map((step, index) => {
          const done = index <= currentStepIndex;
          const isLast = index === STEPS.length - 1;
          const connectorDone = index < currentStepIndex;
          return (
            <li key={step.key} className="flex sm:flex-1 sm:flex-col sm:items-center">
              {/* Cột chỉ báo: dọc trên mobile, ngang từ sm trở lên */}
              <div className="flex flex-col items-center sm:w-full sm:flex-row">
                <div className={`hidden sm:block sm:h-0.5 sm:flex-1 ${index === 0 ? "sm:bg-transparent" : index <= currentStepIndex ? "sm:bg-emerald-400" : "sm:bg-slate-200"}`} />
                <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${
                  done ? "bg-emerald-500 border-emerald-500 text-white" : "bg-white border-slate-300 text-slate-400"
                }`}>
                  {done ? <CheckCircle2 size={16} /> : index + 1}
                </div>
                {!isLast && (
                  <div className={`w-0.5 flex-1 min-h-[1.25rem] sm:h-0.5 sm:w-auto sm:min-h-0 sm:flex-1 ${connectorDone ? "bg-emerald-400" : "bg-slate-200"}`} />
                )}
                {isLast && <div className="hidden sm:block sm:h-0.5 sm:flex-1 sm:bg-transparent" />}
              </div>
              <span className={`pb-4 pl-3 text-xs font-medium sm:pb-0 sm:pl-0 sm:pt-1.5 sm:text-center sm:text-[11px] ${done ? "text-emerald-700" : "text-slate-400"}`}>
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>

    {/* Thẻ tổng quan */}
    {canSeeTable && (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500 font-medium">{run ? "Tổng thực nhận" : "Tổng lương cơ bản"}</p>
          <p className="mt-1 text-lg font-bold text-slate-900">{(run ? totalNet : draftRows.reduce((s: number, r: any) => s + r.monthlySalary, 0)).toLocaleString()} đ</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500 font-medium">Số nhân viên</p>
          <p className="mt-1 text-lg font-bold text-slate-900">{headcount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500 font-medium">Người thiếu công</p>
          <p className="mt-1 text-lg font-bold text-rose-600">{shortageCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500 font-medium">Tổng lương cơ bản</p>
          <p className="mt-1 text-lg font-bold text-slate-900">{(run ? totalBase : draftRows.reduce((s: number, r: any) => s + r.monthlySalary, 0)).toLocaleString()} đ</p>
        </div>
      </div>
    )}

    {canManage && run?.status !== "paid" && (
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {(!run || run.status === "draft") && (
            <>
              {processingAction.visible && <div><button
                onClick={() => void processPeriod()}
                disabled={processingAction.disabled}
                className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-3 py-2 text-sm text-white cursor-pointer hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {processingPayroll ? <RefreshCw size={15} className="animate-spin" /> : <Play size={15} />}
                {processingAction.label}
              </button>{processingAction.reason && <p className="mt-1 text-xs text-amber-700">{processingAction.reason}</p>}</div>}
              {run && (
                <button onClick={() => void action(() => payrollService.review(period), "Đã chuyển sang kiểm tra", clearLocalOverrideState)} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white cursor-pointer hover:bg-emerald-700">
                  <CheckCircle2 size={15} /> Kiểm tra
                </button>
              )}
            </>
          )}
          {run?.status === "review" && (
            <button onClick={() => void action(() => payrollService.close(period), "Đã chốt kỳ lương", clearLocalOverrideState)} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white cursor-pointer hover:bg-indigo-700">
              Chốt kỳ
            </button>
          )}
          {canMarkPayrollPaid(canManage, run?.status) && (
            <button onClick={() => setMarkPaidConfirmOpen(true)} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white cursor-pointer hover:bg-emerald-700">
              <CheckCircle2 size={15} /> Đánh dấu đã thanh toán
            </button>
          )}
        </div>
        {(run?.status === "review" || run?.status === "closed") && (
          <button onClick={() => setReopenOpen(true)} className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 cursor-pointer hover:bg-amber-100">
            <RefreshCw size={15} /> Mở lại kỳ
          </button>
        )}
      </div>
    )}

    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap justify-between gap-3 text-sm items-center">
        <span className="text-slate-500 font-medium">Trạng thái kỳ lương:</span>
        <div className="flex items-center gap-3">
          {canSeeTable && (
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm theo tên hoặc mã..."
                className="rounded-lg border border-slate-300 bg-white pl-8 pr-3 py-1.5 text-xs w-52"
              />
            </div>
          )}
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
            run?.status === "paid" || run?.status === "closed" ? "bg-emerald-100 text-emerald-800 border border-emerald-200" :
            run?.status === "review" ? "bg-cyan-100 text-cyan-800 border border-cyan-200" : "bg-slate-100 text-slate-700 border border-slate-200"
          }`}>
            {run?.status === "paid" ? "Đã thanh toán" : run?.status === "closed" ? "Đã chốt" : run?.status === "review" ? "Kiểm tra" : "Nháp"}
          </span>
        </div>
      </div>

      {run && Object.keys(inputDrafts).length > 0 && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          <span className="text-xs font-semibold text-amber-800">
            {`${Object.keys(inputDrafts).length} nhân viên có thay đổi chưa lưu`}
          </span>
          {inlineEditable && Object.keys(inputDrafts).length > 0 && <button type="button" onClick={() => setInputSaveOpen(true)} className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-cyan-700 cursor-pointer">Lưu thay đổi</button>}
        </div>
      )}

      <div className="overflow-auto border border-slate-100 rounded-xl max-h-[60vh]">
        <table className="w-full text-left text-sm border-collapse">
          {run ? (
            <>
              <thead className="sticky top-0 z-10 bg-slate-50">
                <tr className="border-b text-[11px] uppercase tracking-wide text-slate-500">
                  <th rowSpan={2} className="sticky left-0 z-20 min-w-[180px] border-r-2 border-slate-300 bg-slate-50 p-3 text-left font-bold">Thông tin nhân viên</th>
                  <th colSpan={PAYROLL_RESULT_FIELDS.length + customVariables.length} className="border-l-2 border-cyan-200 bg-cyan-50 p-2 text-center font-bold text-cyan-800">Các khoản có thể chỉnh sửa</th>
                  <th className="border-l-2 border-rose-200 bg-rose-50 p-2 text-center font-bold text-rose-800">Khoản khấu trừ</th>
                  <th className="border-l-2 border-slate-300 bg-slate-100 p-2 text-center font-bold text-slate-800">Thực nhận</th>
                </tr>
                <tr className="border-b text-xs text-slate-500">
                  {PAYROLL_RESULT_FIELDS.map(field => <SortHeader key={field.key} label={field.label} sortKey={field.key} activeKey={sortKey} dir={sortDir} onSort={onSort} align="right" />)}
                  {customVariables.map((variable: any) => <th key={variable.code} className="min-w-[145px] p-3 text-right font-semibold text-slate-500">{variable.name}</th>)}
                  <SortHeader label="Tổng khấu trừ" sortKey="deductionTotal" activeKey={sortKey} dir={sortDir} onSort={onSort} align="right" />
                  <SortHeader label="Thực nhận" sortKey="net" activeKey={sortKey} dir={sortDir} onSort={onSort} align="right" />
                </tr>
              </thead>
              <tbody>
                {filteredSortedRunRows.length === 0 ? (
                  <tr><td colSpan={14 + customVariables.length}><EmptyState icon={Search} title="Không tìm thấy nhân viên phù hợp" /></td></tr>
                ) : filteredSortedRunRows.map((line: any) => (
                  <tr key={line.employeeId} className="border-b last:border-0 hover:bg-slate-50/50">
                    <td className="sticky left-0 z-10 border-r-2 border-slate-200 bg-white p-3 font-medium text-slate-700">
                      <div>{line.employeeName || "Chưa có tên"}</div>
                      {inputErrors[String(line.employeeId)] && <div className="mt-1 text-[10px] text-rose-600">{inputErrors[String(line.employeeId)]}</div>}
                    </td>
                    {PAYROLL_RESULT_FIELDS.map(field => inlineEditable
                      ? renderResultCell(line, field.key, Number(line.systemValues[field.key]), Number(line[field.key]))
                      : <td key={field.key} className="p-3 text-right text-slate-600">{field.key === "adjustedBase"
                        ? <button aria-label={`Chi tiết adjustedBase-${line.employeeId}`} onClick={() => void openFormulaRow(line)} className="font-semibold text-cyan-700 underline decoration-dotted cursor-pointer">{Number(line[field.key]).toLocaleString()} đ</button>
                        : `${Number(line[field.key]).toLocaleString()} đ`}</td>)}
                    {customVariables.map((variable: any) => {
                      const field = `custom.${variable.code}` as const;
                      const systemValue = Number(line.systemValues?.customValues?.[variable.code] ?? variable.defaultValue ?? 0);
                      const effectiveValue = Number(line.customValues?.[variable.code] ?? systemValue);
                      return inlineEditable
                        ? renderResultCell(line, field, systemValue, effectiveValue)
                        : <td key={field} className="p-3 text-right text-slate-600">{effectiveValue.toLocaleString()}</td>;
                    })}
                    <td className="p-3 text-right font-semibold text-rose-700"><span aria-label={`deductionTotal-${line.employeeId}`}>{Number(line.deductionTotal).toLocaleString()} đ</span></td>
                    <td className="p-3 text-right font-bold text-slate-900"><span aria-label={`net-${line.employeeId}`}>{Number(line.net).toLocaleString()} đ</span></td>
                  </tr>
                ))}
              </tbody>
              {filteredSortedRunRows.length > 0 && (
                <tfoot>
                  <tr className="border-t bg-slate-50 font-bold text-slate-700">
                    <td className="p-3">Tổng cộng ({filteredSortedRunRows.length})</td>
                    {PAYROLL_RESULT_FIELDS.map(field => <td key={field.key} className="p-3 text-right">{filteredSortedRunRows.reduce((sum: number, row: any) => sum + Number(row[field.key]), 0).toLocaleString()} đ</td>)}
                    {customVariables.map((variable: any) => <td key={variable.code} className="p-3 text-right">{filteredSortedRunRows.reduce((sum: number, row: any) => sum + Number(row.customValues?.[variable.code] ?? row.systemValues?.customValues?.[variable.code] ?? variable.defaultValue ?? 0), 0).toLocaleString()}</td>)}
                    <td className="p-3 text-right text-rose-700">{filteredSortedRunRows.reduce((s: number, r: any) => s + r.deductionTotal, 0).toLocaleString()} đ</td>
                    <td className="p-3 text-right text-slate-900">{filteredSortedRunRows.reduce((s: number, r: any) => s + r.net, 0).toLocaleString()} đ</td>
                  </tr>
                </tfoot>
              )}
            </>
          ) : !canManage ? (
            <tbody>
              <tr><td><EmptyState icon={Lock} title="Bảng lương chưa được tính cho kỳ này" hint="Vui lòng chờ người có quyền bắt đầu tính lương." /></td></tr>
            </tbody>
          ) : (
            <>
              <thead className="sticky top-0 z-10 bg-slate-50">
                <tr className="border-b text-xs text-slate-500">
                  <SortHeader label="Nhân viên" sortKey="employeeName" activeKey={sortKey} dir={sortDir} onSort={onSort} />
                  <SortHeader label="Lương cơ bản" sortKey="monthlySalary" activeKey={sortKey} dir={sortDir} onSort={onSort} align="right" />
                  <SortHeader label="Ngày công" sortKey="workedDays" activeKey={sortKey} dir={sortDir} onSort={onSort} align="center" />
                  <th className="p-3 text-center font-semibold text-slate-500">Trạng thái công</th>
                </tr>
              </thead>
              <tbody>
                {results.length === 0 ? (
                  <tr><td colSpan={4}><EmptyState icon={Inbox} title="Chưa có dữ liệu công" hint='Vui lòng ấn "Tính lương" để đồng bộ công và tạo bảng lương.' /></td></tr>
                ) : filteredSortedDraftRows.length === 0 ? (
                  <tr><td colSpan={4}><EmptyState icon={Search} title="Không tìm thấy nhân viên phù hợp" /></td></tr>
                ) : (
                  filteredSortedDraftRows.map((row: any) => (
                    <tr key={row.employeeId} className="border-b last:border-0 hover:bg-slate-50/50">
                      <td className="sticky left-0 z-10 border-r-2 border-slate-200 bg-white p-3 font-medium text-slate-700"><div>{row.employeeName || "Chưa có tên"}</div>{inputErrors[String(row.employeeId)] && <div className="mt-1 text-[10px] text-rose-600">{inputErrors[String(row.employeeId)]}</div>}</td>
                      <td className="p-3 text-right text-slate-600">{Number(row.monthlySalary).toLocaleString()} đ</td>
                      <td className="p-3 text-center font-semibold text-emerald-600">{row.workedDays.toFixed(2)} ngày</td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          row.status === "locked" ? "bg-slate-100 text-slate-700 border border-slate-200" : "bg-yellow-50 text-yellow-700 border border-yellow-100"
                        }`}>
                          {row.status === "locked" ? "Đã khóa" : "Bản nháp"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </>
          )}
        </table>
      </div>
    </div>
    {inputSaveOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4" onClick={() => !inputSaving && setInputSaveOpen(false)}>
        <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl" onClick={event => event.stopPropagation()}>
          <div className="border-b border-slate-100 p-5">
            <h3 className="font-bold text-slate-900">Lưu thay đổi dữ liệu lương</h3>
            <p className="mt-1 text-xs text-slate-500">Thay đổi sẽ được lưu cho kỳ {period} và chưa tự động tính lại bảng lương.</p>
          </div>
          <div className="p-5">
            <label className="mb-1 block text-xs font-semibold text-slate-700">Lý do đối soát <span className="text-rose-600">*</span></label>
            <textarea autoFocus value={inputReason} onChange={event => setInputReason(event.target.value)} placeholder="Ví dụ: Đối soát theo xác nhận của quản lý" rows={3} className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cyan-500" />
          </div>
          <div className="flex justify-end gap-2 rounded-b-2xl border-t border-slate-100 bg-slate-50 px-5 py-3">
            <button disabled={inputSaving} onClick={() => setInputSaveOpen(false)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 disabled:opacity-50 cursor-pointer">Hủy</button>
            <button disabled={inputSaving || !inputReason.trim()} onClick={() => void saveLineOverrides()} className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50 cursor-pointer">
              {inputSaving && <RefreshCw size={14} className="animate-spin" />} Lưu thay đổi
            </button>
          </div>
        </div>
      </div>
    )}
    <ConfirmModal
      open={resetConfirmOpen}
      title="Xóa kỳ lương?"
      description={`Toàn bộ dữ liệu công và lương của kỳ ${period} sẽ bị xóa để tính lại từ đầu. Thao tác này không thể hoàn tác.`}
      confirmLabel="Xóa kỳ lương"
      loading={resetting}
      onCancel={() => setResetConfirmOpen(false)}
      onConfirm={async () => {
        setResetting(true);
        await action(() => payrollService.reset(period), "Đã xóa kỳ lương", clearLocalOverrideState);
        setResetting(false);
        setResetConfirmOpen(false);
      }}
    />
    <PayrollReopenModal
      open={reopenOpen}
      loading={reopening}
      onCancel={() => setReopenOpen(false)}
      onConfirm={async (reason) => {
        if (!run?._id) return;
        setReopening(true);
        await action(
          () => payrollService.reopen(String(run._id), { expectedVersion: Number(run.version), reason }),
          "Đã mở lại kỳ lương về Nháp",
          async () => { clearLocalOverrideState(); await loadLineOverrides(); },
        );
        setReopening(false);
        setReopenOpen(false);
      }}
    />
    <ConfirmModal
      open={markPaidConfirmOpen}
      title="Đánh dấu đã thanh toán?"
      description={`Kỳ lương ${period} sẽ chuyển sang Đã thanh toán và không thể mở lại.`}
      confirmLabel="Đánh dấu đã thanh toán"
      loading={markingPaid}
      onCancel={() => setMarkPaidConfirmOpen(false)}
      onConfirm={async () => {
        if (!run?._id) return;
        setMarkingPaid(true);
        await action(
          () => payrollService.markPaid(String(run._id), { expectedVersion: Number(run.version) }),
          "Đã chuyển kỳ lương sang Đã thanh toán",
          clearLocalOverrideState,
        );
        setMarkingPaid(false);
        setMarkPaidConfirmOpen(false);
      }}
    />
    {formulaRow && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4" onClick={() => setFormulaRow(null)}>
        <div className="w-full max-w-md max-h-[90dvh] overflow-y-auto overscroll-contain rounded-2xl bg-white p-4 sm:p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <div className="flex justify-between gap-3"><div className="min-w-0"><h3 className="font-bold text-slate-900">Chi tiết công thức lương</h3><p className="truncate text-xs text-slate-500">{formulaRow.employeeName || formulaRow.employeeId}</p></div><button onClick={() => setFormulaRow(null)} className="shrink-0 cursor-pointer"><X size={17} /></button></div>
          {(() => { const detail = buildPayrollDetails(formulaRow.attendance, formulaRow.calculation, formulaRow.vietnam); const money = (value: number) => value.toLocaleString() + " đ"; return <div className="mt-4 space-y-4 text-sm">{formulaLoading && <p className="text-xs text-cyan-700">Đang tải snapshot bảng lương mới nhất...</p>}
            <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 sm:p-4">
              <div><span className="text-xs text-slate-500">Lương cơ bản</span><b className="block">{money(detail.monthlySalary)}</b></div>
              <div><span className="text-xs text-slate-500">Đơn giá giờ</span><b className="block">{money(Math.round(detail.hourlyRate))}</b></div>
              <div><span className="text-xs text-slate-500">Công chuẩn</span><b className="block">{detail.standardDays.toFixed(2)} ngày</b></div>
              <div><span className="text-xs text-slate-500">Công thực tế</span><b className="block">{detail.workedDays.toFixed(2)} ngày</b></div>
              <div><span className="text-xs text-slate-500">Thiếu công</span><b className="block text-rose-600">{detail.shortageDays.toFixed(2)} ngày ({detail.shortageMinutes.toLocaleString()} phút)</b></div>
              <div><span className="text-xs text-slate-500">Phép hưởng lương</span><b className="block">{money(detail.paidLeaveValue)}</b></div>
            </div>
            <div className="rounded-xl border border-slate-200 p-4 space-y-2"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Thu nhập và điều chỉnh</p>
              {[['Lương theo công', detail.adjustedBase], ['Tăng ca', detail.overtimeValue], ['Phụ cấp', detail.allowances], ['Thưởng', detail.bonuses], ['Điều chỉnh', detail.adjustments]].map(([label, value]) => <div key={String(label)} className="flex justify-between"><span>{label}</span><b>{money(Number(value))}</b></div>)}
              <div className="flex justify-between border-t pt-2 font-bold"><span>Tổng thu nhập</span><b>{money(detail.gross)}</b></div>
            </div>
            <div className="rounded-xl border border-slate-200 p-4 space-y-2"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Chi tiết các khoản khấu trừ</p>
              {[['BHXH', detail.deductionBreakdown.socialInsurance], ['BHYT', detail.deductionBreakdown.healthInsurance], ['BHTN', detail.deductionBreakdown.unemploymentInsurance], ['Thuế TNCN', detail.deductionBreakdown.personalIncomeTax], ['Khấu trừ khác', detail.deductionBreakdown.otherDeductions], ['Tạm ứng', detail.deductionBreakdown.advances]].map(([label, value]) => <div key={String(label)} className="flex justify-between"><span>{label}</span><b className="text-rose-600">-{money(Number(value))}</b></div>)}
              <div className="flex justify-between border-t pt-2"><span>Tổng khấu trừ</span><b className="text-rose-600">-{money(detail.deductionBreakdown.total || detail.deductions || 0)}</b></div><div className="flex justify-between border-t pt-2 text-base font-bold"><span>Thực nhận</span><b className="text-cyan-700">{money(detail.net)}</b></div></div>
          </div>; })()}
        </div>
      </div>
    )}

    {/* Modal Tạo Điều Chỉnh */}
    {isAdjOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4" onClick={() => setIsAdjOpen(false)}>
        <form onSubmit={handleCreateAdjustment} className="flex w-full max-w-md max-h-[90dvh] flex-col rounded-2xl bg-white p-4 sm:p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <div className="flex justify-between items-center gap-3 border-b pb-2">
            <h3 className="font-bold text-slate-900">Tạo đề xuất điều chỉnh lương</h3>
            <button type="button" onClick={() => setIsAdjOpen(false)} className="shrink-0 cursor-pointer text-slate-500"><X size={17} /></button>
          </div>
          <div className="-mx-1 flex-1 space-y-3 overflow-y-auto overscroll-contain px-1 py-4 text-sm">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nhân viên</label>
              <select
                value={adjEmployeeId}
                onChange={(e) => setAdjEmployeeId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white"
              >
                {(run?.lines || results).map((r: any) => (
                  <option key={r.employeeId} value={r.employeeId}>
                    {r.employeeName || r.employeeId}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Loại điều chỉnh</label>
              <select
                value={adjKind}
                onChange={(e) => setAdjKind(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white"
              >
                <option value="bonus">Thưởng / Cộng thêm</option>
                <option value="deduction">Khấu trừ / Phạt</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Số tiền (đ)</label>
              <input
                type="number"
                min="0"
                required
                value={adjAmount}
                onChange={(e) => setAdjAmount(e.target.value)}
                placeholder="Ví dụ: 500000"
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Lý do điều chỉnh</label>
              <textarea
                required
                rows={3}
                value={adjReason}
                onChange={(e) => setAdjReason(e.target.value)}
                placeholder="Nhập lý do tăng thưởng hoặc phạt..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </div>
          </div>
          <div className="flex flex-col-reverse gap-2 pt-3 border-t sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setIsAdjOpen(false)} className="px-4 py-2 border rounded-lg text-sm hover:bg-slate-50 cursor-pointer">Hủy</button>
            <button type="submit" disabled={adjSaving} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-lg text-sm cursor-pointer">
              {adjSaving ? "Đang lưu..." : "Lưu đề xuất"}
            </button>
          </div>
        </form>
      </div>
    )}

  </section>;
}
