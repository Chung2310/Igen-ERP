import React, { Suspense, lazy } from "react";
import { useSubTabRouter } from "../../hooks/useSubTabRouter";
import type { Student } from "./types";
import { AddStudentModal } from "./components/Student/AddStudentModal";
import { StudentDetailModal } from "./components/Student/StudentDetailModal";
import { useStudents } from "./hooks/useStudents";

type StudentSubTab =
  | "TỔNG QUAN"
  | "HỌC VIÊN"
  | "KHÓA HỌC"
  | "LỚP HỌC"
  | "LỊCH THI"
  | "HỌC PHÍ"
  | "THÔNG BÁO"
  | "TÀI NGUYÊN"
  | "ĐỐI TÁC"
  | "CÀI ĐẶT";

const DashboardPage = lazy(() => import("./pages/Dashboard/DashboardPage").then((m) => ({ default: m.DashboardPage })));
const StudentsPage = lazy(() => import("./pages/Students/StudentsPage").then((m) => ({ default: m.StudentsPage })));
const CoursesPage = lazy(() => import("./pages/Courses/CoursesPage").then((m) => ({ default: m.CoursesPage })));
const BatchesPage = lazy(() => import("./pages/Batches/BatchesPage").then((m) => ({ default: m.BatchesPage })));
const ExamsPage = lazy(() => import("./pages/Exams/ExamsPage").then((m) => ({ default: m.ExamsPage })));
const FeesPage = lazy(() => import("./pages/Fees/FeesPage").then((m) => ({ default: m.FeesPage })));
const NotificationsPage = lazy(() => import("./pages/Notifications/NotificationsPage").then((m) => ({ default: m.NotificationsPage })));
const ResourcesPage = lazy(() => import("./pages/Resources/ResourcesPage").then((m) => ({ default: m.ResourcesPage })));
const PartnersPage = lazy(() => import("./pages/Partners/PartnersPage").then((m) => ({ default: m.PartnersPage })));
const SettingsPage = lazy(() => import("./pages/Settings/SettingsPage").then((m) => ({ default: m.SettingsPage })));

const SUB_TAB_ROUTES = [
  { slug: "tong-quan", value: "TỔNG QUAN" as const },
  { slug: "hoc-vien", value: "HỌC VIÊN" as const },
  { slug: "khoa-hoc", value: "KHÓA HỌC" as const },
  { slug: "lop-hoc", value: "LỚP HỌC" as const },
  { slug: "lich-thi", value: "LỊCH THI" as const },
  { slug: "hoc-phi", value: "HỌC PHÍ" as const },
  { slug: "thong-bao", value: "THÔNG BÁO" as const },
  { slug: "tai-nguyen", value: "TÀI NGUYÊN" as const },
  { slug: "doi-tac", value: "ĐỐI TÁC" as const },
  { slug: "cai-dat", value: "CÀI ĐẶT" as const },
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
  const [activeSubTab, setActiveSubTab] = useSubTabRouter<StudentSubTab>(SUB_TAB_ROUTES, "TỔNG QUAN");
  const [selectedStudent, setSelectedStudent] = React.useState<Student | null>(null);
  const [isAddStudentOpen, setIsAddStudentOpen] = React.useState(false);
  const [initialStudentTab, setInitialStudentTab] = React.useState<"Hồ sơ" | "Học phí" | "Lịch sử">("Hồ sơ");
  const { students } = useStudents();

  const handleOpenStudent = React.useCallback((student: Student, tab: string = "Hồ sơ") => {
    setSelectedStudent(student);
    setInitialStudentTab(tab);
  }, []);

  const renderPage = () => {
    switch (activeSubTab) {
      case "TỔNG QUAN":
        return (
          <DashboardPage
            formattedDate={formatDateLabel()}
            onSelectStudent={handleOpenStudent}
            onNavigate={() => { }}
          />
        );
      case "HỌC VIÊN":
        return <StudentsPage onSelectStudent={handleOpenStudent} onAddStudent={() => setIsAddStudentOpen(true)} />;
      case "KHÓA HỌC":
        return <CoursesPage />;
      case "LỚP HỌC":
        return <BatchesPage />;
      case "LỊCH THI":
        return <ExamsPage />;
      case "HỌC PHÍ":
        return <FeesPage onSelectStudent={handleOpenStudent} />;
      case "THÔNG BÁO":
        return <NotificationsPage />;
      case "TÀI NGUYÊN":
        return <ResourcesPage />;
      case "ĐỐI TÁC":
        return <PartnersPage />;
      case "CÀI ĐẶT":
        return <SettingsPage />;
      default:
        return null;
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      {/* Sub Tabs switcher navigation bar */}
      <div className="border-b border-gray-200 bg-gray-50/50 p-2 text-xs flex gap-2 overflow-x-auto shrink-0" id="student_sub_tabs_bar">
        {SUB_TAB_ROUTES.map((item) => {
          const isActive = activeSubTab === item.value;
          return (
            <button
              key={item.value}
              type="button"
              onClick={() => setActiveSubTab(item.value)}
              className={`px-4 py-2 rounded-lg border font-bold uppercase transition-all tracking-wide cursor-pointer ${isActive
                  ? "bg-brand-primary text-white border-brand-primary shadow-sm shadow-brand-primary/20"
                  : "bg-white text-gray-500 border-gray-200 hover:bg-gray-100"
                }`}
            >
              {item.value}
            </button>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 p-6 overflow-y-auto">
        <Suspense fallback={<PageLoader />}>{renderPage()}</Suspense>
      </div>

      {isAddStudentOpen ? (
        <AddStudentModal
          isOpen={isAddStudentOpen}
          onClose={() => setIsAddStudentOpen(false)}
          students={students}
          onSuccess={(student) => {
            setIsAddStudentOpen(false);
            handleOpenStudent(student);
          }}
        />
      ) : null}

      {selectedStudent ? (
        <StudentDetailModal
          student={selectedStudent}
          onClose={() => setSelectedStudent(null)}
          initialTab={initialStudentTab}
        />
      ) : null}

    </div>
  );
}
