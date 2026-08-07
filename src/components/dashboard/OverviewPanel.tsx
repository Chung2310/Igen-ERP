/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { FolderOpen, GraduationCap, KanbanSquare, MessageSquare, PackageCheck, UserCheck, Users, Wallet, TrendingUp, BookOpen, Banknote, CalendarCheck, Clock, UserX, CheckCircle2, UserPlus, TimerReset, Receipt, BadgePercent } from "lucide-react";
import { DashboardSummary, DashboardActionItems } from "../../types/dashboard";
import { formatDashboardCurrency, buildPctSegments } from "./dashboardUtils";
import { ActionItemsWidget } from "./ActionItemsWidget";
import { useEntityLabel } from "../../modules/student-management/hooks/useEntityLabel";
import { DashboardSectionCard } from "./DashboardSectionCard";

export function OverviewPanel({
  summary,
  actionItems,
  canSeeHr,
  canSeeStudent,
}: {
  summary: DashboardSummary | null;
  actionItems?: DashboardActionItems | null;
  canSeeHr: boolean;
  canSeeStudent: boolean;
  [key: string]: any; 
}) {
  const entityLabel = useEntityLabel(canSeeStudent);
  const { titleCase: studentEntityTitle, singular: studentEntitySingular, preset } = entityLabel;
  const isEducation = preset === "student";

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

  const SimpleMetric = ({ icon: Icon, title, value, unit, tone = "blue", onClick }: any) => {
    const tones: Record<string, { bg: string, text: string, iconBg: string }> = {
      blue: { bg: "hover:bg-blue-50/50 hover:border-blue-200", text: "text-blue-600", iconBg: "bg-blue-50 text-blue-600" },
      amber: { bg: "hover:bg-amber-50/50 hover:border-amber-200", text: "text-amber-600", iconBg: "bg-amber-50 text-amber-600" },
      emerald: { bg: "hover:bg-emerald-50/50 hover:border-emerald-200", text: "text-emerald-600", iconBg: "bg-emerald-50 text-emerald-600" },
      indigo: { bg: "hover:bg-indigo-50/50 hover:border-indigo-200", text: "text-indigo-600", iconBg: "bg-indigo-50 text-indigo-600" },
      rose: { bg: "hover:bg-rose-50/50 hover:border-rose-200", text: "text-rose-600", iconBg: "bg-rose-50 text-rose-600" },
      slate: { bg: "hover:bg-slate-50 hover:border-slate-300", text: "text-slate-600", iconBg: "bg-slate-100 text-slate-500" },
    };
    const c = tones[tone] || tones.blue;

    return (
      <div 
        onClick={onClick}
        className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/70 bg-white p-3.5 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] transition-all duration-200 ${onClick ? 'cursor-pointer ' + c.bg : ''}`}
      >
        <div className="flex items-center gap-2 mb-2">
          <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${c.iconBg}`}>
            <Icon className="h-4 w-4" />
          </div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 truncate">{title}</p>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="font-sans text-xl font-black tracking-tight text-slate-800 truncate" title={value}>
            {value}
          </span>
          {unit && <span className="text-[10px] text-slate-400 font-bold uppercase">{unit}</span>}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 pb-10">
      {actionItems && (
        <ActionItemsWidget
          actionItems={actionItems}
          onGoToTasks={() => goToTab("NHÂN SỰ", "kanban")}
          onGoToApprovals={() => goToTab("NHÂN SỰ", "lich")}
          onGoToInventory={() => {}}
        />
      )}

      {/* 1. KHỐI KINH DOANH */}
      {canSeeStudent && (
        <DashboardSectionCard
          title="Kinh doanh"
          icon={TrendingUp}
          gradientFrom="from-cyan-500"
          gradientTo="to-blue-600"
        >
          <SimpleMetric
            icon={TrendingUp}
            tone="blue"
            title="Doanh thu hôm nay"
            value={summary?.students?.revenueToday != null ? formatDashboardCurrency(summary.students.revenueToday, 1, false) : "..."}
            unit="VNĐ"
          />
          <SimpleMetric
            icon={Wallet}
            tone="blue"
            title="Doanh thu tháng"
            value={summary ? formatDashboardCurrency(summary.students.tuitionRevenue, 1, false) : "..."}
            unit="VNĐ"
          />
          <SimpleMetric
            icon={UserPlus}
            tone="emerald"
            title={`${studentEntityTitle} mới`}
            value={summary ? String(summary.students.newStudents) : "..."}
            unit={studentEntitySingular}
          />
          <SimpleMetric
            icon={TimerReset}
            tone="rose"
            title={`Sắp hết hạn / khóa`}
            value={summary?.students.expiringStudentCount != null ? String(summary.students.expiringStudentCount) : "..."}
            unit={studentEntitySingular}
          />
        </DashboardSectionCard>
      )}

      {/* 2. KHỐI ĐÀO TẠO (Chỉ hiện nếu là Giáo dục) */}
      {canSeeStudent && isEducation && (
        <DashboardSectionCard
          title="Đào tạo & Vận hành lớp"
          icon={BookOpen}
          gradientFrom="from-indigo-500"
          gradientTo="to-purple-600"
        >
          <SimpleMetric
            icon={BookOpen}
            tone="indigo"
            title="Lớp đang học"
            value={summary?.batches?.activeCount != null ? String(summary.batches.activeCount) : String(summary?.students.activeBatches || "...")}
            unit="Lớp"
          />
          <SimpleMetric
            icon={CalendarCheck}
            tone="emerald"
            title="Khai giảng hôm nay"
            value={summary?.batches?.openingTodayCount != null ? String(summary.batches.openingTodayCount) : "..."}
            unit="Lớp"
          />
          <SimpleMetric
            icon={UserX}
            tone="amber"
            title="Giáo viên nghỉ"
            value={summary?.instructors?.onLeaveToday != null ? String(summary.instructors.onLeaveToday) : "..."}
            unit="Giáo viên"
          />
          <SimpleMetric
            icon={Users}
            tone="rose"
            title="Thiếu giáo viên"
            value={summary?.batches?.missingInstructorCount != null ? String(summary.batches.missingInstructorCount) : "..."}
            unit="Lớp"
          />
          <SimpleMetric
            icon={TimerReset}
            tone="amber"
            title="Sắp kết thúc"
            value={summary?.batches?.endingSoonCount != null ? String(summary.batches.endingSoonCount) : "..."}
            unit="Lớp"
          />
          <SimpleMetric
            icon={UserX}
            tone="rose"
            title="Học viên nghỉ nhiều"
            value={summary?.batches?.frequentAbsentStudents != null ? String(summary.batches.frequentAbsentStudents) : "..."}
            unit="Học viên"
          />
        </DashboardSectionCard>
      )}

      {/* 3. KHỐI CÔNG NỢ */}
      {canSeeStudent && (
        <DashboardSectionCard
          title="Công nợ & Thu phí"
          icon={Banknote}
          gradientFrom="from-amber-500"
          gradientTo="to-orange-600"
        >
          <SimpleMetric
            icon={Receipt}
            tone="rose"
            title="Công nợ quá hạn"
            value={summary?.receivables?.overdueAmount != null ? formatDashboardCurrency(summary.receivables.overdueAmount, 1, false) : "..."}
            unit="VNĐ"
          />
          <SimpleMetric
            icon={UserX}
            tone="amber"
            title={`${studentEntityTitle} chưa đóng`}
            value={summary?.students?.unpaidStudentCount != null ? String(summary.students.unpaidStudentCount) : "..."}
            unit={studentEntitySingular}
          />
          <SimpleMetric
            icon={Wallet}
            tone="blue"
            title="Cần thu hôm nay"
            value={summary?.receivables?.dueTodayAmount != null ? formatDashboardCurrency(summary.receivables.dueTodayAmount, 1, false) : "..."}
            unit="VNĐ"
          />
          <SimpleMetric
            icon={Banknote}
            tone="emerald"
            title="Đã thu hôm nay"
            value={summary?.receivables?.collectedTodayAmount != null ? formatDashboardCurrency(summary.receivables.collectedTodayAmount, 1, false) : "..."}
            unit="VNĐ"
          />
        </DashboardSectionCard>
      )}

      {/* 4. KHỐI NHÂN SỰ */}
      {canSeeHr && (
        <DashboardSectionCard
          title="Nhân sự & Chấm công"
          icon={Users}
          gradientFrom="from-emerald-500"
          gradientTo="to-teal-600"
        >
          <SimpleMetric
            icon={CheckCircle2}
            tone="emerald"
            title="Đi làm"
            value={summary ? String(summary.timekeeping.checkedInToday) : "..."}
            unit={`/ ${summary ? summary.timekeeping.totalEmployees : "..."} Người`}
            onClick={() => goToTab("NHÂN SỰ", "lich")}
          />
          <SimpleMetric
            icon={Clock}
            tone="amber"
            title="Đi muộn"
            value={summary ? String(summary.timekeeping.lateToday) : "..."}
            unit="Người"
            onClick={() => goToTab("NHÂN SỰ", "lich")}
          />
          <SimpleMetric
            icon={UserX}
            tone="slate"
            title="Nghỉ phép"
            value={summary?.timekeeping?.onApprovedLeaveToday != null ? String(summary.timekeeping.onApprovedLeaveToday) : "..."}
            unit="Người"
            onClick={() => goToTab("NHÂN SỰ", "lich")}
          />
          <SimpleMetric
            icon={UserX}
            tone="rose"
            title="Nghỉ không phép"
            value={summary?.timekeeping?.absentWithoutLeave != null ? String(summary.timekeeping.absentWithoutLeave) : "..."}
            unit="Người"
            onClick={() => goToTab("NHÂN SỰ", "lich")}
          />
        </DashboardSectionCard>
      )}

    </div>
  );
}
