import React, { useState, useEffect, lazy, Suspense } from "react";
import { Activity, Building2, FolderTree, Briefcase, GraduationCap, Layers, Calendar, FileSignature, FileText, Mail, UserSearch } from "lucide-react";
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
const LeaveRequestsTab = lazy(() => import("../components/hr/LeaveRequestsTab"));
const PayrollTab = lazy(() => import("../components/hr/PayrollTab"));
const ContractsTab = lazy(() => import("../components/hr/ContractsTab"));
const CelebrationEmailTab = lazy(() => import("../components/hr/CelebrationEmailTab"));
const RecruitmentTab = lazy(() => import("../components/hr/recruitment/RecruitmentTab"));
const CELEBRATION_TAB = "EMAIL CHÚC MỪNG" as HRSubTabType;
const RECRUITMENT_TAB = "TUY?N D?NG" as HRSubTabType;

export function canAccessRecruitment(role: string | undefined, hasPermission: (code: string) => boolean) {
  return role === "admin" || hasPermission("recruitment:manage");
}

export default function HRTab() {
  const { userProfile, hasPermission } = useAuth();
  const { activeBranchId } = useBranch();
  const isManager =
    userProfile?.role === "superadmin" ||
    userProfile?.role === "admin" ||
    userProfile?.role === "manager";
  // Custom roles (e.g. "hr") granted the timekeeping permissions via RolePermission
  // must also be able to view/manage everyone's attendance, not just their own �
  // scoped to CalendarTab only, so it doesn't leak "manager" rights into other HR tabs.
  const canViewAllAttendance = isManager || hasPermission("timekeeping:read") || hasPermission("timekeeping:manage") || hasPermission("payroll:manage");
  const canManageAttendance = isManager || hasPermission("timekeeping:manage");
  const canEditAttendance = canManageAttendance || hasPermission("payroll:manage");
  const canManageOrgChart = isManager || hasPermission("user:manage");
  const canManageKanban = isManager || hasPermission("kanban:manage");
  const canViewPayroll = hasPermission("payroll:read") || hasPermission("payroll:manage");
  const canManageCelebration = userProfile?.role === "admin" || hasPermission("company-email:manage");
  const canManageRecruitment = canAccessRecruitment(userProfile?.role, hasPermission);

  const [subTab, setSubTab] = useSubTabRouter<HRSubTabType>(HR_SUB_TAB_ROUTES, "SƠ ĐỒ TỔ CHỨC");
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (subTab === RECRUITMENT_TAB && !canManageRecruitment) setSubTab("SƠ ĐỒ TỔ CHỨC");
  }, [subTab, canManageRecruitment, setSubTab]);

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
          console.error("Lỗi khi tải danh s�ch c�ng ty:", err);
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
        data = await authService.getUsersByCompany(selectedCompanyCode, activeBranchId || undefined);
      }
      setUsersList(data);
    } catch (error) {
      console.error("Lỗi khi tải danh s�ch nhân sự:", error);
      toast.error(getApiErrorMessage(error, "Không thể tải so d? nhân sự."));
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
      if (!res.ok) throw new Error("Không thể tải danh s�ch kh�a h?c");
      const json = await res.json();
      const list: TrainingCourse[] = (json.data || []).map((item: any) => ({
        ...item,
        id: item._id,
      }));
      setCourses(list);
    } catch (err) {
      console.error("L?i t?i kh�a h?c:", err);
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
    role: usr.jobTitle || (usr.role === "superadmin" ? "CEO" : "Nhân viên"),
    department: usr.department || "Ban Giám đốc",
    email: usr.email,
    phone: usr.phone || "Chua c?p nh?t",
    avatar:
      usr.photoURL && (usr.photoURL.startsWith("http") || usr.photoURL.startsWith("/"))
        ? usr.photoURL
        : `https://ui-avatars.com/api/?name=${encodeURIComponent(usr.displayName)}&background=random&color=fff`,
    level: usr.level || 4,
    parentId: usr.parentId,
    status: usr.status || "offline",
    division: usr.division || "Khối Vận Hành",
    jobDescriptionLink: usr.jobDescriptionLink || "",
    monthlySalary: usr.monthlySalary,
  }));

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white max-h-[85vh] overflow-hidden" id="hr_tab_wrapper">
      <h1 className="sr-only">Quản lý Nhân sự - {subTab}</h1>

      {/* Sub Tabs switcher navigation bar */}
      <div className="border-b border-slate-200/80 bg-white px-5 pt-2 pb-0 text-xs flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 shrink-0" id="hr_sub_tabs_bar">
        <div className="flex gap-1 overflow-x-auto select-none scrollbar-none max-w-full -mb-px">
          {[
            { id: "SƠ ĐỒ TỔ CHỨC", label: "So d? t? ch?c", icon: FolderTree },
            { id: "ĐÀO TẠO", label: "Đào tạo", icon: GraduationCap },
            { id: "QUY TRÌNH", label: "Quy trình", icon: Layers },
            { id: "Giao Việc", label: "Giao vi?c", icon: Briefcase },
            { id: "LỊCH", label: "Lịch làm việc", icon: Calendar },
            { id: "ĐƠN TỪ", label: "Quản lý đơn từ", icon: FileText },
            { id: "HỢP ĐỒNG", label: "H?p d?ng", icon: FileSignature },
            ...(canViewPayroll ? [{ id: "PAYROLL", label: "B?ng luong", icon: Briefcase }] : []),
            ...(canManageCelebration ? [{ id: CELEBRATION_TAB, label: "Email chúc mừng", icon: Mail }] : []),
            ...(canManageRecruitment ? [{ id: RECRUITMENT_TAB, label: "Tuy?n d?ng", icon: UserSearch }] : []),
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
                <option value="SYSTEM">H? th?ng (SYSTEM)</option>
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
      <Suspense fallback={<TabLoader label="�ang t?i d? li?u nhân sự..." />}>
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
          />
        )}

        {subTab === "Giao Việc" && (
          <KanbanTab
            userProfile={userProfile}
            selectedCompanyCode={selectedCompanyCode}
            employees={employees}
            isManager={canManageKanban}
            usersList={usersList}
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
          />
        )}

        {subTab === "PAYROLL" && <PayrollTab canManage={hasPermission("payroll:manage")} />}
        {subTab === CELEBRATION_TAB && canManageCelebration && <CelebrationEmailTab />}
        {subTab === RECRUITMENT_TAB && canManageRecruitment && <RecruitmentTab key={activeBranchId} />}
        {subTab === "HỢP ĐỒNG" && <ContractsTab canManage={canManageOrgChart} companyCode={selectedCompanyCode} />}
        {subTab === "LỊCH" && (
          <CalendarTab
            userProfile={userProfile}
            selectedCompanyCode={selectedCompanyCode}
            isManager={canViewAllAttendance}
            canManage={canManageAttendance}
            canEditAttendance={canEditAttendance}
            usersList={usersList}
            employees={employees}
          />
        )}
        {subTab === "ĐƠN TỪ" && (
          <LeaveRequestsTab
            userProfile={userProfile}
            selectedCompanyCode={selectedCompanyCode}
            canApprove={canManageAttendance}
            usersList={usersList}
            employees={employees}
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
