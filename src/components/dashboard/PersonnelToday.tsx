import { ArrowUpRight, Building2, CalendarClock, FileClock, ScanFace, UserRoundCog, UsersRound } from "lucide-react";
import type { DashboardSummary } from "../../types/dashboard";
import type { UserProfile } from "../../types";

function openPersonnelTab(sub: string, section?: string) {
  const query = new URLSearchParams({ sub });
  if (section) query.set("section", section);
  window.history.pushState(null, "", `/nhan-su?${query}`);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Chưa có hạn" : date.toLocaleDateString("vi-VN");
}

const cardClass = "relative flex min-h-[210px] flex-col overflow-hidden rounded-[22px] bg-white p-5 shadow-[0_8px_30px_rgba(31,69,104,0.055)] sm:p-6";
const linkClass = "mt-auto inline-flex w-fit items-center gap-1 pt-3 text-xs font-medium text-[#008ACB] hover:text-[#006DAB] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00ADFC]";

export function PersonnelToday({ summary, employees, departmentCount, canSeeTimekeeping, canApproveLeave, loading, error }: {
  summary: DashboardSummary | null;
  employees: UserProfile[] | null;
  departmentCount: number | null;
  canSeeTimekeeping: boolean;
  canApproveLeave: boolean;
  loading: boolean;
  error: boolean;
}) {
  const personnel = summary?.personnelNow;
  const attendance = summary?.timekeeping;
  const expiringContracts = personnel?.expiringContracts ?? [];
  const pendingApprovals = personnel?.pendingApprovals ?? [];
  const managerCount = employees ? employees.filter((employee) => employee.isLeader || ["manager", "branch_owner", "admin"].includes(employee.role)).length : null;
  const checkedIn = attendance?.checkedInToday ?? 0;
  const totalEmployees = attendance?.totalEmployees ?? 0;
  const attendancePercent = totalEmployees > 0 ? Math.min(100, Math.round(checkedIn / totalEmployees * 100)) : 0;
  const showValue = (value: number) => loading || !summary ? "—" : value.toLocaleString("vi-VN");
  const showRosterValue = (value: number | null) => value == null ? "—" : value.toLocaleString("vi-VN");
  return <section aria-label="Cần theo dõi" className="mb-5">
    <div className="grid gap-3 lg:grid-cols-3">
      <article className={`${cardClass} bg-[linear-gradient(115deg,#fff_42%,#f3faff_100%)]`}>
        <div className="relative z-10 flex items-center gap-3"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#DDF2FF] text-[#008FE3]"><ScanFace className="h-6 w-6" /></span><h2 className="text-sm font-semibold text-[#143963]">Chấm công vào</h2></div>
        {canSeeTimekeeping ? <>
          <div className="relative z-10 mt-3 flex items-center justify-between gap-2">
            <div className="min-w-0"><p className="text-[27px] font-semibold leading-tight tabular-nums text-[#058DCB]">{showValue(checkedIn)}<span className="ml-1 text-sm font-normal text-[#143963]">/ {showValue(totalEmployees)} nhân sự</span></p><p className="mt-1 text-xs text-slate-600">Đã chấm công vào hôm nay</p></div>
            <div className="grid h-[94px] w-[94px] shrink-0 place-items-center rounded-full p-2" style={{ background: `conic-gradient(#26A9F5 ${attendancePercent}%, #E9F3FA 0)` }}><div className="grid h-full w-full place-content-center rounded-full bg-white/95 text-center"><strong className="text-lg font-semibold text-[#143963]">{loading || !summary ? "—" : `${attendancePercent}%`}</strong><span className="text-[10px] text-slate-500">Đã chấm công</span></div></div>
          </div>
          <div className="relative z-10 mt-2 flex flex-wrap gap-2">
            <span className="rounded-lg bg-[#EAF6FF] px-2.5 py-1 text-[11px] text-[#007FB8]">Nghỉ có phép <strong className="ml-1 font-semibold tabular-nums">{showValue(attendance?.onApprovedLeaveToday ?? 0)}</strong></span>
            <span className="rounded-lg bg-[#FFF2E8] px-2.5 py-1 text-[11px] text-[#AE5C22]">Đi muộn <strong className="ml-1 font-semibold tabular-nums">{showValue(attendance?.lateToday ?? 0)}</strong></span>
          </div>
        </> : <p className="mt-5 text-sm text-slate-500">Cần quyền xem chấm công.</p>}
        {canSeeTimekeeping && <button type="button" onClick={() => openPersonnelTab("lich", "attendance")} className={linkClass}>Xem chấm công <ArrowUpRight className="h-3.5 w-3.5" /></button>}
      </article>
      <article className={`${cardClass} bg-[linear-gradient(115deg,#fff_48%,#fff8f3_100%)]`}>
        <CalendarClock aria-hidden className="pointer-events-none absolute -bottom-3 right-2 h-28 w-28 rotate-[-10deg] text-orange-100/70" strokeWidth={1.3} />
        <div className="relative z-10 flex items-center gap-3"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#FFF0E4] text-[#E86A18]"><CalendarClock className="h-6 w-6" /></span><h2 className="min-w-0 text-sm font-semibold text-[#143963]">Hợp đồng sắp hết hạn</h2><span className="ml-auto rounded-full bg-orange-50 px-2.5 py-1 text-sm font-semibold text-orange-700">{showValue(personnel?.expiringContractCount ?? 0)}</span></div>
        <div className="relative z-10 mt-5 space-y-2.5">{loading || error || !summary ? <p className="text-sm text-slate-500">{error ? "Không tải được hợp đồng." : "Đang tải hợp đồng..."}</p> : expiringContracts.length ? expiringContracts.map((contract) => <div key={contract.id} className="flex justify-between gap-3 text-xs"><span className="min-w-0 truncate text-[#143963]">{contract.employeeName}</span><span className="shrink-0 text-slate-500">{dateLabel(contract.endDate)}</span></div>) : <p className="text-sm text-[#143963]">Không có hợp đồng sắp hết hạn.</p>}</div>
        <button type="button" onClick={() => openPersonnelTab("hop-dong")} className={`${linkClass} relative z-10`}>Xem hợp đồng <ArrowUpRight className="h-3.5 w-3.5" /></button>
      </article>
      <article className={`${cardClass} bg-[linear-gradient(115deg,#fff_48%,#f8f5ff_100%)]`}>
        <UsersRound aria-hidden className="pointer-events-none absolute -bottom-5 right-1 h-28 w-28 text-violet-100/80" strokeWidth={1.3} />
        <div className="relative z-10 flex items-center gap-3"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#F0E8FF] text-[#7435E4]"><UsersRound className="h-6 w-6" /></span><h2 className="text-sm font-semibold text-[#143963]">Cơ cấu nhân sự</h2></div>
        <div className="relative z-10 mt-3 space-y-1.5">
          <div className="flex items-center justify-between rounded-xl bg-white/80 px-3 py-1.5 text-xs text-[#355271]"><span className="flex items-center gap-2"><UsersRound className="h-3.5 w-3.5 text-[#078DCC]" />Nhân sự</span><strong className="font-semibold tabular-nums text-[#078DCC]">{showRosterValue(employees?.length ?? null)}</strong></div>
          <div className="flex items-center justify-between rounded-xl bg-white/80 px-3 py-1.5 text-xs text-[#355271]"><span className="flex items-center gap-2"><Building2 className="h-3.5 w-3.5 text-[#18A873]" />Phòng ban</span><strong className="font-semibold tabular-nums text-[#18A873]">{showRosterValue(departmentCount)}</strong></div>
          <div className="flex items-center justify-between rounded-xl bg-white/80 px-3 py-1.5 text-xs text-[#355271]"><span className="flex items-center gap-2"><UserRoundCog className="h-3.5 w-3.5 text-[#7435E4]" />Người quản lý</span><strong className="font-semibold tabular-nums text-[#7435E4]">{showRosterValue(managerCount)}</strong></div>
        </div>
        <button type="button" onClick={() => openPersonnelTab("so-do")} className={`${linkClass} relative z-10`}>Xem sơ đồ <ArrowUpRight className="h-3.5 w-3.5" /></button>
      </article>
    </div>
    {canApproveLeave && !loading && !error && Boolean(personnel?.pendingApprovalCount) && <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-amber-50 px-4 py-3 text-amber-900 shadow-[0_5px_18px_rgba(120,76,18,0.055)]" role="status">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/75 text-amber-700"><FileClock className="h-4.5 w-4.5" /></span>
        <div className="min-w-0"><p className="text-sm font-medium">Có {personnel?.pendingApprovalCount} đơn cần kiểm tra</p><p className="truncate text-xs text-amber-800/80">{pendingApprovals.map((item) => item.employeeName).join(", ")}</p></div>
      </div>
      <button type="button" onClick={() => openPersonnelTab("lich", "requests")} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100 focus-visible:outline-2 focus-visible:outline-amber-500">Xem đơn <ArrowUpRight className="h-3.5 w-3.5" /></button>
    </div>}
  </section>;
}
