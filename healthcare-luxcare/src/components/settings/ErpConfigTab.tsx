import React, { useEffect, useState } from "react";
import { Bell, Sliders, ExternalLink } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import CompanySmtpSettingsTab from "./CompanySmtpSettingsTab";

export default function ErpConfigTab() {
  const { userProfile, hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState<"general" | "companyModules">("general");
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    const element = scrollContainerRef.current;
    if (!element) return;

    const { scrollLeft, scrollWidth, clientWidth } = element;
    setCanScrollLeft(scrollLeft > 5);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 5);
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener("resize", checkScroll);
    return () => window.removeEventListener("resize", checkScroll);
  }, []);

  const canManageSmtp = hasPermission("company-smtp:manage");
  const canManageCompanyModules = canManageSmtp;

  return (
    <div className="bg-white/80 backdrop-blur-md border border-gray-200/80 rounded-2xl p-6 shadow-xs space-y-6">
      {/* Thông báo di chuyển tính năng sang module Nhân sự */}
      <div className="flex items-center justify-between p-3.5 bg-gradient-to-r from-cyan-50 to-blue-50 border border-cyan-200/80 rounded-xl text-xs text-cyan-900">
        <div className="flex items-center gap-3">
          <span className="text-xl">⏱️</span>
          <div>
            <p className="font-bold text-cyan-950">
              Quản lý Ca làm việc, Lịch nghỉ lễ & Giờ làm việc nhân viên
            </p>
            <p className="text-[11px] text-cyan-700 mt-0.5">
              Các tính năng này đã được chuyển tập trung về <strong>Module Nhân sự → Ca & Giờ làm</strong> hoặc <strong>Lịch làm việc</strong>.
            </p>
          </div>
        </div>
      </div>

      {canManageCompanyModules && (
        <div className="relative border-b border-gray-100">
          <div
            ref={scrollContainerRef}
            onScroll={checkScroll}
            className="flex gap-2 pb-3 overflow-x-auto scrollbar-none flex-nowrap select-none pr-8"
          >
            <button
              type="button"
              onClick={() => setActiveTab("general")}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition cursor-pointer shrink-0 ${
                activeTab === "general"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              Cấu hình chung
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("companyModules")}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition cursor-pointer shrink-0 ${activeTab === "companyModules" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
            >
              Email
            </button>
          </div>
          {canScrollLeft && (
            <div className="absolute top-0 left-0 bottom-3 w-8 bg-gradient-to-r from-white via-white/80 to-transparent pointer-events-none md:hidden flex items-center justify-start pl-1">
              <span className="text-[10px] text-slate-400 animate-pulse font-bold">◀</span>
            </div>
          )}
          {canScrollRight && (
            <div className="absolute top-0 right-0 bottom-3 w-8 bg-gradient-to-l from-white via-white/80 to-transparent pointer-events-none md:hidden flex items-center justify-end pr-1">
              <span className="text-[10px] text-slate-400 animate-pulse font-bold">▶</span>
            </div>
          )}
        </div>
      )}

      {activeTab === "companyModules" && canManageCompanyModules && (
        <div className="space-y-5">{canManageSmtp && <CompanySmtpSettingsTab />}</div>
      )}
      {activeTab === "general" && (
        <div>
          <h3 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2 border-b border-gray-100 pb-3">
            <Sliders className="h-5 w-5 text-purple-500" />
            Cài đặt hiển thị & Thông báo
          </h3>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                  <Bell className="h-4.5 w-4.5" />
                </div>
                <div className="text-left">
                  <h4 className="text-xs font-bold text-gray-800">Nhận thông báo qua Email</h4>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    Nhận các báo cáo tóm tắt hàng ngày qua email đăng ký.
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
