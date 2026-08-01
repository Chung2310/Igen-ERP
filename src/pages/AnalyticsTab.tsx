import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, BarChart3, Loader2, TrendingDown, TrendingUp } from "lucide-react";
import {
  analyticsService,
  type AnalyticsMeta,
  type ExpensesReport,
  type ProfitAndLossReport,
  type ReceivablesReport,
  type RevenueGranularity,
  type RevenueReport,
} from "../services/analyticsService";
import { RevenueChart } from "../components/analytics/RevenueChart";

/**
 * Trang Phân tích & Báo cáo — chỉ admin/superadmin (gate ở route-config + API).
 *
 * Giai đoạn 4: doanh thu học phí + bán hàng, lãi gộp hàng hóa và breakdown sản phẩm.
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
  const [meta, setMeta] = useState<AnalyticsMeta | null>(null);
  const [revenue, setRevenue] = useState<RevenueReport | null>(null);
  const [receivables, setReceivables] = useState<ReceivablesReport | null>(null);
  const [expenses, setExpenses] = useState<ExpensesReport | null>(null);
  const [pnl, setPnl] = useState<ProfitAndLossReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const preset = useMemo(
    () => RANGE_PRESETS.find((item) => item.key === presetKey) ?? RANGE_PRESETS[0],
    [presetKey]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const to = new Date();
    const from = new Date(to.getTime() - preset.days * 24 * 60 * 60 * 1000);

    try {
      const dateParams = { from: toIsoDate(from), to: toIsoDate(to) };
      const [metaData, revenueData, receivablesData, expensesData] = await Promise.all([
        analyticsService.getMeta(),
        analyticsService.getRevenue({
          ...dateParams,
          granularity: preset.granularity as RevenueGranularity,
        }),
        analyticsService.getReceivables(dateParams.to),
        analyticsService.getExpenses(dateParams),
      ]);
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
  }, [preset]);

  useEffect(() => {
    load();
  }, [load]);

  const blockedSources = meta?.sources.filter((source) => !source.available) ?? [];

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

          {/* Bộ lọc nằm trên một hàng, phía trên biểu đồ */}
          <div className="flex gap-1 rounded-2xl bg-slate-100 p-1">
            {RANGE_PRESETS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setPresetKey(item.key)}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${
                  item.key === presetKey
                    ? "bg-white text-slate-800 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {item.label}
              </button>
            ))}
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
  notSent: "Chưa gửi thông báo",
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
  ];
  const maxAmount = Math.max(...rows.map((row) => row.amount), 1);
  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Chi phí theo dòng tiền</h2>
      <p className="mt-1 text-xs text-slate-400">Chỉ gồm khoản lương xác nhận và hoa hồng đã chi trong kỳ</p>
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
  ];
  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Đối chiếu kết quả vận hành</h2>
      <p className="mt-1 text-xs text-slate-400">Học phí + lãi gộp hàng hóa − lương đã thanh toán − hoa hồng đã chi; chưa gồm các chi phí khác</p>
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
