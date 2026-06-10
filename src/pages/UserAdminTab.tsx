import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { authService } from "../services/authService";
import { UserProfile } from "../types";
import { toast } from "./Toast";
import { Users, Shield, RefreshCw, Plus, Building2, Mail, Lock, User, X } from "lucide-react";
import { parseFirebaseError } from "../utils/firebaseErrorParser";
import { rolePermissionService, RolePermission, Permission } from "../services/rolePermissionService";

export default function UserAdminTab() {
  const { userProfile } = useAuth();
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  
  // SaaS States
  const [companies, setCompanies] = useState<any[]>([]);
  const [selectedCompanyCode, setSelectedCompanyCode] = useState<string>("all");

  // Advanced Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  
  // Register Company Modal States
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [companyCode, setCompanyCode] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [submittingCompany, setSubmittingCompany] = useState(false);

  // Register User Modal States
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [userDisplayName, setUserDisplayName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userPassword, setUserPassword] = useState("");
  const [userRole, setUserRole] = useState<string>("user");
  const [userCompanyCode, setUserCompanyCode] = useState<string>("");
  const [userParentId, setUserParentId] = useState<string>("");
  const [userDepartment, setUserDepartment] = useState("");
  const [submittingUser, setSubmittingUser] = useState(false);

  // Sub-tabs State
  const [activeTab, setActiveTab] = useState<"users" | "roles">("users");

  // Role Permission States
  const [rolePermissionsList, setRolePermissionsList] = useState<RolePermission[]>([]);
  const [systemPermissions, setSystemPermissions] = useState<Permission[]>([]);
  const [roleLoading, setRoleLoading] = useState(false);

  // Add / Edit Role Modal States
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RolePermission | null>(null);
  const [roleSlug, setRoleSlug] = useState("");
  const [roleDisplayName, setRoleDisplayName] = useState("");
  const [roleLevel, setRoleLevel] = useState<number>(3);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [submittingRole, setSubmittingRole] = useState(false);

  // Initialize company code when modal opens
  useEffect(() => {
    if (isUserModalOpen) {
      if (userProfile?.role === "admin") {
        setUserCompanyCode(userProfile.companyCode || "");
      } else {
        setUserCompanyCode(selectedCompanyCode === "all" ? "SYSTEM" : selectedCompanyCode);
      }
    }
  }, [isUserModalOpen, userProfile, selectedCompanyCode]);

  // Handle parentId based on userRole and userCompanyCode automatically
  useEffect(() => {
    if (isUserModalOpen) {
      if (userRole === "manager") {
        if (userCompanyCode && userCompanyCode !== "SYSTEM") {
          const companyAdmin = usersList.find(
            (u) => u.companyCode === userCompanyCode && u.role === "admin"
          );
          setUserParentId(companyAdmin?.uid || "");
        } else {
          setUserParentId("");
        }
      } else {
        setUserParentId("");
      }
    }
  }, [userRole, userCompanyCode, usersList, isUserModalOpen]);

  // Auto fill department based on manager (parentId) for user role
  useEffect(() => {
    if (isUserModalOpen && userRole === "user" && userParentId) {
      const selectedManager = usersList.find(u => u.uid === userParentId);
      if (selectedManager && selectedManager.department) {
        setUserDepartment(selectedManager.department);
      }
    } else if (isUserModalOpen && userRole === "user" && !userParentId) {
      setUserDepartment("");
    }
  }, [userRole, userParentId, usersList, isUserModalOpen]);

  // Reset userDepartment when modal is closed
  useEffect(() => {
    if (!isUserModalOpen) {
      setUserDepartment("");
    }
  }, [isUserModalOpen]);

  // Fetch users list from Firestore
  const fetchUsers = async () => {
    setLoading(true);
    try {
      let data: UserProfile[] = [];
      if (userProfile?.role === "superadmin") {
        data = await authService.getAllUsers();
      } else if (userProfile?.companyCode && userProfile?.companyCode !== "SYSTEM") {
        data = await authService.getUsersByCompany(userProfile.companyCode);
      }
      setUsersList(data);
    } catch (error) {
      console.error("Lỗi khi tải danh sách user:", error);
      toast.error("Không thể tải danh sách tài khoản người dùng.");
    } finally {
      setLoading(false);
    }
  };

  // Fetch companies list (Superadmin only)
  const fetchCompanies = async () => {
    if (userProfile?.role !== "superadmin") return;
    try {
      const data = await authService.getAllCompanies();
      setCompanies(data);
    } catch (error) {
      console.error("Lỗi khi tải danh sách doanh nghiệp:", error);
    }
  };

  const fetchRolePermissions = async () => {
    setRoleLoading(true);
    try {
      let code = undefined;
      if (userProfile?.role === "superadmin") {
        code = selectedCompanyCode === "all" ? "SYSTEM" : selectedCompanyCode;
      } else {
        code = userProfile?.companyCode;
      }
      const data = await rolePermissionService.getRolePermissions(code);
      setRolePermissionsList(data);
    } catch (error) {
      console.error("Lỗi khi tải cấu hình vai trò:", error);
    } finally {
      setRoleLoading(false);
    }
  };

  const fetchSystemPermissions = async () => {
    try {
      const data = await rolePermissionService.getPermissions();
      setSystemPermissions(data);
    } catch (error) {
      console.error("Lỗi khi tải mã quyền hệ thống:", error);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchCompanies();
    fetchRolePermissions();
    fetchSystemPermissions();
  }, [userProfile?.uid, userProfile?.role, userProfile?.companyCode, selectedCompanyCode]);

  const getAvailableRoles = () => {
    const defaultRoles = [
      { role: "user", displayName: "USER (Nhân viên)", level: 4 },
      { role: "manager", displayName: "MANAGER (Quản lý)", level: 3 }
    ];
    
    if (userProfile?.role === "superadmin") {
      defaultRoles.push(
        { role: "admin", displayName: "ADMIN (Chủ doanh nghiệp)", level: 2 },
        { role: "superadmin", displayName: "SUPERADMIN (Toàn quyền)", level: 1 }
      );
    } else if (userProfile?.role === "admin") {
      defaultRoles.push(
        { role: "admin", displayName: "ADMIN (Chủ doanh nghiệp)", level: 2 }
      );
    }

    // Merge with custom roles
    const customRoles = rolePermissionsList
      .filter(rp => !["user", "manager", "admin", "superadmin"].includes(rp.role))
      .map(rp => ({
        role: rp.role,
        displayName: `${rp.role.toUpperCase()} (${rp.displayName || rp.role})`,
        level: rp.level
      }));

    const allRoles = [...defaultRoles, ...customRoles];
    const callerLevel = userProfile?.role === "superadmin" ? 1 : 2;

    return allRoles.filter(r => r.level >= callerLevel);
  };

  // Filter visible users:
  // - Superadmin: see all, filter by selectedCompanyCode
  // - Admin: see all users in the same company (except superadmins)
  const visibleUsers = usersList.filter((usr) => {
    // 1. Lọc theo Doanh nghiệp
    if (userProfile?.role === "superadmin") {
      if (selectedCompanyCode !== "all" && usr.companyCode !== selectedCompanyCode) {
        return false;
      }
    } else {
      // Admin only sees users within their company, hiding superadmin accounts
      if (usr.companyCode !== userProfile?.companyCode || usr.role === "superadmin") {
        return false;
      }
    }

    // 2. Lọc theo Tên hoặc Email
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      const matchName = usr.displayName?.toLowerCase().includes(query);
      const matchEmail = usr.email?.toLowerCase().includes(query);
      if (!matchName && !matchEmail) return false;
    }

    // 3. Lọc theo Ngày đăng ký (createdAt)
    if (filterStartDate || filterEndDate) {
      if (!usr.createdAt) return false;
      const userDate = new Date(usr.createdAt);
      userDate.setHours(0, 0, 0, 0);

      if (filterStartDate) {
        const start = new Date(filterStartDate);
        start.setHours(0, 0, 0, 0);
        if (userDate < start) return false;
      }

      if (filterEndDate) {
        const end = new Date(filterEndDate);
        end.setHours(23, 59, 59, 999);
        if (userDate > end) return false;
      }
    }

    return true;
  });

  const handleRoleChange = async (targetUid: string, targetName: string, newRole: "user" | "manager" | "admin" | "superadmin") => {
    if (targetUid === userProfile?.uid) {
      toast.warning("Bạn không thể tự thay đổi vai trò của chính mình!");
      return;
    }

    // Admin không được phép nâng cấp lên admin hoặc superadmin — chỉ superadmin mới được
    if (userProfile?.role === "admin" && (newRole === "admin" || newRole === "superadmin")) {
      toast.error("Chủ doanh nghiệp không có quyền cấp vai trò Admin hoặc Superadmin cho tài khoản khác!");
      return;
    }

    try {
      await authService.updateUserRole(targetUid, newRole);
      toast.success(`Đã cập nhật quyền hạn cho "${targetName}" thành ${newRole.toUpperCase()}!`);
      // Cập nhật lại list ở client
      setUsersList((prev) =>
        prev.map((u) => {
          if (u.uid === targetUid) {
            const dept = newRole === "admin" || newRole === "superadmin" ? "Ban Giám Đốc" : (newRole === "manager" ? "Quản lý" : "Nhân sự");
            const div = newRole === "admin" || newRole === "superadmin" ? "Ban Giám Đốc" : (newRole === "manager" ? "Quản lý" : "Nhân sự");
            const title = newRole === "admin" ? "Chief Executive Officer (CEO)" : (newRole === "manager" ? "Quản lý phòng ban" : "Nhân viên");
            return { ...u, role: newRole, department: dept, division: div, jobTitle: title };
          }
          return u;
        })
      );
    } catch (error) {
      console.error("Lỗi cập nhật quyền:", error);
      toast.error("Lỗi khi cập nhật quyền hạn người dùng.");
    }
  };

  const handleRegisterCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim() || !companyCode.trim() || !ownerName.trim() || !ownerEmail.trim() || !ownerPassword.trim()) {
      toast.warning("Vui lòng điền đầy đủ thông tin doanh nghiệp và chủ sở hữu!");
      return;
    }
    if (companyCode.trim().length < 2) {
      toast.warning("Mã doanh nghiệp phải có ít nhất 2 ký tự!");
      return;
    }
    if (ownerPassword.length < 6) {
      toast.warning("Mật khẩu của chủ sở hữu phải từ 6 ký tự trở lên!");
      return;
    }

    setSubmittingCompany(true);
    try {
      await authService.registerCompanyAndAdmin(
        companyName,
        companyCode,
        ownerName,
        ownerEmail,
        ownerPassword
      );
      toast.success(`Đăng ký doanh nghiệp ${companyName} và tài khoản Admin thành công!`);
      setIsCompanyModalOpen(false);
      // Reset form
      setCompanyName("");
      setCompanyCode("");
      setOwnerName("");
      setOwnerEmail("");
      setOwnerPassword("");
      // Refresh lists
      await fetchUsers();
      await fetchCompanies();
    } catch (error: any) {
      console.error("Lỗi đăng ký doanh nghiệp:", error);
      const errMsg = parseFirebaseError(error, "Không thể đăng ký doanh nghiệp mới.");
      toast.error(errMsg);
    } finally {
      setSubmittingCompany(false);
    }
  };

  const handleRegisterUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userDisplayName.trim() || !userEmail.trim() || !userPassword.trim() || !userCompanyCode) {
      toast.warning("Vui lòng điền đầy đủ thông tin người dùng!");
      return;
    }
    if (userPassword.length < 6) {
      toast.warning("Mật khẩu phải từ 6 ký tự trở lên!");
      return;
    }
    if (userProfile?.role === "admin" && userRole === "admin") {
      toast.warning("Chủ doanh nghiệp không được phép tạo tài khoản có vai trò Admin!");
      return;
    }

    setSubmittingUser(true);
    try {
      let compName = "";
      if (userCompanyCode === "SYSTEM") {
        compName = "Hệ thống";
      } else {
        const found = companies.find(c => c.code === userCompanyCode);
        compName = found ? found.name : userCompanyCode;
      }

      // Tìm level của người quản lý để tính level nhân viên mới
      const managerProfile = userParentId ? usersList.find(u => u.uid === userParentId) : null;
      await authService.registerUserForCompany(
        userDisplayName,
        userEmail,
        userPassword,
        userRole,
        userCompanyCode,
        compName,
        userParentId || undefined,
        managerProfile?.level,
        userDepartment.trim() || undefined,
        userDepartment.trim() || undefined
      );

      toast.success(`Đăng ký tài khoản cho "${userDisplayName}" thành công!`);
      setIsUserModalOpen(false);
      // Reset form
      setUserDisplayName("");
      setUserEmail("");
      setUserPassword("");
      setUserRole("user");
      setUserParentId("");
      setUserDepartment("");
      // Refresh lists
      await fetchUsers();
    } catch (error: any) {
      console.error("Lỗi đăng ký người dùng:", error);
      const errMsg = parseFirebaseError(error, "Không thể đăng ký người dùng mới.");
      toast.error(errMsg);
    } finally {
      setSubmittingUser(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white max-h-[85vh] overflow-hidden" id="user_admin_tab_wrapper">
      
      {/* Header section */}
      <div className="border-b border-gray-200 bg-gray-50/50 p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-4 shrink-0" id="user_admin_header">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-50 rounded-xl border border-indigo-150">
            <Users className="h-5 w-5 text-indigo-650" />
          </div>
          <div>
            <h4 className="font-bold text-slate-800 text-sm font-sans tracking-tight uppercase">
              Quản trị Tài khoản & Phân quyền
            </h4>
            <p className="text-xs text-gray-500 mt-0.5">
              {userProfile?.role === "superadmin"
                ? "Quản trị toàn bộ hệ thống SaaS Multi-tenant và các tài khoản doanh nghiệp."
                : `Quản lý và cấp quyền hạn cho tất cả thành viên trong công ty ${userProfile?.companyName || ""}.`}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {userProfile?.role === "superadmin" && (
            <>
              {/* Dropdown lọc Doanh nghiệp */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider font-mono">Doanh nghiệp:</span>
                <select
                  value={selectedCompanyCode}
                  onChange={(e) => setSelectedCompanyCode(e.target.value)}
                  className="p-1.5 border border-gray-200 bg-white rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                >
                  <option value="all">Tất cả Doanh nghiệp</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.code}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Nút Đăng ký Doanh nghiệp mới */}
              <button
                onClick={() => setIsCompanyModalOpen(true)}
                className="p-2 px-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold font-sans flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95"
              >
                <Plus className="h-3.5 w-3.5" />
                Đăng ký Doanh nghiệp
              </button>
            </>
          )}

          {/* Add User button */}
          {(userProfile?.role === "superadmin" || userProfile?.role === "admin") && (
            <button
              onClick={() => setIsUserModalOpen(true)}
              className="p-2 px-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold font-sans flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95"
            >
              <Plus className="h-3.5 w-3.5" />
              Thêm Người dùng
            </button>
          )}

          <button 
            onClick={fetchUsers}
            disabled={loading}
            className="p-2 px-3.5 bg-white hover:bg-slate-100 border border-gray-205 rounded-xl text-xs font-bold font-sans flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Tải lại danh sách
          </button>
        </div>
      </div>

      {/* Sub-tab selection */}
      <div className="border-b border-gray-200 px-6 py-2 bg-slate-50 flex gap-4 shrink-0" id="user_admin_subtabs">
        <button
          onClick={() => setActiveTab("users")}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
            activeTab === "users"
              ? "bg-slate-900 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-250"
          }`}
        >
          👤 Danh sách tài khoản
        </button>
        <button
          onClick={() => setActiveTab("roles")}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
            activeTab === "roles"
              ? "bg-slate-900 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-250"
          }`}
        >
          🛡️ Vai trò & Phân quyền
        </button>
      </div>

      {activeTab === "users" ? (
        <>
          {/* Filter Bar */}
          <div className="bg-white border-b border-gray-200 px-6 py-3.5 flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center shrink-0">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              {/* Lọc theo Tên/Email */}
              <div className="relative min-w-[240px] flex-1 max-w-sm">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  🔍
                </span>
                <input
                  type="text"
                  placeholder="Tìm theo tên hoặc email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-1.5 border border-gray-200 bg-gray-50/50 hover:bg-white focus:bg-white rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-650 text-[10px] font-bold"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Lọc theo Ngày đăng ký */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-400 font-bold uppercase text-[9px] tracking-wider font-mono">Từ ngày:</span>
                <input
                  type="date"
                  value={filterStartDate}
                  onChange={(e) => setFilterStartDate(e.target.value)}
                  className="p-1.5 border border-gray-200 bg-gray-50/50 hover:bg-white focus:bg-white rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-semibold cursor-pointer"
                />
                
                <span className="text-gray-400 font-bold uppercase text-[9px] tracking-wider font-mono">Đến ngày:</span>
                <input
                  type="date"
                  value={filterEndDate}
                  onChange={(e) => setFilterEndDate(e.target.value)}
                  className="p-1.5 border border-gray-200 bg-gray-50/50 hover:bg-white focus:bg-white rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-semibold cursor-pointer"
                />
              </div>

              {/* Hiển thị số lượng kết quả */}
              <div className="text-[10px] text-gray-400 font-semibold font-mono">
                Kết quả: {visibleUsers.length} / {usersList.length}
              </div>
            </div>

            {/* Nút Clear Filters */}
            {(searchQuery || filterStartDate || filterEndDate) && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setFilterStartDate("");
                  setFilterEndDate("");
                }}
                className="px-3.5 py-1.5 border border-dashed border-red-200 hover:border-red-400 bg-red-50/30 hover:bg-red-50 text-red-650 hover:text-red-700 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shrink-0 active:scale-95"
              >
                ✕ Xóa bộ lọc
              </button>
            )}
          </div>

          {/* Main List Area */}
          <div className="flex-1 p-6 overflow-y-auto" id="user_admin_content">
            {loading ? (
              <div className="h-48 flex flex-col items-center justify-center text-center">
                <RefreshCw className="h-8 w-8 text-indigo-650 animate-spin mb-3" />
                <span className="text-xs font-bold font-mono text-indigo-800 uppercase tracking-widest">Đang tải danh sách tài khoản...</span>
              </div>
            ) : visibleUsers.length === 0 ? (
              <div className="p-12 text-center bg-gray-50 text-gray-400 italic rounded-2xl border border-dashed">
                Không tìm thấy tài khoản nào trong hệ thống!
              </div>
            ) : (
              <div className="bg-white border border-gray-150 rounded-2xl overflow-hidden shadow-xs">
                <table className="w-full text-left border-collapse text-xs font-sans">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-150 text-[10px] font-bold text-gray-400 font-mono uppercase tracking-wider">
                      <th className="p-4 pl-6">Thành viên</th>
                      <th className="p-4">Địa chỉ Email</th>
                      {userProfile?.role === "superadmin" && <th className="p-4">Doanh nghiệp</th>}
                      <th className="p-4">Ngày đăng ký</th>
                      <th className="p-4">Quyền hạn (Role)</th>
                      <th className="p-4 pr-6 text-center">Hành động cấp quyền</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-slate-700">
                    {visibleUsers.map((usr) => {
                      const isSelf = usr.uid === userProfile?.uid;
                      return (
                        <tr key={usr.uid} className="hover:bg-slate-50/40 transition-colors">
                          {/* Name / Avatar */}
                          <td className="p-4 pl-6 flex items-center gap-3">
                            {usr.photoURL && (usr.photoURL.startsWith("http") || usr.photoURL.startsWith("/")) ? (
                              <img 
                                src={usr.photoURL} 
                                alt={usr.displayName} 
                                className="w-8 h-8 rounded-full object-cover border border-gray-200" 
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center font-bold text-indigo-700 text-xs">
                                {(usr.displayName || usr.email || "US").slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                                {usr.displayName}
                                {isSelf && (
                                  <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-150 rounded-sm text-[8px] font-bold font-mono">
                                    BẠN
                                  </span>
                                )}
                              </span>
                              <span className="text-[10px] text-gray-400 font-mono block mt-0.5">UID: {usr.uid.slice(0, 8)}...</span>
                            </div>
                          </td>

                          {/* Email */}
                          <td className="p-4 font-mono">{usr.email}</td>

                          {/* Company Name / Code (SaaS only) */}
                          {userProfile?.role === "superadmin" && (
                            <td className="p-4 font-semibold text-slate-700">
                              {usr.companyName ? (
                                <span title={usr.companyCode}>{usr.companyName}</span>
                              ) : (
                                <span className="text-gray-400 italic">Hệ thống ({usr.companyCode || "SYSTEM"})</span>
                              )}
                            </td>
                          )}

                          {/* Created At */}
                          <td className="p-4 text-gray-400 font-mono">
                            {usr.createdAt instanceof Date ? usr.createdAt.toLocaleDateString("vi-VN") : "Hôm nay"}
                          </td>

                          {/* Current Role Badge */}
                          <td className="p-4">
                            <span className={`px-2.5 py-0.75 rounded-full font-bold font-mono text-[9px] uppercase tracking-wider flex items-center gap-1.5 w-max ${
                              usr.role === "superadmin"
                                ? "bg-rose-50 border border-rose-200 text-rose-800"
                                : usr.role === "admin"
                                  ? "bg-amber-50 border border-amber-200 text-amber-800"
                                  : usr.role === "manager"
                                    ? "bg-blue-50 border border-blue-200 text-blue-800"
                                    : usr.role === "user"
                                      ? "bg-slate-50 border border-slate-200 text-slate-600"
                                      : "bg-indigo-50 border border-indigo-200 text-indigo-700"
                            }`}>
                              <Shield className="h-3 w-3" />
                              {usr.role === "superadmin"
                                ? "superadmin"
                                : usr.role === "admin"
                                  ? "admin"
                                  : usr.role === "manager"
                                    ? "manager"
                                    : usr.role === "user"
                                      ? "user"
                                      : (rolePermissionsList.find(rp => rp.role === usr.role)?.displayName || usr.role)}
                            </span>
                          </td>

                          {/* Role Modify Selector */}
                          <td className="p-4 pr-6">
                            <div className="flex justify-center">
                              <select
                                disabled={
                                  isSelf ||
                                  usr.role === "superadmin" ||
                                  (usr.role === "admin" && userProfile?.role === "admin")
                                }
                                value={usr.role}
                                onChange={(e) => handleRoleChange(usr.uid, usr.displayName, e.target.value)}
                                className={`p-1.5 px-2.5 border border-gray-200 rounded-lg text-xs font-medium outline-none bg-white focus:ring-1 focus:ring-indigo-500 cursor-pointer ${
                                  isSelf ||
                                  usr.role === "superadmin" ||
                                  (usr.role === "admin" && userProfile?.role === "admin")
                                    ? "opacity-50 cursor-not-allowed bg-gray-50"
                                    : ""
                                }`}
                              >
                                {(() => {
                                  const rolesForSelect = [...getAvailableRoles()];
                                  if (!rolesForSelect.some(r => r.role === usr.role)) {
                                    rolesForSelect.push({
                                      role: usr.role,
                                      displayName: usr.role.toUpperCase(),
                                      level: 99
                                    });
                                  }
                                  return rolesForSelect.map(r => (
                                    <option key={r.role} value={r.role}>
                                      {r.displayName}
                                    </option>
                                  ));
                                })()}
                              </select>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="flex-1 p-6 overflow-y-auto space-y-6" id="roles_permissions_tab_content">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center bg-gray-50 p-4 rounded-2xl border border-gray-150 gap-4">
            <div>
              <h5 className="font-bold text-slate-800 text-sm">Danh sách vai trò & Cấu hình phân quyền</h5>
              <p className="text-xs text-gray-500 mt-0.5">Tạo vai trò tùy chỉnh và thiết lập danh sách quyền tương ứng cho nhân sự.</p>
            </div>
            <button
              onClick={() => {
                setEditingRole(null);
                setRoleSlug("");
                setRoleDisplayName("");
                setRoleLevel(3);
                setSelectedPermissions([]);
                setIsRoleModalOpen(true);
              }}
              className="p-2 px-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold font-sans flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95 text-center justify-center"
            >
              <Plus className="h-3.5 w-3.5" />
              Thêm vai trò tùy chỉnh
            </button>
          </div>

          {roleLoading ? (
            <div className="h-48 flex flex-col items-center justify-center text-center">
              <RefreshCw className="h-8 w-8 text-indigo-650 animate-spin mb-3" />
              <span className="text-xs font-bold font-mono text-indigo-800 uppercase tracking-widest">Đang tải danh sách vai trò...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Render Default roles and Custom roles */}
              {(() => {
                const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
                  admin: ["*"],
                  manager: [
                    "user:read", "user:manage",
                    "crm:read", "crm:manage",
                    "kanban:read", "kanban:manage",
                    "project:read", "project:manage",
                    "stock:read",
                    "marketing:post"
                  ],
                  user: [
                    "user:read",
                    "crm:read",
                    "kanban:read", "kanban:manage",
                    "project:read",
                    "stock:read",
                    "marketing:post"
                  ]
                };

                const defaultRolesList = [
                  { role: "admin", displayName: "ADMIN (Chủ doanh nghiệp)", level: 2, isDefault: true, permissions: DEFAULT_ROLE_PERMISSIONS.admin },
                  { role: "manager", displayName: "MANAGER (Quản lý)", level: 3, isDefault: true, permissions: DEFAULT_ROLE_PERMISSIONS.manager },
                  { role: "user", displayName: "USER (Nhân viên)", level: 4, isDefault: true, permissions: DEFAULT_ROLE_PERMISSIONS.user }
                ];
                
                const customRolesList = rolePermissionsList.filter(rp => !["superadmin", "admin", "manager", "user"].includes(rp.role));
                
                const rolesToDisplay = [
                  ...defaultRolesList.map(dr => {
                    const dbRecord = rolePermissionsList.find(rp => rp.role === dr.role);
                    return {
                      ...dr,
                      permissions: dbRecord ? dbRecord.permissions : (DEFAULT_ROLE_PERMISSIONS[dr.role] || []),
                      displayName: dbRecord?.displayName || dr.displayName,
                      level: dbRecord?.level || dr.level,
                      _id: dbRecord?._id
                    };
                  }),
                  ...customRolesList.map(cr => ({
                    role: cr.role,
                    displayName: cr.displayName || cr.role.toUpperCase(),
                    level: cr.level,
                    permissions: cr.permissions,
                    isDefault: false,
                    _id: cr._id
                  }))
                ];

                return rolesToDisplay.map((roleInfo) => {
                  return (
                    <div key={roleInfo.role} className="bg-white border border-gray-150 hover:border-indigo-200 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between gap-4">
                      <div className="space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded text-[9px] font-bold font-mono tracking-wider">
                              LEVEL {userProfile?.role === "superadmin" ? roleInfo.level : roleInfo.level - 1}
                            </span>
                            <h6 className="font-bold text-slate-800 text-sm mt-1">{roleInfo.displayName}</h6>
                            <span className="text-[10px] text-gray-400 font-mono block">Mã: {roleInfo.role}</span>
                          </div>
                          {roleInfo.isDefault && (
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-150 rounded-sm text-[8px] font-bold font-mono">
                              MẶC ĐỊNH
                            </span>
                          )}
                        </div>

                        {/* Permissions display */}
                        <div className="space-y-1 text-left">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Mã quyền cấp phép:</span>
                          <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-1">
                            {roleInfo.permissions.length === 0 ? (
                              <span className="text-[10px] text-gray-450 italic">Chưa cấu hình quyền nào</span>
                            ) : roleInfo.permissions.includes("*") ? (
                              <span className="px-1.5 py-0.5 bg-rose-50 text-rose-700 border border-rose-150 rounded text-[9px] font-semibold font-mono">
                                * (Tất cả quyền)
                              </span>
                            ) : (
                              roleInfo.permissions.map(p => (
                                <span key={p} className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-150 rounded text-[9px] font-semibold font-mono" title={systemPermissions.find(sp => sp.code === p)?.name || p}>
                                  {p}
                                </span>
                              ))
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="border-t border-gray-100 pt-3 flex justify-end gap-2 mt-auto">
                        {roleInfo.role !== "admin" && (
                          <button
                            onClick={() => {
                              setEditingRole(roleInfo as any);
                              setRoleSlug(roleInfo.role);
                              setRoleDisplayName(roleInfo.displayName);
                              setRoleLevel(roleInfo.level);
                              setSelectedPermissions(roleInfo.permissions);
                              setIsRoleModalOpen(true);
                            }}
                            className="p-1.5 px-3 bg-white hover:bg-slate-100 border border-gray-205 rounded-xl text-[10px] font-bold text-slate-700 cursor-pointer transition-all active:scale-95 flex items-center gap-1"
                          >
                            ⚙️ Thiết lập quyền
                          </button>
                        )}
                        {!roleInfo.isDefault && (
                          <button
                            onClick={async () => {
                              if (window.confirm(`Bạn có chắc chắn muốn xóa vai trò "${roleInfo.displayName}"? Hành động này sẽ gỡ bỏ phân quyền vai trò.`)) {
                                try {
                                  let code = undefined;
                                  if (userProfile?.role === "superadmin") {
                                    code = selectedCompanyCode === "all" ? "SYSTEM" : selectedCompanyCode;
                                  } else {
                                    code = userProfile?.companyCode;
                                  }
                                  await rolePermissionService.deleteRolePermission(roleInfo.role, code);
                                  toast.success("Xóa cấu hình vai trò thành công!");
                                  await fetchRolePermissions();
                                } catch (error: any) {
                                  console.error(error);
                                  toast.error(error.message || "Xóa vai trò thất bại.");
                                }
                              }
                            }}
                            className="p-1.5 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl text-[10px] font-bold text-red-650 cursor-pointer transition-all active:scale-95"
                            title="Xóa vai trò"
                          >
                            🗑️ Xóa
                          </button>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </div>
      )}

      {/* Modal Đăng ký Doanh nghiệp mới */}
      {isCompanyModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden transform transition-all scale-100">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-6 flex justify-between items-center relative">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-500/20">
                  <Building2 className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-sm uppercase tracking-wider font-sans">Đăng ký Doanh nghiệp Mới</h3>
                  <p className="text-[10px] text-slate-350 font-mono mt-0.5">Khởi tạo môi trường SaaS Multi-tenant</p>
                </div>
              </div>
              <button
                onClick={() => setIsCompanyModalOpen(false)}
                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Content / Form */}
            <form onSubmit={handleRegisterCompany} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Tên Doanh nghiệp */}
                <div className="space-y-1.5 text-left col-span-2">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Tên doanh nghiệp *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: VNG Corporation"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  />
                </div>

                {/* Mã Doanh nghiệp */}
                <div className="space-y-1.5 text-left col-span-2">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Mã doanh nghiệp (Company Code) *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: VNG (viết liền, không dấu, chữ hoa)"
                    value={companyCode}
                    onChange={(e) => setCompanyCode(e.target.value)}
                    className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-mono uppercase"
                  />
                </div>
              </div>

              <div className="border-t border-gray-100 my-4 pt-4 space-y-4">
                <div className="text-left">
                  <span className="text-[10px] font-bold text-indigo-650 uppercase tracking-widest font-mono">Tài khoản Chủ doanh nghiệp (Admin Owner)</span>
                </div>

                {/* Tên chủ sở hữu */}
                <div className="space-y-1.5 text-left">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Tên chủ sở hữu *</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-2.5 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      required
                      placeholder="Ví dụ: Lê Hồng Minh"
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      className="w-full pl-10 pr-3.5 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    />
                  </div>
                </div>

                {/* Email chủ sở hữu */}
                <div className="space-y-1.5 text-left">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Địa chỉ Email *</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-2.5 h-4 w-4 text-gray-400" />
                    <input
                      type="email"
                      required
                      placeholder="owner@vng.com"
                      value={ownerEmail}
                      onChange={(e) => setOwnerEmail(e.target.value)}
                      className="w-full pl-10 pr-3.5 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-mono"
                    />
                  </div>
                </div>

                {/* Mật khẩu */}
                <div className="space-y-1.5 text-left">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Mật khẩu *</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-2.5 h-4 w-4 text-gray-400" />
                    <input
                      type="password"
                      required
                      placeholder="Tối thiểu 6 ký tự"
                      value={ownerPassword}
                      onChange={(e) => setOwnerPassword(e.target.value)}
                      className="w-full pl-10 pr-3.5 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex gap-3 justify-end pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsCompanyModalOpen(false)}
                  className="px-4 py-2 border border-gray-200 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-50 transition-all cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={submittingCompany}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/10 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {submittingCompany ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      Đang xử lý...
                    </>
                  ) : (
                    "Khởi tạo Doanh nghiệp"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Đăng ký Người dùng mới */}
      {isUserModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden transform transition-all scale-100">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-6 flex justify-between items-center relative">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-500/20">
                  <User className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-sm uppercase tracking-wider font-sans">Thêm Người dùng Mới</h3>
                  <p className="text-[10px] text-slate-350 font-mono mt-0.5">Tạo tài khoản và gán doanh nghiệp</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsUserModalOpen(false)}
                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Content / Form */}
            <form onSubmit={handleRegisterUser} className="p-6 space-y-4">
              {/* Tên hiển thị */}
              <div className="space-y-1.5 text-left">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Họ và Tên *</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-2.5 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: Nguyễn Văn A"
                    value={userDisplayName}
                    onChange={(e) => setUserDisplayName(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  />
                </div>
              </div>

              {/* Email */}
              <div className="space-y-1.5 text-left">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Địa chỉ Email *</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-2.5 h-4 w-4 text-gray-400" />
                  <input
                    type="email"
                    required
                    placeholder="name@company.com"
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-mono font-medium"
                  />
                </div>
              </div>

              {/* Mật khẩu */}
              <div className="space-y-1.5 text-left">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Mật khẩu *</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-2.5 h-4 w-4 text-gray-400" />
                  <input
                    type="password"
                    required
                    placeholder="Tối thiểu 6 ký tự"
                    value={userPassword}
                    onChange={(e) => setUserPassword(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Vai trò */}
                <div className="space-y-1.5 text-left">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Quyền hạn (Role) *</label>
                  <select
                    value={userRole}
                    onChange={(e) => setUserRole(e.target.value as any)}
                    className="w-full p-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 bg-white cursor-pointer outline-none"
                  >
                    {getAvailableRoles().map(r => (
                      <option key={r.role} value={r.role}>
                        {r.displayName}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Doanh nghiệp */}
                <div className="space-y-1.5 text-left">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Doanh nghiệp *</label>
                  {userProfile?.role === "superadmin" ? (
                    <select
                      value={userCompanyCode}
                      onChange={(e) => setUserCompanyCode(e.target.value)}
                      className="w-full p-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 bg-white cursor-pointer outline-none"
                    >
                      <option value="SYSTEM">Hệ thống (SYSTEM)</option>
                      {companies.map((c) => (
                        <option key={c.id} value={c.code}>
                          {c.name} ({c.code})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      disabled
                      value={userProfile?.companyName || userProfile?.companyCode || ""}
                      className="w-full px-3.5 py-2 border border-gray-150 bg-gray-50 text-gray-500 rounded-xl text-xs outline-none"
                    />
                  )}
                </div>
              </div>


              {/* Người quản lý trực tiếp */}
              {userCompanyCode && userCompanyCode !== "SYSTEM" && userRole === "user" && (
                <div className="space-y-1.5 text-left">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                    Người quản lý trực tiếp
                    <span className="ml-1.5 font-normal normal-case text-gray-400">(tuỳ chọn — xác định cấp bậc trong sơ đồ nhân sự)</span>
                  </label>
                  {(() => {
                    const eligibleManagers = usersList.filter(
                      (u) => u.companyCode === userCompanyCode && u.role === "manager"
                    );
                    return eligibleManagers.length === 0 ? (
                      <div className="w-full px-3.5 py-2 border border-dashed border-gray-200 rounded-xl text-xs text-gray-400 italic bg-gray-50/60">
                        Chưa có quản lý nào trong công ty này
                      </div>
                    ) : (
                      <div>
                        <select
                          value={userParentId}
                          onChange={(e) => setUserParentId(e.target.value)}
                          className="w-full p-2 pl-3.5 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 bg-white cursor-pointer outline-none"
                        >
                          <option value="">— Không có / Chọn sau —</option>
                          {eligibleManagers.map((mgr) => (
                            <option key={mgr.uid} value={mgr.uid}>
                              {`${mgr.displayName} (Manager${mgr.jobTitle ? " · " + mgr.jobTitle : ""}${mgr.department ? " · " + mgr.department : ""})`}
                            </option>
                          ))}
                        </select>
                        {userParentId && (
                          <div className="mt-1.5 flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 border border-indigo-100 rounded-lg w-max">
                            <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-wider">Cấp bậc nhân viên mới:</span>
                            <span className="text-[10px] font-bold text-indigo-700 font-mono">
                              Level {(() => {
                                const rawL = (usersList.find((u) => u.uid === userParentId)?.level ?? 0) + 1;
                                return userProfile?.role === "superadmin" ? rawL : rawL - 1;
                              })()}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Phòng ban */}
              {(userRole === "user" || userRole === "manager") && (
                <div className="space-y-1.5 text-left">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                    {userRole === "manager" ? "Phòng ban quản lý *" : "Phòng ban *"}
                  </label>
                  <input
                    type="text"
                    required
                    disabled={userRole === "user" && !!userParentId}
                    placeholder="Ví dụ: Phòng Kỹ Thuật"
                    value={userDepartment}
                    onChange={(e) => setUserDepartment(e.target.value)}
                    className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none disabled:bg-gray-50 disabled:text-gray-450"
                  />
                  {userRole === "user" && !!userParentId && (
                    <p className="text-[10px] text-indigo-650 font-mono mt-0.5">
                      Tự động điền theo phòng ban của quản lý trực tiếp.
                    </p>
                  )}
                </div>
              )}
              {/* Form Actions */}
              <div className="flex gap-3 justify-end pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="px-4 py-2 border border-gray-200 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-50 transition-all cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={submittingUser}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/10 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {submittingUser ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      Đang đăng ký...
                    </>
                  ) : (
                    "Lưu người dùng"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Cấu hình Phân quyền Vai trò */}
      {isRoleModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden transform transition-all scale-100 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-6 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-650 rounded-xl">
                  <Shield className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-sm uppercase tracking-wider font-sans">
                    {editingRole ? "Cấu hình vai trò & Phân quyền" : "Tạo vai trò tùy chỉnh mới"}
                  </h3>
                  <p className="text-[10px] text-slate-300 font-mono mt-0.5">
                    {editingRole ? `Vai trò: ${roleSlug}` : "Thiết lập vai trò động cho doanh nghiệp"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRoleModalOpen(false)}
                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!roleSlug.trim() || !roleDisplayName.trim()) {
                  toast.warning("Vui lòng nhập đầy đủ thông tin vai trò!");
                  return;
                }

                setSubmittingRole(true);
                try {
                  let code = undefined;
                  if (userProfile?.role === "superadmin") {
                    code = selectedCompanyCode === "all" ? "SYSTEM" : selectedCompanyCode;
                  } else {
                    code = userProfile?.companyCode;
                  }

                  const payload = {
                    role: roleSlug.toLowerCase().trim(),
                    displayName: roleDisplayName.trim(),
                    level: roleLevel,
                    permissions: selectedPermissions,
                    companyCode: code,
                  };

                  await rolePermissionService.saveRolePermission(payload);
                  toast.success(editingRole ? "Cập nhật vai trò thành công!" : "Tạo vai trò mới thành công!");
                  setIsRoleModalOpen(false);
                  await fetchRolePermissions();
                } catch (error: any) {
                  console.error(error);
                  toast.error(error.message || "Không thể cập nhật cấu hình vai trò.");
                } finally {
                  setSubmittingRole(false);
                }
              }}
              className="flex flex-col flex-1 overflow-hidden"
            >
              <div className="p-6 space-y-4 overflow-y-auto flex-1 text-left">
                <div className="grid grid-cols-2 gap-4">
                  {/* Mã vai trò */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Mã vai trò (slug) *</label>
                    <input
                      type="text"
                      required
                      disabled={!!editingRole}
                      placeholder="Ví dụ: hr_lead (viết thường, không dấu)"
                      value={roleSlug}
                      onChange={(e) => setRoleSlug(e.target.value)}
                      className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-mono disabled:bg-gray-100 disabled:text-gray-400"
                    />
                  </div>

                  {/* Tên hiển thị */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Tên hiển thị (Tiếng Việt) *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ví dụ: Trưởng phòng nhân sự"
                      value={roleDisplayName}
                      onChange={(e) => setRoleDisplayName(e.target.value)}
                      className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    />
                  </div>
                </div>

                {/* Level vai trò */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block flex items-center gap-1">
                    Cấp bậc vai trò (Level) *
                    <span className="text-[9px] font-normal normal-case text-gray-400">
                      {userProfile?.role === "superadmin"
                        ? "(2 = cao nhất, 10 = thấp nhất. Superadmin mặc định level 1)"
                        : "(1 = cao nhất, 9 = thấp nhất)"}
                    </span>
                  </label>
                  <select
                    value={roleLevel}
                    onChange={(e) => setRoleLevel(parseInt(e.target.value, 10))}
                    disabled={editingRole?.role === "admin" || editingRole?.role === "superadmin"}
                    className="w-full p-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 bg-white cursor-pointer outline-none disabled:bg-gray-150 disabled:cursor-not-allowed"
                  >
                    {(() => {
                      const minLevel = userProfile?.role === "superadmin" ? 1 : 3;
                      const levels = [];
                      for (let i = minLevel; i <= 10; i++) {
                        levels.push(i);
                      }
                      return levels.map(l => {
                        const displayL = userProfile?.role === "superadmin" ? l : l - 1;
                        return (
                          <option key={l} value={l}>
                            Cấp độ {displayL}
                          </option>
                        );
                      });
                    })()}
                  </select>
                </div>

                {/* Danh sách mã quyền gán */}
                <div className="space-y-2 border-t border-gray-100 pt-3">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Thiết lập các mã quyền được phép truy cập *</label>
                  
                  {editingRole?.role === "superadmin" ? (
                    <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-xs text-rose-700 font-mono italic">
                      Vai trò Superadmin tự động có tất cả quyền trong hệ thống (*) và không thể sửa đổi quyền.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto p-1 pr-2">
                      {systemPermissions.map((perm) => {
                        const isChecked = selectedPermissions.includes(perm.code) || selectedPermissions.includes("*");
                        return (
                          <div
                            key={perm.code}
                            onClick={() => {
                              if (selectedPermissions.includes("*")) return; // Super permissions overrides all
                              setSelectedPermissions((prev) => {
                                if (prev.includes(perm.code)) {
                                  return prev.filter((p) => p !== perm.code);
                                } else {
                                  return [...prev, perm.code];
                                }
                              });
                            }}
                            className={`flex items-start gap-2.5 p-2.5 border rounded-xl cursor-pointer transition-all select-none hover:border-indigo-300 ${
                              isChecked
                                ? "bg-indigo-50/50 border-indigo-200"
                                : "bg-white border-gray-150"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              disabled={selectedPermissions.includes("*")}
                              readOnly
                              className="mt-0.5 cursor-pointer accent-indigo-650"
                            />
                            <div>
                              <span className="text-xs font-bold text-slate-800 block leading-tight">{perm.name}</span>
                              <span className="text-[9px] text-indigo-600 font-mono leading-none block mt-0.5">{perm.code}</span>
                              {perm.description && (
                                <span className="text-[9px] text-gray-400 mt-1 block leading-normal">{perm.description}</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex gap-3 justify-end p-6 border-t border-gray-100 shrink-0 bg-gray-50/50">
                <button
                  type="button"
                  onClick={() => setIsRoleModalOpen(false)}
                  className="px-4 py-2 border border-gray-200 bg-white rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-50 transition-all cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={submittingRole || editingRole?.role === "superadmin"}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/10 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {submittingRole ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      Đang cập nhật...
                    </>
                  ) : (
                    "Lưu cấu hình"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
