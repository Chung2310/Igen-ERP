import { useMemo } from "react";
import { useReducedMotion } from "motion/react";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Package,
  Stethoscope,
  UserPlus,
  UsersRound,
  Wallet,
} from "lucide-react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { HealthcareOverview } from "../../../shared/healthcare";
import { useAuth } from "../../context/AuthContext";
import { useBranch } from "../../context/BranchContext";
import { healthcareApi } from "../../modules/healthcare/api";
import { healthcareHref } from "../../modules/healthcare/navigation";
import {
  appointmentLabels,
  Cell as TableCell,
  dayLabel,
  Feedback,
  RowLink,
  StatusBadge,
  Table,
  timeLabel,
  useHealthcareQuery,
} from "../../modules/healthcare/ui";
import { cn } from "../../modules/student-management/lib/utils";
import {
  HrEmptyIllustration,
  type HrEmptyIllustrationKind,
} from "../hr/HrEmptyIllustration";
import { AnimatedOverviewValue } from "./AnimatedOverviewValue";
import { OverviewChartViewport } from "./OverviewChartViewport";
import { OverviewKpiDelta } from "./OverviewKpiDelta";
import { useOverviewPeriod } from "./OverviewPeriodContext";
import "./overview-dashboard.css";
import "../../modules/finance/finance-overview.css";

const colors = [
  "var(--finance-chart-blue)",
  "var(--finance-chart-teal)",
  "var(--finance-chart-orange)",
  "var(--finance-chart-violet)",
  "var(--finance-chart-red)",
];

const integer = (value: number) =>
  new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(value);

const money = (value: number) => `${integer(value)} đ`;

const shortMoney = (value: number) => {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} tỷ`;
  }
  if (abs >= 1_000_000) {
    return `${(value / 1_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} tr`;
  }
  if (abs >= 1_000) {
    return `${(value / 1_000).toLocaleString("vi-VN", { maximumFractionDigits: 0 })} nghìn`;
  }
  return `${integer(value)} đ`;
};

const moneyTooltip = (value: number | string | undefined) =>
  typeof value === "number" ? money(value) : value ?? "—";

const countTooltip = (value: number | string | undefined) =>
  typeof value === "number" ? integer(value) : value ?? "—";

const truncateAxis = (value: string, max = 16) =>
  value.length > max ? `${value.slice(0, max - 1)}…` : value;

function Empty({
  kind,
  children,
}: {
  kind: HrEmptyIllustrationKind;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-56 flex-col items-center justify-center px-3 text-center text-pretty text-xs text-on-surface-variant">
      <HrEmptyIllustration kind={kind} />
      <p className="mt-1">{children}</p>
    </div>
  );
}

function ChartCard({
  title,
  children,
  hasData,
  kind = "task",
  className = "",
  href,
  emptyText,
  badge,
}: {
  title: string;
  children: React.ReactNode;
  hasData: boolean;
  kind?: HrEmptyIllustrationKind;
  className?: string;
  href?: string;
  emptyText?: string;
  badge?: string;
}) {
  return (
    <section className={cn("finance-chart-card", className)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <h3 className="text-balance text-sm font-semibold text-on-surface">
            {title}
          </h3>
          {badge && (
            <span className="shrink-0 rounded-sm bg-surface-container-low px-1.5 py-0.5 text-xs font-medium tabular-nums text-on-surface-variant">
              {badge}
            </span>
          )}
        </div>
        {href && (
          <a
            href={href}
            aria-label={`${title}: xem chi tiết`}
            className="shrink-0 text-xs font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary"
          >
            Chi tiết
          </a>
        )}
      </div>
      {hasData ? (
        children
      ) : (
        <Empty kind={kind}>
          {emptyText || "Chưa có dữ liệu trong kỳ đã chọn."}
        </Empty>
      )}
    </section>
  );
}

function DonutChartCard({
  title,
  data,
  kind = "task",
  href,
  emptyText,
  badge,
  chartMotion,
  extra,
}: {
  title: string;
  data: Array<{ name: string; value: number }>;
  kind?: HrEmptyIllustrationKind;
  href?: string;
  emptyText?: string;
  badge?: string;
  chartMotion: boolean;
  extra?: React.ReactNode;
}) {
  const rows = data.filter((row) => row.value > 0);
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  return (
    <ChartCard
      title={title}
      hasData={rows.length > 0}
      kind={kind}
      href={href}
      emptyText={emptyText}
      badge={badge}
    >
      {extra}
      <div
        className="grid h-56 min-w-0 grid-cols-1 items-center gap-2 sm:grid-cols-[54%_1fr]"
        role="img"
        aria-label={title}
      >
        <OverviewChartViewport>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={rows}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius="54%"
                outerRadius="78%"
                stroke="none"
                paddingAngle={2}
                isAnimationActive={chartMotion}
              >
                {rows.map((row, index) => (
                  <Cell key={row.name} fill={colors[index % colors.length]} />
                ))}
              </Pie>
              <Tooltip formatter={countTooltip} />
            </PieChart>
          </ResponsiveContainer>
        </OverviewChartViewport>
        <ul className="space-y-1.5 text-xs">
          {rows.slice(0, 6).map((row, index) => {
            const pct = total > 0 ? Math.round((row.value / total) * 100) : 0;
            return (
              <li
                key={row.name}
                className="flex min-w-0 items-center justify-between gap-2"
              >
                <span className="flex min-w-0 items-center gap-1.5 text-on-surface-variant">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: colors[index % colors.length] }}
                    aria-hidden="true"
                  />
                  <span className="truncate" title={row.name}>
                    {row.name}
                  </span>
                </span>
                <strong className="shrink-0 font-medium tabular-nums text-on-surface">
                  {integer(row.value)} ({pct}%)
                </strong>
              </li>
            );
          })}
        </ul>
      </div>
    </ChartCard>
  );
}

function HorizontalBarCard({
  title,
  data,
  barName,
  color = colors[0],
  kind = "task",
  href,
  emptyText,
  chartMotion,
  isMoney = false,
  dataKey = "value",
}: {
  title: string;
  data: Array<Record<string, unknown>>;
  barName: string;
  color?: string;
  kind?: HrEmptyIllustrationKind;
  href?: string;
  emptyText?: string;
  chartMotion: boolean;
  isMoney?: boolean;
  dataKey?: string;
}) {
  return (
    <ChartCard
      title={title}
      hasData={data.length > 0}
      kind={kind}
      href={href}
      emptyText={emptyText}
    >
      <div className="h-56 min-w-0" role="img" aria-label={title}>
        <OverviewChartViewport>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 4, right: isMoney ? 56 : 44, left: 0, bottom: 0 }}
            >
              <XAxis
                type="number"
                axisLine={false}
                tickLine={false}
                allowDecimals={!isMoney}
                tick={{ fontSize: 10 }}
                tickFormatter={isMoney ? (v: number) => shortMoney(v) : undefined}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={104}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11 }}
                tickFormatter={(v: string) => truncateAxis(String(v || ""), 16)}
              />
              <Tooltip formatter={isMoney ? moneyTooltip : countTooltip} />
              <Bar
                dataKey={dataKey}
                name={barName}
                fill={color}
                radius={[0, 4, 4, 0]}
                maxBarSize={18}
                isAnimationActive={chartMotion}
              >
                <LabelList
                  dataKey={dataKey}
                  position="right"
                  fill="var(--color-on-surface-variant)"
                  fontSize={11}
                  formatter={(value: unknown) =>
                    typeof value === "number" && value > 0
                      ? isMoney
                        ? shortMoney(value)
                        : integer(value)
                      : ""
                  }
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </OverviewChartViewport>
      </div>
    </ChartCard>
  );
}

export default function HealthcareOverviewSection() {
  const { userProfile } = useAuth();
  const branch = useBranch();
  if (branch.loading) {
    return (
      <div
        role="status"
        aria-label="Đang tải Tổng quan Y tế"
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6"
      >
        {Array.from({ length: 6 }, (_, index) => (
          <div
            key={index}
            className="h-28 animate-pulse rounded-md bg-surface-container-low motion-reduce:animate-none"
          />
        ))}
      </div>
    );
  }
  if (!branch.activeBranchId) {
    return (
      <div className="finance-chart-card">
        <Feedback
          error={
            branch.error ||
            "Chọn chi nhánh đang hoạt động để xem Tổng quan y tế."
          }
          onRetry={branch.error ? branch.retry : undefined}
        />
      </div>
    );
  }
  return (
    <HealthcareOverviewContent
      key={`${userProfile?.uid}:${userProfile?.companyCode}:${branch.activeBranchId}`}
      branchId={branch.activeBranchId}
      branchName={branch.activeBranch?.name}
    />
  );
}

function HealthcareOverviewContent({
  branchId,
  branchName,
}: {
  branchId: string;
  branchName?: string;
}) {
  const reduceMotion = useReducedMotion();
  const chartMotion = !reduceMotion;
  const period = useOverviewPeriod();
  const api = useMemo(() => healthcareApi(branchId), [branchId]);

  const path = useMemo(() => {
    if (!period) return "/overview";
    const params = new URLSearchParams({ from: period.from, to: period.to });
    if (period.previousFrom && period.previousTo) {
      params.set("previousFrom", period.previousFrom);
      params.set("previousTo", period.previousTo);
    }
    return `/overview?${params.toString()}`;
  }, [period]);

  const { data, loading, error, refresh } =
    useHealthcareQuery<HealthcareOverview>(api, path);

  const patientMap = new Map(
    data?.patientReferences.map((row) => [row._id, row]),
  );
  const patientLink = (id: string) => {
    const patient = patientMap.get(id);
    return (
      <RowLink href={healthcareHref({ tab: "patients", patientId: id }, branchId)}>
        {patient ? `${patient.code} · ${patient.name}` : "Mở hồ sơ bệnh nhân"}
      </RowLink>
    );
  };

  const analytics = data?.analytics;
  const inventoryAlerts = analytics
    ? analytics.inventory.lowStock +
      analytics.inventory.outOfStock +
      analytics.inventory.expired +
      analytics.inventory.expiringSoon
    : 0;

  const stockHealthData = useMemo(() => {
    if (!analytics || analytics.inventory.totalItems === 0) return [];
    return [
      { name: "Đủ tồn", value: analytics.inventory.inStock, color: colors[1] },
      { name: "Sắp hết", value: analytics.inventory.lowStock, color: colors[2] },
      { name: "Hết hàng", value: analytics.inventory.outOfStock, color: colors[4] },
      { name: "Sắp hết hạn", value: analytics.inventory.expiringSoon, color: colors[3] },
      { name: "Hết hạn", value: analytics.inventory.expired, color: colors[4] },
    ];
  }, [analytics]);

  const cashflowTrendData = useMemo(() => {
    if (!analytics) return [];
    if (analytics.finance.stockFlowTrend.length > 0) {
      return analytics.finance.stockFlowTrend;
    }
    if (
      analytics.finance.receiptValue > 0 ||
      analytics.finance.issueValue > 0 ||
      analytics.finance.visitPaymentTotal > 0
    ) {
      return [
        {
          label: "Trong kỳ",
          receiptValue: analytics.finance.receiptValue,
          issueValue: analytics.finance.issueValue,
          visitPayment: analytics.finance.visitPaymentTotal,
        },
      ];
    }
    return [];
  }, [analytics]);

  const hasVisitTrend = Boolean(
    analytics?.visitTrend.some(
      (row) => row.visits > 0 || row.appointments > 0 || row.newPatients > 0,
    ),
  );

  const patientsHref = healthcareHref({ tab: "patients" }, branchId);
  const visitsHref = healthcareHref({ tab: "visits" }, branchId);
  const appointmentsHref = healthcareHref({ tab: "appointments" }, branchId);
  const careHref = healthcareHref({ tab: "care" }, branchId);
  const suppliesHref = healthcareHref({ tab: "supplies" }, branchId);
  const equipmentHref = healthcareHref({ tab: "equipment" }, branchId);

  const detailStrip = data && analytics
    ? [
        {
          label: "Thanh toán khám trong kỳ",
          value: money(analytics.finance.visitPaymentTotal),
          tone: "blue" as const,
        },
        {
          label: "TB thanh toán / lượt",
          value:
            analytics.finance.averageVisitPayment > 0
              ? money(analytics.finance.averageVisitPayment)
              : "—",
          tone: "teal" as const,
        },
        {
          label: "Giá trị nhập kho",
          value: money(analytics.finance.receiptValue),
          tone: "blue" as const,
        },
        {
          label: "Giá trị xuất kho",
          value: money(analytics.finance.issueValue),
          tone: "orange" as const,
        },
        {
          label: "Khách khám trong kỳ",
          value: integer(analytics.uniquePatientsVisited),
          tone: "violet" as const,
        },
        {
          label: "Việc chăm sóc đến hạn",
          value: data.careCount === null ? "—" : integer(data.careCount),
          tone: (data.careCount || 0) > 0 ? ("red" as const) : ("teal" as const),
        },
      ]
    : [];

  return (
    <section
      aria-label="Tổng quan y tế"
      className="finance-overview space-y-3 pb-5 text-left text-on-surface"
    >
      {(loading || error) && !data && (
        <div className="finance-chart-card">
          <Feedback loading={loading} error={error} onRetry={refresh} />
        </div>
      )}

      {error && data && (
        <div
          role="alert"
          className="rounded-md border border-error bg-error-container px-4 py-3 text-sm text-on-error-container"
        >
          {error}
        </div>
      )}

      {data && (
        <>
          {/* KPI Container matching Finance / Student / Gym Overview */}
          <section className="finance-chart-card !p-3 sm:!p-4" aria-label="Chỉ số y tế">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-baseline gap-2">
                <h2
                  id="healthcare-overview-title"
                  data-typography="section-title"
                  className="text-balance text-lg font-semibold text-on-surface"
                >
                  Tình hình y tế
                </h2>
                {branchName && (
                  <span className="text-xs text-on-surface-variant">
                    {branchName}
                  </span>
                )}
              </div>
              <a
                href={patientsHref}
                className="inline-flex min-h-8 items-center gap-1 rounded-sm text-xs font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                Mở Quản lý y tế
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </a>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
              <article className="finance-kpi finance-kpi-0 flex min-h-28 flex-col">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-pretty text-xs font-medium text-white">
                    Tổng bệnh nhân
                  </p>
                  <UsersRound
                    className="size-4 shrink-0 text-on-primary opacity-70"
                    aria-hidden="true"
                  />
                </div>
                <p className="mt-1 text-lg font-semibold tabular-nums text-white sm:text-xl">
                  <AnimatedOverviewValue value={data.patients} format={integer} />
                </p>
                <p className="finance-kpi-delta mt-auto w-full bg-surface-container-lowest px-2 py-1 text-xs font-medium leading-4 tabular-nums text-on-surface-variant">
                  {analytics
                    ? `${integer(analytics.uniquePatientsVisited)} khách khám kỳ này`
                    : "Hồ sơ toàn chi nhánh"}
                </p>
              </article>

              <article className="finance-kpi finance-kpi-1 flex min-h-28 flex-col">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-pretty text-xs font-medium text-white">
                    Bệnh nhân mới
                  </p>
                  <UserPlus
                    className="size-4 shrink-0 text-on-primary opacity-70"
                    aria-hidden="true"
                  />
                </div>
                <p className="mt-1 text-lg font-semibold tabular-nums text-white sm:text-xl">
                  <AnimatedOverviewValue
                    value={analytics?.newPatientsInPeriod ?? null}
                    format={integer}
                  />
                </p>
                <OverviewKpiDelta
                  value={analytics?.newPatientsInPeriod}
                  previous={analytics?.previousPatientsInPeriod}
                  unit="BN"
                />
              </article>

              <article className="finance-kpi finance-kpi-2 flex min-h-28 flex-col">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-pretty text-xs font-medium text-white">
                    Lượt khám trong kỳ
                  </p>
                  <Stethoscope
                    className="size-4 shrink-0 text-on-primary opacity-70"
                    aria-hidden="true"
                  />
                </div>
                <p className="mt-1 text-lg font-semibold tabular-nums text-white sm:text-xl">
                  <AnimatedOverviewValue value={data.visitCount} format={integer} />
                </p>
                <OverviewKpiDelta
                  value={data.visitCount}
                  previous={analytics?.previousVisitCount}
                  unit="lượt"
                />
              </article>

              <article className="finance-kpi finance-kpi-3 flex min-h-28 flex-col">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-pretty text-xs font-medium text-white">
                    Lịch hẹn trong kỳ
                  </p>
                  <CalendarDays
                    className="size-4 shrink-0 text-on-primary opacity-70"
                    aria-hidden="true"
                  />
                </div>
                <p className="mt-1 text-lg font-semibold tabular-nums text-white sm:text-xl">
                  <AnimatedOverviewValue
                    value={
                      data.appointmentCount === null
                        ? null
                        : (analytics?.appointmentsInPeriod ?? data.appointmentCount)
                    }
                    format={integer}
                  />
                </p>
                <OverviewKpiDelta
                  value={
                    data.appointmentCount === null
                      ? null
                      : analytics?.appointmentsInPeriod
                  }
                  previous={analytics?.previousAppointmentsInPeriod}
                  unit="lịch"
                />
              </article>

              <article className="finance-kpi finance-kpi-4 flex min-h-28 flex-col">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-pretty text-xs font-medium text-white">
                    Thanh toán khám
                  </p>
                  <Wallet
                    className="size-4 shrink-0 text-on-primary opacity-70"
                    aria-hidden="true"
                  />
                </div>
                <p className="mt-1 break-words text-lg font-semibold tabular-nums text-white sm:text-xl">
                  <AnimatedOverviewValue
                    value={analytics?.finance.visitPaymentTotal ?? null}
                    format={money}
                  />
                </p>
                <OverviewKpiDelta
                  value={analytics?.finance.visitPaymentTotal}
                  previous={analytics?.finance.previousVisitPaymentTotal}
                  unit="đ"
                />
              </article>

              <article className="finance-kpi finance-kpi-5 flex min-h-28 flex-col">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-pretty text-xs font-medium text-white">
                    Giá trị tồn kho
                  </p>
                  <Package
                    className="size-4 shrink-0 text-on-primary opacity-70"
                    aria-hidden="true"
                  />
                </div>
                <p className="mt-1 break-words text-lg font-semibold tabular-nums text-white sm:text-xl">
                  <AnimatedOverviewValue
                    value={analytics?.inventory.totalValue ?? null}
                    format={money}
                  />
                </p>
                <p className="finance-kpi-delta mt-auto w-full bg-surface-container-lowest px-2 py-1 text-xs font-medium leading-4 tabular-nums text-on-surface-variant">
                  {analytics
                    ? `${integer(analytics.inventory.totalItems)} vật tư · ${integer(inventoryAlerts)} cảnh báo`
                    : "Số dư hiện tại"}
                </p>
              </article>
            </div>
          </section>

          {/* Financial & Operational Detail Strip */}
          {analytics && (
            <section
              className="finance-chart-card"
              aria-label="Số liệu tài chính và vận hành y tế chi tiết"
            >
              <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                <h3 className="text-balance text-sm font-semibold text-on-surface">
                  Số liệu tài chính &amp; vận hành chi tiết
                </h3>
                <span className="text-xs tabular-nums text-on-surface-variant">
                  {integer(analytics.finance.paidVisitCount)} lượt đã thu ·{" "}
                  {integer(analytics.totalPendingAppointments)} lịch đang chờ ·{" "}
                  {integer(analytics.equipment.total)} thiết bị
                </span>
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 xl:grid-cols-6">
                {detailStrip.map((item) => (
                  <div key={item.label} className="min-w-0">
                    <dt className="text-pretty text-xs text-on-surface-variant">
                      {item.label}
                    </dt>
                    <dd
                      className={cn(
                        "mt-0.5 break-words text-lg font-bold tabular-nums",
                        item.value === "—"
                          ? "text-on-surface-variant"
                          : `finance-detail-value finance-detail-value--${item.tone}`,
                      )}
                    >
                      {item.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {/* Charts Grid */}
          {analytics && (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
              {/* 1. Clinical Activity Trend (Visits, Appointments, New Patients) */}
              <ChartCard
                title="Xu hướng lượt khám, lịch hẹn & bệnh nhân mới"
                hasData={hasVisitTrend}
                kind="calendar"
                className="xl:col-span-2"
                href={visitsHref}
                emptyText="Chưa có lượt khám, lịch hẹn hoặc bệnh nhân mới trong kỳ này."
              >
                <div
                  className="h-60 min-w-0"
                  role="img"
                  aria-label="Biểu đồ xu hướng lượt khám, lịch hẹn và bệnh nhân mới"
                >
                  <OverviewChartViewport>
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        data={analytics.visitTrend}
                        margin={{ top: 8, right: 12, left: -12, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="hcVisitsGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={colors[0]} stopOpacity={0.28} />
                            <stop offset="95%" stopColor={colors[0]} stopOpacity={0.02} />
                          </linearGradient>
                          <linearGradient id="hcApptGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={colors[1]} stopOpacity={0.22} />
                            <stop offset="95%" stopColor={colors[1]} stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          stroke="var(--color-outline-variant)"
                          strokeDasharray="3 3"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="label"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 10 }}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          allowDecimals={false}
                          tick={{ fontSize: 10 }}
                        />
                        <Tooltip formatter={countTooltip} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Area
                          type="monotone"
                          dataKey="visits"
                          name="Lượt khám"
                          stroke={colors[0]}
                          fill="url(#hcVisitsGrad)"
                          strokeWidth={2}
                          isAnimationActive={chartMotion}
                        />
                        <Area
                          type="monotone"
                          dataKey="appointments"
                          name="Lịch hẹn"
                          stroke={colors[1]}
                          fill="url(#hcApptGrad)"
                          strokeWidth={2}
                          isAnimationActive={chartMotion}
                        />
                        <Line
                          type="monotone"
                          dataKey="newPatients"
                          name="Bệnh nhân mới"
                          stroke={colors[3]}
                          strokeWidth={2}
                          dot={false}
                          isAnimationActive={chartMotion}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </OverviewChartViewport>
                </div>
              </ChartCard>

              {/* 2. Appointment Status */}
              <DonutChartCard
                title="Trạng thái lịch hẹn trong kỳ"
                data={analytics.appointmentByStatus}
                kind="calendar"
                href={appointmentsHref}
                emptyText="Chưa có lịch hẹn nào trong kỳ đã chọn."
                chartMotion={chartMotion}
              />

              {/* 3. Healthcare Cashflow: Visit Payments, Stock Receipts & Issues */}
              <ChartCard
                title="Dòng tiền y tế (Thanh toán khám, Nhập & Xuất kho)"
                hasData={cashflowTrendData.length > 0}
                kind="payroll"
                className="xl:col-span-2"
                href={suppliesHref}
                emptyText="Chưa có phát sinh thanh toán khám hoặc nhập/xuất kho trong kỳ này."
                badge={`${integer(analytics.finance.receiptCount)} nhập · ${integer(analytics.finance.issueCount)} xuất`}
              >
                <div
                  className="h-60 min-w-0"
                  role="img"
                  aria-label="Biểu đồ thanh toán khám, giá trị nhập kho và xuất kho"
                >
                  <OverviewChartViewport>
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        data={cashflowTrendData}
                        margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid
                          stroke="var(--color-outline-variant)"
                          strokeDasharray="3 3"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="label"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 10 }}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 10 }}
                          tickFormatter={(v: number) => shortMoney(v)}
                          width={56}
                        />
                        <Tooltip formatter={moneyTooltip} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar
                          dataKey="receiptValue"
                          name="Nhập kho"
                          fill={colors[0]}
                          radius={[4, 4, 0, 0]}
                          maxBarSize={26}
                          isAnimationActive={chartMotion}
                        />
                        <Bar
                          dataKey="issueValue"
                          name="Xuất kho"
                          fill={colors[2]}
                          radius={[4, 4, 0, 0]}
                          maxBarSize={26}
                          isAnimationActive={chartMotion}
                        />
                        <Line
                          type="monotone"
                          dataKey="visitPayment"
                          name="Thanh toán khám"
                          stroke={colors[1]}
                          strokeWidth={2}
                          dot={false}
                          isAnimationActive={chartMotion}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </OverviewChartViewport>
                </div>
              </ChartCard>

              {/* 4. Payment Status Breakdown */}
              <DonutChartCard
                title="Trạng thái thanh toán lượt khám"
                data={analytics.finance.paymentStatusBreakdown}
                kind="payroll"
                href={visitsHref}
                emptyText="Chưa có lượt khám nào trong kỳ để thống kê thanh toán."
                chartMotion={chartMotion}
              />

              {/* 5. Patient Gender Distribution */}
              <DonutChartCard
                title="Phân bổ giới tính bệnh nhân"
                data={analytics.patientsByGender}
                kind="worker"
                href={patientsHref}
                emptyText="Chưa có dữ liệu hồ sơ bệnh nhân."
                chartMotion={chartMotion}
              />

              {/* 6. Patient Age Groups */}
              <ChartCard
                title="Phân bổ nhóm tuổi bệnh nhân"
                hasData={analytics.patientsByAgeGroup.length > 0}
                kind="worker"
                href={patientsHref}
                emptyText="Chưa có dữ liệu năm sinh bệnh nhân."
              >
                <div
                  className="h-56 min-w-0"
                  role="img"
                  aria-label="Biểu đồ phân bổ nhóm tuổi bệnh nhân"
                >
                  <OverviewChartViewport>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={analytics.patientsByAgeGroup}
                        margin={{ top: 18, right: 8, left: -16, bottom: 0 }}
                      >
                        <CartesianGrid
                          stroke="var(--color-outline-variant)"
                          strokeDasharray="3 3"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="name"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 10 }}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          allowDecimals={false}
                          tick={{ fontSize: 10 }}
                        />
                        <Tooltip formatter={countTooltip} />
                        <Bar
                          dataKey="value"
                          name="Bệnh nhân"
                          fill={colors[0]}
                          radius={[4, 4, 0, 0]}
                          maxBarSize={32}
                          isAnimationActive={chartMotion}
                        >
                          <LabelList
                            dataKey="value"
                            position="top"
                            fill="var(--color-on-surface-variant)"
                            fontSize={11}
                            formatter={(v: unknown) =>
                              typeof v === "number" && v > 0 ? integer(v) : ""
                            }
                          />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </OverviewChartViewport>
                </div>
              </ChartCard>

              {/* 7. New vs Returning Patients */}
              <DonutChartCard
                title="Cơ cấu khách mới & tái khám"
                data={analytics.patientVisitType}
                kind="worker"
                href={visitsHref}
                emptyText="Chưa có lượt khám trong kỳ để phân loại khách mới và tái khám."
                chartMotion={chartMotion}
              />

              {/* 8. Visit Status Breakdown */}
              <HorizontalBarCard
                title="Trạng thái lượt khám trong kỳ"
                data={analytics.visitsInPeriodByStatus}
                barName="Lượt khám"
                color={colors[3]}
                kind="calendar"
                href={visitsHref}
                emptyText="Chưa có lượt khám nào trong kỳ."
                chartMotion={chartMotion}
              />

              {/* 9. Visits by Doctor */}
              <HorizontalBarCard
                title="Lượt khám theo bác sĩ"
                data={analytics.visitsByDoctor}
                barName="Lượt khám"
                color={colors[0]}
                kind="worker"
                href={visitsHref}
                emptyText="Chưa có dữ liệu bác sĩ phụ trách trong kỳ."
                chartMotion={chartMotion}
              />

              {/* 10. Visits by Department */}
              <HorizontalBarCard
                title="Lượt khám theo phòng ban / khoa"
                data={analytics.visitsByDepartment}
                barName="Lượt khám"
                color={colors[1]}
                kind="worker"
                href={visitsHref}
                emptyText="Chưa có dữ liệu phòng ban trong kỳ."
                chartMotion={chartMotion}
              />

              {/* 11. Popular Treatment Services */}
              <HorizontalBarCard
                title="Dịch vụ điều trị phổ biến"
                data={analytics.visitsByService}
                barName="Lượt sử dụng"
                color={colors[2]}
                kind="task"
                href={visitsHref}
                emptyText="Chưa có dữ liệu dịch vụ điều trị trong kỳ."
                chartMotion={chartMotion}
              />

              {/* 12. Appointments by Doctor */}
              <HorizontalBarCard
                title="Lịch hẹn theo bác sĩ"
                data={analytics.appointmentsByDoctor}
                barName="Lịch hẹn"
                color={colors[3]}
                kind="calendar"
                href={appointmentsHref}
                emptyText="Chưa có lịch hẹn gắn bác sĩ trong kỳ."
                chartMotion={chartMotion}
              />

              {/* Optional Hospital Report Charts (shown automatically when data exists) */}
              {analytics.visitsByCustomerType.length > 0 && (
                <DonutChartCard
                  title="Đối tượng khám"
                  data={analytics.visitsByCustomerType}
                  kind="worker"
                  href={visitsHref}
                  chartMotion={chartMotion}
                />
              )}

              {analytics.topDiagnoses.length > 0 && (
                <HorizontalBarCard
                  title="Chẩn đoán phổ biến"
                  data={analytics.topDiagnoses}
                  barName="Ca khám"
                  color={colors[4]}
                  kind="task"
                  href={visitsHref}
                  chartMotion={chartMotion}
                />
              )}

              {/* 13. Inventory Health & Expiry Bar Chart */}
              <ChartCard
                title="Tình trạng tồn kho & hạn dùng vật tư"
                hasData={stockHealthData.length > 0}
                kind="task"
                href={suppliesHref}
                emptyText="Chưa có vật tư y tế nào trong kho chi nhánh."
                badge={`${integer(analytics.inventory.totalItems)} mã`}
              >
                <div
                  className="h-56 min-w-0"
                  role="img"
                  aria-label="Biểu đồ tình trạng tồn kho và hạn dùng vật tư y tế"
                >
                  <OverviewChartViewport>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={stockHealthData}
                        margin={{ top: 18, right: 8, left: -16, bottom: 0 }}
                      >
                        <CartesianGrid
                          stroke="var(--color-outline-variant)"
                          strokeDasharray="3 3"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="name"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 10 }}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          allowDecimals={false}
                          tick={{ fontSize: 10 }}
                        />
                        <Tooltip formatter={countTooltip} />
                        <Bar
                          dataKey="value"
                          name="Vật tư"
                          radius={[4, 4, 0, 0]}
                          maxBarSize={34}
                          isAnimationActive={chartMotion}
                        >
                          {stockHealthData.map((row) => (
                            <Cell key={row.name} fill={row.color} />
                          ))}
                          <LabelList
                            dataKey="value"
                            position="top"
                            fill="var(--color-on-surface-variant)"
                            fontSize={11}
                            formatter={(v: unknown) =>
                              typeof v === "number" && v > 0 ? integer(v) : ""
                            }
                          />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </OverviewChartViewport>
                </div>
              </ChartCard>

              {/* 14. Inventory Value by Category */}
              <HorizontalBarCard
                title={
                  analytics.inventory.totalValue > 0
                    ? "Giá trị tồn kho theo danh mục"
                    : "Số lượng tồn kho theo danh mục"
                }
                data={analytics.inventory.byCategory}
                dataKey={analytics.inventory.totalValue > 0 ? "value" : "quantity"}
                barName={
                  analytics.inventory.totalValue > 0
                    ? "Giá trị tồn"
                    : "Số lượng tồn"
                }
                color={colors[1]}
                kind="task"
                href={suppliesHref}
                emptyText="Chưa có tồn kho vật tư theo danh mục."
                chartMotion={chartMotion}
                isMoney={analytics.inventory.totalValue > 0}
              />

              {/* 15. Inventory by Warehouse (when data exists) */}
              {analytics.inventory.byWarehouse.length > 0 && (
                <HorizontalBarCard
                  title={
                    analytics.inventory.totalValue > 0
                      ? "Giá trị tồn kho theo kho lưu trữ"
                      : "Số lượng tồn kho theo kho lưu trữ"
                  }
                  data={analytics.inventory.byWarehouse}
                  dataKey={analytics.inventory.totalValue > 0 ? "value" : "quantity"}
                  barName={
                    analytics.inventory.totalValue > 0
                      ? "Giá trị tồn"
                      : "Số lượng tồn"
                  }
                  color={colors[0]}
                  kind="task"
                  href={suppliesHref}
                  chartMotion={chartMotion}
                  isMoney={analytics.inventory.totalValue > 0}
                />
              )}

              {/* 16. Medical Equipment & Inspection */}
              <DonutChartCard
                title="Trang thiết bị y tế & kiểm định"
                data={analytics.equipment.byStatus}
                kind="project"
                href={equipmentHref}
                emptyText="Chưa có trang thiết bị y tế nào được khai báo."
                badge={`${integer(analytics.equipment.total)} thiết bị`}
                chartMotion={chartMotion}
                extra={
                  (analytics.equipment.overdueInspection > 0 ||
                    analytics.equipment.soonInspection > 0 ||
                    analytics.equipment.pendingRequests > 0) && (
                    <div className="mb-2 flex flex-wrap gap-2 text-xs">
                      {analytics.equipment.overdueInspection > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-sm bg-surface-container-low px-2 py-0.5 font-medium tabular-nums finance-detail-value finance-detail-value--red">
                          <AlertTriangle className="size-3.5" aria-hidden="true" />
                          {integer(analytics.equipment.overdueInspection)} quá hạn kiểm định
                        </span>
                      )}
                      {analytics.equipment.soonInspection > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-sm bg-surface-container-low px-2 py-0.5 font-medium tabular-nums finance-detail-value finance-detail-value--orange">
                          {integer(analytics.equipment.soonInspection)} sắp đến hạn
                        </span>
                      )}
                      {analytics.equipment.pendingRequests > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-sm bg-surface-container-low px-2 py-0.5 font-medium tabular-nums text-on-surface-variant">
                          {integer(analytics.equipment.pendingRequests)} phiếu mượn chờ duyệt
                        </span>
                      )}
                    </div>
                  )
                }
              />

              {/* Optional Equipment by Category */}
              {analytics.equipment.byCategory.length > 0 && (
                <HorizontalBarCard
                  title="Thiết bị y tế theo phân loại"
                  data={analytics.equipment.byCategory}
                  barName="Thiết bị"
                  color={colors[3]}
                  kind="project"
                  href={equipmentHref}
                  chartMotion={chartMotion}
                />
              )}

              {/* 17. Care Tasks Status */}
              <DonutChartCard
                title="Tiến độ việc chăm sóc bệnh nhân"
                data={analytics.careByStatus}
                kind="task"
                href={careHref}
                emptyText="Chưa có công việc chăm sóc nào."
                badge={
                  analytics.careCompletionRate !== null
                    ? `${analytics.careCompletionRate}% hoàn tất`
                    : undefined
                }
                chartMotion={chartMotion}
              />
            </div>
          )}

          {/* Actionable Tables: Lịch hẹn hôm nay & Việc chăm sóc đến hạn */}
          <div className="grid gap-3 xl:grid-cols-2">
            {data.appointmentCount !== null && (
              <section className="finance-chart-card space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-balance text-sm font-semibold text-on-surface">
                      Lịch hẹn hôm nay
                    </h3>
                    <span className="rounded-sm bg-surface-container-low px-1.5 py-0.5 text-xs font-medium tabular-nums text-on-surface-variant">
                      {integer(data.appointmentCount)}
                    </span>
                  </div>
                  <a
                    href={appointmentsHref}
                    aria-label="Lịch hẹn hôm nay: xem tất cả"
                    className="text-xs font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    Xem tất cả
                  </a>
                </div>
                <Table
                  headers={["Bệnh nhân", "Giờ hẹn", "Trạng thái"]}
                  emptyKind="calendar"
                  empty={
                    !data.todayAppointments.length
                      ? "Hôm nay chưa có lịch đang chờ."
                      : undefined
                  }
                >
                  {data.todayAppointments.map((row) => (
                    <tr key={row._id}>
                      <TableCell>{patientLink(row.patientId)}</TableCell>
                      <TableCell>
                        <RowLink
                          href={healthcareHref(
                            { tab: "appointments", recordId: row._id },
                            branchId,
                          )}
                        >
                          {timeLabel(row.startsAt)}
                        </RowLink>
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          status={row.status}
                          label={appointmentLabels[row.status]}
                        />
                      </TableCell>
                    </tr>
                  ))}
                </Table>
              </section>
            )}

            {data.careCount !== null && (
              <section className="finance-chart-card space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-balance text-sm font-semibold text-on-surface">
                      Việc chăm sóc đến hạn
                    </h3>
                    <span className="rounded-sm bg-surface-container-low px-1.5 py-0.5 text-xs font-medium tabular-nums text-on-surface-variant">
                      {integer(data.careCount)}
                    </span>
                  </div>
                  <a
                    href={careHref}
                    aria-label="Việc chăm sóc đến hạn: xem tất cả"
                    className="text-xs font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    Xem tất cả
                  </a>
                </div>
                <Table
                  headers={["Công việc", "Bệnh nhân", "Hạn xử lý"]}
                  emptyKind="task"
                  empty={
                    !data.dueCare.length
                      ? "Chưa có việc chăm sóc đến hạn."
                      : undefined
                  }
                >
                  {data.dueCare.map((row) => (
                    <tr key={row._id}>
                      <TableCell>
                        <RowLink
                          href={healthcareHref(
                            { tab: "care", recordId: row._id },
                            branchId,
                          )}
                        >
                          {row.title}
                        </RowLink>
                      </TableCell>
                      <TableCell>{patientLink(row.patientId)}</TableCell>
                      <TableCell>{dayLabel(row.dueOn)}</TableCell>
                    </tr>
                  ))}
                </Table>
              </section>
            )}
          </div>
        </>
      )}
    </section>
  );
}
