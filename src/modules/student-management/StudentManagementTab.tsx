import React, { Suspense, lazy } from "react";
import { useSubTabRouter } from "../../hooks/useSubTabRouter";
import type { Student } from "./types";
import { StudentLoadState } from "./components/StudentLoadState";
import { useStudents } from "./hooks/useStudents";
import { useAuth } from "../../context/AuthContext";
import { useAdminCenters } from "./hooks/useAdminCenters";
import { useEntityLabel } from "./hooks/useEntityLabel";
import { getStudentManagementSubTabLabel } from "./config/workerRecruitmentCopy";
import { ChevronDown } from "lucide-react";
import { ModuleNavigation, ModuleNavigationButton } from "../../components/common/ModuleNavigation";
import { StudentNavIcon } from "./StudentNavIcon";
import { canManageStudentArea, canReadStudentArea } from "../../utils/studentPermissionPolicy";
import { getAllowedStudentTabSlugs } from "./studentTabPermissions";
import { setBusinessApiScope } from "./lib/api";

type StudentSubTab =
  | "BAO_LUU_HOC_LAI"
  | "LO_TRINH_CHO_LOP"
  | "TỔNG QUAN"
  | "HỌC VIÊN"
  | "KHÓA HỌC"
  | "LỚP HỌC"
  | "CHẤT LƯỢNG HỌC VIÊN"
  | "LỊCH THI"
  | "HỌC PHÍ"
  | "THÔNG BÁO"
  | "PHÒNG HỌC"
  | "TÀI NGUYÊN";

const DashboardPage = lazy(() => import("./pages/Dashboard/DashboardPage").then((m) => ({ default: m.DashboardPage })));
const StudentsPage = lazy(() => import("./pages/Students/StudentsPage").then((m) => ({ default: m.StudentsPage })));
const CoursesPage = lazy(() => import("./pages/Courses/CoursesPage").then((m) => ({ default: m.CoursesPage })));
const BatchesPage = lazy(() => import("./pages/Batches/BatchesPage").then((m) => ({ default: m.BatchesPage })));
const StudentQualityPage = lazy(() => import("./pages/StudentQuality/StudentQualityPage").then((m) => ({ default: m.StudentQualityPage })));
const EnrollmentLifecyclePage = lazy(() => import("./pages/EnrollmentLifecycle/EnrollmentLifecyclePage").then((m) => ({ default: m.EnrollmentLifecyclePage })));
const LearningRoadmapPage = lazy(() => import("./pages/LearningRoadmap/LearningRoadmapPage").then((m) => ({ default: m.LearningRoadmapPage })));
const ExamsPage = lazy(() => import("./pages/Exams/ExamsPage").then((m) => ({ default: m.ExamsPage })));
const FeesPage = lazy(() => import("./pages/Fees/FeesPage").then((m) => ({ default: m.FeesPage })));
const NotificationsPage = lazy(() => import("./pages/Notifications/NotificationsPage").then((m) => ({ default: m.NotificationsPage })));
const ResourcesPage = lazy(() => import("./pages/Resources/ResourcesPage").then((m) => ({ default: m.ResourcesPage })));
const ClassroomsPage = lazy(() => import("./pages/Classrooms/ClassroomsPage").then((m) => ({ default: m.ClassroomsPage })));
const AddStudentModal = lazy(() => import("./components/Student/AddStudentModal").then((m) => ({ default: m.AddStudentModal })));
const StudentDetailModal = lazy(() => import("./components/Student/StudentDetailModal").then((m) => ({ default: m.StudentDetailModal })));

const SUB_TAB_ROUTES = [
  { slug: "tong-quan", value: "TỔNG QUAN" as const, label: "Tổng quan" },
  { slug: "khoa-hoc", value: "KHÓA HỌC" as const, label: "Khóa học" },
  { slug: "lop-hoc", value: "LỚP HỌC" as const, label: "Lớp học" },
  { slug: "chat-luong-hoc-vien", value: "CHẤT LƯỢNG HỌC VIÊN" as const, label: "Chất lượng học viên" },
  { slug: "hoc-vien", value: "HỌC VIÊN" as const, label: "Học viên" },
  { slug: "hoc-phi", value: "HỌC PHÍ" as const, label: "Học phí" },
  { slug: "lich-thi", value: "LỊCH THI" as const, label: "Lịch thi" },
  { slug: "phong-hoc", value: "PHÒNG HỌC" as const, label: "Phòng học" },
  { slug: "tai-nguyen", value: "TÀI NGUYÊN" as const, label: "Thiết bị" },
  { slug: "thong-bao", value: "THÔNG BÁO" as const, label: "Thông báo" },
  { slug: "bao-luu-hoc-lai", value: "BAO_LUU_HOC_LAI" as const, label: "Bảo lưu & học lại" },
  { slug: "lo-trinh-va-cho-lop", value: "LO_TRINH_CHO_LOP" as const, label: "Lộ trình & chờ lớp" },
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
  return <StudentLoadState />;
}

export default function StudentManagementTab() {
  React.useLayoutEffect(() => { setBusinessApiScope("student"); }, []);
  const { userProfile } = useAuth();
  const { centers } = useAdminCenters();
  const entityLabel = useEntityLabel();

  const subTabRoutes = React.useMemo(() => {
    const allowedSlugs = getAllowedStudentTabSlugs(userProfile?.permissions || [], entityLabel.preset, userProfile?.role);
    let routes = SUB_TAB_ROUTES.map((item) => ({
      ...item,
      label: item.slug === "hoc-vien"
        ? entityLabel.tabLabel
        : getStudentManagementSubTabLabel(entityLabel.preset, item.slug, item.label),
    })).filter((item) => allowedSlugs.some((slug) => slug === item.slug));

    if (entityLabel.preset !== "student") {
      const hiddenSlugs = entityLabel.preset === "worker"
        ? ["lop-hoc", "chat-luong-hoc-vien", "hoc-phi", "lich-thi", "tai-nguyen"]
        : ["lop-hoc", "chat-luong-hoc-vien", "hoc-phi", "lich-thi", "tai-nguyen"];
      routes = routes.filter((item) => !hiddenSlugs.includes(item.slug));
    }

    return routes;
  }, [entityLabel.tabLabel, entityLabel.preset, userProfile?.permissions, userProfile?.role]);
  const [selectedCenter, setSelectedCenter] = React.useState<string>(() => {
    const centerId = userProfile && "centerId" in userProfile && typeof userProfile.centerId === "string" ? userProfile.centerId : undefined;
    return userProfile?.role === "superadmin" ? "all" : centerId || userProfile?.companyCode || "all";
  });

  const defaultSubTab = subTabRoutes[0]?.value || "TỔNG QUAN";
  const [activeSubTab, setActiveSubTab] = useSubTabRouter<StudentSubTab>(subTabRoutes, defaultSubTab);
  const [selectedStudent, setSelectedStudent] = React.useState<Student | null>(null);
  const [isAddStudentOpen, setIsAddStudentOpen] = React.useState(false);
  const [initialStudentTab, setInitialStudentTab] = React.useState<"Hồ sơ" | "Học phí" | "Lịch sử">("Hồ sơ");
  const canReadStudents = canReadStudentArea(userProfile?.permissions || [], "student-profile");
  const canManage = (area: Parameters<typeof canManageStudentArea>[1]) => canManageStudentArea(userProfile?.permissions || [], area);
  const { students, loading: studentListLoading, error: studentListError, refetch: reloadStudentList } = useStudents(selectedCenter === "all" ? undefined : selectedCenter, "branch", canReadStudents && isAddStudentOpen && !entityLabel.loading);

  const handleOpenStudent = React.useCallback((student: Student, tab: "Hồ sơ" | "Học phí" | "Lịch sử" = "Hồ sơ") => {
    setSelectedStudent(student);
    setInitialStudentTab(tab);
  }, []);

  if (entityLabel.loading) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-white p-6">
        <StudentLoadState error={entityLabel.error} onRetry={() => { void entityLabel.retry?.(); }} />
      </div>
    );
  }

  if (subTabRoutes.length === 0) {
    return (
      <div className="flex h-full min-h-[320px] items-center justify-center bg-white p-6">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-6 py-5 text-sm font-semibold text-amber-800">
          Bạn chưa được cấp quyền sử dụng chức năng này
        </div>
      </div>
    );
  }

  const renderPage = () => {
    if ((activeSubTab as string) === "BAO_LUU_HOC_LAI") return <EnrollmentLifecyclePage />;
    if ((activeSubTab as string) === "LO_TRINH_CHO_LOP") {
      return <LearningRoadmapPage selectedCenter={selectedCenter} canManage={canManage("learning-roadmap")} />;
    }
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
            canManage={canManage("student-profile")}
          />
        );
      case "KHÓA HỌC":
        return entityLabel.preset === "worker"
          ? <BatchesPage selectedCenter={selectedCenter} canManage={canManage("batch")} />
          : <CoursesPage selectedCenter={selectedCenter} canManage={canManage("course")} />;
      case "LỚP HỌC":
        return <BatchesPage selectedCenter={selectedCenter} canManage={canManage("batch")} />;
      case "CHẤT LƯỢNG HỌC VIÊN":
        return (
          <StudentQualityPage
            selectedCenter={selectedCenter}
            canManage={canManage("student-quality")}
            onSelectStudent={handleOpenStudent}
            onOpenBatches={() => setActiveSubTab("LỚP HỌC")}
          />
        );
      case "LỊCH THI":
        return <ExamsPage selectedCenter={selectedCenter} canManage={canManage("exam")} />;
      case "HỌC PHÍ":
        return <FeesPage onSelectStudent={handleOpenStudent} selectedCenter={selectedCenter} />;
      case "THÔNG BÁO":
        return <NotificationsPage canManage={canManage("student-notification")} />;
      case "PHÒNG HỌC":
        return <ClassroomsPage canManage={canManage("classroom")} />;
      case "TÀI NGUYÊN":
        return <ResourcesPage canManage={canManage("student-resource")} excludeType="Phòng học" />;
      default:
        return null;
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      {/* Sub Tabs switcher navigation bar */}
      <ModuleNavigation label="Mục Học viên" activeValue={activeSubTab} id="student_sub_tabs_bar" actions={userProfile?.role === "superadmin" && <div className="flex min-w-0 items-center gap-2">
        <label htmlFor="student-navigation-center" className="text-xs text-on-surface-variant">Cơ sở:</label>
        <div className="relative min-w-0 flex-1 sm:w-52 sm:flex-none">
          <select id="student-navigation-center" value={selectedCenter} onChange={(e) => setSelectedCenter(e.target.value)} className="min-h-9 w-full cursor-pointer appearance-none rounded-xl border border-outline-variant bg-surface-container-lowest py-1.5 pl-3 pr-8 text-xs font-medium text-on-surface focus-visible:outline-2 focus-visible:outline-primary">
            <option value="all">Tất cả cơ sở</option>
            {centers.map((center) => <option key={center.uid} value={center.uid}>{center.displayName}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-on-surface-variant" aria-hidden="true" />
        </div>
      </div>}>
        {subTabRoutes.map(item => <ModuleNavigationButton key={item.value} active={activeSubTab === item.value} onClick={() => setActiveSubTab(item.value)} icon={<StudentNavIcon slug={item.slug === "khoa-hoc" && entityLabel.preset !== "student" ? "cong-viec" : item.slug} />}>{item.label}</ModuleNavigationButton>)}
      </ModuleNavigation>

      <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-6">
        <Suspense fallback={<PageLoader />}>{renderPage()}</Suspense>
      </div>

      <Suspense fallback={<StudentLoadState label="Đang tải biểu mẫu..." />}>
      {isAddStudentOpen && (studentListLoading || studentListError) && (
        <StudentLoadState label="Đang tải dữ liệu biểu mẫu..." error={studentListError} onRetry={() => { void reloadStudentList(); }} onCancel={() => setIsAddStudentOpen(false)} />
      )}
      {isAddStudentOpen && !studentListLoading && !studentListError ? (
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
      </Suspense>

    </div>
  );
}
