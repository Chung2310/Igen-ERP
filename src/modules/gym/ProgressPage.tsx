import { useMemo, useState } from "react";
import { Activity, Calendar, ClipboardCheck, History, TrendingUp, Users } from "lucide-react";
import { ErpRefreshButton } from "../../components/common/ErpRefreshButton";
import { TableFilterToolbar } from "../../components/common/TableFilterToolbar";
import { HrStatusBadge } from "../../components/hr/HrStatusBadge";
import type { GymList, GymRecord } from "../../../shared/gym/types";
import { cn } from "../student-management/lib/utils";
import type { GymApi } from "./api";
import RecordEditor from "./RecordEditor";
import RecordsPage from "./RecordsPage";
import ProgressJourneyModal from "./ProgressJourneyModal";
import { dateLabel, Feedback, GymAvatar, GymEmptyState, secondary, useGymQuery } from "./ui";

export default function ProgressPage({
  api,
  canWrite,
  onOpenCustomer,
}: {
  api: GymApi;
  canWrite: boolean;
  onOpenCustomer: (customer: GymRecord) => void;
}) {
  const [showSessions, setShowSessions] = useState(false);
  const [search, setSearch] = useState("");
  const [revision, setRevision] = useState(0);
  const [logCustomerId, setLogCustomerId] = useState<string>();
  const [detailCustomer, setDetailCustomer] = useState<GymRecord>();

  const refresh = () => setRevision(v => v + 1);
  const customersQuery = useGymQuery<GymList>(api, "/customers?limit=200", revision);
  const sessionsQuery = useGymQuery<GymList>(api, "/sessions?limit=500", revision);
  const measurementsQuery = useGymQuery<GymList>(api, "/measurements?limit=500", revision);

  const customers = customersQuery.data?.data || [];
  const sessions = sessionsQuery.data?.data || [];
  const measurements = measurementsQuery.data?.data || [];

  const stats = useMemo(() => {
    const byCustomer = new Map<string, { sessions: GymRecord[]; measurements: GymRecord[] }>();
    for (const c of customers) byCustomer.set(c._id, { sessions: [], measurements: [] });
    for (const s of sessions) {
      const entry = byCustomer.get(s.customerId);
      if (entry) entry.sessions.push(s);
    }
    for (const m of measurements) {
      const entry = byCustomer.get(m.customerId);
      if (entry) entry.measurements.push(m);
    }

    let activeCount = 0;
    let presentSessions = 0;
    const cards = customers.map(c => {
      const entry = byCustomer.get(c._id)!;
      const sortedSessions = [...entry.sessions].sort((a, b) => String(b.performedAt || "").localeCompare(String(a.performedAt || "")));
      const sortedMeasurements = [...entry.measurements].sort((a, b) => String(a.measurementDate || "").localeCompare(String(b.measurementDate || "")));
      const present = sortedSessions.filter(s => s.attendance !== "ABSENT").length;
      presentSessions += present;
      if (sortedSessions.length > 0 || sortedMeasurements.length > 0) activeCount += 1;

      const latestWeight = sortedMeasurements.at(-1)?.weight ?? c.initialWeight ?? null;
      const firstWeight = sortedMeasurements[0]?.weight ?? c.initialWeight ?? null;
      const weightDelta =
        sortedMeasurements.length >= 2 && typeof latestWeight === "number" && typeof firstWeight === "number"
          ? Math.round((latestWeight - firstWeight) * 10) / 10
          : null;

      return {
        customer: c,
        sessionCount: sortedSessions.length,
        attendanceRate: sortedSessions.length ? Math.round((present / sortedSessions.length) * 100) : null,
        latestWeight,
        weightDelta,
        lastSessionDate: sortedSessions[0]?.performedAt || null,
      };
    });

    const avgAttendance = sessions.length ? Math.round((presentSessions / sessions.length) * 100) : 0;
    return { activeCount, avgAttendance, cards };
  }, [customers, sessions, measurements]);

  const filteredCards = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return stats.cards;
    return stats.cards.filter(
      item =>
        String(item.customer.fullName || "").toLowerCase().includes(q) ||
        String(item.customer.phone || "").toLowerCase().includes(q),
    );
  }, [stats.cards, search]);

  const toggleSessionsButton = (
    <button
      type="button"
      aria-pressed={showSessions}
      className={cn(secondary, showSessions && "border-primary/50 bg-primary/5 text-primary")}
      onClick={() => setShowSessions(v => !v)}
    >
      <History className="size-3.5" aria-hidden="true" />
      {showSessions ? "Tổng quan" : "Lịch sử buổi tập"}
    </button>
  );

  return (
    <section className="flex min-h-full flex-1 flex-col gap-3" aria-label="Tiến độ">
      {!showSessions ? (
        <div className="flex flex-1 flex-col gap-3">
          <dl className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {[
              { label: "Khách hàng", value: String(customers.length), icon: Users, tone: "gym-kpi-icon--primary", valueClass: "text-primary" },
              { label: "Đang hoạt động", value: String(stats.activeCount), icon: Activity, tone: "gym-kpi-icon--success", valueClass: "text-change-up" },
              { label: "Buổi đã ghi", value: String(sessions.length), icon: Calendar, tone: "gym-kpi-icon--warning", valueClass: "text-tertiary" },
              { label: "Tỷ lệ tham gia", value: `${stats.avgAttendance}%`, icon: TrendingUp, tone: "gym-kpi-icon--violet", valueClass: "text-on-surface" },
            ].map(({ label, value, icon: Icon, tone, valueClass }) => (
              <div
                key={label}
                className="flex items-center justify-between gap-3 rounded-md border border-outline-variant bg-surface-container-lowest px-4 py-3 shadow-2xs"
              >
                <div className="min-w-0 space-y-1">
                  <dt className="truncate text-xs text-on-surface-variant">{label}</dt>
                  <dd className={cn("text-xl font-semibold tabular-nums", valueClass)}>{value}</dd>
                </div>
                <span className={cn("inline-flex size-9 shrink-0 items-center justify-center rounded-md", tone)} aria-hidden="true">
                  <Icon className="size-4" />
                </span>
              </div>
            ))}
          </dl>

          <div className="flex flex-1 flex-col gap-3 rounded-md border border-outline-variant bg-surface-container-lowest p-3 sm:p-4">
            <TableFilterToolbar
              appearance="plain"
              actions={
                <>
                  {toggleSessionsButton}
                  <ErpRefreshButton
                    loading={customersQuery.loading || sessionsQuery.loading}
                    onClick={refresh}
                  />
                </>
              }
              search={{
                value: search,
                onChange: setSearch,
                placeholder: "Tìm theo tên, SĐT...",
                ariaLabel: "Tìm học viên",
                className: "min-w-0",
              }}
              totalCount={filteredCards.length}
              countLabel="học viên"
              hasActiveFilters={Boolean(search.trim())}
              onResetFilters={() => setSearch("")}
            />

            <Feedback error={customersQuery.error || sessionsQuery.error} loading={customersQuery.loading} />

            {!customersQuery.loading && !filteredCards.length && (
              <GymEmptyState
                kind="worker"
                filtered={Boolean(search.trim())}
                title="Chưa có học viên phù hợp."
              />
            )}

            {filteredCards.length > 0 && (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {filteredCards.map(({ customer, sessionCount, attendanceRate, latestWeight, weightDelta, lastSessionDate }) => (
                  <article
                    key={customer._id}
                    className="flex flex-col justify-between rounded-md border border-outline-variant bg-surface-container-lowest p-4 shadow-2xs transition-colors hover:border-primary/40"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <GymAvatar name={customer.fullName} />
                          <div className="min-w-0">
                            <h3 className="truncate text-sm font-semibold text-on-surface">{customer.fullName}</h3>
                            <p className="truncate text-xs text-on-surface-variant">{customer.phone || "—"}</p>
                          </div>
                        </div>
                        <HrStatusBadge tone={customer.status === "ACTIVE" ? "success" : "neutral"} className="normal-case">
                          {customer.status === "ACTIVE" ? "Đang tập" : customer.status === "LEAD" ? "Tiềm năng" : "Tạm ngừng"}
                        </HrStatusBadge>
                      </div>

                      <dl className="space-y-1.5 border-t border-outline-variant/60 pt-2.5 text-xs tabular-nums">
                        <div className="flex items-center justify-between">
                          <dt className="text-on-surface-variant">Buổi đã tập</dt>
                          <dd className="font-semibold text-on-surface">{sessionCount} buổi</dd>
                        </div>
                        <div className="flex items-center justify-between">
                          <dt className="text-on-surface-variant">Tỷ lệ tham gia</dt>
                          <dd className="font-semibold text-on-surface">{attendanceRate != null ? `${attendanceRate}%` : "—"}</dd>
                        </div>
                        <div className="flex items-center justify-between">
                          <dt className="text-on-surface-variant">Cân nặng</dt>
                          <dd className="font-semibold text-on-surface">
                            {latestWeight != null ? `${latestWeight} kg` : "—"}
                            {weightDelta != null && (
                              <span className={cn("ml-1 text-[11px]", weightDelta <= 0 ? "text-change-up" : "text-error")}>
                                ({weightDelta > 0 ? `+${weightDelta}` : weightDelta})
                              </span>
                            )}
                          </dd>
                        </div>
                        <div className="flex items-center justify-between">
                          <dt className="text-on-surface-variant">Buổi gần nhất</dt>
                          <dd className="font-medium text-on-surface">{lastSessionDate ? dateLabel(lastSessionDate) : "Chưa có"}</dd>
                        </div>
                      </dl>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2 border-t border-outline-variant/60 pt-3">
                      <button
                        type="button"
                        onClick={() => setDetailCustomer(customer)}
                        className="inline-flex min-h-8 cursor-pointer items-center justify-center rounded-lg border border-outline-variant bg-surface-container-lowest px-2.5 text-xs font-medium text-on-surface transition-colors hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-primary"
                      >
                        Xem tiến độ
                      </button>
                      {canWrite && (
                        <button
                          type="button"
                          onClick={() => setLogCustomerId(customer._id)}
                          className="inline-flex min-h-8 cursor-pointer items-center justify-center gap-1 rounded-lg bg-primary px-2.5 text-xs font-semibold text-on-primary transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-primary"
                        >
                          <ClipboardCheck className="size-3.5" aria-hidden="true" />
                          Ghi nhận
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <RecordsPage
          key="sessions"
          api={api}
          entity="sessions"
          canWrite={canWrite}
          embedded
          toolbarActions={toggleSessionsButton}
        />
      )}

      {logCustomerId && (
        <RecordEditor
          api={api}
          entity="sessions"
          customerId={logCustomerId}
          onClose={() => setLogCustomerId(undefined)}
          onSaved={() => { setLogCustomerId(undefined); refresh(); }}
        />
      )}
      {detailCustomer && <ProgressJourneyModal api={api} customer={detailCustomer} canWrite={canWrite} onClose={() => setDetailCustomer(undefined)} onOpenProfile={() => { onOpenCustomer(detailCustomer); setDetailCustomer(undefined); }} />}
    </section>
  );
}
