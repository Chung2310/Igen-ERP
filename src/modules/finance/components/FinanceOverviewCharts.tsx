import { useState, useMemo } from "react";
import { TrendingUp, PieChart, AlertCircle, ArrowUpRight, ArrowRight, DollarSign, Wallet, ShieldAlert, CheckCircle2, ArrowDownLeft, Target, BarChart3, Clock, SlidersHorizontal } from "lucide-react";
import { money } from "./ManagementUI";
import "../finance-charts.css";

type TrendRow = {
  date: string;
  revenue: number;
  cost: number | null;
  expense: number;
};

type SummaryData = {
  revenue: number;
  cost: number | null;
  grossProfit: number | null;
  expense: number;
  netProfit: number | null;
  missingCostCount?: number;
};

type DebtItem = {
  customerName?: string;
  supplierName?: string;
  balance: number;
  dueDate: string;
  daysUntil: number;
};

const formatShortMoney = (val: number) => {
  const abs = Math.abs(val);
  if (abs >= 1e9) return (val / 1e9).toFixed(1).replace(/\.0$/, "") + " tỷ";
  if (abs >= 1e6) return (val / 1e6).toFixed(1).replace(/\.0$/, "") + " tr";
  if (abs >= 1e3) return (val / 1e3).toFixed(0) + " k";
  return val.toLocaleString("vi-VN") + " đ";
};

const formatDateShort = (dateStr: string) => {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  return parts.length === 3 ? `${parts[2]}/${parts[1]}` : dateStr;
};

// 1. Biểu đồ cột kép Doanh thu & Chi phí (Earning Reports style) với Animation
export function FinanceEarningsBarChart({ trends }: { trends: TrendRow[] }) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [viewScope, setViewScope] = useState<"7" | "14" | "all">("14");

  const displayRows = useMemo(() => {
    if (!trends || !trends.length) return [];
    const sorted = [...trends].sort((a, b) => a.date.localeCompare(b.date));
    if (viewScope === "7") return sorted.slice(-7);
    if (viewScope === "14") return sorted.slice(-14);
    return sorted;
  }, [trends, viewScope]);

  const maxVal = useMemo(() => {
    let max = 0;
    for (const r of displayRows) {
      if (r.revenue > max) max = r.revenue;
      if (r.expense > max) max = r.expense;
    }
    return Math.max(max, 100000);
  }, [displayRows]);

  const highestRevenueIdx = useMemo(() => {
    let best = -1;
    let max = 0;
    displayRows.forEach((r, idx) => {
      if (r.revenue > max) {
        max = r.revenue;
        best = idx;
      }
    });
    return best;
  }, [displayRows]);

  if (!displayRows.length) {
    return (
      <div className="chart-fade-in flex h-60 flex-col items-center justify-center rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 text-center shadow-xs">
        <p className="text-xs font-semibold uppercase text-on-surface-variant">Doanh thu & Chi phí</p>
        <p className="mt-2 text-xs text-on-surface-variant">Chưa có dữ liệu trong khoảng thời gian này</p>
      </div>
    );
  }

  const chartHeight = 150;
  const barWidth = Math.max(8, Math.min(18, Math.floor(400 / (displayRows.length * 2.8))));
  const gap = Math.max(4, Math.floor(barWidth * 0.4));
  const groupWidth = barWidth * 2 + gap + 16;
  const svgWidth = Math.max(520, displayRows.length * groupWidth + 60);

  return (
    <div className="chart-fade-in relative flex flex-col justify-between rounded-2xl border border-outline-variant bg-surface-container-lowest p-4.5 shadow-xs transition-shadow hover:shadow-md">
      <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2.5 border-b border-outline-variant">
        <div>
          <h3 className="text-sm sm:text-base font-bold text-on-surface">Báo cáo doanh thu & chi phí</h3>
          <div className="mt-1 flex items-center gap-3.5 text-xs font-semibold">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-primary shadow-xs" />
              <span className="text-on-surface-variant">Chi phí</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-primary shadow-xs" />
              <span className="text-on-surface-variant">Doanh thu</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 text-xs">
          <button
            type="button"
            onClick={() => setViewScope("7")}
            className={`px-2 py-0.5 rounded-lg text-xs font-medium transition cursor-pointer ${
              viewScope === "7" ? "bg-primary-container text-on-primary-container font-bold" : "text-on-surface-variant hover:bg-surface-container-low"
            }`}
          >
            7 ngày
          </button>
          <button
            type="button"
            onClick={() => setViewScope("14")}
            className={`px-2 py-0.5 rounded-lg text-xs font-medium transition cursor-pointer ${
              viewScope === "14" ? "bg-primary-container text-on-primary-container font-bold" : "text-on-surface-variant hover:bg-surface-container-low"
            }`}
          >
            14 ngày
          </button>
          <button
            type="button"
            onClick={() => setViewScope("all")}
            className={`px-2 py-0.5 rounded-lg text-xs font-medium transition cursor-pointer ${
              viewScope === "all" ? "bg-primary-container text-on-primary-container font-bold" : "text-on-surface-variant hover:bg-surface-container-low"
            }`}
          >
            Tất cả
          </button>
        </div>
      </div>

      <div className="relative mt-3 overflow-x-auto" onMouseLeave={() => setActiveIdx(null)}>
        {activeIdx !== null && displayRows[activeIdx] && (
          <div className="chart-fade-in absolute top-2 right-2 z-10 rounded-xl border border-outline-variant bg-surface-container-lowest/95 px-3 py-2 text-xs shadow-lg backdrop-blur-xs pointer-events-none">
            <p className="font-bold text-on-surface">{formatDateShort(displayRows[activeIdx].date)}</p>
            <p className="mt-1 flex items-center justify-between gap-3 text-primary font-semibold">
              <span>Doanh thu:</span> <span>{money(displayRows[activeIdx].revenue)}</span>
            </p>
            <p className="flex items-center justify-between gap-3 text-primary font-semibold">
              <span>Chi phí:</span> <span>{money(displayRows[activeIdx].expense)}</span>
            </p>
          </div>
        )}

        <svg viewBox={`0 0 ${svgWidth} ${chartHeight + 45}`} className="w-full min-w-[480px] select-none">
          {[0, 0.33, 0.66, 1].map((ratio, i) => {
            const y = chartHeight - ratio * chartHeight + 15;
            const val = ratio * maxVal;
            return (
              <g key={i}>
                <line x1="45" x2={svgWidth - 15} y1={y} y2={y} stroke="var(--color-outline-variant)" strokeDasharray="3 3" />
                <text x="40" y={y + 3} textAnchor="end" fontSize="10" fill="var(--color-on-surface-variant)">
                  {formatShortMoney(val)}
                </text>
              </g>
            );
          })}

          {displayRows.map((r, i) => {
            const groupX = 55 + i * groupWidth;
            const expenseH = Math.max(3, (r.expense / maxVal) * chartHeight);
            const revenueH = Math.max(3, (r.revenue / maxVal) * chartHeight);

            const expY = chartHeight - expenseH + 15;
            const revY = chartHeight - revenueH + 15;

            const isHovered = activeIdx === i;
            const isHighest = highestRevenueIdx === i;
            const delayMs = Math.min(i * 25, 400);

            return (
              <g
                key={r.date}
                className="cursor-pointer group/bar"
                onMouseEnter={() => setActiveIdx(i)}
                onClick={() => setActiveIdx(i)}
              >
                {isHovered && (
                  <rect
                    x={groupX - 6}
                    y="8"
                    width={groupWidth}
                    height={chartHeight + 12}
                    rx="6"
                    fill="var(--color-surface-container-low)"
                  />
                )}

                {isHighest && !isHovered && r.revenue > 0 && (
                  <g className="chart-pulse-badge">
                    <rect
                      x={groupX + barWidth + gap - 22}
                      y={revY - 20}
                      width="54"
                      height="16"
                      rx="7"
                      fill="var(--color-secondary-container)"
                      stroke="var(--color-outline)"
                      strokeWidth="1"
                    />
                    <text
                      x={groupX + barWidth + gap + 5}
                      y={revY - 9}
                      textAnchor="middle"
                      fontSize="9"
                      fontWeight="bold"
                      fill="var(--color-secondary)"
                    >
                      {formatShortMoney(r.revenue)}
                    </text>
                  </g>
                )}

                {/* Expense bar with animation */}
                <rect
                  x={groupX}
                  y={expY}
                  width={barWidth}
                  height={expenseH}
                  rx="3.5"
                  fill={isHovered ? "var(--color-primary)" : "var(--color-primary)"}
                  className="chart-bar-grow transition-colors"
                  style={{ animationDelay: `${delayMs}ms` }}
                />

                {/* Revenue bar with animation */}
                <rect
                  x={groupX + barWidth + gap}
                  y={revY}
                  width={barWidth}
                  height={revenueH}
                  rx="3.5"
                  fill={isHovered ? "var(--color-secondary)" : "var(--color-secondary)"}
                  className="chart-bar-grow transition-colors"
                  style={{ animationDelay: `${delayMs + 15}ms` }}
                />

                <text
                  x={groupX + barWidth + gap / 2}
                  y={chartHeight + 30}
                  textAnchor="middle"
                  fontSize="10"
                  fill={isHovered ? "var(--color-on-surface)" : "var(--color-on-surface-variant)"}
                  fontWeight={isHovered ? "bold" : "normal"}
                >
                  {formatDateShort(r.date)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

// 2. Biểu đồ hiệu quả tài chính & tỷ trọng cơ cấu (Performance Donut style) với Animation
export function FinancePerformanceDonut({ summary }: { summary: SummaryData }) {
  const rev = summary.revenue || 0;
  const cost = summary.cost ?? 0;
  const exp = summary.expense || 0;
  const gross = summary.grossProfit ?? (rev - cost);

  const grossMarginPct = rev > 0 ? Math.round((gross / rev) * 100) : 0;
  const costPct = rev > 0 ? Math.round((cost / rev) * 100) : 0;
  const expPct = rev > 0 ? Math.round((exp / rev) * 100) : 0;

  const radius = 42;
  const circumference = 2 * Math.PI * radius;

  const boundedGross = Math.max(0, Math.min(100, grossMarginPct));
  const boundedCost = Math.max(0, Math.min(100 - boundedGross, costPct));
  const boundedExp = Math.max(0, Math.min(100 - boundedGross - boundedCost, expPct));

  const grossStroke = (boundedGross / 100) * circumference;
  const costStroke = (boundedCost / 100) * circumference;
  const expStroke = (boundedExp / 100) * circumference;

  return (
    <div className="chart-fade-in flex flex-col justify-between rounded-2xl border border-outline-variant bg-surface-container-lowest p-4.5 shadow-xs transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between pb-2.5 border-b border-outline-variant">
        <h3 className="text-sm sm:text-base font-bold text-on-surface">Hiệu quả tài chính</h3>
        <span className="rounded-lg bg-secondary-container px-2 py-0.5 text-xs font-bold text-on-secondary-container">
          Biên lãi {grossMarginPct}%
        </span>
      </div>

      <div className="my-auto py-3 flex flex-col sm:flex-row items-center justify-around gap-5">
        <div className="relative flex items-center justify-center">
          <svg width="120" height="120" viewBox="0 0 110 110" className="-rotate-90">
            <circle cx="55" cy="55" r={radius} fill="transparent" stroke="var(--color-outline-variant)" strokeWidth="10" />
            <circle
              cx="55"
              cy="55"
              r={radius}
              fill="transparent"
              stroke="var(--color-secondary)"
              strokeWidth="10"
              strokeDasharray={`${grossStroke} ${circumference}`}
              strokeDashoffset="0"
              strokeLinecap="round"
              className="chart-donut-draw transition-all duration-700"
            />
            <circle
              cx="55"
              cy="55"
              r={radius}
              fill="transparent"
              stroke="var(--color-secondary)"
              strokeWidth="10"
              strokeDasharray={`${costStroke} ${circumference}`}
              strokeDashoffset={`-${grossStroke}`}
              strokeLinecap="round"
              className="chart-donut-draw transition-all duration-700"
              style={{ animationDelay: "150ms" }}
            />
            <circle
              cx="55"
              cy="55"
              r={radius}
              fill="transparent"
              stroke="var(--color-primary)"
              strokeWidth="10"
              strokeDasharray={`${expStroke} ${circumference}`}
              strokeDashoffset={`-${grossStroke + costStroke}`}
              strokeLinecap="round"
              className="chart-donut-draw transition-all duration-700"
              style={{ animationDelay: "300ms" }}
            />
          </svg>
          <div className="chart-fade-in absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-lg font-bold text-on-surface">
              {grossMarginPct}%
            </span>
            <span className="text-[10px] font-medium uppercase text-on-surface-variant">
              Lãi gộp
            </span>
          </div>
        </div>

        <div className="w-full sm:w-52 space-y-3">
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-semibold text-on-surface">Lãi gộp</span>
              <span className="font-bold text-primary">{money(gross)}</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-low">
              <div
                className="chart-progress-fill h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, grossMarginPct))}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-semibold text-on-surface">Giá vốn</span>
              <span className="font-bold text-secondary">{money(cost)}</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-low">
              <div
                className="chart-progress-fill h-full rounded-full bg-secondary transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, costPct))}%`, animationDelay: "150ms" }}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-semibold text-on-surface">Chi phí</span>
              <span className="font-bold text-primary">{money(exp)}</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-low">
              <div
                className="chart-progress-fill h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, expPct))}%`, animationDelay: "300ms" }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// 3. Thẻ tóm tắt danh sách khoản nợ cần xử lý (Orders Overview style)
export function DebtOverviewCard({ debts }: { debts: { receivables: DebtItem[]; payables: DebtItem[] } }) {
  const urgentDebts = useMemo(() => {
    const list: (DebtItem & { party: string; type: "Phải thu" | "Phải trả" })[] = [];
    (debts?.receivables || []).forEach(r => {
      if (r.balance > 0 && r.daysUntil <= 7) {
        list.push({ ...r, party: r.customerName || "Khách hàng", type: "Phải thu" });
      }
    });
    (debts?.payables || []).forEach(p => {
      if (p.balance > 0 && p.daysUntil <= 7) {
        list.push({ ...p, party: p.supplierName || "Nhà cung cấp", type: "Phải trả" });
      }
    });
    return list.sort((a, b) => a.daysUntil - b.daysUntil).slice(0, 4);
  }, [debts]);

  return (
    <div className="chart-fade-in flex flex-col justify-between rounded-2xl border border-outline-variant bg-surface-container-lowest p-4.5 shadow-xs transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between pb-2.5 border-b border-outline-variant">
        <div className="flex items-center gap-2">
          <div className="flex h-6.5 w-6.5 items-center justify-center rounded-lg bg-tertiary-container text-tertiary">
            <AlertCircle className="h-3.5 w-3.5" />
          </div>
          <h3 className="text-sm sm:text-base font-bold text-on-surface">Khoản nợ ưu tiên</h3>
        </div>
        <a
          href="?sub=cong-no"
          className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:text-on-primary-container transition"
        >
          Xem tất cả <ArrowRight className="h-3 w-3" />
        </a>
      </div>

      <div className="mt-2 divide-y divide-slate-100">
        {urgentDebts.length === 0 ? (
          <div className="py-6 text-center text-xs text-on-surface-variant font-medium">
            Không có khoản nợ nào sắp đến hạn hoặc quá hạn cần xử lý.
          </div>
        ) : (
          urgentDebts.map((item, idx) => {
            const isOverdue = item.daysUntil < 0;
            const isReceivable = item.type === "Phải thu";

            return (
              <div key={idx} className="flex items-center justify-between py-2 transition hover:bg-surface-container-low px-1.5 rounded-lg">
                <div className="min-w-0 flex-1 pr-2">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`inline-block rounded px-1.5 py-0.2 text-[10px] font-bold ${
                        isReceivable
                          ? "bg-primary-container text-on-primary-container border border-primary"
                          : "bg-tertiary-container text-on-tertiary-container border border-tertiary"
                      }`}
                    >
                      {item.type}
                    </span>
                    <p className="truncate text-xs font-bold text-on-surface">{item.party}</p>
                  </div>
                  <p className="mt-0.5 text-[11px] text-on-surface-variant">
                    Hạn: <span className={isOverdue ? "font-bold text-error" : "font-medium text-on-surface-variant"}>{item.dueDate}</span>
                    {isOverdue && ` (Quá ${Math.abs(item.daysUntil)} ngày)`}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-bold text-on-surface">{money(item.balance)}</p>
                  <span
                    className={`inline-block rounded px-1.5 py-0.2 text-[10px] font-semibold ${
                      isOverdue
                        ? "bg-error-container text-on-error-container border border-error"
                        : "bg-tertiary-container text-on-tertiary-container border border-tertiary"
                    }`}
                  >
                    {isOverdue ? "Quá hạn" : "Sắp hạn"}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// 4. Biểu đồ cơ cấu Thu - Chi theo danh mục (Dùng cho tab Thu - Chi)
export function CashFlowOverviewChart({
  cashIn,
  cashOut,
  cashRows,
}: {
  cashIn: number;
  cashOut: number;
  cashRows: any[];
}) {
  const net = cashIn - cashOut;
  const totalMovement = cashIn + cashOut || 1;
  const inPct = Math.round((cashIn / totalMovement) * 100);
  const outPct = Math.round((cashOut / totalMovement) * 100);

  // Group top payment categories
  const categoryStats = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of cashRows) {
      if (r.kind === "payment") {
        const cat = r.category || "other";
        map.set(cat, (map.get(cat) || 0) + (r.amount || 0));
      }
    }
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([cat, amt]) => ({
        label: cat === "rent" ? "Thuê mặt bằng" : cat === "salary" ? "Lương" : cat === "supplier" ? "Trả NCC" : cat === "marketing" ? "Marketing" : cat === "utilities" ? "Điện nước" : cat === "inventory" ? "Nhập máy" : "Chi khác",
        amount: amt,
        pct: cashOut > 0 ? Math.round((amt / cashOut) * 100) : 0,
      }));
  }, [cashRows, cashOut]);

  return (
    <div className="chart-fade-in grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* Cân đối dòng tiền In vs Out */}
      <div className="flex flex-col justify-between rounded-2xl border border-outline-variant bg-surface-container-lowest p-4.5 shadow-xs transition-shadow hover:shadow-md">
        <div className="flex items-center justify-between pb-2 border-b border-outline-variant">
          <div className="flex items-center gap-2">
            <div className="flex h-6.5 w-6.5 items-center justify-center rounded-lg bg-secondary-container text-secondary">
              <Wallet className="h-3.5 w-3.5" />
            </div>
            <h3 className="text-sm font-bold text-on-surface">Cân đối dòng tiền</h3>
          </div>
          <span className={`text-xs font-bold ${net >= 0 ? "text-on-secondary-container" : "text-error"}`}>
            Ròng: {money(net)}
          </span>
        </div>

        <div className="py-3 space-y-3">
          {/* Thanh so sánh Thu vs Chi */}
          <div>
            <div className="flex justify-between text-xs mb-1 font-semibold">
              <span className="text-on-secondary-container">Thu thực tế ({inPct}%)</span>
              <span className="text-error">Chi thực tế ({outPct}%)</span>
            </div>
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-surface-container-low">
              <div
                className="chart-progress-fill h-full bg-secondary transition-all duration-700"
                style={{ width: `${inPct}%` }}
              />
              <div
                className="chart-progress-fill h-full bg-error transition-all duration-700"
                style={{ width: `${outPct}%`, animationDelay: "150ms" }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1 text-center">
            <div className="rounded-xl bg-secondary-container p-2.5 border border-secondary">
              <p className="text-[11px] font-semibold text-on-secondary-container">Tổng thu vào</p>
              <p className="text-sm sm:text-base font-bold text-on-secondary-container mt-0.5">{money(cashIn)}</p>
            </div>
            <div className="rounded-xl bg-error-container p-2.5 border border-error">
              <p className="text-[11px] font-semibold text-on-error-container">Tổng chi ra</p>
              <p className="text-sm sm:text-base font-bold text-on-error-container mt-0.5">{money(cashOut)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Cơ cấu chi phí nổi bật */}
      <div className="flex flex-col justify-between rounded-2xl border border-outline-variant bg-surface-container-lowest p-4.5 shadow-xs transition-shadow hover:shadow-md">
        <div className="flex items-center justify-between pb-2 border-b border-outline-variant">
          <div className="flex items-center gap-2">
            <div className="flex h-6.5 w-6.5 items-center justify-center rounded-lg bg-primary-container text-primary">
              <PieChart className="h-3.5 w-3.5" />
            </div>
            <h3 className="text-sm font-bold text-on-surface">Mục chi tiêu lớn</h3>
          </div>
          <span className="text-[11px] text-on-surface-variant font-medium">Theo chi phí thực tế</span>
        </div>

        <div className="py-2 space-y-2.5">
          {categoryStats.length === 0 ? (
            <p className="text-center text-xs text-on-surface-variant py-4">Chưa có khoản chi nào trong kỳ.</p>
          ) : (
            categoryStats.map((c, i) => (
              <div key={c.label}>
                <div className="flex justify-between text-xs mb-1 font-medium">
                  <span className="text-on-surface">{c.label}</span>
                  <span className="font-bold text-on-surface">{money(c.amount)} ({c.pct}%)</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-low">
                  <div
                    className="chart-progress-fill h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${c.pct}%`, animationDelay: `${i * 100}ms` }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// 5. Biểu đồ Top sản phẩm / nhóm đóng góp doanh thu & lãi (Dùng cho tab Lãi lỗ)
export function ProfitTopGroupsChart({ rows }: { rows: any[] }) {
  const topRows = useMemo(() => {
    return [...rows]
      .filter(r => r.revenue > 0)
      .sort((a, b) => (b.revenue || 0) - (a.revenue || 0))
      .slice(0, 5);
  }, [rows]);

  const maxRev = topRows[0]?.revenue || 1;

  if (topRows.length === 0) return null;

  return (
    <div className="chart-fade-in rounded-2xl border border-outline-variant bg-surface-container-lowest p-4.5 shadow-xs transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between pb-2.5 border-b border-outline-variant mb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-6.5 w-6.5 items-center justify-center rounded-lg bg-primary-container text-primary">
            <BarChart3 className="h-3.5 w-3.5" />
          </div>
          <h3 className="text-sm sm:text-base font-bold text-on-surface">Top 5 nhóm đóng góp doanh thu</h3>
        </div>
        <span className="text-[11px] font-semibold text-on-surface-variant">Xếp hạng theo doanh số</span>
      </div>

      <div className="space-y-3">
        {topRows.map((r, i) => {
          const revPct = Math.round((r.revenue / maxRev) * 100);
          const marginPct = r.revenue > 0 && r.grossProfit != null ? Math.round((r.grossProfit / r.revenue) * 100) : 0;

          return (
            <div key={r.key || i} className="group/item">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-bold text-on-surface truncate max-w-[60%]">
                  #{i + 1} {r.key}
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-on-surface">{money(r.revenue)}</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${marginPct >= 0 ? "bg-secondary-container text-on-secondary-container" : "bg-error-container text-on-error-container"}`}>
                    Lãi {marginPct}%
                  </span>
                </div>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container-low">
                <div
                  className="chart-progress-fill h-full rounded-full bg-primary transition-all duration-500 group-hover/item:brightness-110"
                  style={{ width: `${revPct}%`, animationDelay: `${i * 80}ms` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// 6. Biểu đồ cơ cấu VAT (Dùng cho tab VAT)
export function VatStructureChart({ vat }: { vat: any }) {
  if (!vat) return null;

  const totalTax = (vat.input || 0) + (vat.output || 0) || 1;
  const inPct = Math.round(((vat.input || 0) / totalTax) * 100);
  const outPct = Math.round(((vat.output || 0) / totalTax) * 100);

  return (
    <div className="chart-fade-in grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div className="rounded-xl border border-secondary bg-secondary-container p-3.5 shadow-xs">
        <div className="flex items-center justify-between text-xs font-bold text-on-secondary-container">
          <span>VAT Đầu vào khấu trừ</span>
          <span className="rounded bg-secondary-container px-1.5 py-0.5 text-[10px]">{inPct}%</span>
        </div>
        <p className="mt-1.5 text-base sm:text-lg font-bold text-on-secondary-container">{money(vat.input)}</p>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
          <div className="chart-progress-fill h-full bg-secondary" style={{ width: `${inPct}%` }} />
        </div>
      </div>

      <div className="rounded-xl border border-primary bg-primary-container p-3.5 shadow-xs">
        <div className="flex items-center justify-between text-xs font-bold text-on-primary-container">
          <span>VAT Đầu ra bán hàng</span>
          <span className="rounded bg-primary-container px-1.5 py-0.5 text-[10px]">{outPct}%</span>
        </div>
        <p className="mt-1.5 text-base sm:text-lg font-bold text-on-primary-container">{money(vat.output)}</p>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-primary">
          <div className="chart-progress-fill h-full bg-primary" style={{ width: `${outPct}%`, animationDelay: "150ms" }} />
        </div>
      </div>

      <div className={`rounded-xl border p-3.5 shadow-xs ${vat.payable > 0 ? "border-error bg-error-container" : "border-primary bg-primary-container"}`}>
        <div className="flex items-center justify-between text-xs font-bold text-on-surface">
          <span>{vat.payable > 0 ? "VAT Phải nộp kỳ này" : "Còn chuyển kỳ sau"}</span>
          <span className={`rounded px-1.5 py-0.5 text-[10px] ${vat.payable > 0 ? "bg-error-container text-on-error-container" : "bg-primary-container text-on-primary-container"}`}>
            {vat.payable > 0 ? "Nộp thuế" : "Khấu trừ"}
          </span>
        </div>
        <p className={`mt-1.5 text-base sm:text-lg font-bold ${vat.payable > 0 ? "text-on-error-container" : "text-on-primary-container"}`}>
          {money(vat.payable > 0 ? vat.payable : vat.nextCarryforward)}
        </p>
        <p className="mt-1 text-[11px] text-on-surface-variant">
          {vat.payable > 0 ? "Sau khi trừ VAT đầu vào & chuyển kỳ" : "Chuyển sang bù trừ kỳ kế tiếp"}
        </p>
      </div>
    </div>
  );
}

// 7. Biểu đồ đồng hồ tiến độ hòa vốn (Dùng cho tab Hòa vốn)
export function BreakevenGaugeChart({
  breakeven,
  period,
  onConfigure,
}: {
  breakeven: any;
  period?: string;
  onConfigure?: () => void;
}) {
  if (!breakeven) return null;

  const pct = Math.min(100, Math.max(0, Math.round(breakeven.progress ?? 0)));
  const isComplete = pct >= 100;
  const hasProgress = breakeven.progress != null;

  return (
    <div className="chart-fade-in flex flex-col justify-between rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 shadow-xs transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between pb-3 border-b border-outline-variant">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-container text-primary">
            <Target className="h-4 w-4" />
          </div>
          <h3 className="text-sm sm:text-base font-bold text-on-surface">Tiến độ điểm hòa vốn</h3>
        </div>
        <span className={`rounded-lg px-2.5 py-0.5 text-xs font-semibold ${isComplete ? "bg-secondary-container text-on-secondary-container" : "bg-primary-container text-on-primary-container"}`}>
          {isComplete ? "Đã hòa vốn" : `${pct}% hoàn thành`}
        </span>
      </div>

      <div className="py-4 space-y-4">
        {/* Animated Progress Bar */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-medium text-on-surface-variant">Tiến độ doanh thu</span>
            <span className={hasProgress ? "font-bold text-on-surface" : "font-medium text-on-surface-variant"}>
              {hasProgress ? `${breakeven.progress.toFixed(1)}%` : "Chưa xác định"}
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-container-low p-0.5">
            <div
              className={`chart-progress-fill h-full rounded-full transition-all duration-700 ${
                isComplete ? "bg-primary" : "bg-primary"
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-center pt-1">
          <div className="rounded-xl bg-surface-container-low p-2.5 border border-outline-variant">
            <p className="text-[11px] font-medium text-on-surface-variant">Cần thêm mỗi ngày</p>
            <p className={`mt-0.5 text-sm sm:text-base ${breakeven.dailyNeeded ? "font-bold text-on-surface" : "font-medium text-on-surface-variant"}`}>
              {money(breakeven.dailyNeeded)}
            </p>
          </div>
          <div className="rounded-xl bg-surface-container-low p-2.5 border border-outline-variant">
            <p className="text-[11px] font-medium text-on-surface-variant">Ước tính theo tốc độ</p>
            <p className={`mt-0.5 text-sm sm:text-base ${breakeven.projectedDays == null ? "font-medium text-on-surface-variant" : "font-bold text-on-primary-container"}`}>
              {breakeven.projectedDays == null ? "Chưa đủ dữ liệu" : `${breakeven.projectedDays} ngày nữa`}
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2 text-xs text-on-surface-variant border-t border-outline-variant">
          <p>
            {hasProgress
              ? `Tốc độ hiện tại ước tính đạt điểm hòa vốn trong kỳ${period ? ` ${period}` : ""}.`
              : `Cần doanh thu và tỷ lệ đóng góp dương để tính toán${period ? ` kỳ ${period}` : ""}.`}
          </p>
          {onConfigure && (
            <button
              type="button"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-on-primary-container hover:text-on-primary-container hover:underline transition cursor-pointer shrink-0"
              onClick={onConfigure}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Cấu hình chi phí cố định
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// 8. Biểu đồ phân bổ tỷ trọng tuổi nợ (Dùng cho tab Tuổi nợ)
export function AgingDistributionBar({ items }: { items: { label: string; balance: number; percentage: number; color?: string }[] }) {
  if (!items || !items.length) return null;

  return (
    <div className="chart-fade-in rounded-2xl border border-outline-variant bg-surface-container-lowest p-4.5 shadow-xs transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between pb-2.5 border-b border-outline-variant mb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-6.5 w-6.5 items-center justify-center rounded-lg bg-primary-container text-primary">
            <Clock className="h-3.5 w-3.5" />
          </div>
          <h3 className="text-sm sm:text-base font-bold text-on-surface">Phân bổ tuổi nợ trực quan</h3>
        </div>
        <span className="text-[11px] font-semibold text-on-surface-variant">Tỷ trọng theo các mốc hạn</span>
      </div>

      {/* Stacked Progress Bar with animation */}
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-surface-container-low mb-3">
        {items.map((item, idx) => {
          const colors = ["bg-secondary", "bg-primary", "bg-tertiary", "bg-error"];
          return (
            <div
              key={item.label}
              className={`chart-progress-fill h-full ${colors[idx % colors.length]} transition-all duration-500`}
              style={{ width: `${item.percentage}%`, animationDelay: `${idx * 100}ms` }}
              title={`${item.label}: ${item.percentage}%`}
            />
          );
        })}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        {items.map((item, idx) => {
          const bulletColors = ["bg-secondary", "bg-primary", "bg-tertiary", "bg-error"];
          return (
            <div key={item.label} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${bulletColors[idx % bulletColors.length]}`} />
              <span className="text-on-surface-variant truncate">{item.label}:</span>
              <span className="font-bold text-on-surface">{item.percentage}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
