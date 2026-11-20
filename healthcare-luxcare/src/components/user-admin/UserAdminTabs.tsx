import { useRef, useState, useEffect } from "react";
import { Users, ShieldCheck } from "lucide-react";
import { UserProfile } from "../../types";
import { UserAdminTabKey } from "./types";

interface Props {
  activeTab: UserAdminTabKey;
  onChange: (tab: UserAdminTabKey) => void;
  userProfile?: UserProfile | null;
}

export function UserAdminTabs({ activeTab, onChange, userProfile }: Props) {
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
    <div
      className="border-b border-slate-200/80 bg-white px-5 pt-2 pb-0 text-xs flex justify-between items-center shrink-0 relative"
      id="user_admin_subtabs"
    >
      <div className="relative flex-1 min-w-0">
        <div
          ref={scrollContainerRef}
          onScroll={checkScroll}
          className="flex gap-1 overflow-x-auto select-none scrollbar-none flex-nowrap pb-1 pr-8"
        >
          {[
            { id: "users", label: "Danh sách tài khoản", icon: Users },
            { id: "roles", label: "Vai trò & Phân quyền", icon: ShieldCheck },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => onChange(tab.id as UserAdminTabKey)}
                className={`flex items-center gap-2 px-4 py-2.5 font-bold text-xs transition-all duration-200 cursor-pointer shrink-0 rounded-xl ${
                  isActive
                    ? "bg-cyan-600 text-white font-bold shadow-sm"
                    : "text-slate-600 hover:text-cyan-600 hover:bg-cyan-50 font-semibold"
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? "text-white" : "text-slate-400"}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
        {canScrollLeft && (
          <div className="absolute top-0 left-0 bottom-1 w-8 bg-gradient-to-r from-white via-white/80 to-transparent pointer-events-none md:hidden flex items-center justify-start pl-1">
            <span className="text-[10px] text-slate-400 animate-pulse font-bold">◀</span>
          </div>
        )}
        {canScrollRight && (
          <div className="absolute top-0 right-0 bottom-1 w-8 bg-gradient-to-l from-white via-white/80 to-transparent pointer-events-none md:hidden flex items-center justify-end pr-1">
            <span className="text-[10px] text-slate-400 animate-pulse font-bold">▶</span>
          </div>
        )}
      </div>
    </div>
  );
}
