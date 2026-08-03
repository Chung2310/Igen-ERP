import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, BarChart3, Download, Loader2, TrendingDown, TrendingUp } from "lucide-react";
import {
  analyticsService,
  type AnalyticsExportFormat,
  type AnalyticsExportReport,
  type AnalyticsMeta,
  type ExpensesReport,
  type OperatingExpense,
  type ProfitAndLossReport,
  type ReceivablesReport,
  type RevenueGranularity,
  type RevenueReport,
} from "../services/analyticsService";
import { RevenueChart } from "../components/analytics/RevenueChart";

/**
 * Trang Phân tích & Báo cáo — chỉ admin/superadmin (gate ở route-config + API).
 *
 * Giai đoạn 6: dashboard tài chính hoàn chỉnh và xuất Excel/CSV theo bộ lọc hiện tại.
 */
const RANGE_PRESETS = [
  { key: "30d", label: "30 ngày", days: 30, granularity: "day" as const },
  { key: "90d", label: "90 ngày", days: 90, granularity: "week" as const },
  { key: "12m", label: "12 tháng", days: 365, granularity: "month" as const },
];

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatVnd(amount: number): string {
  return new Intl.NumberFormat("vi-VN").format(amount);
}

export default function AnalyticsTab() {
  const [presetKey, setPresetKey] = useState("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [branchId, setBranchId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [meta, setMeta] = useState<AnalyticsMeta | null>(null);
  const [revenue, setRevenue] = useState<RevenueReport | null>(null);
  const [receivables, setReceivables] = useState<ReceivablesReport | null>(null);
  const [expenses, setExpenses] = useState<ExpensesReport | null>(null);
  const [pnl, setPnl] = useState<ProfitAndLossReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<AnalyticsExportFormat | null>(null);
  const [exportReport, setExportReport] = useState<AnalyticsExportReport>("overview");
  const [expenseDraft, setExpenseDraft] = useState({ category: "Vận hành", projectId: "", description: "", amount: "", incurredOn: toIsoDate(new Date()) });
  const [savingExpense, setSavingExpense] = useState(false);
  const [expenseList, setExpenseList] = useState<OperatingExpense[]>([]);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [expenseEdit, setExpenseEdit] = useState({ category: "", projectId: "", description: "", amount: "", incurredOn: "" });
  const [rowBusy, setRowBusy] = useState<string | null>(null);

  const preset = useMemo(
    () => RANGE_PRESETS.find((item) => item.key === presetKey) ?? RANGE_PRESETS[0],
    [presetKey]
  );

  const dateParams = useMemo(() => {
    if (presetKey === "custom" && customFrom && customTo) return { from: customFrom, to: customTo };
    const to = new Date();
    const from = new Date(to.getTime() - preset.days * 24 * 60 * 60 * 1000);
    return { from: toIsoDate(from), to: toIsoDate(to) };
  }, [customFrom, customTo, preset.days, presetKey]);

  const scopeParams = useMemo(() => ({
    ...(branchId ? { branchId } : {}),
    ...(courseId ? { courseId } : {}),
  }), [branchId, courseId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [metaData, revenueData, receivablesData, expensesData, expenseRows] = await Promise.all([
        analyticsService.getMeta(),
        analyticsService.getRevenue({
          ...dateParams,
          ...scopeParams,
          granularity: preset.granularity as RevenueGranularity,
        }),
        analyticsService.getReceivables(dateParams.to, scopeParams),
        analyticsService.getExpenses({ ...dateParams, ...scopeParams }),
        analyticsService.listOperatingExpenses({ ...dateParams, ...(branchId ? { branchId } : {}) }),
      ]);
      setExpenseList(expenseRows);
      setMeta(metaData);
      setRevenue(revenueData);
      setReceivables(receivablesData);
      setExpenses(expensesData);
      setPnl({
        revenue: revenueData.total,
        tuitionRevenue: revenueData.tuitionTotal,
        goodsRevenue: revenueData.goodsTotal,
        goodsGrossProfit: revenueData.goodsGrossProfit,
        payrollExpense: expensesData.payroll.amount,
        commissionExpense: expensesData.commission.amount,
        generalOperatingExpense: expensesData.operating.amount,
        totalOperatingExpenses: expensesData.total,
        operatingResult: revenueData.goodsGrossProfit === null ? null : revenueData.tuitionTotal + revenueData.goodsGrossProfit - expensesData.total,
        excludedCostLines: revenueData.excludedCostLines,
        excludedCommissionRecords: expensesData.excludedCommissionRecords,
        currency: "VND",
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [branchId, dateParams, preset.granularity, scopeParams]);

  useEffect(() => {
    load();
  }, [load]);

  const blockedSources = meta?.sources.filter((source) => !source.available) ?? [];

  const handleExport = async (format: AnalyticsExportFormat) => {
    setExporting(format);
    setError(null);
    try {
      await analyticsService.downloadExport({ ...dateParams, ...scopeParams, granularity: preset.granularity, report: exportReport, format });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setExporting(null);
    }
  };

  const handleAddExpense = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingExpense(true);
    setError(null);
    try {
      await analyticsService.createOperatingExpense({ ...expenseDraft, amount: Number(expenseDraft.amount), ...(branchId ? { branchId } : {}) });
      setExpenseDraft((current) => ({ ...current, description: "", amount: "" }));
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingExpense(false);
    }
  };

  const projectOptions = meta?.filters.projects ?? [];
  const projectName = (id?: string) => {
    if (!id) return "Chi phí chung";
    const found = projectOptions.find((item) => item.id === id);
    return found ? found.name : "(Dự án đã xóa)";
  };

  const startEditExpense = (row: OperatingExpense) => {
    setEditingExpenseId(row._id);
    setExpenseEdit({
      category: row.category,
      projectId: row.projectId ?? "",
      description: row.description,
      amount: String(row.amount),
      incurredOn: String(row.incurredOn).slice(0, 10),
    });
  };

  const handleSaveExpenseEdit = async (id: string) => {
    const amount = Number(expenseEdit.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Số tiền chi phải lớn hơn 0.");
      return;
    }
    setRowBusy(id);
    setError(null);
    try {
      await analyticsService.updateOperatingExpense(id, { ...expenseEdit, amount });
      setEditingExpenseId(null);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRowBusy(null);
    }
  };

  const handleVoidExpense = async (id: string) => {
    setRowBusy(id);
    setError(null);
    try {
      await analyticsService.voidOperatingExpense(id);
      if (editingExpenseId === id) setEditingExpenseId(null);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRowBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <header className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <BarChart3 className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-lg font-bold text-slate-800">Phân tích &amp; Báo cáo</h1>
              <p className="text-sm text-slate-500">
                Doanh thu toàn công ty. Khu vực dành riêng cho quản trị viên.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="flex gap-1 rounded-2xl bg-slate-100 p-1">
              {RANGE_PRESETS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setPresetKey(item.key)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${item.key === presetKey ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                >{item.label}</button>
              ))}
            </div>
            <button type="button" onClick={() => setPresetKey("custom")} className={`rounded-xl px-3 py-1.5 text-xs font-bold ${presetKey === "custom" ? "bg-blue-50 text-blue-700" : "border border-slate-200 text-slate-600"}`}>Tùy chọn</button>
            {presetKey === "custom" && <><input aria-label="Từ ngày" type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="rounded-xl border border-slate-200 px-2 py-1.5 text-xs"/><input aria-label="Đến ngày" type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="rounded-xl border border-slate-200 px-2 py-1.5 text-xs"/></>}
            <select aria-label="Chi nhánh" value={branchId} onChange={(e) => { setBranchId(e.target.value); setCourseId(""); }} className="rounded-xl border border-slate-200 px-3 py-2 text-xs"><option value="">Tất cả chi nhánh</option>{meta?.filters.branches.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
            <select aria-label="Khóa học" value={courseId} onChange={(e) => setCourseId(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs"><option value="">Tất cả khóa học</option>{meta?.filters.courses.filter((item) => !branchId || item.branchId === branchId).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
            <select value={exportReport} onChange={(event) => setExportReport(event.target.value as AnalyticsExportReport)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">
              <option value="overview">Toàn bộ báo cáo</option>
              <option value="revenue">Doanh thu</option>
              <option value="receivables">Công nợ</option>
              <option value="expenses">Chi phí</option>
              <option value="pnl">Kết quả vận hành</option>
            </select>
            <button type="button" onClick={() => handleExport("xlsx")} disabled={exporting !== null} className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
              {exporting === "xlsx" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} Excel
            </button>
            <button type="button" onClick={() => handleExport("csv")} disabled={exporting !== null || exportReport === "overview"} title={exportReport === "overview" ? "CSV không hỗ trợ nhiều sheet; hãy chọn từng báo cáo" : undefined} className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 disabled:opacity-50">
              {exporting === "csv" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} CSV
            </button>
          </div>
        </div>
      </header>

      {loading && (
        <div className="flex items-center justify-center gap-2 rounded-[28px] border border-slate-200 bg-white p-10 text-sm font-semibold text-slate-500 shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Đang tổng hợp số liệu...
        </div>
      )}

      {error && (
        <div className="rounded-[28px] border border-rose-200 bg-rose-50 p-6 text-sm font-semibold text-rose-700">
          {error}
        </div>
      )}

      {!loading && !error && revenue && receivables && expenses && pnl && (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <StatTile
              label="Tổng doanh thu"
              value={`${formatVnd(revenue.total)} ₫`}
              growthPct={revenue.growthPct}
            />
            <StatTile label="Doanh thu học phí" value={`${formatVnd(revenue.tuitionTotal)} ₫`} />
            <StatTile label="Doanh thu bán hàng" value={`${formatVnd(revenue.goodsTotal)} ₫`} />
            <StatTile label="Công nợ phải thu" value={`${formatVnd(receivables.total)} ₫`} />
            <StatTile label="Chi phí đã chi" value={`${formatVnd(expenses.total)} ₫`} />
            <StatTile label="Kết quả vận hành" value={pnl.operatingResult === null ? "Chưa đủ dữ liệu" : `${formatVnd(pnl.operatingResult)} ₫`} />
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-5 text-sm font-bold uppercase tracking-wide text-slate-500">
              Cơ cấu doanh thu theo thời gian
            </h2>
            <RevenueChart
              series={revenue.series}
              granularity={revenue.range.granularity}
            />
          </section>

          {revenue.goodsBreakdown.length > 0 && (
            <GoodsBreakdown rows={revenue.goodsBreakdown} />
          )}

          <section className="grid gap-4 lg:grid-cols-2">
            <ReceivablesAging report={receivables} />
            <ExpenseBreakdown report={expenses} />
          </section>

          <form onSubmit={handleAddExpense} className="grid gap-3 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-5">
            <div className="md:col-span-5"><h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Ghi nhận chi phí vận hành</h2><p className="mt-1 text-xs text-slate-400">Khoản xác nhận sẽ được đưa ngay vào tổng chi phí và P&amp;L.</p></div>
            <input required value={expenseDraft.category} onChange={(e) => setExpenseDraft({ ...expenseDraft, category: e.target.value })} placeholder="Nhóm chi phí" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            <select aria-label="Dự án" value={expenseDraft.projectId} onChange={(e) => setExpenseDraft({ ...expenseDraft, projectId: e.target.value })} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
              <option value="">Chi phí chung (không gắn dự án)</option>
              {projectOptions.filter((item) => !branchId || item.branchId === branchId).map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
            <input required value={expenseDraft.description} onChange={(e) => setExpenseDraft({ ...expenseDraft, description: e.target.value })} placeholder="Nội dung chi" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            <input required min="1" type="number" value={expenseDraft.amount} onChange={(e) => setExpenseDraft({ ...expenseDraft, amount: e.target.value })} placeholder="Số tiền" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            <input required type="date" value={expenseDraft.incurredOn} onChange={(e) => setExpenseDraft({ ...expenseDraft, incurredOn: e.target.value })} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            <button disabled={savingExpense} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50 md:col-start-5">{savingExpense ? "Đang lưu..." : "Thêm khoản chi"}</button>
          </form>

          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Khoản chi đã ghi nhận</h2>
            <p className="mt-1 text-xs text-slate-400">Sửa được nhóm, dự án, nội dung, số tiền và ngày chi. Khoản đã hủy không còn hiển thị.</p>
            {expenseList.length === 0 ? (
              <p className="mt-4 text-sm text-slate-400">Chưa có khoản chi nào trong khoảng thời gian này.</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-xs uppercase tracking-wide text-slate-400">
                      <th className="py-2 pr-3 font-bold">Ngày</th>
                      <th className="py-2 pr-3 font-bold">Nhóm</th>
                      <th className="py-2 pr-3 font-bold">Dự án</th>
                      <th className="py-2 pr-3 font-bold">Nội dung</th>
                      <th className="py-2 pr-3 font-bold">Số tiền</th>
                      <th className="py-2 font-bold">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {expenseList.map((row) => (
                      <tr key={row._id} className="align-middle text-slate-600">
                        {editingExpenseId === row._id ? (
                          <>
                            <td className="py-2 pr-3"><input aria-label="Ngày chi" type="date" value={expenseEdit.incurredOn} onChange={(e) => setExpenseEdit({ ...expenseEdit, incurredOn: e.target.value })} className="rounded-xl border border-slate-200 px-2 py-1.5 text-xs" /></td>
                            <td className="py-2 pr-3"><input aria-label="Nhóm chi phí" value={expenseEdit.category} onChange={(e) => setExpenseEdit({ ...expenseEdit, category: e.target.value })} className="w-28 rounded-xl border border-slate-200 px-2 py-1.5 text-xs" /></td>
                            <td className="py-2 pr-3">
                              <select aria-label="Dự án của khoản chi" value={expenseEdit.projectId} onChange={(e) => setExpenseEdit({ ...expenseEdit, projectId: e.target.value })} className="rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-xs">
                                <option value="">Chi phí chung</option>
                                {projectOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                              </select>
                            </td>
                            <td className="py-2 pr-3"><input aria-label="Nội dung chi" value={expenseEdit.description} onChange={(e) => setExpenseEdit({ ...expenseEdit, description: e.target.value })} className="w-full rounded-xl border border-slate-200 px-2 py-1.5 text-xs" /></td>
                            <td className="py-2 pr-3"><input aria-label="Số tiền" type="number" min="1" value={expenseEdit.amount} onChange={(e) => setExpenseEdit({ ...expenseEdit, amount: e.target.value })} className="w-28 rounded-xl border border-slate-200 px-2 py-1.5 text-xs" /></td>
                            <td className="py-2">
                              <div className="flex items-center gap-2">
                                <button type="button" disabled={rowBusy === row._id} onClick={() => handleSaveExpenseEdit(row._id)} className="rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">{rowBusy === row._id ? "Đang lưu..." : "Lưu"}</button>
                                <button type="button" onClick={() => setEditingExpenseId(null)} className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600">Hủy</button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="py-2 pr-3 whitespace-nowrap">{String(row.incurredOn).slice(0, 10)}</td>
                            <td className="py-2 pr-3">{row.category}</td>
                            <td className="py-2 pr-3">{projectName(row.projectId)}</td>
                            <td className="py-2 pr-3">{row.description}</td>
                            <td className="py-2 pr-3 font-bold whitespace-nowrap">{formatVnd(row.amount)} ₫</td>
                            <td className="py-2">
                              <div className="flex items-center gap-2">
                                <button type="button" onClick={() => startEditExpense(row)} className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600">Sửa</button>
                                <button type="button" disabled={rowBusy === row._id} onClick={() => handleVoidExpense(row._id)} className="rounded-xl border border-rose-200 px-3 py-1.5 text-xs font-bold text-rose-600 disabled:opacity-50">Hủy khoản</button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <PnlBridge report={pnl} />

          {/* Nói rõ phần dữ liệu không được tính, thay vì lặng lẽ báo thiếu */}
          {(revenue.excludedRecords > 0 || revenue.excludedGoodsLines > 0 || revenue.excludedCostLines > 0 || revenue.excludedUnclassifiedStockOut > 0 || expenses.excludedCommissionRecords > 0 || blockedSources.length > 0) && (
            <section className="rounded-[28px] border border-amber-200 bg-amber-50 p-6">
              <div className="flex gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                <div className="space-y-2 text-sm">
                  <p className="font-bold text-amber-900">Dữ liệu chưa được tính vào báo cáo</p>

                  {revenue.excludedRecords > 0 && (
                    <p className="text-amber-800">
                      {revenue.excludedRecords} giao dịch chưa xác định được ngày thu tiền nên không
                      xếp được vào kỳ nào. Chạy <code>yarn backfill:payment-paid-on</code> để bổ sung.
                    </p>
                  )}

                  {revenue.excludedGoodsLines > 0 && (
                    <p className="text-amber-800">{revenue.excludedGoodsLines} dòng bán hàng thiếu snapshot giá bán nên không được tính vào doanh thu kho.</p>
                  )}

                  {revenue.excludedCostLines > 0 && (
                    <p className="text-amber-800">{revenue.excludedCostLines} dòng bán hàng thiếu giá vốn; KPI lãi gộp được ẩn để tránh báo số sai.</p>
                  )}

                  {revenue.excludedUnclassifiedStockOut > 0 && (
                    <p className="text-amber-800">{revenue.excludedUnclassifiedStockOut} phiếu xuất lịch sử chưa phân loại mục đích nên không được suy đoán là doanh thu bán hàng.</p>
                  )}

                  {expenses.excludedCommissionRecords > 0 && (
                    <p className="text-amber-800">{expenses.excludedCommissionRecords} khoản chi hoa hồng có ngày sai định dạng DD/MM/YYYY nên không thể xếp vào kỳ báo cáo.</p>
                  )}

                  {blockedSources.map((source) => (
                    <p key={source.key} className="text-amber-800">
                      <span className="font-semibold">{source.label}:</span> {source.blockedReason}
                    </p>
                  ))}
                </div>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

const AGING_LABELS: Record<ReceivablesReport["aging"][number]["bucket"], string> = {
  notScheduled: "Chưa đặt hạn",
  notDue: "Chưa đến hạn",
  "0-30": "0–30 ngày",
  "31-60": "31–60 ngày",
  "60+": "Trên 60 ngày",
};

function ReceivablesAging({ report }: { report: ReceivablesReport }) {
  const maxAmount = Math.max(...report.aging.map((row) => row.amount), 1);
  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Tuổi công nợ học phí</h2>
      <p className="mt-1 text-xs text-slate-400">Tính từ ngày gửi thông báo thu; chưa phải số ngày quá hạn hợp đồng</p>
      <div className="mt-5 space-y-4">
        {report.aging.map((row) => (
          <div key={row.bucket}>
            <div className="mb-1 flex justify-between gap-3 text-xs"><span className="font-semibold text-slate-600">{AGING_LABELS[row.bucket]}</span><span className="tabular-nums text-slate-500">{formatVnd(row.amount)} ₫ · {row.count} đợt</span></div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{ width: `${(row.amount / maxAmount) * 100}%` }} /></div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ExpenseBreakdown({ report }: { report: ExpensesReport }) {
  const rows = [
    { label: "Lương đã thanh toán", ...report.payroll },
    { label: "Hoa hồng đã chi", ...report.commission },
    { label: "Chi phí vận hành chung", ...report.operating },
  ];
  const maxAmount = Math.max(...rows.map((row) => row.amount), 1);
  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Chi phí theo dòng tiền</h2>
      <p className="mt-1 text-xs text-slate-400">Gồm lương, hoa hồng và các khoản vận hành đã xác nhận trong kỳ</p>
      <div className="mt-5 space-y-5">
        {rows.map((row) => (
          <div key={row.label}>
            <div className="mb-1 flex justify-between gap-3 text-xs"><span className="font-semibold text-slate-600">{row.label}</span><span className="tabular-nums text-slate-500">{formatVnd(row.amount)} ₫ · {row.count} khoản</span></div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-amber-600" style={{ width: `${(row.amount / maxAmount) * 100}%` }} /></div>
          </div>
        ))}
      </div>
    </section>
  );
}

function PnlBridge({ report }: { report: ProfitAndLossReport }) {
  const rows = [
    { label: "Doanh thu học phí", value: report.tuitionRevenue, sign: "+" },
    { label: "Lãi gộp hàng hóa", value: report.goodsGrossProfit, sign: "+" },
    { label: "Lương đã thanh toán", value: report.payrollExpense, sign: "−" },
    { label: "Hoa hồng đã chi", value: report.commissionExpense, sign: "−" },
    { label: "Chi phí vận hành chung", value: report.generalOperatingExpense, sign: "−" },
  ];
  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Đối chiếu kết quả vận hành</h2>
      <p className="mt-1 text-xs text-slate-400">Học phí + lãi gộp hàng hóa − lương − hoa hồng − chi phí vận hành chung</p>
      <div className="mt-5 divide-y divide-slate-100">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-4 py-3 text-sm">
            <span className="font-semibold text-slate-600">{row.label}</span>
            <span className="font-bold tabular-nums text-slate-700">{row.value === null ? "Chưa đủ dữ liệu" : `${row.sign} ${formatVnd(row.value)} ₫`}</span>
          </div>
        ))}
        <div className="flex items-center justify-between gap-4 pt-4 text-base">
          <span className="font-bold text-slate-800">Kết quả vận hành</span>
          <span className="font-black tabular-nums text-slate-900">{report.operatingResult === null ? "Chưa đủ dữ liệu" : `${formatVnd(report.operatingResult)} ₫`}</span>
        </div>
      </div>
    </section>
  );
}

function GoodsBreakdown({ rows }: { rows: RevenueReport["goodsBreakdown"] }) {
  const maxRevenue = Math.max(...rows.map((row) => row.revenue), 1);

  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Doanh thu bán hàng theo nhóm sản phẩm</h2>
      <p className="mt-1 text-xs text-slate-400">Doanh thu và số lượng xuất bán trong kỳ đang chọn</p>
      <div className="mt-5 space-y-4">
        {rows.map((row) => (
          <div key={row.category} className="grid gap-2 sm:grid-cols-[minmax(120px,220px)_1fr_auto] sm:items-center">
            <span className="truncate text-sm font-semibold text-slate-700" title={row.category}>{row.category}</span>
            <div className="h-3 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-amber-600" style={{ width: `${(row.revenue / maxRevenue) * 100}%` }} />
            </div>
            <span className="text-right text-sm font-bold tabular-nums text-slate-700">{formatVnd(row.revenue)} ₫ <span className="font-normal text-slate-400">· {row.quantity}</span></span>
          </div>
        ))}
      </div>
    </section>
  );
}

function StatTile({
  label,
  value,
  growthPct,
}: {
  label: string;
  value: string;
  growthPct?: number | null;
}) {
  const hasGrowth = typeof growthPct === "number";
  const isUp = hasGrowth && growthPct >= 0;

  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-800">{value}</p>

      {hasGrowth && (
        <p
          className={`mt-1 flex items-center gap-1 text-xs font-semibold ${
            isUp ? "text-emerald-600" : "text-rose-600"
          }`}
        >
          {isUp ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
          {isUp ? "+" : ""}
          {growthPct}% so với kỳ trước
        </p>
      )}

      {/* Không có kỳ trước thì nói rõ, không hiển thị 0% */}
      {growthPct === null && (
        <p className="mt-1 text-xs text-slate-400">Chưa có số liệu kỳ trước để so sánh</p>
      )}
    </div>
  );
}
