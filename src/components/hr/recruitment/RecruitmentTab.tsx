import React, { useState, useRef } from "react";
import { BriefcaseBusiness, CalendarClock, Users, ChevronLeft, ChevronRight } from "lucide-react";
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

  return <section className="recruitment-screen flex min-h-0 flex-1 flex-col bg-gradient-to-br from-[#F7FAFF] via-[#F2F8FF] to-[#F7FBFD]" aria-label="Quản lý tuyển dụng">
    <div className="flex shrink-0 items-center gap-1 border-b border-[#E7F0F8] bg-white px-3 py-2 sm:px-5">
      <button
        type="button"
        aria-label="Cuộn tab tuyển dụng sang trái"
        onClick={() => scrollSubTabs("left")}
        className="flex h-8 w-5 shrink-0 items-center justify-center text-[#7C90AB] transition-colors hover:text-[#087BDF] sm:hidden"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <div
        ref={subTabsRef}
        className="flex min-w-0 max-w-full flex-1 select-none gap-1 overflow-x-auto scrollbar-none"
      >
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setView(id)}
            aria-pressed={view === id}
            className={`flex shrink-0 cursor-pointer items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#00ADFC]/30 ${
              view === id
                ? "bg-[#00A4E8] text-white"
                : "text-[#536B8F] hover:bg-[#EAF6FE] hover:text-[#087BDF]"
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
        className="flex h-8 w-5 shrink-0 items-center justify-center text-[#7C90AB] transition-colors hover:text-[#087BDF] sm:hidden"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
    <div className="min-h-0 flex-1 overflow-auto">
      {view === "jobs" && <RecruitmentJobsView canManage={canManage} />}
      {view === "applicants" && <RecruitmentApplicantsView canManage={canManage} />}
      {view === "interviews" && <RecruitmentInterviewsView canManage={canManage} />}
    </div>
  </section>;
}
