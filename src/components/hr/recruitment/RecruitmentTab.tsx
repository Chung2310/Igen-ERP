import React, { useState } from "react";
import { BriefcaseBusiness, CalendarClock, GitBranch, Users } from "lucide-react";
import RecruitmentJobsView from "./RecruitmentJobsView";
import RecruitmentApplicantsView from "./RecruitmentApplicantsView";
import RecruitmentPipelineView from "./RecruitmentPipelineView";
import RecruitmentInterviewsView from "./RecruitmentInterviewsView";

type View = "jobs" | "applicants" | "pipeline" | "interviews";
const tabs = [
  { id: "jobs" as const, label: "Tin tuyển dụng", icon: BriefcaseBusiness },
  { id: "applicants" as const, label: "Ứng viên", icon: Users },
  { id: "pipeline" as const, label: "Quy trình", icon: GitBranch },
  { id: "interviews" as const, label: "Phỏng vấn", icon: CalendarClock },
];

export default function RecruitmentTab() {
  const [view, setView] = useState<View>("jobs");
  return <section className="flex min-h-0 flex-1 flex-col bg-slate-50" aria-label="Quản lý tuyển dụng">
    <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-slate-200 bg-white px-5 py-2">
      {tabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => setView(id)} aria-pressed={view === id}
        className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-semibold ${view === id ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
        <Icon className="h-4 w-4" />{label}
      </button>)}
    </div>
    <div className="min-h-0 flex-1 overflow-auto">
      {view === "jobs" && <RecruitmentJobsView />}
      {view === "applicants" && <RecruitmentApplicantsView />}
      {view === "pipeline" && <RecruitmentPipelineView />}
      {view === "interviews" && <RecruitmentInterviewsView />}
    </div>
  </section>;
}
