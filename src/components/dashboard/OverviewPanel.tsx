/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState } from "react";
import { FolderOpen, GraduationCap, KanbanSquare, MessageSquare, PackageCheck, UserCheck, Users, Wallet } from "lucide-react";
import { DashboardSummary, DashboardActionItems } from "../../types/dashboard";
import LowStockModal from "../inventory/LowStockModal";
import { formatDashboardCurrency, buildPctSegments } from "./dashboardUtils";
import { ModuleCard, DonutCard, BarChart } from "./DashboardWidgets";
import { ActionItemsWidget } from "./ActionItemsWidget";
import { useEntityLabel } from "../../modules/student-management/hooks/useEntityLabel";

type CardKey = "hr" | "inventory" | "projects" | "students" | "tuition" | "timekeeping" | "chat" | "resources" | "charts" | "inventoryPanels";

/**
 * Mỗi card yêu cầu 1 mã quyền trong RolePermission.permissions[] của công ty
 * (xem server/config/permission-catalog.ts). Card chỉ hiện khi module tương
 * ứng được bật cho công ty (canSeeX) VÀ role của user có quyền này.
 */
const CARD_PERMISSION_MAP: Record<CardKey, string[]> = {
  hr: ["user:read", "user:manage", "hr:read"],
  inventory: ["stock:read", "stock:manage"],
  projects: ["project:read", "project:manage", "kanban:read", "kanban:manage"],
  students: ["student:read", "student:manage"],
  tuition: ["student:read", "student:manage"],
  timekeeping: ["timekeeping:read", "user:read", "user:manage"],
  chat: ["chat:read", "chat:manage"],
  resources: ["resource:read", "resource:manage"],
  charts: ["user:read", "user:manage", "project:read", "project:manage", "kanban:read", "kanban:manage", "hr:read"],
  inventoryPanels: ["stock:read", "stock:manage"],
};

export function OverviewPanel({
  employeeCount,
  employeeLabel,
  totalProducts,
  pendingShipments,
  overstockItems,
  onCreateReorder,
  onCreatePromotion,
  onRecommendAgent,
  lowStockCount,
  lowStockItems,
  totalRevenue,
  trendData,
  newHiresCount,
  todayTimekeeping,
  todayWorkCalendar,
  isTimekeepingLoading,
  onRefreshTimekeeping,
  summary,
  canSeeHr,
  canSeeInventory,
  canSeeResource,
  canSeeChat,
  canSeeStudent,
  permissions,
  actionItems,
}: {
  employeeCount: string;
  employeeLabel: string;
  totalProducts: string;
  pendingShipments: string;
  overstockItems: any[];
  onCreateReorder: (productName?: string) => void;
  onCreatePromotion: (productName?: string) => void;
  onRecommendAgent: () => void;
  lowStockCount: string;
  lowStockItems: any[];
  totalRevenue: number;
  trendData: Array<{ label: string; value: number }>;
  newHiresCount: number;
  todayTimekeeping: any;
  todayWorkCalendar: { date: string; isWorkingDay: boolean; label?: string } | null;
  isTimekeepingLoading: boolean;
  onRefreshTimekeeping: () => void;
  summary: DashboardSummary | null;
  canSeeHr: boolean;
  canSeeInventory: boolean;
  canSeeResource: boolean;
  canSeeChat: boolean;
  canSeeStudent: boolean;
  permissions?: string[];
  actionItems?: DashboardActionItems | null;
}) {
  const [showLowStockModal, setShowLowStockModal] = useState<boolean>(false);
  const entityLabel = useEntityLabel(canSeeStudent);
  const { titleCase: studentEntityTitle, singular: studentEntitySingular, preset } = entityLabel;
  const isEducation = preset === "student";
  const showCard = (key: CardKey) => {
    if (!permissions) return true;
    if (permissions.includes("*")) return true;
    const requiredPerms = CARD_PERMISSION_MAP[key];
    return requiredPerms.some((perm) => permissions.includes(perm));
  };

  const goToTab = (tab: string, subTab?: string) => {
    const pathMap: Record<string, string> = {
      "TỔNG QUAN": "/tong-quan",
      "NHÂN SỰ": "/nhan-su",
      "KHO & SẢN PHẨM": "/kho-san-pham",
      "QUẢN TRỊ USER": "/quan-tri-user",
      "CÀI ĐẶT": "/cai-dat",
      "VÍ & NẠP TIỀN": "/vi-nap-tien",
      "QUẢN LÝ HỌC VIÊN": "/quan-ly-hoc-vien",
      "TRÒ CHUYỆN": "/tro-chuyen",
      "QUẢN LÝ TÀI NGUYÊN": "/quan-ly-tai-nguyen",
    };
    let path = pathMap[tab];
    if (path) {
      if (subTab) {
        path += `?sub=${subTab}`;
      }
      window.history.pushState(null, "", path);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  };

  return (
    <div className="space-y-6">
        {actionItems && (
          <ActionItemsWidget
            actionItems={actionItems}
            onGoToTasks={() => goToTab("NHÂN SỰ", "kanban")}
            onGoToApprovals={() => goToTab("NHÂN SỰ", "lich")}
            onGoToInventory={() => goToTab("KHO & SẢN PHẨM")}
          />
        )}


        {/* Metric Module Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {canSeeHr && showCard("hr") && (
            <ModuleCard
              icon={Users}
              tone="amber"
              title="Nhân sự"
              value={employeeCount}
              label="Tổng nhân sự"
              footer="Nhân sự mới"
              footerValue={`+${newHiresCount}`}
              onClick={() => goToTab("NHÂN SỰ")}
            />
          )}
          {canSeeInventory && showCard("inventory") && (
            <ModuleCard
              icon={PackageCheck}
              tone="blue"
              title="Kho & Sản phẩm"
              value={totalProducts}
              label="Tổng sản phẩm"
              footer="Đơn chờ xuất"
              footerValue={`${pendingShipments} Đơn`}
              alert
              lowCount={lowStockCount}
              onClick={() => goToTab("KHO & SẢN PHẨM")}
            />
          )}
          {canSeeHr && showCard("projects") && (
            <ModuleCard
              icon={KanbanSquare}
              tone="indigo"
              title="Dự án & Công việc"
              value={summary ? String(summary.projects.tasks.doing) : "..."}
              label="Task đang làm"
              footer="Dự án hoạt động"
              footerValue={summary ? String(summary.projects.activeProjects) : "..."}
              alert
              lowCount={summary ? String(summary.projects.overdueTasks) : "..."}
              onClick={() => goToTab("NHÂN SỰ", "kanban")}
            />
          )}
          {canSeeStudent && showCard("students") && (
            <ModuleCard
              icon={GraduationCap}
              tone="emerald"
              title={studentEntityTitle}
              value={summary ? String(summary.students.totalStudents) : "..."}
              label={`Tổng ${studentEntitySingular}`}
              footer={`${studentEntityTitle} mới trong kỳ`}
              footerValue={summary ? `+${summary.students.newStudents}` : "..."}
              onClick={() => goToTab("QUẢN LÝ HỌC VIÊN", "hoc-vien")}
            />
          )}
          {isEducation && canSeeStudent && showCard("tuition") && (
            <ModuleCard
              icon={Wallet}
              tone="amber"
              title={`Học phí & Công nợ ${studentEntitySingular}`}
              value={summary ? formatDashboardCurrency(summary.students.tuitionRevenue, 1, false) : "..."}
              label="Học phí đã thu"
              footer="Công nợ còn lại"
              footerValue={summary ? formatDashboardCurrency(summary.students.outstandingDebt, 1, false) : "..."}
              onClick={() => goToTab("QUẢN LÝ HỌC VIÊN", "hoc-phi")}
            />
          )}
          {canSeeHr && showCard("timekeeping") && (
            <ModuleCard
              icon={UserCheck}
              tone="blue"
              title="Chấm công hôm nay"
              value={summary ? `${summary.timekeeping.checkedInToday}/${summary.timekeeping.totalEmployees}` : "..."}
              label="Đã điểm danh"
              footer="Đi muộn"
              footerValue={summary ? String(summary.timekeeping.lateToday) : "..."}
              onClick={() => goToTab("NHÂN SỰ", "lich")}
            />
          )}
          {canSeeChat && showCard("chat") && (
            <ModuleCard
              icon={MessageSquare}
              tone="slate"
              title="Trò chuyện"
              value={summary ? String(summary.chat.unreadMessages) : "..."}
              label="Tin chưa đọc"
              footer="Phòng chat tham gia"
              footerValue={summary ? String(summary.chat.roomCount) : "..."}
              onClick={() => goToTab("TRÒ CHUYỆN")}
            />
          )}
          {canSeeResource && showCard("resources") && (
            <ModuleCard
              icon={FolderOpen}
              tone="indigo"
              title="Tài nguyên"
              value={summary ? String(summary.resources.fileCount) : "..."}
              label="Tổng số file"
              footer="Tải lên trong kỳ"
              footerValue={summary ? `+${summary.resources.recentUploads}` : "..."}
              onClick={() => goToTab("QUẢN LÝ TÀI NGUYÊN")}
            />
          )}

        </div>

        {canSeeChat && showCard("chat") && summary && summary.chat.unreadMessages > 10 && (
          <button
            type="button"
            onClick={onRecommendAgent}
            className="flex w-full items-center justify-between rounded-2xl border border-indigo-100 bg-indigo-50/70 px-4 py-3 text-left transition hover:bg-indigo-50"
          >
            <span className="text-xs font-semibold text-indigo-800">
              Tin chưa đọc đang tăng cao ({summary.chat.unreadMessages}) — AI có thể gợi ý tạo Agent trả lời tự động.
            </span>
            <span className="shrink-0 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white">Gợi ý Agent</span>
          </button>
        )}

        {/* Biểu đồ tổng quát các module */}
        {summary && canSeeHr && showCard("charts") && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            <DonutCard
              title="Trạng thái công việc"
              centerLabel="Tổng việc"
              centerValue={summary.projects.tasks.total.toLocaleString("vi-VN")}
              segments={buildPctSegments(
                [
                  { label: "Chưa làm", value: summary.projects.tasks.todo, color: "#f59e0b" },
                  { label: "Đang làm", value: summary.projects.tasks.doing, color: "#2563eb" },
                  { label: "Hoàn thành", value: summary.projects.tasks.done, color: "#059669" },
                ],
                "việc"
              )}
            />
            <DonutCard
              title="Tiến độ đào tạo"
              centerLabel="Lượt ghi danh"
              centerValue={summary.training.enrollments.total.toLocaleString("vi-VN")}
              segments={buildPctSegments(
                [
                  { label: "Chưa bắt đầu", value: summary.training.enrollments.notStarted, color: "#f59e0b" },
                  { label: "Đang học", value: summary.training.enrollments.inProgress, color: "#2563eb" },
                  { label: "Hoàn thành", value: summary.training.enrollments.completed, color: "#059669" },
                ],
                "lượt"
              )}
            />
            <DonutCard
              title="Chấm công hôm nay"
              centerLabel="Nhân sự"
              centerValue={summary.timekeeping.totalEmployees.toLocaleString("vi-VN")}
              segments={buildPctSegments(
                [
                  { label: "Đúng giờ", value: Math.max(0, summary.timekeeping.checkedInToday - summary.timekeeping.lateToday), color: "#059669" },
                  { label: "Đi muộn", value: summary.timekeeping.lateToday, color: "#f59e0b" },
                  { label: "Chưa điểm danh", value: Math.max(0, summary.timekeeping.totalEmployees - summary.timekeeping.checkedInToday), color: "#e2e8f0" },
                ],
                "người"
              )}
            />
          </div>
        )}

        {canSeeInventory && showCard("inventoryPanels") && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm hover:shadow-md transition-all duration-300">
              <div className="mb-5 flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-wider text-gray-800">Doanh thu xuất kho</h3>
                <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-600">Đơn vị: VNĐ</span>
              </div>
              <BarChart data={trendData} />
            </div>

            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between">
              <div>
                <div className="mb-5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-2.5 w-2.5 rounded-full bg-rose-500 animate-pulse" />
                    <h3 className="text-sm font-bold uppercase tracking-wide text-gray-800">Cảnh báo tồn kho</h3>
                  </div>
                  <button onClick={() => goToTab("KHO & SẢN PHẨM")} className="text-xs font-semibold text-blue-655 hover:text-blue-700 transition-colors">Xem tất cả</button>
                </div>

                {lowStockItems.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center text-sm text-gray-500">
                    <PackageCheck className="h-8 w-8 mx-auto mb-2 text-slate-400" />
                    Tồn kho hiện tại đang ở mức an toàn.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {lowStockItems.slice(0, 3).map((p: any) => (
                      <div key={p.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 p-3 hover:bg-slate-50 transition-colors">
                        <div className="min-w-0 flex-1 pr-3">
                          <p className="truncate text-sm font-bold text-gray-800">{p.name}</p>
                          <p className="text-xs text-gray-500">Mã sản phẩm: {p.sku} · Định mức: {p.minStockAlert}</p>
                        </div>
                        <div className="flex items-center gap-2.5 shrink-0">
                          <span className="rounded-lg bg-rose-50 px-2 py-1 text-xs font-bold text-rose-600 ring-1 ring-rose-500/10">
                            Tồn: {p.stock}
                          </span>
                          <button
                            type="button"
                            onClick={() => onCreateReorder(p.name)}
                            className="rounded-lg border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
                          >
                            Tạo đề xuất nhập kho
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {lowStockItems.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-gray-500">Tổng số sản phẩm yếu:</span>
                  <span className="font-mono text-base font-extrabold text-rose-600">{lowStockCount} mã sản phẩm</span>
                </div>
              )}
              {showLowStockModal && <LowStockModal products={lowStockItems} onClose={() => setShowLowStockModal(false)} />}
            </div>
          </div>
        )}

        {canSeeInventory && showCard("inventoryPanels") && overstockItems.length > 0 && (
          <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm hover:shadow-md transition-all duration-300">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-2.5 w-2.5 rounded-full bg-amber-500" />
                <h3 className="text-sm font-bold uppercase tracking-wide text-gray-800">Cơ hội khuyến mãi (tồn kho dư thừa)</h3>
              </div>
              <button onClick={() => goToTab("KHO & SẢN PHẨM")} className="text-xs font-semibold text-blue-655 hover:text-blue-700 transition-colors">Xem tất cả</button>
            </div>
            <div className="space-y-3">
              {overstockItems.slice(0, 3).map((p: any) => (
                <div key={p.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 p-3 hover:bg-slate-50 transition-colors">
                  <div className="min-w-0 flex-1 pr-3">
                    <p className="truncate text-sm font-bold text-gray-800">{p.name}</p>
                    <p className="text-xs text-gray-500">Mã sản phẩm: {p.sku} · Định mức: {p.minStockAlert}</p>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
                    <span className="rounded-lg bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700 ring-1 ring-amber-500/10">
                      Tồn: {p.stock}
                    </span>
                    <button
                      type="button"
                      onClick={() => onCreatePromotion(p.name)}
                      className="rounded-lg border border-amber-200 px-2 py-1 text-xs font-semibold text-amber-700 transition hover:bg-amber-50"
                    >
                      Tạo chiến dịch ưu đãi
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
    </div>
  );
}
