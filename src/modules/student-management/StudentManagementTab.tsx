import React, { Suspense, lazy } from "react";
import { useSubTabRouter } from "../../hooks/useSubTabRouter";
import type { Student } from "./types";
import { AddStudentModal } from "./components/Student/AddStudentModal";
import { StudentDetailModal } from "./components/Student/StudentDetailModal";
import { useStudents } from "./hooks/useStudents";
import { useAuth } from "../../context/AuthContext";
import { useAdminCenters } from "./hooks/useAdminCenters";
import { useEntityLabel } from "./hooks/useEntityLabel";
import { getStudentManagementSubTabLabel } from "./config/workerRecruitmentCopy";
import { ChevronDown, LayoutDashboard, Users, BookOpen, BriefcaseBusiness, GraduationCap, Calendar, CreditCard, Bell, FolderOpen, Settings } from "lucide-react";

type StudentSubTab =
  | "TỔNG QUAN"
  | "HỌC VIÊN"
  | "KHÓA HỌC"
  | "LỚP HỌC"
  | "LỊCH THI"
  | "HỌC PHÍ"
  | "THÔNG BÁO"
  | "TÀI NGUYÊN"
  | "CÀI ĐẶT";

const DashboardPage = lazy(() => import("./pages/Dashboard/DashboardPage").then((m) => ({ default: m.DashboardPage })));
const StudentsPage = lazy(() => import("./pages/Students/StudentsPage").then((m) => ({ default: m.StudentsPage })));
const CoursesPage = lazy(() => import("./pages/Courses/CoursesPage").then((m) => ({ default: m.CoursesPage })));
const BatchesPage = lazy(() => import("./pages/Batches/BatchesPage").then((m) => ({ default: m.BatchesPage })));
const ExamsPage = lazy(() => import("./pages/Exams/ExamsPage").then((m) => ({ default: m.ExamsPage })));
const FeesPage = lazy(() => import("./pages/Fees/FeesPage").then((m) => ({ default: m.FeesPage })));
const NotificationsPage = lazy(() => import("./pages/Notifications/NotificationsPage").then((m) => ({ default: m.NotificationsPage })));
const ResourcesPage = lazy(() => import("./pages/Resources/ResourcesPage").then((m) => ({ default: m.ResourcesPage })));
const SettingsPage = lazy(() => import("./pages/Settings/SettingsPage").then((m) => ({ default: m.SettingsPage })));

const SUB_TAB_ROUTES = [
  { slug: "tong-quan", value: "TỔNG QUAN" as const, label: "Tổng quan", icon: LayoutDashboard },
  { slug: "khoa-hoc", value: "KHÓA HỌC" as const, label: "Khóa học", icon: BookOpen },
  { slug: "lop-hoc", value: "LỚP HỌC" as const, label: "Lớp học", icon: GraduationCap },
  { slug: "hoc-vien", value: "HỌC VIÊN" as const, label: "Học viên", icon: Users },
  { slug: "hoc-phi", value: "HỌC PHÍ" as const, label: "Học phí", icon: CreditCard },
  { slug: "lich-thi", value: "LỊCH THI" as const, label: "Lịch thi", icon: Calendar },
  { slug: "tai-nguyen", value: "TÀI NGUYÊN" as const, label: "Tài nguyên", icon: FolderOpen },
  { slug: "thong-bao", value: "THÔNG BÁO" as const, label: "Thông báo", icon: Bell },
  { slug: "cai-dat", value: "CÀI ĐẶT" as const, label: "Cài đặt", icon: Settings },
];

function formatDateLabel() {
  return new Intl.DateTimeFormat("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date());
}

function PageLoader() {
  return (
    <div className="flex min-h-[320px] items-center justify-center rounded-[28px] border border-slate-200 bg-white text-sm font-semibold text-slate-500 shadow-sm">
      Đang tải phân khu học viên...
    </div>
  );
}

export default function StudentManagementTab() {
  const { userProfile } = useAuth();
  const { centers } = useAdminCenters();
  const entityLabel = useEntityLabel();

  const subTabRoutes = React.useMemo(() => {
    let routes = SUB_TAB_ROUTES.map((item) => ({
      ...item,
      label: item.slug === "hoc-vien"
        ? entityLabel.tabLabel
        : getStudentManagementSubTabLabel(entityLabel.preset, item.slug, item.label),
      icon: (entityLabel.preset === "worker" || entityLabel.preset === "customer") && item.slug === "khoa-hoc"
        ? BriefcaseBusiness
        : item.icon,
    }));

    if (entityLabel.preset !== "student") {
      const hiddenSlugs = entityLabel.preset === "worker"
        ? ["lop-hoc", "hoc-phi", "lich-thi", "tai-nguyen"]
        : ["lop-hoc", "hoc-phi", "lich-thi", "tai-nguyen"];
      routes = routes.filter((item) => !hiddenSlugs.includes(item.slug));
    }

    return routes;
  }, [entityLabel.tabLabel, entityLabel.preset]);
  const [selectedCenter, setSelectedCenter] = React.useState<string>(() => {
    return userProfile?.role === "superadmin" ? "all" : (userProfile as any)?.centerId || userProfile?.companyCode || "all";
  });

  const [activeSubTab, setActiveSubTab] = useSubTabRouter<StudentSubTab>(subTabRoutes, "TỔNG QUAN");
  const [selectedStudent, setSelectedStudent] = React.useState<Student | null>(null);
  const [isAddStudentOpen, setIsAddStudentOpen] = React.useState(false);
  const [initialStudentTab, setInitialStudentTab] = React.useState<"Hồ sơ" | "Học phí" | "Lịch sử">("Hồ sơ");
  const { students } = useStudents(selectedCenter === "all" ? undefined : selectedCenter);

  const handleOpenStudent = React.useCallback((student: Student, tab: "Hồ sơ" | "Học phí" | "Lịch sử" = "Hồ sơ") => {
    setSelectedStudent(student);
    setInitialStudentTab(tab);
  }, []);

  if (entityLabel.loading) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-white p-6">
        <PageLoader />
      </div>
    );
  }

  const renderPage = () => {
    switch (activeSubTab) {
      case "TỔNG QUAN":
        return (
          <DashboardPage
            formattedDate={formatDateLabel()}
            onSelectStudent={handleOpenStudent}
            onNavigate={() => { }}
            selectedCenter={selectedCenter}
          />
        );
      case "HỌC VIÊN":
        return (
          <StudentsPage
            onSelectStudent={handleOpenStudent}
            onAddStudent={() => setIsAddStudentOpen(true)}
            selectedCenter={selectedCenter}
          />
        );
      case "KHÓA HỌC":
        return entityLabel.preset === "worker"
          ? <BatchesPage selectedCenter={selectedCenter} />
          : <CoursesPage selectedCenter={selectedCenter} />;
      case "LỚP HỌC":
        return <BatchesPage selectedCenter={selectedCenter} />;
      case "LỊCH THI":
        return <ExamsPage selectedCenter={selectedCenter} />;
      case "HỌC PHÍ":
        return <FeesPage onSelectStudent={handleOpenStudent} selectedCenter={selectedCenter} />;
      case "THÔNG BÁO":
        return <NotificationsPage />;
      case "TÀI NGUYÊN":
        return <ResourcesPage />;
      case "CÀI ĐẶT":
        return <SettingsPage selectedCenter={selectedCenter} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      {/* Sub Tabs switcher navigation bar */}
      <div className="border-b border-slate-200/80 bg-white px-5 pt-2 pb-0 text-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shrink-0" id="student_sub_tabs_bar">
        <div className="flex gap-1 overflow-x-auto select-none">
          {subTabRoutes.map((item) => {
            const isActive = activeSubTab === item.value;
            const Icon = item.icon;
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => setActiveSubTab(item.value)}
                className={`flex items-center gap-2 px-4 py-2.5 font-bold text-xs transition-all duration-200 cursor-pointer shrink-0 rounded-xl ${
                  isActive
                    ? "bg-cyan-600 text-white font-bold shadow-sm"
                    : "text-slate-600 hover:text-cyan-600 hover:bg-cyan-50 font-semibold"
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? "text-white" : "text-slate-400"}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {userProfile?.role === "superadmin" && (
          <div className="flex items-center gap-2 shrink-0 pb-2 sm:pb-0 pr-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Cơ sở:</span>
            <div className="relative min-w-[200px]">
              <select
                value={selectedCenter}
                onChange={(e) => setSelectedCenter(e.target.value)}
                className="w-full h-8 pl-3 pr-8 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none appearance-none focus:border-cyan-600 transition-all cursor-pointer shadow-sm"
              >
                <option value="all">Tất cả cơ sở</option>
                {centers.map((center) => (
                  <option key={center.uid} value={center.uid}>
                    {center.displayName}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            </div>
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 p-6 overflow-y-auto">
        <Suspense fallback={<PageLoader />}>{renderPage()}</Suspense>
      </div>

      {isAddStudentOpen ? (
        <AddStudentModal
          isOpen={isAddStudentOpen}
          onClose={() => setIsAddStudentOpen(false)}
          students={students}
          selectedCenter={selectedCenter}
          onSuccess={(student) => {
            setIsAddStudentOpen(false);
            handleOpenStudent(student);
          }}
        />
      ) : null}

      {selectedStudent ? (
        <StudentDetailModal
          student={selectedStudent}
          selectedCenter={selectedCenter}
          onClose={() => setSelectedStudent(null)}
          initialTab={initialStudentTab}
        />
      ) : null}

    </div>
  );
}
