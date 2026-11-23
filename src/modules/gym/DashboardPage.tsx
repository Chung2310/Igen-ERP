import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  RefreshCw,
  Ruler,
  Search,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { HrPageTitle } from "../../components/hr/HrPageTitle";
import { HrStatusBadge } from "../../components/hr/HrStatusBadge";
import type { GymTab } from "../../../shared/gym/types";
import { cn } from "../student-management/lib/utils";
import type { GymApi } from "./api";
import { Feedback, GymAvatar, GymEmptyState, secondary, useGymQuery } from "./ui";

interface DashboardMeasurement {
  measurementDate?: string;
  weight?: number;
  bodyFatPercentage?: number;
  muscleMass?: number;
}

interface DashboardCustomerRow {
  customerId: string;
  fullName: string;
  phone?: string;
  initialGoal?: string;
  initialWeight?: number | null;
  dataStatus: "READY" | "INSUFFICIENT_DATA";
  score: number | null;
  scoreBreakdown: { measurementTrend: number; careRisk: number } | null;
  progressCategory: "GOOD" | "SLOW" | "POOR" | "INSUFFICIENT_DATA";
  measurementCount: number;
  firstMeasurement?: DashboardMeasurement | null;
  latestMeasurement?: DashboardMeasurement | null;
  changes?: {
    bodyFatChange: number;
    muscleChange: number;
    weightChange: number;
    daysBetween: number;
  } | null;
  openAlerts?: number;
  riskFactors?: string[];
  improvementTips?: string[];
}

interface PtDashboardPayload {
  totalCustomers: number;
  customers: number;
  activeCustomers: number;
  openAlerts: number;
  goodProgressCount: number;
  slowProgressCount: number;
  poorProgressCount: number;
  insufficientDataCount?: number;
  customerRows: DashboardCustomerRow[];
}

type CategoryFilter = "ALL" | "GOOD" | "SLOW" | "POOR" | "INSUFFICIENT_DATA";

const RANK_META = [
  { title: "Top 1 Biến đổi ngoạn mục", tone: "warning" as const },
  { title: "Top 2 Tăng cơ giảm mỡ", tone: "info" as const },
  { title: "Top 3 Bứt phá thể lực", tone: "success" as const },
  { title: "Top 4 Phong độ cao", tone: "neutral" as const },
];

export default function DashboardPage({
  api,
  onNavigate,
}: {
  api: GymApi;
  onNavigate: (tab: GymTab) => void;
}) {
  const [revision, setRevision] = useState(0);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<CategoryFilter>("ALL");

  const query = useGymQuery<PtDashboardPayload>(api, "/dashboard", revision);
  const data = query.data;
  const rows = data?.customerRows || [];

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("vi");
    return rows.filter((c) => {
      const matchSearch =
        !q ||
        c.fullName.toLocaleLowerCase("vi").includes(q) ||
        c.customerId.toLocaleLowerCase("vi").includes(q) ||
        String(c.phone || "").toLocaleLowerCase("vi").includes(q);
      const matchCategory =
        filterCategory === "ALL" || c.progressCategory === filterCategory;
      return matchSearch && matchCategory;
    });
  }, [rows, search, filterCategory]);

  const topTransformers = useMemo(() => {
    return rows
      .filter((c) => c.dataStatus === "READY" && c.changes && (c.score ?? 0) >= 50)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, 4);
  }, [rows]);

  const attentionCustomers = useMemo(() => {
    return rows.filter(
      (c) =>
        c.progressCategory === "POOR" ||
        c.progressCategory === "SLOW" ||
        (c.openAlerts && c.openAlerts > 0) ||
        (c.changes && (c.changes.bodyFatChange < 0 || c.changes.muscleChange < 0)),
    );
  }, [rows]);

  const insufficientCount =
    data?.insufficientDataCount ??
    rows.filter((r) => r.progressCategory === "INSUFFICIENT_DATA").length;

  return (
    <section className="space-y-5" aria-label="Bảng điều khiển Huấn luyện viên">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary" aria-hidden="true">
            <Activity className="size-5" />
          </span>
          <HrPageTitle>Bảng điều khiển Huấn luyện viên</HrPageTitle>
        </div>
        <button
          type="button"
          className={secondary}
          disabled={query.loading}
          onClick={() => setRevision((v) => v + 1)}
        >
          <RefreshCw
            className={cn("size-3.5", query.loading && "animate-spin")}
            aria-hidden="true"
          />
          Làm mới số liệu
        </button>
      </div>

      <Feedback error={query.error} loading={query.loading} />

      {data && (
        <>
          {/* PHẦN 1: KHÁCH HÀNG CỦA TÔI & BF-AT */}
          <section className="space-y-3" aria-label="Khách hàng của tôi">
            <h2 className="flex items-center gap-2 text-balance text-sm font-semibold uppercase text-on-surface">
              <Users className="size-4 text-primary" aria-hidden="true" />
              Khách hàng của tôi
            </h2>

            {/* 4 BF-AT KPI Cards */}
            <dl className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              {[
                {
                  label: "Tổng khách quản lý",
                  value: data.totalCustomers ?? data.customers ?? 0,
                  unit: "học viên",
                  icon: Users,
                  valueClass: "text-primary",
                  iconTone: "gym-kpi-icon--primary",
                },
                {
                  label: "Tiến bộ tốt",
                  value: data.goodProgressCount ?? 0,
                  unit: "khách",
                  icon: TrendingUp,
                  valueClass: "text-change-up",
                  iconTone: "gym-kpi-icon--success",
                },
                {
                  label: "Tiến bộ chậm",
                  value: data.slowProgressCount ?? 0,
                  unit: "khách",
                  icon: Clock,
                  valueClass: "text-tertiary",
                  iconTone: "gym-kpi-icon--warning",
                },
                {
                  label: "Kết quả không tốt",
                  value: data.poorProgressCount ?? 0,
                  unit: "cần xử lý",
                  icon: AlertTriangle,
                  valueClass: "text-error",
                  iconTone: "bg-error-container/50 text-error",
                },
              ].map((kpi) => {
                const Icon = kpi.icon;
                return (
                  <div
                    key={kpi.label}
                    className="flex items-center justify-between gap-3 rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-3.5 shadow-2xs"
                  >
                    <div className="min-w-0 space-y-1">
                      <dt className="truncate text-xs font-medium text-on-surface-variant">
                        {kpi.label}
                      </dt>
                      <dd className={cn("flex items-baseline gap-1.5 text-2xl font-bold tabular-nums", kpi.valueClass)}>
                        <span>{kpi.value.toLocaleString("vi-VN")}</span>
                        <span className="text-xs font-normal text-on-surface-variant">
                          {kpi.unit}
                        </span>
                      </dd>
                    </div>
                    <span
                      className={cn(
                        "inline-flex size-10 shrink-0 items-center justify-center rounded-lg",
                        kpi.iconTone,
                      )}
                      aria-hidden="true"
                    >
                      <Icon className="size-5" />
                    </span>
                  </div>
                );
              })}
            </dl>

            {/* Search + 5 Status Filter Pills + BF-AT Table */}
            <div className="space-y-3 rounded-md border border-outline-variant bg-surface-container-lowest p-3 sm:p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
                  <Search
                    className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant/70"
                    aria-hidden="true"
                  />
                  <input
                    type="text"
                    aria-label="Tìm theo tên học viên hoặc mã"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Tìm theo tên học viên hoặc mã..."
                    className="h-9 w-full rounded-md border border-outline-variant bg-surface-container-lowest pl-8 pr-8 text-xs text-on-surface focus:border-primary focus:outline-none"
                  />
                  {search && (
                    <button
                      type="button"
                      aria-label="Xóa tìm kiếm"
                      onClick={() => setSearch("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer text-on-surface-variant hover:text-on-surface"
                    >
                      <X className="size-3.5" aria-hidden="true" />
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Lọc trạng thái BF-AT">
                  {(
                    [
                      ["ALL", `Tất cả (${rows.length})`],
                      ["GOOD", `Tiến bộ tốt (${data.goodProgressCount ?? 0})`],
                      ["SLOW", `Tiến bộ chậm (${data.slowProgressCount ?? 0})`],
                      ["POOR", `Cần quan tâm (${data.poorProgressCount ?? 0})`],
                      ["INSUFFICIENT_DATA", `Chưa đủ dữ liệu InBody (${insufficientCount})`],
                    ] as const
                  ).map(([key, label]) => {
                    const active = filterCategory === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setFilterCategory(key)}
                        className={cn(
                          "cursor-pointer rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-primary",
                          active
                            ? "border-primary bg-primary text-on-primary"
                            : "border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container hover:text-on-surface",
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {filteredCustomers.length === 0 ? (
                <GymEmptyState
                  kind="worker"
                  filtered={Boolean(search.trim() || filterCategory !== "ALL")}
                  title="Chưa có dữ liệu học viên phù hợp."
                />
              ) : (
                <div className="overflow-x-auto rounded-md border border-outline-variant">
                  <table className="min-w-[780px] w-full border-collapse text-left text-sm tabular-nums">
                    <thead className="border-b border-outline-variant bg-surface-container-low/70 text-xs font-semibold text-on-surface-variant">
                      <tr>
                        <th className="px-3 py-2.5">Học viên &amp; Mục tiêu</th>
                        <th className="px-3 py-2.5">Trạng thái BF-AT</th>
                        <th className="px-3 py-2.5">Biến đổi Cơ / Mỡ (Δ)</th>
                        <th className="px-3 py-2.5">Điểm tiến độ</th>
                        <th className="px-3 py-2.5 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant [&>tr]:transition-colors [&>tr:hover]:bg-surface-container-low/40">
                      {filteredCustomers.map((c) => (
                        <tr key={c.customerId}>
                          <td className="px-3 py-2.5 align-middle">
                            <div className="flex items-center gap-2.5">
                              <GymAvatar name={c.fullName} size="sm" />
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-on-surface">{c.fullName}</p>
                                <p className="truncate text-xs text-on-surface-variant">
                                  Mục tiêu: {c.initialGoal || "Cải thiện thể lực"}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 align-middle">
                            {c.dataStatus === "INSUFFICIENT_DATA" || c.progressCategory === "INSUFFICIENT_DATA" ? (
                              <HrStatusBadge dot tone="neutral">
                                Cần ≥ 2 lần InBody
                              </HrStatusBadge>
                            ) : c.progressCategory === "GOOD" ? (
                              <HrStatusBadge dot tone="success">
                                Tiến bộ tốt
                              </HrStatusBadge>
                            ) : c.progressCategory === "SLOW" ? (
                              <HrStatusBadge dot tone="warning">
                                Tiến bộ chậm
                              </HrStatusBadge>
                            ) : (
                              <HrStatusBadge dot tone="danger">
                                Cần quan tâm
                              </HrStatusBadge>
                            )}
                          </td>
                          <td className="px-3 py-2.5 align-middle text-xs">
                            {c.changes ? (
                              <div className="space-y-0.5">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-on-surface-variant">Mỡ:</span>
                                  <strong
                                    className={
                                      c.changes.bodyFatChange > 0
                                        ? "text-change-up"
                                        : c.changes.bodyFatChange < 0
                                          ? "text-error"
                                          : "text-on-surface-variant"
                                    }
                                  >
                                    {c.changes.bodyFatChange > 0
                                      ? `-${c.changes.bodyFatChange}%`
                                      : c.changes.bodyFatChange < 0
                                        ? `+${Math.abs(c.changes.bodyFatChange)}%`
                                        : "0%"}
                                  </strong>
                                  <span className="text-on-surface-variant">Cơ:</span>
                                  <strong
                                    className={
                                      c.changes.muscleChange > 0
                                        ? "text-change-up"
                                        : c.changes.muscleChange < 0
                                          ? "text-error"
                                          : "text-on-surface-variant"
                                    }
                                  >
                                    {c.changes.muscleChange > 0
                                      ? `+${c.changes.muscleChange} kg`
                                      : `${c.changes.muscleChange} kg`}
                                  </strong>
                                </div>
                                <span className="block text-[11px] text-on-surface-variant">
                                  ({c.changes.daysBetween} ngày · {c.measurementCount} lần đo)
                                </span>
                              </div>
                            ) : (
                              <span className="italic text-on-surface-variant">
                                Chưa đủ dữ liệu InBody đối chiếu
                              </span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 align-middle">
                            {c.score !== null ? (
                              <div className="flex items-center gap-2">
                                <div className="h-2 w-16 overflow-hidden rounded-full border border-outline-variant bg-surface-container">
                                  <div
                                    className={cn(
                                      "h-full rounded-full",
                                      c.score >= 70
                                        ? "bg-change-up"
                                        : c.score >= 50
                                          ? "bg-primary"
                                          : "bg-error",
                                    )}
                                    style={{ width: `${Math.min(100, Math.max(0, c.score))}%` }}
                                  />
                                </div>
                                <span className="text-xs font-bold text-on-surface">
                                  {c.score}/100
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-on-surface-variant">—</span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-right align-middle">
                            <button
                              type="button"
                              onClick={() => onNavigate("measurements")}
                              className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/15"
                            >
                              <Ruler className="size-3.5" aria-hidden="true" />
                              InBody
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>

          {/* PHẦN 2: KẾT QUẢ NỔI BẬT - TOP THAY ĐỔI THEO MỤC TIÊU */}
          <section className="space-y-3" aria-label="Kết quả nổi bật">
            <h2 className="flex items-center gap-2 text-balance text-sm font-semibold uppercase text-on-surface">
              <Trophy className="size-4 text-tertiary" aria-hidden="true" />
              Kết quả nổi bật — Top thay đổi theo mục tiêu
            </h2>

            {topTransformers.length === 0 ? (
              <div className="rounded-md border border-outline-variant bg-surface-container-lowest p-6 text-center">
                <Sparkles className="mx-auto mb-2 size-7 text-tertiary" aria-hidden="true" />
                <h3 className="text-sm font-semibold text-on-surface">
                  Chưa có học viên nào lọt vào Top nổi bật
                </h3>
                <p className="mt-1 text-pretty text-xs text-on-surface-variant">
                  Cập nhật thêm dữ liệu đo InBody các lần tiếp theo để hệ thống tự động tính toán và vinh danh.
                </p>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {topTransformers.map((c, index) => {
                  const rank = RANK_META[index] || RANK_META[3];
                  return (
                    <article
                      key={c.customerId}
                      className="flex flex-col justify-between rounded-md border border-outline-variant bg-surface-container-lowest p-4 shadow-2xs"
                    >
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <HrStatusBadge tone={rank.tone} className="normal-case">
                            {rank.title}
                          </HrStatusBadge>
                          <span className="text-sm font-bold tabular-nums text-primary">
                            {c.score}/100 điểm
                          </span>
                        </div>

                        <div>
                          <h3 className="text-base font-semibold text-on-surface">{c.fullName}</h3>
                          <p className="mt-0.5 text-xs text-on-surface-variant">
                            Mục tiêu ban đầu:{" "}
                            <strong className="text-primary">
                              {c.initialGoal || "Tăng cơ giảm mỡ"}
                            </strong>
                          </p>
                        </div>

                        <dl className="grid grid-cols-3 gap-2 rounded-md border border-outline-variant/70 bg-surface-container-low/50 p-2.5 text-center tabular-nums">
                          <div>
                            <dt className="text-[11px] text-on-surface-variant">Body Fat</dt>
                            <dd className="mt-0.5 text-sm font-bold text-change-up">
                              {c.changes && c.changes.bodyFatChange > 0
                                ? `-${c.changes.bodyFatChange}%`
                                : "0%"}
                            </dd>
                            <span className="text-[10px] text-on-surface-variant">
                              {c.firstMeasurement?.bodyFatPercentage ?? "—"}% →{" "}
                              {c.latestMeasurement?.bodyFatPercentage ?? "—"}%
                            </span>
                          </div>
                          <div>
                            <dt className="text-[11px] text-on-surface-variant">Khối lượng cơ</dt>
                            <dd className="mt-0.5 text-sm font-bold text-primary">
                              {c.changes && c.changes.muscleChange > 0
                                ? `+${c.changes.muscleChange}kg`
                                : "0kg"}
                            </dd>
                            <span className="text-[10px] text-on-surface-variant">
                              {c.firstMeasurement?.muscleMass ?? "—"}kg →{" "}
                              {c.latestMeasurement?.muscleMass ?? "—"}kg
                            </span>
                          </div>
                          <div>
                            <dt className="text-[11px] text-on-surface-variant">Cân nặng</dt>
                            <dd className="mt-0.5 text-sm font-bold text-on-surface">
                              {c.changes && c.changes.weightChange !== 0
                                ? `${c.changes.weightChange > 0 ? "+" : ""}${c.changes.weightChange}kg`
                                : "0kg"}
                            </dd>
                            <span className="text-[10px] text-on-surface-variant">
                              {c.firstMeasurement?.weight ?? "—"}kg →{" "}
                              {c.latestMeasurement?.weight ?? "—"}kg
                            </span>
                          </div>
                        </dl>
                      </div>

                      <div className="mt-3 flex items-center justify-between border-t border-outline-variant/60 pt-2.5 text-xs">
                        <span className="tabular-nums text-on-surface-variant">
                          Thời gian: <strong className="text-on-surface">{c.changes?.daysBetween} ngày</strong> ({c.measurementCount} lần đo)
                        </span>
                        <button
                          type="button"
                          onClick={() => onNavigate("roadmaps")}
                          className="inline-flex cursor-pointer items-center gap-1 font-semibold text-primary hover:underline"
                        >
                          Xem lộ trình
                          <ArrowUpRight className="size-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          {/* PHẦN 3: CẢNH BÁO HỌC VIÊN CẦN QUAN TÂM */}
          <section className="space-y-3" aria-label="Cảnh báo học viên cần quan tâm">
            <h2 className="flex items-center gap-2 text-balance text-sm font-semibold uppercase text-on-surface">
              <ShieldAlert className="size-4 text-error" aria-hidden="true" />
              Cảnh báo: Học viên cần quan tâm &amp; không thay đổi
            </h2>

            {attentionCustomers.length === 0 ? (
              <div className="rounded-md border border-outline-variant bg-surface-container-lowest p-6 text-center">
                <CheckCircle2 className="mx-auto mb-2 size-7 text-change-up" aria-hidden="true" />
                <h3 className="text-sm font-semibold text-on-surface">
                  Tuyệt vời! Không có học viên nào bị cảnh báo nghiêm trọng
                </h3>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {attentionCustomers.map((c) => (
                  <article
                    key={c.customerId}
                    className="flex flex-col justify-between rounded-md border border-error/30 bg-surface-container-lowest shadow-2xs"
                  >
                    <div className="space-y-3 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-error-container/60 text-error" aria-hidden="true">
                            <AlertTriangle className="size-4" />
                          </span>
                          <div>
                            <h3 className="text-sm font-semibold text-on-surface">{c.fullName}</h3>
                            <p className="text-xs text-on-surface-variant">
                              Mục tiêu: {c.initialGoal || "Cải thiện vóc dáng"}
                            </p>
                          </div>
                        </div>
                        <HrStatusBadge tone={c.progressCategory === "POOR" ? "danger" : "warning"}>
                          {c.progressCategory === "POOR" ? "Kết quả tệ" : "Tiến bộ chậm"}
                        </HrStatusBadge>
                      </div>

                      {c.improvementTips && c.improvementTips.length > 0 && (
                        <div className="flex items-start gap-2 rounded-md border border-change-up/30 bg-change-up/5 p-2.5 text-xs text-on-surface">
                          <Sparkles className="mt-0.5 size-3.5 shrink-0 text-change-up" aria-hidden="true" />
                          <span className="text-pretty">{c.improvementTips[0]}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 border-t border-outline-variant/60 bg-surface-container-low/50 px-4 py-2.5 text-xs">
                      <span className="font-medium text-on-surface-variant">
                        {c.openAlerts ? "Cảnh báo tiến độ" : "Cần theo dõi thêm"}
                      </span>
                      <button
                        type="button"
                        onClick={() => onNavigate("measurements")}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-on-primary transition-colors hover:bg-primary/90"
                      >
                        <Ruler className="size-3.5" aria-hidden="true" />
                        Đo InBody
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </section>
  );
}
