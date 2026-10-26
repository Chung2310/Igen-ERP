import React, { useState, useEffect, useRef, lazy, Suspense } from "react";
import { Building2, FolderTree, Briefcase, GraduationCap, Layers, Calendar, FileSignature, Mail, UserSearch, ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import { HRSubTabType, EmployeeNode, TrainingCourse, UserProfile } from "../types";
import { useAuth } from "../context/AuthContext";
import { useBranch } from "../context/BranchContext";
import { authService, getAccessToken } from "../services/authService";
import { toast } from "./Toast";
import { getApiErrorMessage } from "../utils/errorMessage";
import { useSubTabRouter } from "../hooks/useSubTabRouter";
import { HR_SUB_TAB_ROUTES } from "../router/subTabRoutes";
import { cn } from "../modules/student-management/lib/utils";

// Lazy-loaded subcomponents
const OrgChartTab = lazy(() => import("../components/hr/OrgChartTab"));
const KanbanTab = lazy(() => import("../components/hr/KanbanTab"));
const TrainingTab = lazy(() => import("../components/hr/TrainingTab"));
const WorkflowTab = lazy(() => import("../components/hr/WorkflowTab"));
const HrScheduleTab = lazy(() => import("../components/hr/HrScheduleTab"));
const PayrollTab = lazy(() => import("../components/hr/PayrollTab"));
const ContractsTab = lazy(() => import("../components/hr/ContractsTab"));
const CelebrationEmailTab = lazy(() => import("../components/hr/CelebrationEmailTab"));
const EmployeePayslips = lazy(() => import("../components/hr/EmployeePayslips"));
const RecruitmentTab = lazy(() => import("../components/hr/recruitment/RecruitmentTab"));
const HrDepartmentTab = lazy(() => import("../components/hr/HrDepartmentTab"));
const BranchManagementTab = lazy(() => import("../components/settings/BranchManagementTab"));
const CELEBRATION_TAB = "EMAIL CHÚC MỪNG" as HRSubTabType;
const RECRUITMENT_TAB = "TUYỂN DỤNG" as HRSubTabType;
const DEPARTMENT_TAB = "PHÒNG BAN" as HRSubTabType;
const BRANCH_TAB = "CHI NHÁNH" as HRSubTabType;

export function canAccessRecruitment(role: string | undefined, hasPermission: (code: string) => boolean) {
  return role === "superadmin" || role === "admin" || hasPermission("recruitment:read") || hasPermission("recruitment:manage");
}

export default function HRTab() {
  const subTabsRef = useRef<HTMLElement>(null);
  const [tabScroll, setTabScroll] = useState({ left: false, right: false });
  const scrollSubTabs = (direction: "left" | "right") => {
    const nav = subTabsRef.current;
    nav?.scrollBy({ left: (direction === "left" ? -1 : 1) * Math.max(240, nav.clientWidth * 0.75), behavior: "smooth" });
  };
  const { userProfile, hasPermission } = useAuth();
  const { activeBranchId } = useBranch();
  const isManager =
    userProfile?.role === "superadmin" ||
    userProfile?.role === "admin" ||
    userProfile?.role === "manager";
  // Custom roles (e.g. "hr") granted the timekeeping permissions via RolePermission
  // must also be able to view/manage everyone's attendance, not just their own -
  // scoped to CalendarTab only, so it doesn't leak "manager" rights into other HR tabs.
  const hasContractPermissions = false;
  const canViewAllAttendance = (isManager || hasPermission("timekeeping:read") || hasPermission("timekeeping:manage") || hasPermission("payroll-period:manage")) && !hasContractPermissions;
  const canManageAttendance = (isManager || hasPermission("timekeeping:manage")) && !hasContractPermissions;
  const canManageTimekeeping = userProfile?.role === "superadmin" || userProfile?.role === "admin" || hasPermission("timekeeping:manage");
  const canManageCalendar = userProfile?.role === "superadmin" || userProfile?.role === "admin";
  const canEditAttendance = (canManageAttendance || hasPermission("payroll-period:manage")) && !hasContractPermissions;
  const canManageOrgChart = isManager || hasPermission("access:manage");
  const canManageKanban = isManager || hasPermission("work:manage");
  const isPayrollManager = userProfile?.role === "superadmin" || userProfile?.role === "admin";
  const canViewPayroll = isPayrollManager || hasPermission("payroll-period:read") || hasPermission("payroll-period:manage");
  const canManageCelebration = userProfile?.role === "admin" || hasPermission("settings:manage");
  const canManageDepartments = userProfile?.role === "superadmin" || hasPermission("access:manage") || hasPermission("hr:manage");
  const canViewDepartments = canManageDepartments || hasPermission("access:read") || hasPermission("hr:read");
  const canManageBranches = userProfile?.role === "admin";
  const hasRecruitmentAccess = canAccessRecruitment(userProfile?.role, hasPermission);
  const canManageRecruitment =
    userProfile?.role === "admin" || userProfile?.role === "superadmin" || hasPermission("recruitment:manage");

  useEffect(() => {
    const nav = subTabsRef.current;
    if (!nav) return;
    const update = () => {
      const maxScroll = Math.max(0, nav.scrollWidth - nav.clientWidth);
      setTabScroll({ left: nav.scrollLeft > 1, right: nav.scrollLeft < maxScroll - 1 });
    };
    update();
    nav.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(nav);
    Array.from(nav.children).forEach((tab) => observer?.observe(tab));
    return () => {
      nav.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      observer?.disconnect();
    };
  }, [canViewDepartments, canManageBranches, canManageCelebration, hasRecruitmentAccess]);

  const [subTab, setSubTab] = useSubTabRouter<HRSubTabType>(HR_SUB_TAB_ROUTES, "SƠ ĐỒ TỔ CHỨC");
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (subTab === RECRUITMENT_TAB && !hasRecruitmentAccess) setSubTab("SƠ ĐỒ TỔ CHỨC");
    if (subTab === DEPARTMENT_TAB && !canViewDepartments) setSubTab("SƠ ĐỒ TỔ CHỨC");
    if (subTab === BRANCH_TAB && !canManageBranches) setSubTab("SƠ ĐỒ TỔ CHỨC");
  }, [subTab, hasRecruitmentAccess, canViewDepartments, canManageBranches, setSubTab]);

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
        const branchId = selectedCompanyCode === userProfile?.companyCode ? activeBranchId || undefined : undefined;
        data = await authService.getUsersByCompany(selectedCompanyCode, branchId);
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
    <div className="flex min-h-0 flex-1 flex-col bg-surface max-h-[85vh] overflow-hidden" id="hr_tab_wrapper">
      <h1 className="sr-only text-balance">Quản lý Nhân sự - {subTab}</h1>

      {/* Sub Tabs switcher navigation bar */}
      <div className="mb-4 flex shrink-0 flex-col items-stretch gap-3 border-b border-outline-variant bg-surface-container-lowest px-3 pb-2 pt-2 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-5" id="hr_sub_tabs_bar">
        <div className="flex min-w-0 flex-1 items-center gap-1 select-none">
          <button type="button" aria-label="Cuộn tab Nhân sự sang trái" onClick={() => scrollSubTabs("left")} disabled={!tabScroll.left} className={cn("flex size-11 shrink-0 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface hover:text-primary focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40", !tabScroll.left && !tabScroll.right && "hidden")}><ChevronLeft className="size-4" aria-hidden="true" /></button>
          <nav ref={subTabsRef} aria-label="Mục Nhân sự" className="flex min-w-0 max-w-full flex-1 gap-1 overflow-x-auto select-none scrollbar-none">
            {[
              { id: "SƠ ĐỒ TỔ CHỨC", label: "Sơ đồ tổ chức", icon: FolderTree },
              ...(canViewDepartments ? [{ id: DEPARTMENT_TAB, label: "Phòng ban", icon: Building2 }] : []),
              ...(canManageBranches ? [{ id: BRANCH_TAB, label: "Chi nhánh", icon: MapPin }] : []),
              { id: "ĐÀO TẠO", label: "Đào tạo", icon: GraduationCap },
              { id: "QUY TRÌNH", label: "Quy trình", icon: Layers },
              { id: "Giao Việc", label: "Giao việc", icon: Briefcase },
              { id: "LỊCH", label: "Lịch & Ca làm việc", icon: Calendar },
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
                  type="button"
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => setSubTab(tab.id as HRSubTabType)}
                  className={cn(
                    "flex shrink-0 cursor-pointer items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold normal-case transition-colors focus-visible:outline-2 focus-visible:outline-primary",
                    isActive ? "bg-primary font-bold text-on-primary shadow-xs" : "text-on-surface-variant hover:bg-surface hover:text-primary",
                  )}
                >
                  <Icon className="size-4" aria-hidden="true" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
          <button type="button" aria-label="Cuộn tab Nhân sự sang phải" onClick={() => scrollSubTabs("right")} disabled={!tabScroll.right} className={cn("flex size-11 shrink-0 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface hover:text-primary focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40", !tabScroll.left && !tabScroll.right && "hidden")}><ChevronRight className="size-4" aria-hidden="true" /></button>
        </div>

        <div className="flex items-center gap-4 pb-2 sm:pb-0">
          {/* SaaS Multi-tenant Company Filter for Superadmin */}
          {userProfile?.role === "superadmin" && (
            <div className="flex items-center gap-2">
              <Building2 className="size-4 shrink-0 text-on-surface-variant" aria-hidden="true" />
              <select
                value={selectedCompanyCode}
                onChange={(e) => setSelectedCompanyCode(e.target.value)}
                className="max-w-[60vw] cursor-pointer rounded-xl border border-outline-variant bg-surface-container-lowest p-1.5 text-xs font-medium text-on-surface outline-none focus-visible:outline-2 focus-visible:outline-primary sm:max-w-none"
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
        {subTab === DEPARTMENT_TAB && canViewDepartments && (
          <HrDepartmentTab companyCode={selectedCompanyCode} fetchUsers={fetchUsers} canManage={canManageDepartments} />
        )}

        {subTab === BRANCH_TAB && canManageBranches && (
          <div className="min-h-0 flex-1 overflow-y-auto bg-surface p-3 sm:p-5">
            <BranchManagementTab />
          </div>
        )}

        {subTab === "SƠ ĐỒ TỔ CHỨC" && (
          <OrgChartTab
            userProfile={userProfile}
            selectedCompanyCode={selectedCompanyCode}
            usersList={usersList}
            employees={employees}
            fetchUsers={fetchUsers}
            isManager={canManageOrgChart}
            canManageDepartments={canManageDepartments}
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
            <PayrollTab canManage={isPayrollManager || hasPermission("payroll-period:manage")} canPublishPayslips={isPayrollManager || hasPermission("payroll-payment:manage")} canExportPayslips={isPayrollManager || hasPermission("payroll-payment:read") || hasPermission("payroll-payment:manage")} />
          ) : (
            <EmployeePayslips />
          )
        )}
        {subTab === CELEBRATION_TAB && canManageCelebration && <CelebrationEmailTab />}
        {subTab === RECRUITMENT_TAB && hasRecruitmentAccess && <RecruitmentTab key={activeBranchId} canManage={canManageRecruitment} />}
        {subTab === "HỢP ĐỒNG" && <ContractsTab canManage={canManageOrgChart} companyCode={selectedCompanyCode} branchId={activeBranchId || undefined} />}
        {subTab === "LỊCH" && (
          <HrScheduleTab
            userProfile={userProfile}
            selectedCompanyCode={selectedCompanyCode}
            isManager={canViewAllAttendance}
            canManageAttendance={canManageAttendance}
            canEditAttendance={canEditAttendance}
            usersList={usersList}
            employees={employees}
            canManageTimekeeping={canManageTimekeeping}
            canManageCalendar={canManageCalendar}
          />
        )}
      </Suspense>
    </div>
  );
}

function TabLoader({ label }: { label: string }) {
  return (
    <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-3 rounded-2xl border border-outline-variant bg-surface-container-lowest p-6 text-center">
      <div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" aria-hidden="true" />
      <span role="status" className="text-pretty text-xs font-semibold text-on-surface-variant">{label}</span>
    </div>
  );
}
