import React, { useState, useRef } from "react";
import { BriefcaseBusiness, CalendarClock, Users, ChevronLeft, ChevronRight } from "lucide-react";
import RecruitmentJobsView from "./RecruitmentJobsView";
import RecruitmentApplicantsView from "./RecruitmentApplicantsView";
import RecruitmentInterviewsView from "./RecruitmentInterviewsView";

type View = "jobs" | "applicants" | "interviews";
const tabs = [
  { id: "jobs" as const, label: "Tin tuyển dụng", icon: BriefcaseBusiness },
  { id: "applicants" as const, label: "Ứng viên", icon: Users },
  { id: "interviews" as const, label: "Phỏng vấn", icon: CalendarClock },
];

export default function RecruitmentTab() {
  const [view, setView] = useState<View>("jobs");
  const subTabsRef = useRef<HTMLDivElement>(null);
  
  const scrollSubTabs = (direction: "left" | "right") => {
    if (subTabsRef.current) {
      const scrollAmount = 120;
      subTabsRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  return <section className="flex min-h-0 flex-1 flex-col bg-slate-50" aria-label="Quản lý tuyển dụng">
    <div className="flex shrink-0 items-center gap-1 border-b border-slate-200/80 bg-white px-3 pt-2 pb-0 sm:px-5">
      <button
        type="button"
        aria-label="Cuộn tab tuyển dụng sang trái"
        onClick={() => scrollSubTabs("left")}
        className="flex h-8 w-5 shrink-0 items-center justify-center text-slate-400 transition-colors hover:text-slate-700 sm:hidden"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <div
        ref={subTabsRef}
        className="flex min-w-0 max-w-full flex-1 gap-1 overflow-x-auto scrollbar-none select-none -mb-px"
      >
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setView(id)}
            aria-pressed={view === id}
            className={`flex items-center gap-2 px-4 py-2.5 font-bold text-xs transition-all duration-200 cursor-pointer shrink-0 rounded-xl ${
              view === id
                ? "bg-cyan-600 text-white font-bold shadow-sm"
                : "text-slate-600 hover:text-cyan-600 hover:bg-cyan-50 font-semibold"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>
      <button
        type="button"
        aria-label="Cuộn tab tuyển dụng sang phải"
        onClick={() => scrollSubTabs("right")}
        className="flex h-8 w-5 shrink-0 items-center justify-center text-slate-400 transition-colors hover:text-slate-700 sm:hidden"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
    <div className="min-h-0 flex-1 overflow-auto">
      {view === "jobs" && <RecruitmentJobsView />}
      {view === "applicants" && <RecruitmentApplicantsView />}
      {view === "interviews" && <RecruitmentInterviewsView />}
    </div>
  </section>;
}
