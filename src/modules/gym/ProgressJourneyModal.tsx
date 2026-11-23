import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { ErpModal } from "../../components/common/ErpModal";
import { HrStatusBadge } from "../../components/hr/HrStatusBadge";
import type { GymList, GymRecord } from "../../../shared/gym/types";
import { cn } from "../student-management/lib/utils";
import type { GymApi } from "./api";
import ProgressReports from "./ProgressReports";
import SessionDetail from "./SessionDetail";
import InBodyEvolution from "./InBodyEvolution";
import ProgressPhotos from "./ProgressPhotos";
import {
  ProgressBodyCharts,
  TrackingAnalyticsPanel,
  WorkoutSessionComparison,
} from "./ProgressAnalytics";
import { dateLabel, Feedback, GymEmptyState, secondary, useGymQuery } from "./ui";

const tabs = [
  ["overview", "Tổng quan"],
  ["sessions", "Lịch & buổi tập"],
  ["measurements", "Chỉ số cơ thể"],
  ["achievements", "Thành tích"],
  ["photos", "Ảnh tiến độ"],
  ["plans", "Giáo án"],
  ["reports", "Báo cáo"],
] as const;
type Tab = (typeof tabs)[number][0];

export default function ProgressJourneyModal({
  api,
  customer,
  canWrite,
  onClose,
  onOpenProfile,
}: {
  api: GymApi;
  customer: GymRecord;
  canWrite: boolean;
  onClose: () => void;
  onOpenProfile: () => void;
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const [revision, setRevision] = useState(0);
  const sessionsQuery = useGymQuery<GymList>(
    api,
    `/sessions?customerId=${customer._id}&limit=100`,
    revision,
  );
  const measurementsQuery = useGymQuery<GymList>(
    api,
    `/measurements?customerId=${customer._id}&limit=100`,
    revision,
  );
  const plansQuery = useGymQuery<GymList>(
    api,
    `/workout-plans?customerId=${customer._id}&limit=100`,
    revision,
  );
  const reportsQuery = useGymQuery<GymList>(
    api,
    `/progress-reports?customerId=${customer._id}&limit=100`,
    revision,
  );
  const photosQuery = useGymQuery<GymList>(
    api,
    `/progress-photos?customerId=${customer._id}&limit=100`,
    revision,
  );

  const sessions = sessionsQuery.data?.data || [];
  const measurements = [...(measurementsQuery.data?.data || [])].sort((a, b) =>
    String(a.measurementDate).localeCompare(String(b.measurementDate)),
  );
  const plans = plansQuery.data?.data || [];
  const reports = reportsQuery.data?.data || [];
  const storedPhotos = photosQuery.data?.data || [];
  const storedSessionIds = new Set(
    storedPhotos.map((photo) => photo.sessionId).filter(Boolean),
  );
  const legacyPhotos = sessions
    .filter(
      (session) =>
        !session.photoSyncVersion && !storedSessionIds.has(session._id),
    )
    .flatMap((session) =>
      (session.progressPhotos || []).map((photo: GymRecord, index: number) => ({
        ...photo,
        _id: `${session._id}-${index}`,
        sessionId: session._id,
        date: session.performedAt,
        takenDate: session.performedAt,
        stage: "PROGRESS",
        index,
      })),
    );
  const photos = [...storedPhotos, ...legacyPhotos];

  // Achievements: PRs across Strength / Bodyweight / Cardio
  const best = new Map<
    string,
    { name: string; label: string; value: number; date: string }
  >();
  for (const session of [...sessions].reverse()) {
    for (const exercise of session.exerciseLogs || []) {
      const key = exercise.exerciseId || exercise.name;
      for (const set of exercise.result?.sets || []) {
        if (!set.completed) continue;
        if (typeof set.weight === "number" && set.weight > 0) {
          const prev = best.get(key);
          if (!prev || set.weight > prev.value) {
            best.set(key, {
              name: exercise.name,
              label: `Mức tạ tốt nhất: ${set.weight} kg · ${Number(set.reps || 0)} reps`,
              value: set.weight,
              date: session.performedAt,
            });
          }
        } else if (typeof set.reps === "number" && set.reps > 0) {
          const prev = best.get(key);
          if (!prev || set.reps > prev.value) {
            best.set(key, {
              name: exercise.name,
              label: `Reps tốt nhất: ${set.reps} reps${set.addedWeight ? ` (+${set.addedWeight} kg)` : ""}`,
              value: set.reps,
              date: session.performedAt,
            });
          }
        }
      }
      if (
        exercise.trackingType === "CARDIO" &&
        typeof exercise.result?.distanceKm === "number" &&
        exercise.result.distanceKm > 0
      ) {
        const prev = best.get(key);
        if (!prev || exercise.result.distanceKm > prev.value) {
          best.set(key, {
            name: exercise.name,
            label: `Quãng đường tốt nhất: ${exercise.result.distanceKm} km (${exercise.result.durationMinutes || 0} phút)`,
            value: exercise.result.distanceKm,
            date: session.performedAt,
          });
        }
      }
    }
  }

  // Group sessions by month for calendar summary
  const sessionsByMonth = sessions.reduce<Record<string, number>>((acc, s) => {
    const key = String(s.performedAt || "").slice(0, 7);
    if (key) acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const initialWeight = measurements[0]?.weight ?? customer.initialWeight;
  const latestWeight = measurements.at(-1)?.weight ?? customer.initialWeight;
  const attendance = sessions.length
    ? Math.round(
        (sessions.filter((session) => session.attendance !== "ABSENT").length /
          sessions.length) *
          100,
      )
    : 0;

  const avgRpe = (() => {
    const rpes: number[] = [];
    for (const session of sessions) {
      for (const ex of session.exerciseLogs || []) {
        for (const set of ex.result?.sets || []) {
          if (typeof set.rpe === "number" && set.rpe > 0) rpes.push(set.rpe);
        }
        if (typeof ex.result?.rpe === "number" && ex.result.rpe > 0) {
          rpes.push(ex.result.rpe);
        }
      }
    }
    return rpes.length
      ? Math.round((rpes.reduce((sum, v) => sum + v, 0) / rpes.length) * 10) / 10
      : null;
  })();

  const streakWeeks = (() => {
    const attendedDates = sessions
      .filter((s) => s.attendance !== "ABSENT" && s.performedAt)
      .map((s) => new Date(String(s.performedAt)))
      .filter((d) => !Number.isNaN(d.getTime()));
    if (!attendedDates.length) return 0;
    const weekKey = (d: Date) => {
      const utc = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
      const day = utc.getUTCDay() || 7;
      utc.setUTCDate(utc.getUTCDate() + 4 - day);
      return Math.floor(utc.getTime() / (7 * 24 * 60 * 60 * 1000));
    };
    const weeks = Array.from(new Set(attendedDates.map(weekKey))).sort((a, b) => b - a);
    let streak = 1;
    for (let i = 1; i < weeks.length; i++) {
      if (weeks[i - 1] - weeks[i] === 1) streak++;
      else break;
    }
    return streak;
  })();
  const loading =
    sessionsQuery.loading ||
    measurementsQuery.loading ||
    plansQuery.loading ||
    reportsQuery.loading ||
    photosQuery.loading;
  const error =
    sessionsQuery.error ||
    measurementsQuery.error ||
    plansQuery.error ||
    reportsQuery.error ||
    photosQuery.error;

  return (
    <ErpModal
      native
      title={`Tiến độ ${customer.fullName}`}
      onClose={onClose}
      maxWidth="max-w-6xl"
    >
      <div className="max-h-[80dvh] space-y-4 overflow-y-auto p-1">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-outline-variant bg-surface-container-low p-3">
          <div>
            <h2 className="text-lg font-semibold text-on-surface">
              {customer.fullName}
            </h2>
            <p className="text-xs text-on-surface-variant">{customer.phone}</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className={secondary}
              onClick={() => setRevision((value) => value + 1)}
            >
              Làm mới
            </button>
            <button type="button" className={secondary} onClick={onOpenProfile}>
              Mở hồ sơ
            </button>
          </div>
        </div>

        <nav
          role="tablist"
          aria-label="Chi tiết tiến độ học viên"
          className="flex gap-1 overflow-x-auto border-b border-outline-variant"
        >
          {tabs.map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              className={cn(
                "shrink-0 cursor-pointer border-b-2 px-3 py-2 text-sm",
                tab === key
                  ? "border-primary font-semibold text-primary"
                  : "border-transparent text-on-surface-variant hover:text-on-surface",
              )}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </nav>

        <Feedback loading={loading} error={error} />

        {!loading && !error && (
          <div role="tabpanel" className="space-y-4">
            {tab === "overview" && (
              <>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    ["Buổi tập", sessions.length],
                    ["Lần đo", measurements.length],
                    ["Ảnh tiến độ", photos.length],
                    ["Báo cáo", reports.length],
                  ].map(([label, value]) => (
                    <div
                      key={String(label)}
                      className="rounded-md border border-outline-variant p-4"
                    >
                      <p className="text-xs text-on-surface-variant">{label}</p>
                      <strong className="text-2xl tabular-nums text-primary">
                        {value}
                      </strong>
                    </div>
                  ))}
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <div className="rounded-md border border-outline-variant p-3">
                    <p className="text-xs text-on-surface-variant">Tỷ lệ tham gia</p>
                    <strong className="tabular-nums">{attendance}%</strong>
                  </div>
                  <div className="rounded-md border border-outline-variant p-3">
                    <p className="text-xs text-on-surface-variant">RPE trung bình</p>
                    <strong className="tabular-nums text-primary">
                      {avgRpe != null ? `${avgRpe} / 10` : "—"}
                    </strong>
                  </div>
                  <div className="rounded-md border border-outline-variant p-3">
                    <p className="text-xs text-on-surface-variant">Chuỗi tập liên tiếp</p>
                    <strong className="tabular-nums text-change-up">
                      {streakWeeks} tuần
                    </strong>
                  </div>
                  <div className="rounded-md border border-outline-variant p-3">
                    <p className="text-xs text-on-surface-variant">
                      Cân nặng hiện tại
                    </p>
                    <strong className="tabular-nums">
                      {latestWeight ?? "—"} kg
                    </strong>
                  </div>
                  <div className="rounded-md border border-outline-variant p-3">
                    <p className="text-xs text-on-surface-variant">
                      Thay đổi cân nặng
                    </p>
                    <strong className="tabular-nums">
                      {typeof initialWeight === "number" &&
                      typeof latestWeight === "number"
                        ? `${Math.round((latestWeight - initialWeight) * 10) / 10} kg`
                        : "—"}
                    </strong>
                  </div>
                </div>
                <InBodyEvolution records={measurements} />
                <TrackingAnalyticsPanel sessions={sessions} />
              </>
            )}

            {tab === "sessions" && (
              <div className="space-y-4">
                {Object.keys(sessionsByMonth).length > 0 && (
                  <div className="rounded-md border border-outline-variant bg-surface-container-low/50 p-3">
                    <p className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-on-surface">
                      <CalendarDays className="size-3.5 text-primary" aria-hidden="true" />
                      Tần suất buổi tập theo tháng
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(sessionsByMonth)
                        .sort(([a], [b]) => b.localeCompare(a))
                        .map(([month, count]) => (
                          <span
                            key={month}
                            className="rounded-md border border-outline-variant bg-surface-container-lowest px-2.5 py-1 text-xs tabular-nums"
                          >
                            Tháng {month}: <strong className="text-primary">{count} buổi</strong>
                          </span>
                        ))}
                    </div>
                  </div>
                )}
                <WorkoutSessionComparison sessions={sessions} />
                {sessions.length ? (
                  sessions.map((session) => (
                    <section
                      key={session._id}
                      className="rounded-md border border-outline-variant p-3"
                    >
                      <h3 className="mb-2 font-semibold text-on-surface">
                        Buổi tập {dateLabel(session.performedAt)}
                      </h3>
                      <SessionDetail session={session} />
                    </section>
                  ))
                ) : (
                  <GymEmptyState kind="calendar" title="Chưa có buổi tập." />
                )}
              </div>
            )}

            {tab === "measurements" && (
              <div className="space-y-4">
                <ProgressBodyCharts
                  measurements={measurements}
                  sessions={sessions}
                />
                {measurements.length ? (
                  <div className="overflow-x-auto rounded-md border border-outline-variant">
                    <table className="w-full min-w-[540px] text-left text-sm tabular-nums">
                      <thead className="bg-surface-container-low">
                        <tr>
                          {[
                            "Ngày đo",
                            "Cân nặng",
                            "Mỡ (%)",
                            "Cơ (kg)",
                            "Vòng eo (cm)",
                            "Điểm InBody",
                          ].map((label) => (
                            <th key={label} className="p-2 font-medium">
                              {label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {measurements.map((item) => (
                          <tr
                            key={item._id}
                            className="border-t border-outline-variant"
                          >
                            <td className="p-2">
                              {dateLabel(item.measurementDate)}
                            </td>
                            <td className="p-2">{item.weight ?? "—"}</td>
                            <td className="p-2">
                              {item.bodyFatPercentage ?? "—"}
                            </td>
                            <td className="p-2">{item.muscleMass ?? "—"}</td>
                            <td className="p-2">{item.waist ?? "—"}</td>
                            <td className="p-2">{item.inbodyScore ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <GymEmptyState kind="worker" title="Chưa có số đo." />
                )}
              </div>
            )}

            {tab === "achievements" &&
              (best.size ? (
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {[...best.values()].map((item) => (
                    <article
                      key={item.name}
                      className="rounded-md border border-outline-variant p-3"
                    >
                      <h3 className="font-semibold text-on-surface">
                        {item.name}
                      </h3>
                      <p className="text-sm font-medium text-primary">
                        {item.label}
                      </p>
                      <p className="text-xs text-on-surface-variant">
                        Đạt ngày {dateLabel(item.date)}
                      </p>
                    </article>
                  ))}
                </div>
              ) : (
                <GymEmptyState
                  kind="training"
                  title="Chưa có thành tích được ghi nhận."
                />
              ))}

            {tab === "photos" && (
              <ProgressPhotos
                api={api}
                customerId={customer._id}
                photos={photos}
                canWrite={canWrite}
                onSaved={() => setRevision((value) => value + 1)}
              />
            )}

            {tab === "plans" &&
              (plans.length ? (
                <div className="space-y-2.5">
                  {plans.map((plan) => (
                    <article
                      key={plan._id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-outline-variant p-3"
                    >
                      <div>
                        <h3 className="font-semibold text-on-surface">
                          {plan.title}
                        </h3>
                        <p className="text-xs text-on-surface-variant">
                          {plan.durationDays || (plan.durationWeeks || 4) * 7}{" "}
                          ngày · {dateLabel(plan.createdAt)}
                        </p>
                      </div>
                      <HrStatusBadge
                        tone={plan.status === "ACTIVE" ? "success" : "neutral"}
                      >
                        {plan.status === "ACTIVE" ? "Đang áp dụng" : "Lịch sử"}
                      </HrStatusBadge>
                    </article>
                  ))}
                </div>
              ) : (
                <GymEmptyState kind="training" title="Chưa có giáo án." />
              ))}

            {tab === "reports" && (
              <ProgressReports
                api={api}
                customerId={customer._id}
                canWrite={canWrite}
              />
            )}
          </div>
        )}
      </div>
    </ErpModal>
  );
}
