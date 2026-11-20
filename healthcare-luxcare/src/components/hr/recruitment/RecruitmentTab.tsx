import React, { useState, useRef, useEffect } from "react";
import { BriefcaseBusiness, CalendarClock, Users } from "lucide-react";
import RecruitmentJobsView from "./RecruitmentJobsView";
import RecruitmentApplicantsView from "./RecruitmentApplicantsView";
import RecruitmentInterviewsView from "./RecruitmentInterviewsView";

type View = "jobs" | "applicants" | "interviews";
const tabs = [
  { id: "jobs" as const, label: "Tin tuyển dụng", icon: BriefcaseBusiness },
  { id: "applicants" as const, label: "Ứng viên", icon: Users },
  { id: "interviews" as const, label: "Phỏng vấn", icon: CalendarClock },
];

export default function RecruitmentTab({ canManage = false }: { canManage?: boolean }) {
  const [view, setView] = useState<View>("jobs");
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    const el = scrollContainerRef.current;
    if (el) {
      const { scrollLeft, scrollWidth, clientWidth } = el;
      setCanScrollLeft(scrollLeft > 5);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 5);
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener("resize", checkScroll);
    return () => window.removeEventListener("resize", checkScroll);
  }, []);

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-slate-50" aria-label="Quản lý tuyển dụng">
      <div className="relative shrink-0 border-b border-slate-200 bg-white">
        <div
          ref={scrollContainerRef}
          onScroll={checkScroll}
          className="flex items-center gap-1 overflow-x-auto px-5 py-2 scrollbar-none flex-nowrap select-none"
        >
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setView(id)}
              aria-pressed={view === id}
              className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-semibold cursor-pointer ${view === id ? "bg-cyan-600 text-white shadow-sm" : "text-slate-600 hover:bg-cyan-50 hover:text-cyan-600"}`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
        {canScrollLeft && (
          <div className="absolute top-0 left-0 bottom-0 w-8 bg-gradient-to-r from-white via-white/80 to-transparent pointer-events-none md:hidden flex items-center justify-start pl-1">
            <span className="text-[10px] text-slate-400 animate-pulse font-bold">◀</span>
          </div>
        )}
        {canScrollRight && (
          <div className="absolute top-0 right-0 bottom-0 w-8 bg-gradient-to-l from-white via-white/80 to-transparent pointer-events-none md:hidden flex items-center justify-end pr-1">
            <span className="text-[10px] text-slate-400 animate-pulse font-bold">▶</span>
          </div>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {view === "jobs" && <RecruitmentJobsView canManage={canManage} />}
        {view === "applicants" && <RecruitmentApplicantsView canManage={canManage} />}
        {view === "interviews" && <RecruitmentInterviewsView canManage={canManage} />}
      </div>
    </section>
  );
}
