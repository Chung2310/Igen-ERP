import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, CheckCircle2, FileSpreadsheet, Inbox, Lock, Play, RefreshCw, Search, Trash2, X } from "lucide-react";
import * as XLSX from "xlsx";
import { payrollService } from "../../services/payrollService";
import { buildPayrollDetails } from "./payrollDetails";
import { PayrollReviewQueue } from "./payroll/PayrollReviewQueue";
import { PayrollPaymentsPanel } from "./payroll/PayrollPaymentsPanel";
import { PayrollPayslipsPanel } from "./payroll/PayrollPayslipsPanel";

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

function ConfirmModal({ open, title, description, confirmLabel = "XÃ¡c nháº­n", onConfirm, onCancel, loading }: { open: boolean; title: string; description: string; confirmLabel?: string; onConfirm: () => void; onCancel: () => void; loading?: boolean }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" onClick={onCancel}>
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3 p-5">
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
        <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3">
          <button onClick={onCancel} disabled={loading} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 cursor-pointer hover:bg-slate-50 disabled:opacity-50">
            Há»§y
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
  { key: "synced", label: "Äá»“ng bá»™ cÃ´ng" },
  { key: "locked", label: "KhÃ³a cÃ´ng" },
  { key: "calculated", label: "TÃ­nh lÆ°Æ¡ng" },
  { key: "approved", label: "Duyá»‡t" },
  { key: "closed", label: "Chá»‘t ká»³" },
] as const;

export default function PayrollTab({ canManage }: { canManage: boolean }) {
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7));
  const [run, setRun] = useState<any>(null);
  const [results, setResults] = useState<any[]>([]);
  const [adjustments, setAdjustments] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("employeeName");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [formulaRow, setFormulaRow] = useState<any>(null);
  const [formulaLoading, setFormulaLoading] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  const reload = async () => { let nextRun: any = null; try { nextRun = await payrollService.getRun(period); setRun(nextRun); } catch { setRun(null); } try { setResults(await payrollService.getResults(period)); } catch { setResults([]); } try { setAdjustments(await payrollService.getAdjustments(period)); } catch { setAdjustments([]); } try { setPayments(nextRun?._id ? await payrollService.getPayments(String(nextRun._id)) : []); } catch { setPayments([]); } };
  useEffect(() => { void reload(); }, [period]);
  useEffect(() => { setSearch(""); setSortKey("employeeName"); setSortDir("asc"); }, [period]);

  const exportCsv = () => { const rows = run?.lines || results; const csv = ["employeeId,adjustedBase,overtime,net", ...rows.map((line: any) => [line.employeeId, line.calculation?.adjustedBase || "", line.calculation?.overtime || "", line.calculation?.net || ""].join(","))].join("\\n"); const blob = new Blob([csv], { type: "text/csv;charset=utf-8" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `payroll-${period}.csv`; anchor.click(); URL.revokeObjectURL(url); };
  const exportExcel = () => {
    const rows = run
      ? run.lines.map((line: any) => {
          const originalResult = results.find((r) => r.employeeId === line.employeeId);
          return {
            "MÃ£ nhÃ¢n viÃªn": line.employeeId,
            "TÃªn nhÃ¢n viÃªn": line.employeeName || originalResult?.employeeName || "",
            "LÆ°Æ¡ng cÆ¡ báº£n": originalResult?.monthlySalary || line.calculation?.monthlySalary || 0,
            "LÆ°Æ¡ng Ä‘iá»u chá»‰nh": line.calculation?.adjustedBase || 0,
            "TÄƒng ca": line.calculation?.overtime || 0,
            "Thá»±c nháº­n": line.calculation?.net || 0,
          };
        })
      : results.map((row: any) => ({
          "MÃ£ nhÃ¢n viÃªn": row.employeeId,
          "TÃªn nhÃ¢n viÃªn": row.employeeName || "",
          "LÆ°Æ¡ng cÆ¡ báº£n": row.monthlySalary || 0,
          "CÃ´ng chuáº©n (giá»)": row.standardHours,
          "NgÃ y cÃ´ng": Number(row.workedDays ?? 0).toFixed(2),
          "Thiáº¿u cÃ´ng (ngÃ y)": Number(row.shortageDays ?? ((row.shortageMinutes || 0) / 480)).toFixed(2),
          "Tráº¡ng thÃ¡i cÃ´ng": row.status === "locked" ? "ÄÃ£ khÃ³a" : "Báº£n nhÃ¡p",
        }));
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "BangLuong");
    XLSX.writeFile(workbook, `bang-luong-${period}.xlsx`);
  };
  const action = async (fn: () => Promise<unknown>, success: string) => { try { await fn(); setMessage(success); await reload(); } catch (error) { setMessage(error instanceof Error ? error.message : "KhÃ´ng thá»ƒ thá»±c hiá»‡n thao tÃ¡c"); } };

  const allLocked = results.length > 0 && results.every((r) => r.status === "locked");
  const currentStepIndex = run?.status === "closed" ? 4
    : run?.status === "approved" ? 3
    : run ? 2
    : allLocked ? 1
    : results.length > 0 ? 0
    : -1;

  const runRows = useMemo(() => {
    if (!run) return [];
    return run.lines.map((line: any) => {
      const originalResult = results.find((r: any) => r.employeeId === line.employeeId);
      return {
        employeeId: line.employeeId,
        employeeName: line.employeeName || originalResult?.employeeName || "",
        baseSalary: originalResult?.monthlySalary || line.calculation?.monthlySalary || 0,
        adjustedBase: line.calculation?.adjustedBase || 0,
        overtime: line.calculation?.overtime || 0,
        net: line.calculation?.net || 0,
        calculation: line.calculation || {},
      };
    });
  }, [run, results]);

  const draftRows = useMemo(() => results.map((row: any) => ({
    employeeId: row.employeeId,
    employeeName: row.employeeName || "",
    monthlySalary: row.monthlySalary || 0,
    standardHours: row.standardHours,
    workedDays: Number(row.workedDays ?? 0),
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
  const needsRecalculation = results.some((row: any) => row.needsRecalculation);

  const openFormulaRow = async (line: any) => {
    setFormulaRow(line); setFormulaLoading(Boolean(run?._id));
    if (run?._id) { try { const detail = await payrollService.getLineDetail(String(run._id), line.employeeId); setFormulaRow({ ...line, calculation: detail.calculation || line.calculation, attendance: detail.attendance || line.attendance }); } catch { /* keep local detail */ } finally { setFormulaLoading(false); } }
  };

  const downloadExport = async (type: "detailed" | "insurance" | "pit" | "bank_transfer") => { if (!run?._id) return; try { const blob = await payrollService.exportWorkbook(String(run._id), type); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `payroll-${period}-${type}.xlsx`; anchor.click(); URL.revokeObjectURL(url); setMessage("Đã tải export bảng lương"); } catch (error) { setMessage(error instanceof Error ? error.message : "Không thể export bảng lương"); } };
  const publishPayslips = () => { if (run?._id) void action(() => payrollService.publishPayslips(String(run._id), run.lines.map((line: any) => line.employeeId)), "Đã publish payslip"); };
  const canSeeTable = canManage || !!run;

  return <section className="flex-1 overflow-auto p-5 space-y-4 bg-slate-50">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-lg font-bold text-slate-800">Báº£ng lÆ°Æ¡ng</h2>
        <p className="text-xs text-slate-500">Ká»³ lÆ°Æ¡ng vÃ  káº¿t quáº£ cÃ´ng Ä‘Ã£ khÃ³a</p>
      </div>
      <div className="flex items-center gap-2">
        <input type="month" value={period} onChange={e => setPeriod(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
        <button title="Táº£i láº¡i" onClick={() => void reload()} className="rounded-lg border bg-white p-2 cursor-pointer hover:bg-slate-50"><RefreshCw size={16} /></button>
        <button title="Xuáº¥t CSV" onClick={exportCsv} className="rounded-lg border bg-white px-3 py-2 text-sm cursor-pointer hover:bg-slate-50">CSV</button>
        {canSeeTable && (
          <button title="Xuáº¥t Excel" onClick={exportExcel} className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-3 py-2 text-sm cursor-pointer hover:bg-slate-50">
            <FileSpreadsheet size={16} className="text-emerald-600" />
            Excel
          </button>
        )}
      </div>
    </div>

    {message && <div className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm text-cyan-800">{message}</div>}
    {run?._id && <div className="rounded-xl border border-slate-200 bg-white p-4"><div className="mb-3 text-sm font-bold text-slate-800">Payslip và export</div><PayrollPayslipsPanel canManage={canManage} publishedCount={run.lines?.length || 0} onPublish={publishPayslips} onExport={(type) => void downloadExport(type)} /></div>}
    {canManage && run?._id && <div className="rounded-xl border border-slate-200 bg-white p-4"><div className="mb-3 text-sm font-bold text-slate-800">Thanh toÃ¡n báº£ng lÆ°Æ¡ng</div><PayrollPaymentsPanel payments={payments} onConfirm={(item) => void action(() => payrollService.confirmPayment(item._id), "ÄÃ£ xÃ¡c nháº­n thanh toÃ¡n")} onCancel={(item) => void action(() => payrollService.cancelPayment(item._id), "ÄÃ£ há»§y thanh toÃ¡n")} onReverse={(item) => void action(() => payrollService.reversePayment(item._id), "ÄÃ£ hoÃ n tÃ¡c thanh toÃ¡n")} /></div>}
    {canManage && <div className="rounded-xl border border-slate-200 bg-white p-4"><div className="mb-3 text-sm font-bold text-slate-800">Äiá»u chá»‰nh chá» duyá»‡t</div><PayrollReviewQueue adjustments={adjustments} onApprove={(item) => void action(() => payrollService.approveAdjustment(period, item._id), "ÄÃ£ duyá»‡t Ä‘iá»u chá»‰nh")} onReject={(item) => void action(() => payrollService.rejectAdjustment(period, item._id), "ÄÃ£ tá»« chá»‘i Ä‘iá»u chá»‰nh")} /></div>}
    {needsRecalculation && <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">Lá»‹ch sá»­ cháº¥m cÃ´ng Ä‘Ã£ thay Ä‘á»•i. HÃ£y â€œÄá»“ng bá»™ cÃ´ngâ€ trÆ°á»›c khi khÃ³a hoáº·c tÃ­nh lÆ°Æ¡ng láº¡i.</div>}

    {/* Quy trÃ¬nh xá»­ lÃ½ ká»³ lÆ°Æ¡ng */}
    <div className="rounded-xl border border-slate-200 bg-white p-4 overflow-x-auto">
      <div className="flex items-center min-w-max">
        {STEPS.map((step, index) => {
          const done = index <= currentStepIndex;
          const isLast = index === STEPS.length - 1;
          return (
            <div key={step.key} className="flex items-center">
              <div className="flex flex-col items-center gap-1.5 w-24">
                <div className={`flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-bold ${
                  done ? "bg-emerald-500 border-emerald-500 text-white" : "bg-white border-slate-300 text-slate-400"
                }`}>
                  {done ? <CheckCircle2 size={16} /> : index + 1}
                </div>
                <span className={`text-[11px] text-center font-medium ${done ? "text-emerald-700" : "text-slate-400"}`}>{step.label}</span>
              </div>
              {!isLast && <div className={`h-0.5 w-8 -mt-4 ${index < currentStepIndex ? "bg-emerald-400" : "bg-slate-200"}`} />}
            </div>
          );
        })}
      </div>
    </div>

    {/* Tháº» tá»•ng quan */}
    {canSeeTable && (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500 font-medium">{run ? "Tá»•ng thá»±c nháº­n" : "Tá»•ng lÆ°Æ¡ng cÆ¡ báº£n"}</p>
          <p className="mt-1 text-lg font-bold text-slate-900">{(run ? totalNet : draftRows.reduce((s: number, r: any) => s + r.monthlySalary, 0)).toLocaleString()} Ä‘</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500 font-medium">Sá»‘ nhÃ¢n viÃªn</p>
          <p className="mt-1 text-lg font-bold text-slate-900">{headcount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500 font-medium">NgÆ°á»i thiáº¿u cÃ´ng</p>
          <p className="mt-1 text-lg font-bold text-rose-600">{shortageCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500 font-medium">Tá»•ng lÆ°Æ¡ng cÆ¡ báº£n</p>
          <p className="mt-1 text-lg font-bold text-slate-900">{(run ? totalBase : draftRows.reduce((s: number, r: any) => s + r.monthlySalary, 0)).toLocaleString()} Ä‘</p>
        </div>
      </div>
    )}

    {canManage && (
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <button onClick={() => void action(() => payrollService.snapshot(period), "ÄÃ£ Ä‘á»“ng bá»™ káº¿t quáº£ cÃ´ng")} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white cursor-pointer hover:bg-indigo-700">
            <RefreshCw size={15} /> Äá»“ng bá»™ cÃ´ng
          </button>
          <button disabled={needsRecalculation} onClick={() => void action(() => payrollService.lock(period), "ÄÃ£ khÃ³a káº¿t quáº£ cÃ´ng")} className="inline-flex items-center gap-2 rounded-lg bg-slate-700 px-3 py-2 text-sm text-white cursor-pointer hover:bg-slate-850 disabled:opacity-40">
            <Lock size={15} /> KhÃ³a cÃ´ng
          </button>
          <button onClick={() => void action(() => payrollService.createRun(period), "ÄÃ£ táº¡o báº£ng lÆ°Æ¡ng")} className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-3 py-2 text-sm text-white cursor-pointer hover:bg-cyan-700">
            <Play size={15} /> TÃ­nh lÆ°Æ¡ng
          </button>
          <button onClick={() => void action(() => payrollService.approve(period), "ÄÃ£ duyá»‡t báº£ng lÆ°Æ¡ng")} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white cursor-pointer hover:bg-emerald-700">
            <CheckCircle2 size={15} /> Duyá»‡t
          </button>
          <button onClick={() => void action(() => payrollService.close(period), "ÄÃ£ chá»‘t ká»³ lÆ°Æ¡ng")} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white cursor-pointer hover:bg-indigo-700">
            Chá»‘t ká»³
          </button>
        </div>
        <button onClick={() => setResetConfirmOpen(true)} className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 cursor-pointer hover:bg-rose-100">
          <Trash2 size={15} /> XÃ³a ká»³ lÆ°Æ¡ng
        </button>
      </div>
    )}

    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap justify-between gap-3 text-sm items-center">
        <span className="text-slate-500 font-medium">Tráº¡ng thÃ¡i ká»³ lÆ°Æ¡ng:</span>
        <div className="flex items-center gap-3">
          {canSeeTable && (
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="TÃ¬m theo tÃªn hoáº·c mÃ£..."
                className="rounded-lg border border-slate-300 bg-white pl-8 pr-3 py-1.5 text-xs w-52"
              />
            </div>
          )}
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
            run?.status === "approved" || run?.status === "closed" ? "bg-emerald-100 text-emerald-800 border border-emerald-200" :
            run?.status === "calculated" ? "bg-cyan-100 text-cyan-800 border border-cyan-200" : "bg-slate-100 text-slate-700 border border-slate-200"
          }`}>
            {run?.status === "approved" ? "ÄÃ£ duyá»‡t" : run?.status === "closed" ? "ÄÃ£ chá»‘t" : run?.status === "calculated" ? "ÄÃ£ tÃ­nh lÆ°Æ¡ng" : "ChÆ°a táº¡o"}
          </span>
        </div>
      </div>

      <div className="overflow-auto border border-slate-100 rounded-xl max-h-[60vh]">
        <table className="w-full text-left text-sm border-collapse">
          {run ? (
            <>
              <thead className="sticky top-0 z-10 bg-slate-50">
                <tr className="border-b text-xs text-slate-500">
                  <SortHeader label="NhÃ¢n viÃªn" sortKey="employeeName" activeKey={sortKey} dir={sortDir} onSort={onSort} />
                  <SortHeader label="LÆ°Æ¡ng cÆ¡ báº£n" sortKey="baseSalary" activeKey={sortKey} dir={sortDir} onSort={onSort} align="right" />
                  <SortHeader label="LÆ°Æ¡ng Ä‘iá»u chá»‰nh" sortKey="adjustedBase" activeKey={sortKey} dir={sortDir} onSort={onSort} align="right" />
                  <SortHeader label="TÄƒng ca" sortKey="overtime" activeKey={sortKey} dir={sortDir} onSort={onSort} align="right" />
                  <SortHeader label="Thá»±c nháº­n" sortKey="net" activeKey={sortKey} dir={sortDir} onSort={onSort} align="right" />
                </tr>
              </thead>
              <tbody>
                {filteredSortedRunRows.length === 0 ? (
                  <tr><td colSpan={5}><EmptyState icon={Search} title="KhÃ´ng tÃ¬m tháº¥y nhÃ¢n viÃªn phÃ¹ há»£p" /></td></tr>
                ) : filteredSortedRunRows.map((line: any) => (
                  <tr key={line.employeeId} className="border-b last:border-0 hover:bg-slate-50/50">
                    <td className="p-3 font-medium text-slate-700"><div>{line.employeeName || "ChÆ°a cÃ³ tÃªn"}</div><div className="text-[10px] text-slate-400">{line.employeeId}</div></td>
                    <td className="p-3 text-right text-slate-600">{Number(line.baseSalary).toLocaleString()} Ä‘</td>
                    <td className="p-3 text-right text-slate-600"><button onClick={() => void openFormulaRow(line)} className="font-semibold text-cyan-700 underline decoration-dotted cursor-pointer">{Number(line.adjustedBase).toLocaleString()} Ä‘</button></td>
                    <td className="p-3 text-right text-slate-600">{Number(line.overtime).toLocaleString()} Ä‘</td>
                    <td className="p-3 text-right font-bold text-slate-900">{Number(line.net).toLocaleString()} Ä‘</td>
                  </tr>
                ))}
              </tbody>
              {filteredSortedRunRows.length > 0 && (
                <tfoot>
                  <tr className="border-t bg-slate-50 font-bold text-slate-700">
                    <td className="p-3">Tá»•ng cá»™ng ({filteredSortedRunRows.length})</td>
                    <td className="p-3 text-right">{filteredSortedRunRows.reduce((s: number, r: any) => s + r.baseSalary, 0).toLocaleString()} Ä‘</td>
                    <td className="p-3 text-right">{filteredSortedRunRows.reduce((s: number, r: any) => s + r.adjustedBase, 0).toLocaleString()} Ä‘</td>
                    <td className="p-3 text-right">{filteredSortedRunRows.reduce((s: number, r: any) => s + r.overtime, 0).toLocaleString()} Ä‘</td>
                    <td className="p-3 text-right text-slate-900">{filteredSortedRunRows.reduce((s: number, r: any) => s + r.net, 0).toLocaleString()} Ä‘</td>
                  </tr>
                </tfoot>
              )}
            </>
          ) : !canManage ? (
            <tbody>
              <tr><td><EmptyState icon={Lock} title="Báº£ng lÆ°Æ¡ng chÆ°a Ä‘Æ°á»£c tÃ­nh cho ká»³ nÃ y" hint="Vui lÃ²ng chá» ngÆ°á»i cÃ³ quyá»n báº¯t Ä‘áº§u tÃ­nh lÆ°Æ¡ng." /></td></tr>
            </tbody>
          ) : (
            <>
              <thead className="sticky top-0 z-10 bg-slate-50">
                <tr className="border-b text-xs text-slate-500">
                  <SortHeader label="NhÃ¢n viÃªn" sortKey="employeeName" activeKey={sortKey} dir={sortDir} onSort={onSort} />
                  <SortHeader label="LÆ°Æ¡ng cÆ¡ báº£n" sortKey="monthlySalary" activeKey={sortKey} dir={sortDir} onSort={onSort} align="right" />
                  <SortHeader label="CÃ´ng chuáº©n (giá»)" sortKey="standardHours" activeKey={sortKey} dir={sortDir} onSort={onSort} align="center" />
                  <SortHeader label="NgÃ y cÃ´ng" sortKey="workedDays" activeKey={sortKey} dir={sortDir} onSort={onSort} align="center" />
                  <th className="p-3 text-center font-semibold text-slate-500">Tráº¡ng thÃ¡i cÃ´ng</th>
                </tr>
              </thead>
              <tbody>
                {results.length === 0 ? (
                  <tr><td colSpan={5}><EmptyState icon={Inbox} title="ChÆ°a cÃ³ dá»¯ liá»‡u cÃ´ng" hint='Vui lÃ²ng áº¥n "Äá»“ng bá»™ cÃ´ng" Ä‘á»ƒ táº£i danh sÃ¡ch nhÃ¢n viÃªn.' /></td></tr>
                ) : filteredSortedDraftRows.length === 0 ? (
                  <tr><td colSpan={5}><EmptyState icon={Search} title="KhÃ´ng tÃ¬m tháº¥y nhÃ¢n viÃªn phÃ¹ há»£p" /></td></tr>
                ) : (
                  filteredSortedDraftRows.map((row: any) => (
                    <tr key={row.employeeId} className="border-b last:border-0 hover:bg-slate-50/50">
                      <td className="p-3 font-medium text-slate-700"><div>{row.employeeName || "ChÆ°a cÃ³ tÃªn"}</div><div className="text-[10px] text-slate-400">{row.employeeId}</div></td>
                      <td className="p-3 text-right text-slate-600">{Number(row.monthlySalary).toLocaleString()} Ä‘</td>
                      <td className="p-3 text-center text-slate-600">{row.standardHours} giá»</td>
                      <td className="p-3 text-center font-semibold text-emerald-600">{row.workedDays.toFixed(2)} ngÃ y</td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          row.status === "locked" ? "bg-slate-100 text-slate-700 border border-slate-200" : "bg-yellow-50 text-yellow-700 border border-yellow-100"
                        }`}>
                          {row.status === "locked" ? "ÄÃ£ khÃ³a" : "Báº£n nhÃ¡p"}
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
    <ConfirmModal
      open={resetConfirmOpen}
      title="XÃ³a ká»³ lÆ°Æ¡ng?"
      description={`ToÃ n bá»™ dá»¯ liá»‡u cÃ´ng vÃ  lÆ°Æ¡ng cá»§a ká»³ ${period} sáº½ bá»‹ xÃ³a Ä‘á»ƒ tÃ­nh láº¡i tá»« Ä‘áº§u. Thao tÃ¡c nÃ y khÃ´ng thá»ƒ hoÃ n tÃ¡c.`}
      confirmLabel="XÃ³a ká»³ lÆ°Æ¡ng"
      loading={resetting}
      onCancel={() => setResetConfirmOpen(false)}
      onConfirm={async () => {
        setResetting(true);
        await action(() => payrollService.reset(period), "ÄÃ£ xÃ³a ká»³ lÆ°Æ¡ng");
        setResetting(false);
        setResetConfirmOpen(false);
      }}
    />
    {formulaRow && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4" onClick={() => setFormulaRow(null)}>
        <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <div className="flex justify-between"><div><h3 className="font-bold text-slate-900">Chi tiáº¿t cÃ´ng thá»©c lÆ°Æ¡ng</h3><p className="text-xs text-slate-500">{formulaRow.employeeName || formulaRow.employeeId}</p></div><button onClick={() => setFormulaRow(null)} className="cursor-pointer"><X size={17} /></button></div>
          {(() => { const detail = buildPayrollDetails(formulaRow.attendance, formulaRow.calculation); const money = (value: number) => value.toLocaleString() + " Ä‘"; return <div className="mt-4 space-y-4 text-sm">{formulaLoading && <p className="text-xs text-cyan-700">Äang táº£i snapshot báº£ng lÆ°Æ¡ng má»›i nháº¥t...</p>}
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-4">
              <div><span className="text-xs text-slate-500">LÆ°Æ¡ng cÆ¡ báº£n</span><b className="block">{money(detail.monthlySalary)}</b></div>
              <div><span className="text-xs text-slate-500">ÄÆ¡n giÃ¡ giá»</span><b className="block">{money(Math.round(detail.hourlyRate))}</b></div>
              <div><span className="text-xs text-slate-500">CÃ´ng chuáº©n</span><b className="block">{detail.standardDays.toFixed(2)} ngÃ y / {detail.standardHours} giá»</b></div>
              <div><span className="text-xs text-slate-500">CÃ´ng thá»±c táº¿</span><b className="block">{detail.workedDays.toFixed(2)} ngÃ y</b></div>
              <div><span className="text-xs text-slate-500">Thiáº¿u cÃ´ng</span><b className="block text-rose-600">{detail.shortageDays.toFixed(2)} ngÃ y ({detail.shortageMinutes.toLocaleString()} phÃºt)</b></div>
              <div><span className="text-xs text-slate-500">PhÃ©p hÆ°á»Ÿng lÆ°Æ¡ng</span><b className="block">{money(detail.paidLeaveValue)}</b></div>
            </div>
            <div className="rounded-xl border border-slate-200 p-4 space-y-2"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Thu nháº­p vÃ  Ä‘iá»u chá»‰nh</p>
              {[['LÆ°Æ¡ng theo cÃ´ng', detail.adjustedBase], ['TÄƒng ca', detail.overtimeValue], ['Phá»¥ cáº¥p', detail.allowances], ['ThÆ°á»Ÿng', detail.bonuses], ['Äiá»u chá»‰nh', detail.adjustments]].map(([label, value]) => <div key={String(label)} className="flex justify-between"><span>{label}</span><b>{money(Number(value))}</b></div>)}
              <div className="flex justify-between border-t pt-2 font-bold"><span>Tá»•ng thu nháº­p</span><b>{money(detail.gross)}</b></div>
            </div>
            <div className="rounded-xl border border-slate-200 p-4 space-y-2"><div className="flex justify-between"><span>Giáº£m trá»«</span><b className="text-rose-600">-{money(detail.deductions || 0)}</b></div><div className="flex justify-between border-t pt-2 text-base font-bold"><span>Thá»±c nháº­n</span><b className="text-cyan-700">{money(detail.net)}</b></div></div>
          </div>; })()}
        </div>
      </div>
    )}
  </section>;
}




