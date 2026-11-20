import React, { useState } from "react";
import { Clock, CalendarDays, Users } from "lucide-react";
import WorkShiftsTab from "../settings/WorkShiftsTab";
import CompanyWorkCalendarTab from "../settings/CompanyWorkCalendarTab";
import EmployeeWorkHoursTab from "../settings/EmployeeWorkHoursTab";

export type WorkScheduleSubTab = "workShifts" | "workCalendar" | "workHours";

interface WorkScheduleSettingsTabProps {
  initialSubTab?: WorkScheduleSubTab;
}

export default function WorkScheduleSettingsTab({
  initialSubTab = "workShifts",
}: WorkScheduleSettingsTabProps) {
  const [activeTab, setActiveTab] = useState<WorkScheduleSubTab>(initialSubTab);

  return (
    <div className="space-y-6 animate-fade-in" id="work_schedule_settings_wrapper">
      {/* Header Tabs đồng bộ với DepartmentRoomManagementTab */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-cyan-600" />
            Ca làm việc & Giờ làm việc
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Quản lý danh mục ca làm việc, lịch nghỉ lễ toàn công ty và giờ làm việc riêng của từng nhân sự.
          </p>
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl flex-wrap">
          <button
            type="button"
            onClick={() => setActiveTab("workShifts")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === "workShifts"
                ? "bg-white text-cyan-700 shadow-sm font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Clock className="w-4 h-4" />
            Ca làm việc
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("workCalendar")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === "workCalendar"
                ? "bg-white text-cyan-700 shadow-sm font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <CalendarDays className="w-4 h-4" />
            Lịch nghỉ lễ & Làm bù
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("workHours")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === "workHours"
                ? "bg-white text-cyan-700 shadow-sm font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Users className="w-4 h-4" />
            Giờ làm việc nhân viên
          </button>
        </div>
      </div>

      {/* Nội dung tab */}
      <div className="min-h-[420px]">
        {activeTab === "workShifts" && <WorkShiftsTab />}
        {activeTab === "workCalendar" && <CompanyWorkCalendarTab />}
        {activeTab === "workHours" && <EmployeeWorkHoursTab />}
      </div>
    </div>
  );
}
