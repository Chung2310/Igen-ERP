/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from "react";
import { Users, Wallet, TrendingUp, BookOpen, Banknote, CalendarCheck, Clock, UserX, CheckCircle2, UserPlus, TimerReset, Receipt, Search, RotateCcw } from "lucide-react";
import { DashboardSummary, DashboardActionItems } from "../../types/dashboard";
import { formatDashboardCurrency } from "./dashboardUtils";
import { ActionItemsWidget } from "./ActionItemsWidget";
import { useEntityLabel } from "../../modules/student-management/hooks/useEntityLabel";
import { DashboardSectionCard } from "./DashboardSectionCard";
import { OverviewAttendanceChart, OverviewComparisonChart, OverviewDonutPanel, OverviewShareChart, OverviewTimelineChart } from "./OverviewCharts";
import { DASHBOARD_CHART_PALETTE } from "./dashboardPalette";
import { OverviewKpiCard } from "./OverviewKpiCard";
import { analyticsService } from "../../services/analyticsService";

type OverviewGroup = "all" | "business" | "training" | "debt" | "hr";

export function OverviewPanel({
  summary,
  actionItems,
  canSeeHr,
  canSeeStudent,
  refreshKey = 0,
  onRefresh,
}: {
  summary: DashboardSummary | null;
  actionItems?: DashboardActionItems | null;
  canSeeHr: boolean;
  canSeeStudent: boolean;
  refreshKey?: number;
  onRefresh?: () => void;
  [key: string]: any;
}) {
  const entityLabel = useEntityLabel(canSeeStudent);
  const { titleCase: studentEntityTitle, singular: studentEntitySingular, preset } = entityLabel;
  const isEducation = preset === "student";
  const [group, setGroup] = useState<OverviewGroup>("all");
  const [search, setSearch] = useState("");
  const [periodWeeks, setPeriodWeeks] = useState<4 | 8 | 12>(8);
  const [revenueSeries, setRevenueSeries] = useState<Array<{ label: string; value: number }>>([]);
  const [revenueLoading, setRevenueLoading] = useState(canSeeStudent);
  const [revenueError, setRevenueError] = useState(false);

  useEffect(() => {
    if (!canSeeStudent) return;
    let cancelled = false;
    const to = new Date();
    const from = new Date(to);
    from.setDate(to.getDate() - periodWeeks * 7 + 1);
    setRevenueLoading(true);
    setRevenueError(false);
    analyticsService.getRevenue({ from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10), granularity: "week" })
      .then((report) => {
        if (!cancelled) setRevenueSeries(report.series.map((bucket) => ({ label: bucket.bucket.slice(5), value: bucket.amount })));
      })
      .catch((error) => {
        console.error("Không thể tải biểu đồ doanh thu tổng quan:", error);
        if (!cancelled) { setRevenueSeries([]); setRevenueError(true); }
      })
      .finally(() => { if (!cancelled) setRevenueLoading(false); });
    return () => { cancelled = true; };
  }, [canSeeStudent, periodWeeks, refreshKey]);

  const normalizedSearch = search.trim().toLocaleLowerCase("vi-VN");
  const matches = (...terms: string[]) => !normalizedSearch || terms.some((term) => term.toLocaleLowerCase("vi-VN").includes(normalizedSearch));
  const showBusiness = canSeeStudent && (group === "all" || group === "business") && matches("kinh doanh", "doanh thu", "học viên mới", "sắp hết hạn");
  const showTraining = canSeeStudent && isEducation && (group === "all" || group === "training") && matches("đào tạo", "lớp", "giáo viên", "khai giảng", "học viên nghỉ");
  const showDebt = canSeeStudent && (group === "all" || group === "debt") && matches("công nợ", "thu phí", "học viên chưa đóng", "đã thu");
  const showHr = canSeeHr && (group === "all" || group === "hr") && matches("nhân sự", "chấm công", "đi làm", "đi muộn", "nghỉ phép");
  const showActionItems = !!actionItems && group === "all" && !normalizedSearch;
  const hasSideColumn = showBusiness || showActionItems;
  const percent = (value: number, total: number) => total > 0 ? (Math.max(0, value) / total) * 100 : undefined;

  const kpis = [
    ...(canSeeStudent ? [
      { group: "business" as const, icon: TrendingUp, label: "Doanh thu hôm nay", value: summary ? formatDashboardCurrency(summary.students.revenueToday ?? 0, 1, false) : "...", unit: "VNĐ", detail: "So với doanh thu tháng", progress: percent(summary?.students.revenueToday ?? 0, summary?.students.tuitionRevenue ?? 0) },
      { group: "business" as const, icon: Wallet, label: "Doanh thu tháng", value: summary ? formatDashboardCurrency(summary.students.tuitionRevenue, 1, false) : "...", unit: "VNĐ", detail: "Doanh thu học phí tháng này" },
      { group: "business" as const, icon: UserPlus, label: `${studentEntityTitle} mới`, value: summary ? String(summary.students.newStudents) : "...", unit: studentEntitySingular, detail: "Trong hôm nay", progress: percent(summary?.students.newStudents ?? 0, summary?.students.totalStudents ?? 0) },
      { group: "training" as const, icon: BookOpen, label: "Lớp đang học", value: summary ? String(summary.batches?.activeCount ?? summary.students.activeBatches) : "...", unit: "lớp", detail: "Đang hoạt động" },
      { group: "debt" as const, icon: Receipt, label: "Công nợ quá hạn", value: summary ? formatDashboardCurrency(summary.receivables?.overdueAmount ?? 0, 1, false) : "...", unit: "VNĐ", detail: "Cần theo dõi", progress: percent(summary?.receivables?.overdueAmount ?? 0, summary?.students.outstandingDebt ?? 0) },
    ] : []),
    ...(canSeeHr ? [{ group: "hr" as const, icon: CheckCircle2, label: "Đi làm hôm nay", value: summary ? String(summary.timekeeping.checkedInToday) : "...", unit: "người", detail: `${summary?.timekeeping.totalEmployees ?? "..."} nhân sự`, progress: percent(summary?.timekeeping.checkedInToday ?? 0, summary?.timekeeping.totalEmployees ?? 0) }] : []),
  ];
  const visibleKpis = kpis.filter((item) => (group === "all" || item.group === group) && matches(item.label, item.detail));

  const goToTab = (tab: string, subTab?: string) => {
    const pathMap: Record<string, string> = {
      "TỔNG QUAN": "/tong-quan",
      "NHÂN SỰ": "/nhan-su",
      "QUẢN LÝ HỌC VIÊN": "/quan-ly-hoc-vien",
      "ANALYTICS": "/analytics",
    };
    let path = pathMap[tab];
    if (path) {
      if (subTab) {
        path += `?sub=${subTab}`;
      }
      window.history.pushState(null, "", path);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  };

  const SimpleMetric = ({ icon: Icon, title, value, unit, onClick }: any) => (
    <div
      onClick={onClick}
      className={`group flex min-w-0 items-center gap-2.5 rounded-xl border border-slate-200/70 bg-white px-3 py-2.5 transition-colors ${onClick ? "cursor-pointer hover:border-[#B5E8FF] hover:bg-[#F4FBFF]" : ""}`}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#E8F7FF] text-[#007EB8]">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-[10px] font-bold uppercase tracking-wide text-slate-500" title={title}>{title}</p>
        <div className="flex items-baseline gap-1">
          <span className="truncate text-base font-black tabular-nums tracking-tight text-slate-800" title={value}>{value}</span>
          {unit && <span className="shrink-0 truncate text-[10px] font-semibold text-slate-400">{unit}</span>}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-3 pb-6">
      {/* Toolbar: 1 hàng gọn */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200/80 bg-white p-2 shadow-sm">
        <label className="flex h-9 min-w-[200px] flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3 text-slate-400 focus-within:border-[#00ADFC]">
          <Search className="h-4 w-4 shrink-0" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm chỉ số, nhóm báo cáo..."
            className="min-w-0 flex-1 bg-transparent text-xs text-slate-700 outline-none placeholder:text-slate-400"
            aria-label="Tìm chỉ số trên trang tổng quan"
          />
        </label>
        <select
          value={group}
          onChange={(event) => setGroup(event.target.value as OverviewGroup)}
          className="h-9 min-w-[170px] rounded-xl border border-slate-200 bg-slate-50/70 px-3 text-xs font-semibold text-slate-700 outline-none focus:border-[#00ADFC]"
          aria-label="Lọc nhóm báo cáo"
        >
          <option value="all">Tất cả nhóm báo cáo</option>
          {canSeeStudent && <option value="business">Kinh doanh</option>}
          {canSeeStudent && isEducation && <option value="training">Đào tạo</option>}
          {canSeeStudent && <option value="debt">Công nợ & thu phí</option>}
          {canSeeHr && <option value="hr">Nhân sự & chấm công</option>}
        </select>
        <div className="flex items-center rounded-xl bg-[#F4FBFF] p-1" aria-label="Khoảng thời gian biểu đồ doanh thu">
          {([4, 8, 12] as const).map((weeks) => (
            <button
              key={weeks}
              type="button"
              onClick={() => setPeriodWeeks(weeks)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${periodWeeks === weeks ? "bg-white text-[#007EB8] shadow-sm" : "text-slate-500 hover:text-[#007EB8]"}`}
              aria-pressed={periodWeeks === weeks}
            >
              {weeks} tuần
            </button>
          ))}
        </div>
        <button type="button" onClick={onRefresh} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-[#00ADFC] hover:text-[#007EB8]" aria-label="Làm mới dữ liệu tổng quan" title="Làm mới dữ liệu">
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>

      {/* KPI strip gọn */}
      {visibleKpis.length > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {visibleKpis.map((item, index) => <OverviewKpiCard key={item.label} {...item} emphasis={index >= 2} />)}
        </div>
      )}

      {/* Bố cục chính: cột trái (biểu đồ + khối số liệu) / cột phải (cơ cấu + việc cần làm) */}
      <div className="grid items-start gap-3 xl:grid-cols-12">
        <div className={`min-w-0 space-y-3 ${hasSideColumn ? "xl:col-span-8" : "xl:col-span-12"}`}>
          {showBusiness && (
            <OverviewTimelineChart title="Doanh thu theo từng tuần" series={revenueSeries} periodWeeks={periodWeeks} loading={revenueLoading} error={revenueError} />
          )}

          <div className="grid items-start gap-3 lg:grid-cols-2">
            {/* 1. KHỐI KINH DOANH */}
            {showBusiness && (
              <DashboardSectionCard
                title="Kinh doanh"
                icon={TrendingUp}
                gradientFrom="from-[#00ADFC]"
                gradientTo="to-[#6CCFFD]"
                charts={
                  <>
                    <OverviewComparisonChart
                      title="Doanh thu"
                      unit="money"
                      loading={!summary}
                      items={[
                        { label: "Hôm nay", value: summary?.students.revenueToday ?? 0, color: DASHBOARD_CHART_PALETTE[0] },
                        { label: "Tháng này", value: summary?.students.tuitionRevenue ?? 0, color: DASHBOARD_CHART_PALETTE[1] },
                      ]}
                    />
                    <OverviewComparisonChart
                      title="Học viên"
                      loading={!summary}
                      items={[
                        { label: `${studentEntityTitle} mới`, value: summary?.students.newStudents ?? 0, color: DASHBOARD_CHART_PALETTE[0] },
                        { label: "Sắp hết hạn / khóa", value: summary?.students.expiringStudentCount ?? 0, color: DASHBOARD_CHART_PALETTE[2] },
                      ]}
                    />
                  </>
                }
              >
                <SimpleMetric icon={TrendingUp} title="Doanh thu hôm nay" value={summary?.students?.revenueToday != null ? formatDashboardCurrency(summary.students.revenueToday, 1, false) : "..."} unit="VNĐ" />
                <SimpleMetric icon={Wallet} title="Doanh thu tháng" value={summary ? formatDashboardCurrency(summary.students.tuitionRevenue, 1, false) : "..."} unit="VNĐ" />
                <SimpleMetric icon={UserPlus} title={`${studentEntityTitle} mới`} value={summary ? String(summary.students.newStudents) : "..."} unit={studentEntitySingular} />
                <SimpleMetric icon={TimerReset} title="Sắp hết hạn / khóa" value={summary?.students.expiringStudentCount != null ? String(summary.students.expiringStudentCount) : "..."} unit={studentEntitySingular} />
              </DashboardSectionCard>
            )}

            {/* 2. KHỐI ĐÀO TẠO (Chỉ hiện nếu là Giáo dục) */}
            {showTraining && (
              <DashboardSectionCard
                title="Đào tạo & Vận hành lớp"
                icon={BookOpen}
                gradientFrom="from-[#00ADFC]"
                gradientTo="to-[#9DDFFE]"
                charts={
                  <>
                    <OverviewComparisonChart
                      title="Tình trạng lớp"
                      loading={!summary}
                      items={[
                        { label: "Đang học", value: summary?.batches?.activeCount ?? summary?.students.activeBatches ?? 0, color: DASHBOARD_CHART_PALETTE[0] },
                        { label: "Khai giảng hôm nay", value: summary?.batches?.openingTodayCount ?? 0, color: DASHBOARD_CHART_PALETTE[1] },
                        { label: "Sắp kết thúc", value: summary?.batches?.endingSoonCount ?? 0, color: DASHBOARD_CHART_PALETTE[2] },
                        { label: "Thiếu giáo viên", value: summary?.batches?.missingInstructorCount ?? 0, color: DASHBOARD_CHART_PALETTE[3] },
                      ]}
                    />
                    <OverviewComparisonChart
                      title="Cần theo dõi"
                      loading={!summary}
                      items={[
                        { label: "Giáo viên nghỉ", value: summary?.instructors?.onLeaveToday ?? 0, color: DASHBOARD_CHART_PALETTE[0] },
                        { label: "Học viên nghỉ nhiều", value: summary?.batches?.frequentAbsentStudents ?? 0, color: DASHBOARD_CHART_PALETTE[2] },
                      ]}
                    />
                  </>
                }
              >
                <SimpleMetric icon={BookOpen} title="Lớp đang học" value={summary?.batches?.activeCount != null ? String(summary.batches.activeCount) : String(summary?.students.activeBatches || "...")} unit="Lớp" />
                <SimpleMetric icon={CalendarCheck} title="Khai giảng hôm nay" value={summary?.batches?.openingTodayCount != null ? String(summary.batches.openingTodayCount) : "..."} unit="Lớp" />
                <SimpleMetric icon={UserX} title="Giáo viên nghỉ" value={summary?.instructors?.onLeaveToday != null ? String(summary.instructors.onLeaveToday) : "..."} unit="GV" />
                <SimpleMetric icon={Users} title="Thiếu giáo viên" value={summary?.batches?.missingInstructorCount != null ? String(summary.batches.missingInstructorCount) : "..."} unit="Lớp" />
                <SimpleMetric icon={TimerReset} title="Sắp kết thúc" value={summary?.batches?.endingSoonCount != null ? String(summary.batches.endingSoonCount) : "..."} unit="Lớp" />
                <SimpleMetric icon={UserX} title="Học viên nghỉ nhiều" value={summary?.batches?.frequentAbsentStudents != null ? String(summary.batches.frequentAbsentStudents) : "..."} unit="HV" />
              </DashboardSectionCard>
            )}

            {/* 3. KHỐI CÔNG NỢ */}
            {showDebt && (
              <DashboardSectionCard
                title="Công nợ & Thu phí"
                icon={Banknote}
                gradientFrom="from-[#00ADFC]"
                gradientTo="to-[#6CCFFD]"
                charts={
                  <>
                    <OverviewComparisonChart
                      title="Dòng tiền & công nợ"
                      unit="money"
                      loading={!summary}
                      items={[
                        { label: "Công nợ quá hạn", value: summary?.receivables?.overdueAmount ?? 0, color: DASHBOARD_CHART_PALETTE[0] },
                        { label: "Cần thu hôm nay", value: summary?.receivables?.dueTodayAmount ?? 0, color: DASHBOARD_CHART_PALETTE[1] },
                        { label: "Đã thu hôm nay", value: summary?.receivables?.collectedTodayAmount ?? 0, color: DASHBOARD_CHART_PALETTE[2] },
                      ]}
                    />
                    <OverviewShareChart
                      title="Học viên chưa đóng"
                      label="Chưa đóng / tổng học viên"
                      value={summary?.students.unpaidStudentCount ?? 0}
                      total={summary?.students.totalStudents ?? 0}
                      color={DASHBOARD_CHART_PALETTE[0]}
                      loading={!summary}
                    />
                  </>
                }
              >
                <SimpleMetric icon={Receipt} title="Công nợ quá hạn" value={summary?.receivables?.overdueAmount != null ? formatDashboardCurrency(summary.receivables.overdueAmount, 1, false) : "..."} unit="VNĐ" />
                <SimpleMetric icon={UserX} title={`${studentEntityTitle} chưa đóng`} value={summary?.students?.unpaidStudentCount != null ? String(summary.students.unpaidStudentCount) : "..."} unit={studentEntitySingular} />
                <SimpleMetric icon={Wallet} title="Cần thu hôm nay" value={summary?.receivables?.dueTodayAmount != null ? formatDashboardCurrency(summary.receivables.dueTodayAmount, 1, false) : "..."} unit="VNĐ" />
                <SimpleMetric icon={Banknote} title="Đã thu hôm nay" value={summary?.receivables?.collectedTodayAmount != null ? formatDashboardCurrency(summary.receivables.collectedTodayAmount, 1, false) : "..."} unit="VNĐ" />
              </DashboardSectionCard>
            )}

            {/* 4. KHỐI NHÂN SỰ */}
            {showHr && (
              <DashboardSectionCard
                title="Nhân sự & Chấm công"
                icon={Users}
                gradientFrom="from-[#00ADFC]"
                gradientTo="to-[#9DDFFE]"
                charts={
                  <div className="sm:col-span-2">
                    <OverviewAttendanceChart
                      checkedIn={summary?.timekeeping.checkedInToday ?? 0}
                      late={summary?.timekeeping.lateToday ?? 0}
                      approvedLeave={summary?.timekeeping.onApprovedLeaveToday ?? 0}
                      absent={summary?.timekeeping.absentWithoutLeave ?? 0}
                      total={summary?.timekeeping.totalEmployees ?? 0}
                      loading={!summary}
                    />
                  </div>
                }
              >
                <SimpleMetric icon={CheckCircle2} title="Đi làm" value={summary ? String(summary.timekeeping.checkedInToday) : "..."} unit={`/ ${summary ? summary.timekeeping.totalEmployees : "..."}`} onClick={() => goToTab("NHÂN SỰ", "lich")} />
                <SimpleMetric icon={Clock} title="Đi muộn" value={summary ? String(summary.timekeeping.lateToday) : "..."} unit="Người" onClick={() => goToTab("NHÂN SỰ", "lich")} />
                <SimpleMetric icon={UserX} title="Nghỉ phép" value={summary?.timekeeping?.onApprovedLeaveToday != null ? String(summary.timekeeping.onApprovedLeaveToday) : "..."} unit="Người" onClick={() => goToTab("NHÂN SỰ", "lich")} />
                <SimpleMetric icon={UserX} title="Nghỉ không phép" value={summary?.timekeeping?.absentWithoutLeave != null ? String(summary.timekeeping.absentWithoutLeave) : "..."} unit="Người" onClick={() => goToTab("NHÂN SỰ", "lich")} />
              </DashboardSectionCard>
            )}
          </div>
        </div>

        {hasSideColumn && (
          <aside className="min-w-0 space-y-3 xl:col-span-4 xl:sticky xl:top-0">
            {showBusiness && (
              <OverviewDonutPanel
                title="Cơ cấu học viên theo học phí"
                total={summary?.students.totalStudents ?? 0}
                highlighted={summary?.students.unpaidStudentCount ?? 0}
                highlightedLabel="Học viên chưa đóng"
                remainderLabel="Học viên còn lại"
                loading={!summary}
              />
            )}
            {showActionItems && (
              <ActionItemsWidget
                actionItems={actionItems ?? null}
                onGoToTasks={() => goToTab("NHÂN SỰ", "kanban")}
                onGoToApprovals={() => goToTab("NHÂN SỰ", "lich")}
                onGoToInventory={() => {}}
              />
            )}
          </aside>
        )}
      </div>

      {visibleKpis.length === 0 && !showBusiness && !showTraining && !showDebt && !showHr && (
        <div className="rounded-2xl border border-dashed border-[#B5E8FF] bg-[#F4FBFF] p-8 text-center text-sm text-[#007EB8]">
          Không tìm thấy chỉ số phù hợp.
        </div>
      )}
    </div>
  );
}
