import React, { useState } from "react";
import { ModuleNavigation, ModuleNavigationButton } from "../../common/ModuleNavigation";
import { BriefcaseBusiness, CalendarClock, Users } from "lucide-react";
import RecruitmentJobsView from "./RecruitmentJobsView";
import RecruitmentApplicantsView from "./RecruitmentApplicantsView";
import RecruitmentInterviewsView from "./RecruitmentInterviewsWorkspace";
import "./recruitment-ui.css";

type View = "jobs" | "applicants" | "interviews";
const tabs = [
  { id: "jobs" as const, label: "Tin tuyển dụng", icon: BriefcaseBusiness },
  { id: "applicants" as const, label: "Ứng viên", icon: Users },
  { id: "interviews" as const, label: "Phỏng vấn", icon: CalendarClock },
];

export default function RecruitmentTab({ canManage = false }: { canManage?: boolean }) {
  const [view, setView] = useState<View>("jobs");
  return <section className="recruitment-screen flex min-h-0 flex-1 flex-col bg-gradient-to-br from-[#F7FAFF] via-[#F2F8FF] to-[#F7FBFD]" aria-label="Quản lý tuyển dụng">
    <ModuleNavigation label="Mục Tuyển dụng" activeValue={view}>
      {tabs.map(({ id, label, icon: Icon }) => <ModuleNavigationButton key={id} active={view === id} icon={<Icon />} aria-pressed={view === id} onClick={() => setView(id)}>{label}</ModuleNavigationButton>)}
    </ModuleNavigation>
    <div className="min-h-0 flex-1 overflow-auto">
      {view === "jobs" && <RecruitmentJobsView canManage={canManage} />}
      {view === "applicants" && <RecruitmentApplicantsView canManage={canManage} />}
      {view === "interviews" && <RecruitmentInterviewsView canManage={canManage} />}
    </div>
  </section>;
}
