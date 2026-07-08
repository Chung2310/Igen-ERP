import React, { useState, useEffect, lazy, Suspense } from "react";
import { Activity, Building2 } from "lucide-react";
import { HRSubTabType, EmployeeNode, TrainingCourse, UserProfile } from "../types";
import { useAuth } from "../context/AuthContext";
import { authService, getAccessToken } from "../services/authService";
import { toast } from "./Toast";
import { useSubTabRouter } from "../hooks/useSubTabRouter";

// Lazy-loaded subcomponents
const OrgChartTab = lazy(() => import("../components/hr/OrgChartTab"));
const KanbanTab = lazy(() => import("../components/hr/KanbanTab"));
const TrainingTab = lazy(() => import("../components/hr/TrainingTab"));
const WorkflowTab = lazy(() => import("../components/hr/WorkflowTab"));
const CalendarTab = lazy(() => import("../components/hr/CalendarTab"));

export default function HRTab() {
  const { userProfile } = useAuth();
  const isManager =
    userProfile?.role === "superadmin" ||
    userProfile?.role === "admin" ||
    userProfile?.role === "manager";

  const HR_SUB_TAB_ROUTES = [
    { slug: "so-do", value: "SƠ ĐỒ TỔ CHỨC" as HRSubTabType },
    { slug: "kanban", value: "GIAO VIỆC KANBAN" as HRSubTabType },
    { slug: "dao-tao", value: "ĐÀO TẠO" as HRSubTabType },
    { slug: "quy-trinh", value: "QUY TRÌNH" as HRSubTabType },
    { slug: "lich", value: "LỊCH" as HRSubTabType },
  ] as const;
  const [subTab, setSubTab] = useSubTabRouter<HRSubTabType>(HR_SUB_TAB_ROUTES as any, "SƠ ĐỒ TỔ CHỨC");
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

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
      toast.error("Không thể tải sơ đồ nhân sự.");
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
  }, [selectedCompanyCode, userProfile?.uid]);

  // Map user profile from Firestore to EmployeeNode tree model
  const employees: EmployeeNode[] = usersList.map((usr) => ({
    id: usr.uid,
    name: usr.displayName,
    role: usr.jobTitle || (usr.role === "superadmin" ? "CEO" : "Nhân viên"),
    department: usr.department || "Ban Giám Đốc",
    email: usr.email,
    phone: usr.phone || "Chưa cập nhật",
    avatar:
      usr.photoURL && (usr.photoURL.startsWith("http") || usr.photoURL.startsWith("/"))
        ? usr.photoURL
        : `https://ui-avatars.com/api/?name=${encodeURIComponent(usr.displayName)}&background=random&color=fff`,
    level: usr.level || 4,
    parentId: usr.parentId,
    status: usr.status || "offline",
    division: usr.division || "Khối Vận Hành",
  }));

  return (
    <div className="flex flex-col h-full bg-white max-h-[85vh] overflow-hidden" id="hr_tab_wrapper">
      <h1 className="sr-only">Quản lý Nhân sự - {subTab}</h1>

      {/* Sub Tabs switcher navigation bar */}
      <div className="border-b border-gray-200 bg-gray-50/50 p-2 text-xs flex justify-between items-center shrink-0" id="hr_sub_tabs_bar">
        <div className="flex gap-2">
          {["SƠ ĐỒ TỔ CHỨC", "GIAO VIỆC KANBAN", "ĐÀO TẠO", "QUY TRÌNH", "LỊCH"].map((tab) => (
            <button
              key={tab}
              onClick={() => setSubTab(tab as HRSubTabType)}
              className={`px-4 py-2 rounded-lg border font-bold uppercase transition-all tracking-wide cursor-pointer ${subTab === tab
                  ? "bg-slate-800 text-white border-slate-800 shadow-xs"
                  : "bg-white text-gray-500 border-gray-200 hover:bg-gray-100"
                }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4">
          {/* SaaS Multi-tenant Company Filter for Superadmin */}
          {userProfile?.role === "superadmin" && (
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-slate-400" />
              <select
                value={selectedCompanyCode}
                onChange={(e) => setSelectedCompanyCode(e.target.value)}
                className="p-1.5 border border-gray-200 bg-white rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer font-semibold"
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
            isManager={isManager}
            companies={companies}
            courses={courses}
            fetchCourses={fetchCourses}
            loading={loading}
          />
        )}

        {subTab === "GIAO VIỆC KANBAN" && (
          <KanbanTab
            userProfile={userProfile}
            selectedCompanyCode={selectedCompanyCode}
            employees={employees}
            isManager={isManager}
            usersList={usersList}
            onNavigateToWorkflow={(workflowId) => {
              sessionStorage.setItem("targetWorkflowId", workflowId);
              setSubTab("QUY TRÌNH");
            }}
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
            usersList={usersList}
            onNavigateToKanban={(taskId) => {
              sessionStorage.setItem("targetKanbanTaskId", taskId);
              setSubTab("GIAO VIỆC KANBAN");
            }}
          />
        )}

        {subTab === "LỊCH" && (
          <CalendarTab
            userProfile={userProfile}
            selectedCompanyCode={selectedCompanyCode}
            isManager={isManager}
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
