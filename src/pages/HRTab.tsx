import React, { useState, useEffect, useRef, lazy, Suspense } from "react";
import { Activity, Building2, FolderTree, Briefcase, GraduationCap, Layers, Calendar, FileSignature, Mail, UserSearch, ChevronLeft, ChevronRight } from "lucide-react";
import { HRSubTabType, EmployeeNode, TrainingCourse, UserProfile } from "../types";
import { useAuth } from "../context/AuthContext";
import { useBranch } from "../context/BranchContext";
import { authService, getAccessToken } from "../services/authService";
import { toast } from "./Toast";
import { getApiErrorMessage } from "../utils/errorMessage";
import { useSubTabRouter } from "../hooks/useSubTabRouter";
import { HR_SUB_TAB_ROUTES } from "../router/subTabRoutes";

// Lazy-loaded subcomponents
const OrgChartTab = lazy(() => import("../components/hr/OrgChartTab"));
const KanbanTab = lazy(() => import("../components/hr/KanbanTab"));
const TrainingTab = lazy(() => import("../components/hr/TrainingTab"));
const WorkflowTab = lazy(() => import("../components/hr/WorkflowTab"));
const CalendarTab = lazy(() => import("../components/hr/CalendarTab"));
const PayrollTab = lazy(() => import("../components/hr/PayrollTab"));
const ContractsTab = lazy(() => import("../components/hr/ContractsTab"));
const CelebrationEmailTab = lazy(() => import("../components/hr/CelebrationEmailTab"));
const EmployeePayslips = lazy(() => import("../components/hr/EmployeePayslips"));
const RecruitmentTab = lazy(() => import("../components/hr/recruitment/RecruitmentTab"));
const CELEBRATION_TAB = "EMAIL CHÚC MỪNG" as HRSubTabType;
const RECRUITMENT_TAB = "TUYỂN DỤNG" as HRSubTabType;

export function canAccessRecruitment(role: string | undefined, hasPermission: (code: string) => boolean) {
  return role === "superadmin" || role === "admin" || hasPermission("recruitment:read") || hasPermission("recruitment:manage");
}

export default function HRTab() {
  const subTabsRef = useRef<HTMLDivElement>(null);
  const scrollSubTabs = (direction: "left" | "right") => subTabsRef.current?.scrollBy({ left: direction === "left" ? -280 : 280, behavior: "smooth" });
  const { userProfile, hasPermission } = useAuth();
  const { activeBranchId } = useBranch();
  const isManager =
    userProfile?.role === "superadmin" ||
    userProfile?.role === "admin" ||
    userProfile?.role === "manager";
  // Custom roles (e.g. "hr") granted the timekeeping permissions via RolePermission
  // must also be able to view/manage everyone's attendance, not just their own -
  // scoped to CalendarTab only, so it doesn't leak "manager" rights into other HR tabs.
  const isCompanyAdmin = userProfile?.role === "superadmin" || userProfile?.role === "admin";
  const hasContractPermissions = false;
  const canViewAllAttendance = (isManager || hasPermission("timekeeping:read") || hasPermission("timekeeping:manage") || hasPermission("payroll-period:manage")) && !hasContractPermissions;
  const canManageAttendance = (isManager || hasPermission("timekeeping:manage")) && !hasContractPermissions;
  const canEditAttendance = (canManageAttendance || hasPermission("payroll-period:manage")) && !hasContractPermissions;
  const canManageOrgChart = isManager || hasPermission("access:manage");
  const canManageKanban = isManager || hasPermission("work:manage");
  const isPayrollManager = userProfile?.role === "superadmin" || userProfile?.role === "admin";
  const canViewPayroll = isPayrollManager || hasPermission("payroll-period:read") || hasPermission("payroll-period:manage");
  const canManageCelebration = userProfile?.role === "admin" || hasPermission("settings:manage");
  const hasRecruitmentAccess = canAccessRecruitment(userProfile?.role, hasPermission);
  const canManageRecruitment =
    userProfile?.role === "admin" || userProfile?.role === "superadmin" || hasPermission("recruitment:manage");

  const [subTab, setSubTab] = useSubTabRouter<HRSubTabType>(HR_SUB_TAB_ROUTES, "SƠ ĐỒ TỔ CHỨC");
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (subTab === RECRUITMENT_TAB && !hasRecruitmentAccess) setSubTab("SƠ ĐỒ TỔ CHỨC");
  }, [subTab, hasRecruitmentAccess, setSubTab]);

  // SaaS States
  const [companies, setCompanies] = useState<any[]>([]);
  const [selectedCompanyCode, setSelectedCompanyCode] = useState<string>("");
  const [courses, setCourses] = useState<TrainingCourse[]>([]);

  // Load companies for superadmin, or set selected company code for admin/manager/user
  useEffect(() => {
    const loadCompanies = async () => {
      if (!userProfile) return;

      if (userProfile.role === "superadmin") {
        try {
          const comps = await authService.getAllCompanies();
          setCompanies(comps);
          if (comps.length > 0) {
            setSelectedCompanyCode(comps[0].code);
          } else {
            setSelectedCompanyCode("SYSTEM");
          }
        } catch (err) {
          console.error("Lỗi khi tải danh sách công ty:", err);
          setSelectedCompanyCode("SYSTEM");
        }
      } else if (userProfile.companyCode) {
        setSelectedCompanyCode(userProfile.companyCode);
      } else {
        setSelectedCompanyCode("SYSTEM");
      }
    };
    loadCompanies();
  }, [userProfile?.uid, userProfile?.role, userProfile?.companyCode]);

  // Fetch users list from Firestore based on company filter
  const fetchUsers = async () => {
    if (!selectedCompanyCode) return;
    setLoading(true);
    try {
      let data: UserProfile[] = [];
      if (selectedCompanyCode === "SYSTEM") {
        if (userProfile?.role === "superadmin") {
          const allUsers = await authService.getAllUsers();
          data = allUsers.filter((u) => !u.companyCode || u.companyCode === "SYSTEM");
        } else {
          data = userProfile ? [userProfile] : [];
        }
      } else {
        data = await authService.getUsersByCompany(selectedCompanyCode);
      }
      setUsersList(data);
    } catch (error) {
      console.error("Lỗi khi tải danh sách nhân sự:", error);
      toast.error(getApiErrorMessage(error, "Không thể tải sơ đồ nhân sự."));
    } finally {
      setLoading(false);
    }
  };

  const fetchCourses = async (companyCode: string) => {
    if (!companyCode) return;
    try {
      const res = await fetch("/api/v1/crud/training-courses", {
        headers: {
          "Authorization": `Bearer ${getAccessToken()}`,
        },
      });
      if (!res.ok) throw new Error("Không thể tải danh sách khóa học");
      const json = await res.json();
      const list: TrainingCourse[] = (json.data || []).map((item: any) => ({
        ...item,
        id: item._id,
      }));
      setCourses(list);
    } catch (err) {
      console.error("Lỗi tải khóa học:", err);
    }
  };

  useEffect(() => {
    if (selectedCompanyCode) {
      fetchUsers();
      fetchCourses(selectedCompanyCode);
    }
  }, [selectedCompanyCode, userProfile?.uid, activeBranchId]);

  // Map user profile from Firestore to EmployeeNode tree model
  const employees: EmployeeNode[] = usersList.map((usr) => ({
    id: usr.uid,
    name: usr.displayName,
    role: usr.jobTitle || (
      usr.role === "superadmin" ? "CEO" :
      usr.role === "admin" ? "Quản trị viên" :
      usr.role === "branch_owner" ? "Chủ chi nhánh" :
      usr.role === "manager" ? "Quản lý" : "Nhân viên"
    ),
    department: usr.department || "Ban Giám đốc",
    email: usr.email,
    phone: usr.phone || "Chưa cập nhật",
    avatar:
      usr.photoURL && (usr.photoURL.startsWith("http") || usr.photoURL.startsWith("/"))
        ? usr.photoURL
        : `https://ui-avatars.com/api/?name=${encodeURIComponent(usr.displayName)}&background=random&color=fff`,
    level: usr.level || (
      usr.role === "superadmin" ? 0 :
      usr.role === "admin" ? 1 :
      usr.role === "branch_owner" ? 2 :
      usr.role === "manager" ? 3 : 4
    ),
    parentId: usr.parentId,
    status: usr.status || "offline",
    division: usr.division || "Khối Vận Hành",
    isLeader: usr.isLeader,
    jobDescriptionLink: usr.jobDescriptionLink || "",
    monthlySalary: usr.monthlySalary,
  }));

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white max-h-[85vh] overflow-hidden" id="hr_tab_wrapper">
      <h1 className="sr-only">Quản lý Nhân sự - {subTab}</h1>

      {/* Sub Tabs switcher navigation bar */}
      <div className="flex shrink-0 flex-col items-stretch gap-3 border-b border-slate-200/80 bg-white px-3 pt-2 pb-0 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-5" id="hr_sub_tabs_bar">
        <div className="flex min-w-0 flex-1 items-center gap-1 select-none">
          <button type="button" aria-label="Cuộn tab HR sang trái" onClick={() => scrollSubTabs("left")} className="flex h-6 w-5 shrink-0 items-center justify-center text-slate-400 transition-colors hover:text-slate-700 sm:hidden"><ChevronLeft className="h-4 w-4" /></button>
          <div ref={subTabsRef} className="flex min-w-0 max-w-full flex-1 gap-1 overflow-x-auto select-none scrollbar-none -mb-px">
            {[
              { id: "SƠ ĐỒ TỔ CHỨC", label: "Sơ đồ tổ chức", icon: FolderTree },
              { id: "ĐÀO TẠO", label: "Đào tạo", icon: GraduationCap },
              { id: "QUY TRÌNH", label: "Quy trình", icon: Layers },
              { id: "Giao Việc", label: "Giao việc", icon: Briefcase },
              { id: "LỊCH", label: "Lịch làm việc", icon: Calendar },
              { id: "HỢP ĐỒNG", label: "Hợp đồng", icon: FileSignature },
              { id: "PAYROLL", label: "Bảng lương", icon: Briefcase },
              ...(canManageCelebration ? [{ id: CELEBRATION_TAB, label: "Email chúc mừng", icon: Mail }] : []),
              ...(hasRecruitmentAccess ? [{ id: RECRUITMENT_TAB, label: "Tuyển dụng", icon: UserSearch }] : []),
            ].map((tab) => {
              const isActive = subTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setSubTab(tab.id as HRSubTabType)}
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
          <button type="button" aria-label="Cuộn tab HR sang phải" onClick={() => scrollSubTabs("right")} className="flex h-6 w-5 shrink-0 items-center justify-center text-slate-400 transition-colors hover:text-slate-700 sm:hidden"><ChevronRight className="h-4 w-4" /></button>
        </div>

        <div className="flex items-center gap-4 pb-2 sm:pb-0">
          {/* SaaS Multi-tenant Company Filter for Superadmin */}
          {userProfile?.role === "superadmin" && (
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-slate-400 shrink-0" />
              <select
                value={selectedCompanyCode}
                onChange={(e) => setSelectedCompanyCode(e.target.value)}
                className="p-1.5 border border-gray-200 bg-white rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer font-semibold max-w-[60vw] sm:max-w-none"
              >
                <option value="SYSTEM">Hệ thống (SYSTEM)</option>
                {companies.map((c) => (
                  <option key={c.id || c._id || c.code} value={c.code}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>
          )}

        </div>
      </div>

      {/* Conditional Rendering of Modular Tab Components */}
      <Suspense fallback={<TabLoader label="Đang tải dữ liệu nhân sự..." />}>
        {subTab === "SƠ ĐỒ TỔ CHỨC" && (
          <OrgChartTab
            userProfile={userProfile}
            selectedCompanyCode={selectedCompanyCode}
            usersList={usersList}
            employees={employees}
            fetchUsers={fetchUsers}
            isManager={canManageOrgChart}
            companies={companies}
            courses={courses}
            fetchCourses={fetchCourses}
            loading={loading}
            activeBranchId={activeBranchId || undefined}
          />
        )}

        {subTab === "Giao Việc" && (
          <KanbanTab
            userProfile={userProfile}
            selectedCompanyCode={selectedCompanyCode}
            employees={employees}
            isManager={canManageKanban}
            usersList={usersList}
            activeBranchId={activeBranchId || undefined}
          />
        )}

        {subTab === "ĐÀO TẠO" && (
          <TrainingTab
            userProfile={userProfile}
            selectedCompanyCode={selectedCompanyCode}
            isManager={isManager}
            courses={courses}
            setCourses={setCourses}
            fetchCourses={fetchCourses}
            employees={employees}
          />
        )}

        {subTab === "QUY TRÌNH" && (
          <WorkflowTab
            userProfile={userProfile}
            selectedCompanyCode={selectedCompanyCode}
            isManager={isManager}
            activeBranchId={activeBranchId || undefined}
          />
        )}

        {subTab === "PAYROLL" && (
          canViewPayroll ? (
            <PayrollTab canManage={isPayrollManager || hasPermission("payroll-period:manage")} />
          ) : (
            <EmployeePayslips />
          )
        )}
        {subTab === CELEBRATION_TAB && canManageCelebration && <CelebrationEmailTab />}
        {subTab === RECRUITMENT_TAB && hasRecruitmentAccess && <RecruitmentTab key={activeBranchId} canManage={canManageRecruitment} />}
        {subTab === "HỢP ĐỒNG" && <ContractsTab canManage={canManageOrgChart} companyCode={selectedCompanyCode} branchId={activeBranchId || undefined} />}
        {subTab === "LỊCH" && (
          <CalendarTab
            userProfile={userProfile}
            selectedCompanyCode={selectedCompanyCode}
            isManager={canViewAllAttendance}
            canManage={canManageAttendance}
            canEditAttendance={canEditAttendance}
            usersList={usersList}
            employees={employees}
            canApproveLeave={canManageAttendance}
          />
        )}
      </Suspense>
    </div>
  );
}

function TabLoader({ label }: { label: string }) {
  return (
    <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-3 rounded-2xl bg-white border border-gray-150 p-6 text-center">
      <div className="w-8 h-8 border-3 border-indigo-650 border-t-transparent rounded-full animate-spin" />
      <span className="text-xs text-gray-500 font-semibold">{label}</span>
    </div>
  );
}
