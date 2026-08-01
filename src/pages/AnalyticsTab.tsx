import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, BarChart3, Loader2, TrendingDown, TrendingUp } from "lucide-react";
import {
  analyticsService,
  type AnalyticsMeta,
  type RevenueGranularity,
  type RevenueReport,
} from "../services/analyticsService";
import { RevenueChart } from "../components/analytics/RevenueChart";

/**
 * Trang Phân tích & Báo cáo — chỉ admin/superadmin (gate ở route-config + API).
 *
 * Giai đoạn 2: doanh thu học phí theo thời gian. Doanh thu bán hàng từ kho được
 * bổ sung sau khi StockLog lưu snapshot đơn giá — xem docs/admin-analytics/research.md.
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
      const [metaData, revenueData] = await Promise.all([
        analyticsService.getMeta(),
        analyticsService.getRevenue({
          from: toIsoDate(from),
          to: toIsoDate(to),
          granularity: preset.granularity as RevenueGranularity,
        }),
      ]);
      setMeta(metaData);
      setRevenue(revenueData);
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

      {!loading && !error && revenue && (
        <>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatTile
              label="Doanh thu học phí"
              value={`${formatVnd(revenue.total)} ₫`}
              growthPct={revenue.growthPct}
            />
            <StatTile label="Kỳ trước" value={`${formatVnd(revenue.previousTotal)} ₫`} />
            <StatTile
              label="Số giao dịch"
              value={String(revenue.series.reduce((sum, row) => sum + row.count, 0))}
            />
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-5 text-sm font-bold uppercase tracking-wide text-slate-500">
              Doanh thu học phí theo thời gian
            </h2>
            <RevenueChart
              series={revenue.series}
              granularity={revenue.range.granularity}
            />
          </section>

          {/* Nói rõ phần dữ liệu không được tính, thay vì lặng lẽ báo thiếu */}
          {(revenue.excludedRecords > 0 || blockedSources.length > 0) && (
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
