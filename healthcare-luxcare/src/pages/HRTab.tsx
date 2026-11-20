import React, { useState, useEffect, useRef, lazy, Suspense } from "react";
import {
  Activity,
  Building2,
  FolderTree,
  Briefcase,
  GraduationCap,
  Layers,
  Calendar,
  FileSignature,
  Mail,
  UserSearch,
  Award,
  Clock,
} from "lucide-react";
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
const CredentialsTab = lazy(() => import("../components/hr/CredentialsTab"));
const CelebrationEmailTab = lazy(() => import("../components/hr/CelebrationEmailTab"));
const EmployeePayslips = lazy(() => import("../components/hr/EmployeePayslips"));
const RecruitmentTab = lazy(() => import("../components/hr/recruitment/RecruitmentTab"));
const CELEBRATION_TAB = "EMAIL CHÚC MỪNG" as HRSubTabType;
const RECRUITMENT_TAB = "TUYỂN DỤNG" as HRSubTabType;
const CREDENTIALS_TAB = "VĂN BẰNG & CHỨNG CHỈ" as HRSubTabType;
const DEPARTMENTS_TAB = "PHÒNG BAN" as HRSubTabType;
const WORK_SCHEDULE_TAB = "CA & GIỜ LÀM VIỆC" as HRSubTabType;
const DepartmentRoomManagementTab = lazy(() =>
  import("../components/settings/DepartmentRoomManagementTab").then((m) => ({
    default: m.DepartmentRoomManagementTab,
  }))
);
const WorkScheduleSettingsTab = lazy(() => import("../components/hr/WorkScheduleSettingsTab"));

export function canAccessRecruitment(role: string | undefined, hasPermission: (code: string) => boolean) {
  return (
    role === "admin" ||
    role === "superadmin" ||
    hasPermission("recruitment:read") ||
    hasPermission("recruitment:manage")
  );
}

export default function HRTab() {
  const { userProfile, hasPermission } = useAuth();
  const { activeBranchId, branches } = useBranch();
  const isManager =
    userProfile?.role === "superadmin" || userProfile?.role === "admin" || userProfile?.role === "manager";
  // Custom roles (e.g. "hr") granted the timekeeping permissions via RolePermission
  // must also be able to view/manage everyone's attendance, not just their own -
  // scoped to CalendarTab only, so it doesn't leak "manager" rights into other HR tabs.
  const isCompanyAdmin = userProfile?.role === "superadmin" || userProfile?.role === "admin";
  const hasContractPermissions =
    !isCompanyAdmin && (hasPermission("contracts:read") || hasPermission("contracts:manage"));
  const canViewAllAttendance =
    (isManager ||
      hasPermission("timekeeping:read") ||
      hasPermission("timekeeping:manage") ||
      hasPermission("payroll:manage")) &&
    !hasContractPermissions;
  const canManageAttendance = (isManager || hasPermission("timekeeping:manage")) && !hasContractPermissions;
  const canEditAttendance = (canManageAttendance || hasPermission("payroll:manage")) && !hasContractPermissions;
  const canManageOrgChart = isManager || hasPermission("user:manage");
  const canManageKanban = isManager || hasPermission("kanban:manage");
  const isPayrollManager = userProfile?.role === "superadmin" || userProfile?.role === "admin";
  const canViewPayroll = isPayrollManager || hasPermission("payroll:read") || hasPermission("payroll:manage");
  const canManageCelebration = userProfile?.role === "admin" || hasPermission("company-email:manage");
  const hasRecruitmentAccess = canAccessRecruitment(userProfile?.role, hasPermission);
  const canManageRecruitment =
    userProfile?.role === "admin" || userProfile?.role === "superadmin" || hasPermission("recruitment:manage");
  const canManageCredentials = hasPermission("credentials:manage") || hasPermission("hr:manage");
  const canViewCredentials = canManageCredentials || hasPermission("credentials:read") || hasPermission("hr:read");
  const canViewEmployeeCredentials =
    canManageCredentials || ["admin", "superadmin", "branch_owner", "manager"].includes(userProfile?.role || "");
  const canManageDepartments =
    isManager ||
    hasPermission("user:manage") ||
    hasPermission("hr:manage") ||
    hasPermission("department:manage");
  const canManageWorkSchedule =
    isCompanyAdmin ||
    isManager ||
    hasPermission("timekeeping:manage") ||
    hasPermission("hr:manage");

  const [subTab, setSubTab] = useSubTabRouter<HRSubTabType>(HR_SUB_TAB_ROUTES, "SƠ ĐỒ TỔ CHỨC");
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [credentialEmployeeId, setCredentialEmployeeId] = useState<string | undefined>();

  const [showMenu, setShowMenu] = useState(true);
  const lastScrollY = useRef(0);
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
    const handleScroll = (e: Event) => {
      if (window.innerWidth >= 768) {
        setShowMenu(true);
        return;
      }
      const target = e.target as HTMLElement;
      let currentScrollY = 0;
      if (target === (document as any) || target === (window as any)) {
        currentScrollY = window.scrollY || document.documentElement.scrollTop;
      } else if (target && typeof target.scrollTop === "number") {
        currentScrollY = target.scrollTop;
      } else {
        return;
      }

      // Always show menu near the top of the container
      if (currentScrollY < 60) {
        setShowMenu(true);
        lastScrollY.current = currentScrollY;
        return;
      }

      const diff = currentScrollY - lastScrollY.current;
      // Require a minimum scroll delta to change state to prevent flickering/jittering
      if (Math.abs(diff) < 15) return;

      if (diff > 0) {
        setShowMenu(false);
      } else {
        setShowMenu(true);
      }
      lastScrollY.current = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, true);
    return () => window.removeEventListener("scroll", handleScroll, true);
  }, []);

  useEffect(() => {
    const timer = setTimeout(checkScroll, 100);
    window.addEventListener("resize", checkScroll);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", checkScroll);
    };
  }, [subTab, usersList]);

  useEffect(() => {
    if (subTab === RECRUITMENT_TAB && !hasRecruitmentAccess) setSubTab("SƠ ĐỒ TỔ CHỨC");
  }, [subTab, hasRecruitmentAccess, setSubTab]);

  useEffect(() => {
    if (subTab === CREDENTIALS_TAB && !canViewCredentials) setSubTab("SƠ ĐỒ TỔ CHỨC");
  }, [subTab, canViewCredentials, setSubTab]);

  useEffect(() => {
    if (subTab === DEPARTMENTS_TAB && !canManageDepartments) setSubTab("SƠ ĐỒ TỔ CHỨC");
  }, [subTab, canManageDepartments, setSubTab]);

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
          Authorization: `Bearer ${getAccessToken()}`,
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
    role:
      usr.jobTitle ||
      (usr.role === "superadmin"
        ? "CEO"
        : usr.role === "admin"
          ? "Quản trị viên"
          : usr.role === "branch_owner"
            ? "Chủ chi nhánh"
            : usr.role === "manager"
              ? "Quản lý"
              : "Nhân viên"),
    department: usr.department || "Ban Giám đốc",
    email: usr.email,
    phone: usr.phone || "Chưa cập nhật",
    avatar:
      usr.photoURL && (usr.photoURL.startsWith("http") || usr.photoURL.startsWith("/"))
        ? usr.photoURL
        : `https://ui-avatars.com/api/?name=${encodeURIComponent(usr.displayName)}&background=random&color=fff`,
    level:
      usr.level ||
      (usr.role === "superadmin"
        ? 0
        : usr.role === "admin"
          ? 1
          : usr.role === "branch_owner"
            ? 2
            : usr.role === "manager"
              ? 3
              : 4),
    parentId: usr.parentId,
    status: usr.status || "offline",
    division: usr.division || "Khối Vận Hành",
    isLeader: usr.isLeader,
    jobDescriptionLink: usr.jobDescriptionLink || "",
    monthlySalary: usr.monthlySalary,
    birthDate: usr.birthDate,
  }));

  return (
    <div
      className={`flex min-h-0 flex-1 flex-col bg-white max-h-[85vh] overflow-hidden ${!showMenu ? "hr-scrolled-down" : ""}`}
      id="hr_tab_wrapper"
    >
      <h1 className="sr-only">Quản lý Nhân sự - {subTab}</h1>

      {/* Sub Tabs switcher navigation bar */}
      <div
        className={`border-b border-slate-200/80 bg-white px-5 text-xs flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3 shrink-0 transition-all duration-300 ${
          showMenu ? "max-h-[200px] py-3 opacity-100" : "max-h-0 py-0 opacity-0 overflow-hidden border-b-0"
        }`}
        id="hr_sub_tabs_bar"
      >
        <div className="relative flex-1 min-w-0 md:overflow-visible">
          <div
            ref={scrollContainerRef}
            onScroll={checkScroll}
            className="flex flex-nowrap md:flex-wrap gap-1.5 select-none overflow-x-auto md:overflow-x-visible scrollbar-none pb-2 md:pb-0 pr-8 md:pr-0"
          >
            {[
              { id: "SƠ ĐỒ TỔ CHỨC", label: "Sơ đồ tổ chức", icon: FolderTree },
              { id: "ĐÀO TẠO", label: "Đào tạo", icon: GraduationCap },
              { id: "QUY TRÌNH", label: "Quy trình", icon: Layers },
              { id: "Giao Việc", label: "Giao việc", icon: Briefcase },
              { id: "LỊCH", label: "Lịch làm việc", icon: Calendar },
              { id: "HỢP ĐỒNG", label: "Hợp đồng", icon: FileSignature },
              ...(canViewCredentials ? [{ id: CREDENTIALS_TAB, label: "Văn bằng & chứng chỉ", icon: Award }] : []),
              { id: "PAYROLL", label: "Bảng lương", icon: Briefcase },
              ...(canManageCelebration ? [{ id: CELEBRATION_TAB, label: "Email chúc mừng", icon: Mail }] : []),
              ...(hasRecruitmentAccess ? [{ id: RECRUITMENT_TAB, label: "Tuyển dụng", icon: UserSearch }] : []),
              ...(canManageWorkSchedule ? [{ id: WORK_SCHEDULE_TAB, label: "Ca & Giờ làm việc", icon: Clock }] : []),
              ...(canManageDepartments ? [{ id: DEPARTMENTS_TAB, label: "Phòng & Phòng ban", icon: Building2 }] : []),
            ].map((tab) => {
              const isActive = subTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    if (tab.id === CREDENTIALS_TAB) setCredentialEmployeeId(undefined);
                    setSubTab(tab.id as HRSubTabType);
                  }}
                  className={`flex items-center gap-2 px-3 py-2 font-bold text-xs transition-all duration-200 cursor-pointer shrink-0 rounded-xl ${
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
          {/* Fading overlays indicating more content on mobile */}
          {canScrollLeft && (
            <div className="absolute top-0 left-0 bottom-2 w-10 bg-gradient-to-r from-white via-white/80 to-transparent pointer-events-none md:hidden flex items-center justify-start pl-1">
              <span className="text-[10px] text-slate-400 animate-pulse font-bold">◀</span>
            </div>
          )}
          {canScrollRight && (
            <div className="absolute top-0 right-0 bottom-2 w-10 bg-gradient-to-l from-white via-white/80 to-transparent pointer-events-none md:hidden flex items-center justify-end pr-1">
              <span className="text-[10px] text-slate-400 animate-pulse font-bold">▶</span>
            </div>
          )}
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
            key={`${selectedCompanyCode}:${isCompanyAdmin ? activeBranchId : userProfile?.branchId || ""}`}
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
            mainBranchId={branches.find((b) => b.code === "MAIN")?._id}
            canViewEmployeeCredentials={canViewEmployeeCredentials}
            onOpenCredentials={(employeeId) => {
              setCredentialEmployeeId(employeeId);
              setSubTab(CREDENTIALS_TAB);
            }}
          />
        )}

        {subTab === WORK_SCHEDULE_TAB && canManageWorkSchedule && (
          <div className="flex-1 p-4 sm:p-6 overflow-y-auto text-left" id="hr_work_schedule_content">
            <WorkScheduleSettingsTab />
          </div>
        )}

        {subTab === DEPARTMENTS_TAB && canManageDepartments && (
          <div className="flex-1 p-4 sm:p-6 overflow-y-auto text-left" id="hr_departments_content">
            <DepartmentRoomManagementTab />
          </div>
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

        {subTab === "PAYROLL" &&
          (canViewPayroll ? (
            <PayrollTab canManage={isPayrollManager || hasPermission("payroll:manage")} />
          ) : (
            <EmployeePayslips />
          ))}
        {subTab === CELEBRATION_TAB && canManageCelebration && <CelebrationEmailTab />}
        {subTab === RECRUITMENT_TAB && hasRecruitmentAccess && (
          <RecruitmentTab key={activeBranchId} canManage={canManageRecruitment} />
        )}
        {subTab === "HỢP ĐỒNG" && (
          <ContractsTab
            canManage={canManageOrgChart}
            companyCode={selectedCompanyCode}
            branchId={activeBranchId || undefined}
          />
        )}
        {subTab === CREDENTIALS_TAB && canViewCredentials && (
          <CredentialsTab
            canManage={canManageCredentials}
            companyCode={selectedCompanyCode}
            initialEmployeeId={credentialEmployeeId}
          />
        )}
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
