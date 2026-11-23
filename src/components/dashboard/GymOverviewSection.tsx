import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import {
  AlertTriangle,
  ArrowRight,
  Dumbbell,
  Ruler,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { GymTab } from "../../../shared/gym/types";
import { useAuth } from "../../context/AuthContext";
import { useBranch } from "../../context/BranchContext";
import { gymApi } from "../../modules/gym/api";
import { cn } from "../../modules/student-management/lib/utils";
import { ErpRefreshButton } from "../common/ErpRefreshButton";
import {
  HrEmptyIllustration,
  type HrEmptyIllustrationKind,
} from "../hr/HrEmptyIllustration";
import { AnimatedOverviewValue } from "./AnimatedOverviewValue";
import { OverviewChartViewport } from "./OverviewChartViewport";
import { OverviewKpiDelta } from "./OverviewKpiDelta";
import {
  OverviewPeriodActions,
  useOverviewPeriod,
} from "./OverviewPeriodContext";
import {
  buildGymOverview,
  type GymDashboardPayload,
} from "./gymOverviewMetrics";
import "../../modules/finance/finance-overview.css";

const colors = [
  "var(--finance-chart-blue)",
  "var(--finance-chart-teal)",
  "var(--finance-chart-orange)",
  "var(--finance-chart-violet)",
  "var(--finance-chart-red)",
];

const kpiIcons = [
  Users,
  UserPlus,
  Dumbbell,
  Ruler,
  TrendingUp,
  AlertTriangle,
] as const;

const integer = (value: number) =>
  new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(value);

const decimal = (value: number) =>
  new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(value);

const countTooltip = (value: number | string | undefined) =>
  typeof value === "number" ? integer(value) : value ?? "—";

function gymHref(tab: GymTab, branchId: string) {
  const params = new URLSearchParams({ sub: tab });
  if (branchId) params.set("branch", branchId);
  return `/gym?${params.toString()}`;
}

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
  kind = "training",
  className = "",
  href,
  emptyText,
}: {
  title: string;
  children: React.ReactNode;
  hasData: boolean;
  kind?: HrEmptyIllustrationKind;
  className?: string;
  href?: string;
  emptyText?: string;
}) {
  return (
    <section className={cn("finance-chart-card", className)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-balance text-sm font-semibold text-on-surface">
          {title}
        </h3>
        {href && (
          <a
            href={href}
            aria-label={`${title}: xem chi tiết`}
            className="shrink-0 text-xs font-semibold text-primary focus-visible:outline-2 focus-visible:outline-primary"
          >
            Chi tiết
          </a>
        )}
      </div>
      {hasData ? (
        children
      ) : (
        <Empty kind={kind}>
          {emptyText || "Chưa có dữ liệu trong phạm vi đã chọn."}
        </Empty>
      )}
    </section>
  );
}

export default function GymOverviewSection() {
  const { userProfile } = useAuth();
  const branch = useBranch();

  if (branch.loading) {
    return (
      <div
        role="status"
        aria-label="Đang tải Tổng quan Phòng Gym"
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
      <p
        role="status"
        className="finance-chart-card text-pretty text-sm text-on-surface-variant"
      >
        {branch.error ||
          "Chọn chi nhánh đang hoạt động để xem Tổng quan Phòng Gym."}
      </p>
    );
  }

  return (
    <GymOverviewContent
      key={`${userProfile?.uid || "user"}:${branch.activeBranchId}`}
      branchId={branch.activeBranchId}
    />
  );
}

function GymOverviewContent({ branchId }: { branchId: string }) {
  const period = useOverviewPeriod();
  const reduceMotion = useReducedMotion();
  const chartMotion = !reduceMotion;
  const api = useMemo(() => gymApi(branchId), [branchId]);
  const from = period?.from || "";
  const to = period?.to || "";
  const previousFrom = period?.previousFrom || "";
  const previousTo = period?.previousTo || "";

  const [revision, setRevision] = useState(0);
  const [payload, setPayload] = useState<GymDashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const hasLoaded = useRef(false);

  const load = useCallback(
    async (signal: AbortSignal) => {
      const params = new URLSearchParams();
      if (from && to) {
        params.set("from", from);
        params.set("to", to);
      }
      if (previousFrom && previousTo) {
        params.set("previousFrom", previousFrom);
        params.set("previousTo", previousTo);
      }
      const queryStr = params.toString();
      const path = queryStr ? `/dashboard?${queryStr}` : "/dashboard";

      if (hasLoaded.current) setRefreshing(true);
      else setLoading(true);
      setError("");

      try {
        const result = await api.request<GymDashboardPayload>(
          path,
          "GET",
          undefined,
          signal,
        );
        if (signal.aborted) return;
        hasLoaded.current = true;
        setPayload(result);
      } catch (err) {
        if (signal.aborted) return;
        setError(
          err instanceof Error
            ? err.message
            : "Không thể tải dữ liệu Tổng quan Phòng Gym.",
        );
      } finally {
        if (!signal.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [api, from, to, previousFrom, previousTo],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load, revision]);

  const data = useMemo(
    () => (payload ? buildGymOverview(payload) : null),
    [payload],
  );

  const kpis = data
    ? [
        { label: "Tổng học viên", value: data.totalCustomers },
        {
          label: "Học viên mới",
          value: data.newCustomers.current,
          previous: data.newCustomers.previous,
          unit: "học viên",
        },
        {
          label: "Buổi tập trong kỳ",
          value: data.sessionsInPeriod.current,
          previous: data.sessionsInPeriod.previous,
          unit: "buổi",
        },
        {
          label: "Lần đo InBody",
          value: data.measurementsInPeriod.current,
          previous: data.measurementsInPeriod.previous,
          unit: "lần",
        },
        { label: "Tiến bộ tốt", value: data.goodProgress },
        { label: "Cần quan tâm", value: data.attentionCount },
      ]
    : [];

  const bodyDeltaText =
    data && (data.averageBodyFatDelta !== null || data.averageMuscleDelta !== null)
      ? `${
          data.averageBodyFatDelta != null
            ? data.averageBodyFatDelta > 0
              ? `-${decimal(data.averageBodyFatDelta)}% mỡ`
              : data.averageBodyFatDelta < 0
                ? `+${decimal(Math.abs(data.averageBodyFatDelta))}% mỡ`
                : "0% mỡ"
            : "—"
        } · ${
          data.averageMuscleDelta != null
            ? `${data.averageMuscleDelta > 0 ? "+" : ""}${decimal(data.averageMuscleDelta)} kg cơ`
            : "—"
        }`
      : "—";

  const detailStrip = data
    ? [
        {
          label: "Tỷ lệ chuyên cần",
          value:
            data.attendanceRate == null ? "—" : `${decimal(data.attendanceRate)}%`,
          tone: "blue" as const,
        },
        {
          label: "Điểm tiến độ TB",
          value:
            data.averageScore == null
              ? "—"
              : `${decimal(data.averageScore)}/100`,
          tone: "teal" as const,
        },
        {
          label: "Gói PT hiệu lực",
          value: `${integer(data.activePackages)}${data.expiringPackages > 0 ? ` (${integer(data.expiringPackages)} sắp hết)` : ""}`,
          tone: "violet" as const,
        },
        {
          label: "Biến đổi Mỡ / Cơ TB",
          value: bodyDeltaText,
          tone: "orange" as const,
        },
      ]
    : [];

  const hasTrendData = Boolean(
    data?.activityTrend.some(
      (row) => row.sessions > 0 || row.measurements > 0 || row.newCustomers > 0,
    ),
  );
  const hasPlanCoverage = Boolean(
    data?.planCoverage.some((row) => row.published > 0 || row.draft > 0),
  );

  const customersUrl = gymHref("customers", branchId);
  const inbodyUrl = gymHref("measurements", branchId);
  const progressUrl = gymHref("progress", branchId);
  const workoutsUrl = gymHref("workout-templates", branchId);
  const trainersUrl = gymHref("trainers", branchId);

  return (
    <div className="finance-overview space-y-3 text-left text-on-surface">
      <h2 className="sr-only">Tổng quan Phòng Gym</h2>

      {error && (
        <div
          role="alert"
          className="rounded-md border border-error bg-error-container px-4 py-3 text-sm text-on-error-container"
        >
          {error}
        </div>
      )}

      {loading && !data && (
        <div
          role="status"
          aria-label="Đang tải Tổng quan Phòng Gym"
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6"
        >
          {Array.from({ length: 6 }, (_, index) => (
            <div
              key={index}
              className="h-28 animate-pulse rounded-md bg-surface-container-low motion-reduce:animate-none"
            />
          ))}
        </div>
      )}

      {!loading && data && data.totalCustomers === 0 && !error && (
        <section className="finance-chart-card flex flex-wrap items-center justify-between gap-3">
          <p className="text-pretty text-sm text-on-surface-variant">
            Chưa có học viên trong chi nhánh này. Các biểu đồ bên dưới sẽ cập nhật khi có dữ liệu.
          </p>
          <a
            href={customersUrl}
            className="inline-flex items-center gap-1 text-sm font-semibold text-primary focus-visible:outline-2 focus-visible:outline-primary"
          >
            Mở quản lý Phòng Gym
            <ArrowRight className="size-4" aria-hidden="true" />
          </a>
        </section>
      )}

      {data && (
        <>
          <section className="finance-chart-card" aria-label="Chỉ số Phòng Gym">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <h3 className="text-balance text-lg font-semibold text-on-surface">
                Tình hình Phòng Gym
              </h3>
              <span className="text-xs tabular-nums text-on-surface-variant">
                {integer(data.activeCustomers)} đang tập ·{" "}
                {integer(data.activePackages)} gói PT hiệu lực
                {data.pendingTransfers > 0
                  ? ` · ${integer(data.pendingTransfers)} điều chuyển chờ duyệt`
                  : ""}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
              {kpis.map((item, index) => {
                const Icon = kpiIcons[index];
                return (
                  <article
                    key={item.label}
                    className={`finance-kpi finance-kpi-${index} flex min-h-28 flex-col`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-pretty text-xs font-medium text-white">
                        {item.label}
                      </p>
                      <Icon
                        className="size-4 shrink-0 text-on-primary opacity-70"
                        aria-hidden="true"
                      />
                    </div>
                    <p className="mt-1 text-lg font-semibold tabular-nums text-white sm:text-xl">
                      <AnimatedOverviewValue
                        value={error ? null : item.value}
                        format={integer}
                      />
                    </p>
                    {item.previous !== undefined && (
                      <OverviewKpiDelta
                        value={error ? null : item.value}
                        previous={error ? null : item.previous}
                        unit={item.unit}
                      />
                    )}
                  </article>
                );
              })}
            </div>
          </section>

          <section
            className="finance-chart-card"
            aria-label="Chỉ số chuyên môn và vận hành Phòng Gym"
          >
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <h3 className="text-balance text-sm font-semibold text-on-surface">
                Chỉ số chuyên môn &amp; vận hành
              </h3>
              <span className="text-xs text-on-surface-variant">
                Đánh giá BF-AT &amp; chuyên cần trong kỳ
              </span>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
              {detailStrip.map((item) => (
                <div key={item.label} className="min-w-0">
                  <dt className="text-pretty text-xs text-on-surface-variant">
                    {item.label}
                  </dt>
                  <dd
                    className={cn(
                      "mt-0.5 break-words text-xl font-bold tabular-nums",
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

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
            <ChartCard
              title="Xu hướng tập luyện & đo InBody"
              hasData={hasTrendData}
              className="xl:col-span-2"
              href={progressUrl}
              kind="calendar"
              emptyText="Chưa có buổi tập, lần đo InBody hoặc học viên mới trong kỳ này."
            >
              <div
                role="img"
                aria-label="Xu hướng buổi tập, đo InBody và học viên mới trong kỳ"
                className="h-56 min-w-0"
              >
                <OverviewChartViewport>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={data.activityTrend}
                      margin={{ top: 10, right: 12, bottom: 0, left: -18 }}
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
                        minTickGap={20}
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
                        dataKey="sessions"
                        name="Buổi tập"
                        stroke={colors[0]}
                        fill="var(--finance-chart-teal-soft)"
                        strokeWidth={2}
                        isAnimationActive={chartMotion}
                        animationDuration={700}
                      />
                      <Area
                        type="monotone"
                        dataKey="measurements"
                        name="Lần đo InBody"
                        stroke={colors[1]}
                        fill="transparent"
                        strokeWidth={2}
                        isAnimationActive={chartMotion}
                        animationDuration={700}
                      />
                      <Area
                        type="monotone"
                        dataKey="newCustomers"
                        name="Học viên mới"
                        stroke={colors[2]}
                        fill="transparent"
                        strokeWidth={2}
                        isAnimationActive={chartMotion}
                        animationDuration={700}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </OverviewChartViewport>
              </div>
            </ChartCard>

            <ChartCard
              title="Phân bổ tiến độ BF-AT"
              hasData={data.progressDistribution.length > 0}
              href={inbodyUrl}
              kind="worker"
            >
              <div
                role="img"
                aria-label="Phân bổ học viên theo mức tiến độ BF-AT"
                className="h-56 min-w-0"
              >
                <OverviewChartViewport>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.progressDistribution}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="47%"
                        innerRadius="60%"
                        outerRadius="80%"
                        stroke="var(--color-surface-container-lowest)"
                        strokeWidth={2}
                        paddingAngle={1}
                        isAnimationActive={chartMotion}
                        animationDuration={700}
                      >
                        {data.progressDistribution.map((row, index) => (
                          <Cell
                            key={row.name}
                            fill={
                              row.name === "Tiến bộ tốt"
                                ? colors[1]
                                : row.name === "Tiến bộ chậm"
                                  ? colors[2]
                                  : row.name === "Cần quan tâm"
                                    ? colors[4]
                                    : colors[index % colors.length]
                            }
                          />
                        ))}
                      </Pie>
                      <Tooltip formatter={countTooltip} />
                      <Legend
                        verticalAlign="bottom"
                        wrapperStyle={{ fontSize: 11 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </OverviewChartViewport>
              </div>
            </ChartCard>

            <ChartCard
              title="Trạng thái học viên"
              hasData={data.customerStatus.length > 0}
              href={customersUrl}
              kind="worker"
            >
              <div
                role="img"
                aria-label="Số học viên theo trạng thái"
                className="h-56 min-w-0"
              >
                <OverviewChartViewport>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data.customerStatus}
                      layout="vertical"
                      margin={{ left: 0, right: 44, top: 4, bottom: 0 }}
                    >
                      <XAxis
                        axisLine={false}
                        tickLine={false}
                        type="number"
                        allowDecimals={false}
                        tick={{ fontSize: 10 }}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        type="category"
                        dataKey="name"
                        width={84}
                        tick={{ fontSize: 10 }}
                      />
                      <Tooltip formatter={countTooltip} />
                      <Bar
                        dataKey="value"
                        name="Học viên"
                        maxBarSize={20}
                        isAnimationActive={chartMotion}
                        animationDuration={700}
                      >
                        {data.customerStatus.map((row, index) => (
                          <Cell
                            key={row.name}
                            fill={colors[index % colors.length]}
                          />
                        ))}
                        <LabelList
                          dataKey="value"
                          position="right"
                          fill="var(--color-on-surface-variant)"
                          fontSize={11}
                          formatter={(value: unknown) =>
                            typeof value === "number" && value > 0
                              ? integer(value)
                              : ""
                          }
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </OverviewChartViewport>
              </div>
            </ChartCard>

            <ChartCard
              title="Chuyên cần buổi tập trong kỳ"
              hasData={data.attendance.length > 0}
              href={progressUrl}
              kind="calendar"
              emptyText="Chưa có buổi tập được ghi nhận trong kỳ này."
            >
              <div
                role="img"
                aria-label="Tỷ lệ có mặt, đi muộn và vắng mặt trong kỳ"
                className="h-56 min-w-0"
              >
                <OverviewChartViewport>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.attendance}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="47%"
                        innerRadius="60%"
                        outerRadius="80%"
                        stroke="var(--color-surface-container-lowest)"
                        strokeWidth={2}
                        paddingAngle={1}
                        isAnimationActive={chartMotion}
                        animationDuration={700}
                      >
                        {data.attendance.map((row) => (
                          <Cell
                            key={row.name}
                            fill={
                              row.name === "Có mặt"
                                ? colors[1]
                                : row.name === "Đi muộn"
                                  ? colors[2]
                                  : colors[4]
                            }
                          />
                        ))}
                      </Pie>
                      <Tooltip formatter={countTooltip} />
                      <Legend
                        verticalAlign="bottom"
                        wrapperStyle={{ fontSize: 11 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </OverviewChartViewport>
              </div>
            </ChartCard>

            <ChartCard
              title="Phân bổ mục tiêu tập luyện"
              hasData={data.goalTypes.length > 0}
              href={customersUrl}
              kind="training"
              emptyText="Chưa có mục tiêu tập luyện được thiết lập."
            >
              <div
                role="img"
                aria-label="Số mục tiêu theo nhóm tập luyện"
                className="h-56 min-w-0"
              >
                <OverviewChartViewport>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data.goalTypes}
                      layout="vertical"
                      margin={{ left: 0, right: 44, top: 4, bottom: 0 }}
                    >
                      <XAxis
                        axisLine={false}
                        tickLine={false}
                        type="number"
                        allowDecimals={false}
                        tick={{ fontSize: 10 }}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        type="category"
                        dataKey="name"
                        width={106}
                        tick={{ fontSize: 10 }}
                      />
                      <Tooltip formatter={countTooltip} />
                      <Bar
                        dataKey="value"
                        name="Mục tiêu"
                        fill={colors[3]}
                        maxBarSize={19}
                        isAnimationActive={chartMotion}
                        animationDuration={700}
                      >
                        <LabelList
                          dataKey="value"
                          position="right"
                          fill="var(--color-on-surface-variant)"
                          fontSize={11}
                          formatter={(value: unknown) =>
                            typeof value === "number" && value > 0
                              ? integer(value)
                              : ""
                          }
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </OverviewChartViewport>
              </div>
            </ChartCard>

            <ChartCard
              title="Độ phủ giáo án, dinh dưỡng & lộ trình"
              hasData={hasPlanCoverage}
              className="xl:col-span-2"
              href={workoutsUrl}
              kind="training"
              emptyText="Chưa có giáo án, thực đơn hoặc lộ trình được tạo."
            >
              <div
                role="img"
                aria-label="Số lượng đã công bố và bản nháp của giáo án, thực đơn, lộ trình và báo cáo tiến độ"
                className="h-56 min-w-0"
              >
                <OverviewChartViewport>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={data.planCoverage}
                      layout="vertical"
                      margin={{ left: 0, right: 16, top: 4, bottom: 0 }}
                    >
                      <XAxis
                        axisLine={false}
                        tickLine={false}
                        type="number"
                        allowDecimals={false}
                        tick={{ fontSize: 10 }}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        type="category"
                        dataKey="name"
                        width={104}
                        tick={{ fontSize: 10 }}
                      />
                      <Tooltip formatter={countTooltip} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar
                        dataKey="published"
                        name="Đã công bố"
                        stackId="plans"
                        fill={colors[1]}
                        maxBarSize={21}
                        isAnimationActive={chartMotion}
                        animationDuration={700}
                      />
                      <Bar
                        dataKey="draft"
                        name="Bản nháp"
                        stackId="plans"
                        fill={colors[2]}
                        maxBarSize={21}
                        isAnimationActive={chartMotion}
                        animationDuration={700}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </OverviewChartViewport>
              </div>
            </ChartCard>

            <ChartCard
              title="Tình trạng gói tập PT"
              hasData={data.packageStatus.length > 0}
              href={customersUrl}
              kind="contract"
              emptyText="Chưa có gói tập PT được đăng ký."
            >
              <div
                role="img"
                aria-label="Cơ cấu gói tập PT theo trạng thái"
                className="h-56 min-w-0"
              >
                <OverviewChartViewport>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.packageStatus}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="47%"
                        innerRadius="60%"
                        outerRadius="80%"
                        stroke="var(--color-surface-container-lowest)"
                        strokeWidth={2}
                        paddingAngle={1}
                        isAnimationActive={chartMotion}
                        animationDuration={700}
                      >
                        {data.packageStatus.map((row, index) => (
                          <Cell
                            key={row.name}
                            fill={colors[index % colors.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip formatter={countTooltip} />
                      <Legend
                        verticalAlign="bottom"
                        wrapperStyle={{ fontSize: 11 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </OverviewChartViewport>
              </div>
            </ChartCard>

            <ChartCard
              title="Điểm tiến độ BF-AT nổi bật"
              hasData={data.topScores.length > 0}
              className={data.trainerWorkload.length > 0 ? "" : "xl:col-span-2"}
              href={inbodyUrl}
              kind="training"
              emptyText="Cần tối thiểu 2 lần đo InBody cho mỗi học viên để tính điểm tiến độ."
            >
              <div
                role="img"
                aria-label="Top học viên có điểm tiến độ BF-AT cao nhất"
                className="h-56 min-w-0"
              >
                <OverviewChartViewport>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data.topScores}
                      layout="vertical"
                      margin={{ left: 0, right: 44, top: 4, bottom: 0 }}
                    >
                      <XAxis
                        axisLine={false}
                        tickLine={false}
                        type="number"
                        domain={[0, 100]}
                        tick={{ fontSize: 10 }}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        type="category"
                        dataKey="name"
                        width={106}
                        tick={{ fontSize: 10 }}
                        tickFormatter={(name: string) =>
                          name.length > 16 ? `${name.slice(0, 15)}…` : name
                        }
                      />
                      <Tooltip
                        formatter={(value: unknown) =>
                          typeof value === "number" ? `${integer(value)}/100 điểm` : String(value ?? "—")
                        }
                      />
                      <Bar
                        dataKey="score"
                        name="Điểm tiến độ"
                        fill={colors[0]}
                        maxBarSize={19}
                        isAnimationActive={chartMotion}
                        animationDuration={700}
                      >
                        {data.topScores.map((row) => (
                          <Cell
                            key={row.customerId}
                            fill={
                              row.score >= 70
                                ? colors[1]
                                : row.score >= 50
                                  ? colors[0]
                                  : colors[4]
                            }
                          />
                        ))}
                        <LabelList
                          dataKey="score"
                          position="right"
                          fill="var(--color-on-surface-variant)"
                          fontSize={11}
                          formatter={(value: unknown) =>
                            typeof value === "number" ? `${integer(value)}` : ""
                          }
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </OverviewChartViewport>
              </div>
            </ChartCard>

            <ChartCard
              title="Cơ cấu giới tính học viên"
              hasData={data.gender.length > 0}
              href={customersUrl}
              kind="worker"
            >
              <div
                role="img"
                aria-label="Cơ cấu giới tính học viên"
                className="h-56 min-w-0"
              >
                <OverviewChartViewport>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.gender}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="47%"
                        outerRadius="74%"
                        stroke="none"
                        isAnimationActive={chartMotion}
                        animationDuration={700}
                      >
                        {data.gender.map((row, index) => (
                          <Cell
                            key={row.name}
                            fill={colors[index % colors.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip formatter={countTooltip} />
                      <Legend
                        verticalAlign="bottom"
                        wrapperStyle={{ fontSize: 11 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </OverviewChartViewport>
              </div>
            </ChartCard>

            {data.trainerWorkload.length > 0 && (
              <ChartCard
                title="Khối lượng phụ trách theo Huấn luyện viên"
                hasData={data.trainerWorkload.length > 0}
                href={trainersUrl}
                kind="worker"
              >
                <div
                  role="img"
                  aria-label="Số học viên và buổi tập theo từng huấn luyện viên"
                  className="h-56 min-w-0"
                >
                  <OverviewChartViewport>
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        data={data.trainerWorkload}
                        layout="vertical"
                        margin={{ left: 0, right: 40, top: 4, bottom: 0 }}
                      >
                        <XAxis
                          axisLine={false}
                          tickLine={false}
                          type="number"
                          allowDecimals={false}
                          tick={{ fontSize: 10 }}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          type="category"
                          dataKey="name"
                          width={96}
                          tick={{ fontSize: 10 }}
                          tickFormatter={(name: string) =>
                            name.length > 15 ? `${name.slice(0, 14)}…` : name
                          }
                        />
                        <Tooltip formatter={countTooltip} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar
                          dataKey="customers"
                          name="Học viên"
                          fill={colors[0]}
                          maxBarSize={14}
                          isAnimationActive={chartMotion}
                          animationDuration={700}
                        />
                        <Bar
                          dataKey="sessions"
                          name="Buổi tập kỳ này"
                          fill={colors[1]}
                          maxBarSize={14}
                          isAnimationActive={chartMotion}
                          animationDuration={700}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </OverviewChartViewport>
                </div>
              </ChartCard>
            )}
          </div>

          <section className="finance-chart-card">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-balance text-sm font-semibold text-on-surface">
                Học viên cần quan tâm
              </h3>
              <a
                href={inbodyUrl}
                className="text-xs font-semibold text-primary focus-visible:outline-2 focus-visible:outline-primary"
              >
                Mở InBody
              </a>
            </div>
            {data.attentionRows.length ? (
              <ul className="grid grid-cols-1 gap-x-5 sm:grid-cols-2 xl:grid-cols-3">
                {data.attentionRows.slice(0, 9).map((row) => (
                  <li
                    key={row.customerId}
                    className="flex min-w-0 items-center justify-between gap-2 border-b border-outline-variant py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-on-surface">
                        {row.fullName}
                      </p>
                      <p className="truncate text-xs text-on-surface-variant">
                        {row.initialGoal || "Cải thiện thể lực"}
                      </p>
                    </div>
                    <strong
                      className={cn(
                        "finance-detail-value shrink-0 text-base font-bold tabular-nums",
                        row.progressCategory === "POOR"
                          ? "finance-detail-value--red"
                          : "finance-detail-value--orange",
                      )}
                    >
                      {row.score != null ? `${integer(row.score)}/100` : "—"}
                    </strong>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty kind="worker">
                Không có học viên nào đang bị cảnh báo tiến độ.
              </Empty>
            )}
          </section>
        </>
      )}
    </div>
  );
}
