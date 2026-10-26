import { useState } from "react";
import { CalendarDays, CalendarCheck, Clock3, Users } from "lucide-react";
import type { EmployeeNode, UserProfile } from "../../types";
import { cn } from "../../modules/student-management/lib/utils";
import CalendarTab from "./CalendarTab";
import WorkShiftsTab from "../settings/WorkShiftsTab";
import CompanyWorkCalendarTab from "../settings/CompanyWorkCalendarTab";
import EmployeeWorkHoursTab from "../settings/EmployeeWorkHoursTab";

type Props = {
  userProfile: UserProfile | null;
  selectedCompanyCode: string;
  usersList: UserProfile[];
  employees: EmployeeNode[];
  isManager: boolean;
  canManageAttendance: boolean;
  canEditAttendance: boolean;
  canManageTimekeeping: boolean;
  canManageCalendar: boolean;
};

export default function HrScheduleTab({ userProfile, selectedCompanyCode, usersList, employees, isManager, canManageAttendance, canEditAttendance, canManageTimekeeping, canManageCalendar }: Props) {
  const [activeTab, setActiveTab] = useState<"attendance" | "shifts" | "holidays" | "hours">("attendance");
  const tabs = [
    { id: "attendance", label: "Chấm công & Lịch làm việc", Icon: CalendarCheck, visible: true },
    { id: "shifts", label: "Ca làm việc", Icon: Clock3, visible: canManageTimekeeping },
    { id: "holidays", label: "Lịch nghỉ lễ", Icon: CalendarDays, visible: canManageCalendar },
    { id: "hours", label: "Giờ làm việc nhân viên", Icon: Users, visible: canManageTimekeeping },
  ] as const;
  return <section className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-surface p-3 text-on-surface sm:p-5" aria-label="Lịch và ca làm việc">
    <nav aria-label="Nội dung lịch và ca làm việc" className="flex flex-wrap gap-1 rounded-xl border border-outline-variant bg-surface-container-lowest p-2">
      {tabs.filter(tab => tab.visible).map(({ id, label, Icon }) => <button key={id} type="button" aria-current={activeTab === id ? "page" : undefined} onClick={() => setActiveTab(id)} className={cn("inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-primary", activeTab === id ? "bg-primary text-on-primary" : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface")}><Icon className="size-4" aria-hidden="true" />{label}</button>)}
    </nav>
    {activeTab === "attendance" && <CalendarTab userProfile={userProfile} selectedCompanyCode={selectedCompanyCode} isManager={isManager} canManage={canManageAttendance} canEditAttendance={canEditAttendance} usersList={usersList} employees={employees} canApproveLeave={canManageAttendance} />}
    {activeTab === "shifts" && canManageTimekeeping && <WorkShiftsTab />}
    {activeTab === "holidays" && canManageCalendar && <CompanyWorkCalendarTab />}
    {activeTab === "hours" && canManageTimekeeping && <EmployeeWorkHoursTab />}
  </section>;
}
