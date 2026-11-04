import { useState } from "react";
import { CalendarDays, CalendarCheck, Clock3, Users } from "lucide-react";
import type { EmployeeNode, UserProfile } from "../../types";
import { ModuleNavigation, ModuleNavigationButton } from "../common/ModuleNavigation";
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
  return <section className="min-h-0 flex-1 space-y-2 overflow-y-auto rounded-2xl border border-outline-variant bg-surface-container-lowest px-2 pb-2 pt-0 text-on-surface sm:px-3 sm:pb-3" aria-label="Lịch và ca làm việc">
    <ModuleNavigation label="Mục Lịch và ca làm việc" activeValue={activeTab} layout="horizontal" className="px-2 sm:px-2">
      {tabs.filter(tab => tab.visible).map(({ id, label, Icon }) => (
        <ModuleNavigationButton
          key={id}
          active={activeTab === id}
          icon={<Icon />}
          onClick={() => setActiveTab(id)}
        >
          {label}
        </ModuleNavigationButton>
      ))}
    </ModuleNavigation>
    {activeTab === "attendance" && <CalendarTab userProfile={userProfile} selectedCompanyCode={selectedCompanyCode} isManager={isManager} canManage={canManageAttendance} canEditAttendance={canEditAttendance} usersList={usersList} employees={employees} canApproveLeave={canManageAttendance} />}
    {activeTab === "shifts" && canManageTimekeeping && <WorkShiftsTab />}
    {activeTab === "holidays" && canManageCalendar && <CompanyWorkCalendarTab />}
    {activeTab === "hours" && canManageTimekeeping && <EmployeeWorkHoursTab />}
  </section>;
}
