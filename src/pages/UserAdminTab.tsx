import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { authService } from "../services/authService";
import { UserProfile } from "../types";
import { toast } from "./Toast";
import { Users, Shield, RefreshCw, Plus, Building2, Mail, Lock, User, X, SlidersHorizontal, Wallet } from "lucide-react";
import { parseFirebaseError } from "../utils/firebaseErrorParser";
import { rolePermissionService, RolePermission, Permission } from "../services/rolePermissionService";
import { AdminTransactionInfo, AdminUserBalance, walletService } from "../services/walletService";

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
  const [userPage, setUserPage] = useState(1);
  const USERS_PER_PAGE = 8;
  
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
  const [userHeyGenAvatarIds, setUserHeyGenAvatarIds] = useState("");
  const [userHeyGenVoiceId, setUserHeyGenVoiceId] = useState("");
  const [userHeyGenApiKey, setUserHeyGenApiKey] = useState("");
  const [submittingUser, setSubmittingUser] = useState(false);
  const [isHeyGenModalOpen, setIsHeyGenModalOpen] = useState(false);
  const [editingHeyGenUser, setEditingHeyGenUser] = useState<UserProfile | null>(null);
  const [editingHeyGenAvatarIds, setEditingHeyGenAvatarIds] = useState("");
  const [editingHeyGenVoiceId, setEditingHeyGenVoiceId] = useState("");
  const [editingHeyGenApiKey, setEditingHeyGenApiKey] = useState("");
  const [savingHeyGenAccess, setSavingHeyGenAccess] = useState(false);

  const parseAvatarIdsInput = (value: string) =>
    value
      .split(/[\n,]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  const formatAvatarIds = (user?: UserProfile | null) =>
    Array.isArray(user?.heygenAccess?.avatarIds) && user?.heygenAccess?.avatarIds.length > 0
      ? user.heygenAccess.avatarIds.join(", ")
      : (user?.heygenAccess?.avatarId || "-");

  // Sub-tabs State
  const [activeTab, setActiveTab] = useState<"users" | "roles" | "balance">("users");
  const [balanceUsers, setBalanceUsers] = useState<AdminUserBalance[]>([]);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [isBalanceModalOpen, setIsBalanceModalOpen] = useState(false);
  const [editingBalanceUser, setEditingBalanceUser] = useState<AdminUserBalance | null>(null);
  const [balanceAction, setBalanceAction] = useState<"add" | "subtract">("add");
  const [newBalanceValue, setNewBalanceValue] = useState("");
  const [balanceNote, setBalanceNote] = useState("");
  const [submittingBalance, setSubmittingBalance] = useState(false);
  const [selectedBalanceUserId, setSelectedBalanceUserId] = useState<string>("");
  const [balanceTransactions, setBalanceTransactions] = useState<AdminTransactionInfo[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);

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

  const fetchAdminBalances = async () => {
    if (userProfile?.role !== "superadmin") return;

    setBalanceLoading(true);
    try {
      const companyFilter = selectedCompanyCode === "all" ? undefined : selectedCompanyCode;
      const data = await walletService.getAdminBalances(companyFilter);
      setBalanceUsers(data);
      setSelectedBalanceUserId((prev) => {
        if (!data.length) return "";
        return data.some((item) => item.userId === prev) ? prev : data[0].userId;
      });
    } catch (error) {
      console.error("Lỗi khi tải danh sách số dư:", error);
      toast.error("Không thể tải danh sách số dư người dùng.");
    } finally {
      setBalanceLoading(false);
    }
  };

  const fetchAdminTransactions = async (targetUserId: string) => {
    if (!targetUserId) {
      setBalanceTransactions([]);
      return;
    }

    setTransactionsLoading(true);
    try {
      const data = await walletService.getAdminUserTransactions(targetUserId, 20);
      setBalanceTransactions(data);
    } catch (error) {
      console.error("Lỗi khi tải lịch sử giao dịch:", error);
      toast.error("Không thể tải lịch sử giao dịch của người dùng.");
    } finally {
      setTransactionsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchCompanies();
    fetchRolePermissions();
    fetchSystemPermissions();
    fetchAdminBalances();
  }, [userProfile?.uid, userProfile?.role, userProfile?.companyCode, selectedCompanyCode]);

  useEffect(() => {
    if (activeTab === "balance" && selectedBalanceUserId) {
      fetchAdminTransactions(selectedBalanceUserId);
    }
  }, [activeTab, selectedBalanceUserId]);

  useEffect(() => {
    setUserPage(1);
  }, [searchQuery, filterStartDate, filterEndDate, selectedCompanyCode, userProfile?.role]);

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

  const balanceByUserId = balanceUsers.reduce<Record<string, AdminUserBalance>>((acc, item) => {
    acc[item.userId] = item;
    return acc;
  }, {});

  const totalUserPages = Math.max(1, Math.ceil(visibleUsers.length / USERS_PER_PAGE));
  const safeUserPage = Math.min(userPage, totalUserPages);
  const paginatedVisibleUsers = visibleUsers.slice(
    (safeUserPage - 1) * USERS_PER_PAGE,
    safeUserPage * USERS_PER_PAGE
  );

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
        userDepartment.trim() || undefined,
        undefined,
        {
          avatarIds: parseAvatarIdsInput(userHeyGenAvatarIds),
          avatarId: parseAvatarIdsInput(userHeyGenAvatarIds)[0] || undefined,
          voiceId: userHeyGenVoiceId.trim() || undefined,
          apiKey: userHeyGenApiKey.trim() || undefined,
        }
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
      setUserHeyGenAvatarIds("");
      setUserHeyGenVoiceId("");
      setUserHeyGenApiKey("");
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

  const openBalanceEditor = (targetUser: AdminUserBalance, action: "add" | "subtract" = "add") => {
    setEditingBalanceUser(targetUser);
    setBalanceAction(action);
    setNewBalanceValue("");
    setBalanceNote("");
    setIsBalanceModalOpen(true);
  };

  const handleSaveBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBalanceUser) return;

    const parsedAmount = Number(newBalanceValue);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.warning("So tien dieu chinh phai lon hon 0.");
      return;
    }

    const currentBalance = Number(editingBalanceUser.balance ?? 0);
    const nextBalance =
      balanceAction === "add"
        ? currentBalance + parsedAmount
        : currentBalance - parsedAmount;

    if (nextBalance < 0) {
      toast.warning("Không thể trừ vượt quá số dư hiện tại.");
      return;
    }

    setSubmittingBalance(true);
    try {
      const updated = await walletService.updateUserBalance(
        editingBalanceUser.userId,
        Number(nextBalance.toFixed(2)),
        balanceNote.trim() ||
          `${balanceAction === "add" ? "Cộng" : "Trừ"} ${parsedAmount.toFixed(2)} Credit từ màn hình quản lý user`
      );

      setBalanceUsers((prev) =>
        prev.map((item) =>
          item.userId === updated.userId
            ? { ...item, ...updated }
            : item
        )
      );
      if (selectedBalanceUserId === updated.userId) {
        await fetchAdminTransactions(updated.userId);
      }

      toast.success(
        `${balanceAction === "add" ? "Đã cộng" : "Đã trừ"} ${parsedAmount.toFixed(2)} Credit cho "${updated.displayName}".`
      );
      setIsBalanceModalOpen(false);
      setEditingBalanceUser(null);
      setBalanceNote("");
      setNewBalanceValue("");
    } catch (error: any) {
      console.error("Lỗi cập nhật số dư:", error);
      toast.error(error.message || "Không thể cập nhật số dư người dùng.");
    } finally {
      setSubmittingBalance(false);
    }
  };

  const closeBalanceModal = () => {
    setIsBalanceModalOpen(false);
    setEditingBalanceUser(null);
    setBalanceAction("add");
    setNewBalanceValue("");
    setBalanceNote("");
  };

  const openHeyGenEditor = (user: UserProfile) => {
    setEditingHeyGenUser(user);
    setEditingHeyGenAvatarIds(
      Array.isArray(user.heygenAccess?.avatarIds) && user.heygenAccess?.avatarIds.length > 0
        ? user.heygenAccess.avatarIds.join(", ")
        : (user.heygenAccess?.avatarId || "")
    );
    setEditingHeyGenVoiceId(user.heygenAccess?.voiceId || "");
    setEditingHeyGenApiKey(user.heygenAccess?.apiKey || "");
    setIsHeyGenModalOpen(true);
  };

  const handleSaveHeyGenAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHeyGenUser) {
      return;
    }

    setSavingHeyGenAccess(true);
    try {
      const avatarIds = parseAvatarIdsInput(editingHeyGenAvatarIds);
      await authService.updateUser(editingHeyGenUser.uid, {
        heygenAccess: {
          avatarIds,
          avatarId: avatarIds[0] || "",
          voiceId: editingHeyGenVoiceId.trim(),
          apiKey: editingHeyGenApiKey.trim(),
        },
      });

      setUsersList((prev) =>
        prev.map((user) =>
          user.uid === editingHeyGenUser.uid
            ? {
                ...user,
                heygenAccess: {
                  avatarIds,
                  avatarId: avatarIds[0] || "",
                  voiceId: editingHeyGenVoiceId.trim(),
                  apiKey: editingHeyGenApiKey.trim(),
                },
              }
            : user
        )
      );

      toast.success(`Đã cập nhật cấu hình HeyGen cho "${editingHeyGenUser.displayName}".`);
      setIsHeyGenModalOpen(false);
      setEditingHeyGenUser(null);
    } catch (error: any) {
      console.error("Lỗi cập nhật HeyGen access:", error);
      toast.error(error.message || "Không thể cập nhật cấu hình HeyGen cho người dùng này.");
    } finally {
      setSavingHeyGenAccess(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white max-h-[85vh] overflow-hidden" id="user_admin_tab_wrapper">
      <h1 className="sr-only">Quản trị Hệ thống & Phân quyền - {activeTab}</h1>
      
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
                    <option key={c.id || c._id || c.code} value={c.code}>
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
        {userProfile?.role === "superadmin" && (
          <button
            onClick={() => setActiveTab("balance")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === "balance"
                ? "bg-slate-900 text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-250"
            }`}
          >
            <Wallet className="h-3.5 w-3.5" />
            Số dư người dùng
          </button>
        )}
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
              <div className="bg-white border border-gray-150 rounded-2xl overflow-hidden shadow-xs max-w-full">
                <div className="max-w-full overflow-x-auto overscroll-x-contain">
                <table className="w-full min-w-[1180px] text-left border-collapse text-xs font-sans">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-150 text-[10px] font-bold text-gray-400 font-mono uppercase tracking-wider">
                      <th className="p-4 pl-6">Thành viên</th>
                      <th className="p-4">Địa chỉ Email</th>
                      {userProfile?.role === "superadmin" && <th className="p-4">Doanh nghiệp</th>}
                      <th className="p-4">Ngày đăng ký</th>
                      <th className="p-4">Quyền hạn (Role)</th>
                      {userProfile?.role === "superadmin" && <th className="p-4">Số dư</th>}
                      <th className="p-4">HeyGen</th>
                      <th className="p-4 pr-6 text-center">Hành động cấp quyền</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-slate-700">
                    {paginatedVisibleUsers.map((usr) => {
                      const isSelf = usr.uid === userProfile?.uid;
                      const userBalance = balanceByUserId[usr.uid];
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

                          {userProfile?.role === "superadmin" && (
                            <td className="p-4 min-w-[170px]">
                              <div className="flex items-center gap-2 whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedBalanceUserId(usr.uid);
                                    setActiveTab("balance");
                                  }}
                                  className="inline-flex items-center gap-2 rounded-full border border-sky-100 bg-sky-50 px-3 py-1.5 text-sky-900 transition hover:bg-sky-100"
                                >
                                  <Wallet className="h-3.5 w-3.5 text-sky-600" />
                                  <span className="text-xs font-bold">{new Intl.NumberFormat("vi-VN", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(userBalance?.balance || 0)} Credit</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    openBalanceEditor(
                                      userBalance || {
                                        userId: usr.uid,
                                        displayName: usr.displayName,
                                        email: usr.email,
                                        role: usr.role,
                                        companyCode: usr.companyCode || "",
                                        companyName: usr.companyName || "",
                                        balance: 0,
                                        currency: "Credit",
                                      },
                                      "add"
                                    )
                                  }
                                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-bold text-slate-700 transition hover:bg-slate-50"
                                >
                                  Sửa
                                </button>
                              </div>
                            </td>
                          )}

                          <td className="p-4">
                            <div className="space-y-1">
                              <p className="text-[10px] text-slate-600">
                                Avatar(s): <span className="font-mono">{formatAvatarIds(usr)}</span>
                              </p>
                              <p className="text-[10px] text-slate-600">
                                Giọng đọc: <span className="font-mono">{usr.heygenAccess?.voiceId || "-"}</span>
                              </p>
                              <p className="text-[10px] text-slate-400">
                                {usr.heygenAccess?.apiKey ? "Có khóa API riêng" : "Dùng khóa API hệ thống"}
                              </p>
                            </div>
                          </td>

                          {/* Role Modify Selector */}
                          <td className="p-4 pr-6">
                            <div className="flex justify-center gap-2">
                              {userProfile?.role === "superadmin" && (
                                <button
                                  type="button"
                                  onClick={() => openHeyGenEditor(usr)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-cyan-200 bg-cyan-50 px-2.5 py-1.5 text-[11px] font-bold text-cyan-800 transition hover:bg-cyan-100"
                                >
                                  <SlidersHorizontal className="h-3.5 w-3.5" />
                                  Cấu hình
                                </button>
                              )}
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
                                  return rolesForSelect.map((r, index) => (
                                    <option key={`${usr.uid}-${r.role}-${index}`} value={r.role}>
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
                <div className="flex flex-col gap-3 border-t border-gray-100 bg-gray-50/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-[11px] font-mono text-slate-500">
                    Trang {safeUserPage} / {totalUserPages} · Hiển thị {paginatedVisibleUsers.length} / {visibleUsers.length} tài khoản
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setUserPage((prev) => Math.max(1, prev - 1))}
                      disabled={safeUserPage === 1}
                      className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Trang trước
                    </button>
                    {Array.from({ length: totalUserPages }, (_, index) => index + 1)
                      .slice(Math.max(0, safeUserPage - 3), Math.min(totalUserPages, safeUserPage + 2))
                      .map((page) => (
                        <button
                          key={page}
                          type="button"
                          onClick={() => setUserPage(page)}
                          className={`h-9 min-w-9 rounded-xl px-3 text-[11px] font-bold transition ${
                            page === safeUserPage
                              ? "bg-slate-900 text-white"
                              : "border border-gray-200 bg-white text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          {page}
                        </button>
                      ))}
                    <button
                      type="button"
                      onClick={() => setUserPage((prev) => Math.min(totalUserPages, prev + 1))}
                      disabled={safeUserPage === totalUserPages}
                      className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Trang sau
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      ) : activeTab === "balance" ? (
        <div className="flex-1 p-6 overflow-y-auto space-y-6" id="user_balance_tab_content">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center bg-gray-50 p-4 rounded-2xl border border-gray-150 gap-4">
            <div>
              <h5 className="font-bold text-slate-800 text-sm">Quản lý số dư ví người dùng</h5>
              <p className="text-xs text-gray-500 mt-0.5">Chỉ superadmin mới được chỉnh sửa balance của người dùng.</p>
            </div>
            <button
              type="button"
              onClick={fetchAdminBalances}
              disabled={balanceLoading}
              className="p-2 px-3.5 bg-white hover:bg-slate-100 border border-gray-205 rounded-xl text-xs font-bold font-sans flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${balanceLoading ? "animate-spin" : ""}`} />
              Tải lại số dư
            </button>
          </div>

          {balanceLoading ? (
            <div className="h-48 flex flex-col items-center justify-center text-center">
              <RefreshCw className="h-8 w-8 text-indigo-650 animate-spin mb-3" />
              <span className="text-xs font-bold font-mono text-indigo-800 uppercase tracking-widest">Đang tải dữ liệu số dư...</span>
            </div>
          ) : balanceUsers.length === 0 ? (
            <div className="p-12 text-center bg-gray-50 text-gray-400 italic rounded-2xl border border-dashed">
              Chưa có người dùng nào để điều chỉnh số dư.
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.95fr)] gap-6">
              <div className="bg-white border border-gray-150 rounded-2xl overflow-hidden shadow-xs max-w-full">
                <div className="max-w-full overflow-x-auto overscroll-x-contain">
                <table className="w-full min-w-[1280px] text-left border-collapse text-xs font-sans">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-150 text-[10px] font-bold text-gray-400 font-mono uppercase tracking-wider">
                      <th className="p-4 pl-6">Người dùng</th>
                      <th className="p-4">Doanh nghiệp</th>
                      <th className="p-4">Vai trò</th>
                      <th className="p-4">Số dư</th>
                      <th className="p-4">Cập nhật</th>
                      <th className="p-4 pr-6 text-center">Hành động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-slate-700">
                    {balanceUsers.map((item) => {
                      const isSelected = item.userId === selectedBalanceUserId;
                      return (
                        <tr
                          key={item.userId}
                          className={`transition-colors ${isSelected ? "bg-emerald-50/60" : "hover:bg-slate-50/40"}`}
                        >
                          <td className="p-4 pl-6 cursor-pointer" onClick={() => setSelectedBalanceUserId(item.userId)}>
                            <div>
                              <div className="font-semibold text-slate-800">{item.displayName}</div>
                              <div className="text-[11px] text-gray-500 font-mono">{item.email}</div>
                            </div>
                          </td>
                          <td className="p-4 cursor-pointer" onClick={() => setSelectedBalanceUserId(item.userId)}>
                            <div className="font-semibold text-slate-700">{item.companyName || "Hệ thống"}</div>
                            <div className="text-[10px] text-gray-400 font-mono">{item.companyCode || "SYSTEM"}</div>
                          </td>
                          <td className="p-4">
                            <span className="px-2.5 py-0.75 rounded-full font-bold font-mono text-[9px] uppercase tracking-wider inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200 text-slate-700">
                              <Shield className="h-3 w-3" />
                              {item.role}
                            </span>
                          </td>
                          <td className="p-4 min-w-[170px]">
                            <div className="font-bold text-emerald-700">{new Intl.NumberFormat("vi-VN", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(item.balance || 0)} Credit</div>
                            <div className="mt-1 text-[10px] text-gray-400 font-mono">{item.currency}</div>
                          </td>
                          <td className="p-4 text-gray-500 font-mono">
                            {item.updatedAt ? new Date(item.updatedAt).toLocaleString("vi-VN") : "-"}
                          </td>
                          <td className="p-4 pr-6">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedBalanceUserId(item.userId);
                                  setActiveTab("balance");
                                }}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700 transition hover:bg-slate-50"
                              >
                                Xem chi tiết
                              </button>
                              <button
                                type="button"
                                onClick={() => openBalanceEditor(item, "add")}
                                className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-800 transition hover:bg-emerald-100"
                              >
                                Điều chỉnh
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
                <div className="flex flex-col gap-3 border-t border-gray-100 bg-gray-50/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-[11px] font-mono text-slate-500">
                    Trang {safeUserPage} / {totalUserPages} · Hiển thị {paginatedVisibleUsers.length} / {visibleUsers.length} tài khoản
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setUserPage((prev) => Math.max(1, prev - 1))}
                      disabled={safeUserPage === 1}
                      className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Trang trước 
                    </button>
                    {Array.from({ length: totalUserPages }, (_, index) => index + 1)
                      .slice(Math.max(0, safeUserPage - 3), Math.min(totalUserPages, safeUserPage + 2))
                      .map((page) => (
                        <button
                          key={page}
                          type="button"
                          onClick={() => setUserPage(page)}
                          className={`h-9 min-w-9 rounded-xl px-3 text-[11px] font-bold transition ${
                            page === safeUserPage
                              ? "bg-slate-900 text-white"
                              : "border border-gray-200 bg-white text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          {page}
                        </button>
                      ))}
                    <button
                      type="button"
                      onClick={() => setUserPage((prev) => Math.min(totalUserPages, prev + 1))}
                      disabled={safeUserPage === totalUserPages}
                      className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Trang sau
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-gray-150 rounded-2xl shadow-xs p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h6 className="font-bold text-slate-800 text-sm">Lịch sử giao dịch</h6>
                    <p className="text-xs text-gray-500 mt-1">
                      {balanceUsers.find((item) => item.userId === selectedBalanceUserId)?.displayName || "Chọn người dùng"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => fetchAdminTransactions(selectedBalanceUserId)}
                    disabled={!selectedBalanceUserId || transactionsLoading}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${transactionsLoading ? "animate-spin" : ""}`} />
                    Tải lại
                  </button>
                </div>

                {transactionsLoading ? (
                  <div className="h-48 flex items-center justify-center text-center">
                    <RefreshCw className="h-6 w-6 text-emerald-600 animate-spin" />
                  </div>
                ) : balanceTransactions.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-xs text-gray-500">
                    Chưa có giao dịch nào cho tài khoản này.
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[540px] overflow-y-auto pr-1">
                    {balanceTransactions.map((transaction) => (
                      <div key={transaction._id} className="rounded-2xl border border-gray-150 p-3.5 bg-gray-50/60">
                        <div className="flex items-center justify-between gap-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase ${
                            transaction.type === "deposit"
                              ? "bg-emerald-100 text-emerald-800"
                              : transaction.type === "withdraw"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-slate-200 text-slate-700"
                          }`}>
                            {transaction.type}
                          </span>
                          <span className="font-bold text-slate-800">{new Intl.NumberFormat("vi-VN", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(transaction.amount || 0)} Credit</span>
                        </div>
                        <div className="mt-2 text-[11px] text-gray-500 font-mono">
                          {new Date(transaction.createdAt).toLocaleString("vi-VN")}
                        </div>
                        <div className="mt-2 text-xs text-slate-600 leading-5">
                          {transaction.description || "Không có mô tả giao dịch."}
                        </div>
                        <div className="mt-2 text-[10px] text-gray-400 font-mono">
                          Order: {transaction.orderCode} · Status: {transaction.status}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
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
          <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden transform transition-all scale-100 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-6 flex justify-between items-center relative shrink-0">
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
            <form onSubmit={handleRegisterUser} className="flex flex-col min-h-0">
              <div className="p-6 space-y-4 overflow-y-auto flex-1 min-h-0">
                {/* Tên hiển thị */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5 text-left sm:col-span-2">
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
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {/* Vai trò */}
                  <div className="space-y-1.5 text-left">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Quyền hạn (Role) *</label>
                    <select
                      value={userRole}
                      onChange={(e) => setUserRole(e.target.value as any)}
                      className="w-full p-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 bg-white cursor-pointer outline-none"
                    >
                      {getAvailableRoles().map((r, index) => (
                        <option key={`${r.role}-${index}`} value={r.role}>
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
                          <option key={c.id || c._id || c.code} value={c.code}>
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

                <div className="rounded-2xl border border-cyan-100 bg-cyan-50/50 p-4 space-y-3 text-left">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-700">Cấu hình HeyGen</p>
                    <p className="mt-1 text-[11px] text-cyan-900/80">
                      Chỉ cần điền 1 mã avatar, 1 mã giọng đọc và nếu cần thì thêm khóa API riêng.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Mã Avatar</label>
                      <textarea
                        placeholder="Nhập nhiều mã avatar, cách nhau bằng dấu phẩy hoặc xuống dòng"
                        value={userHeyGenAvatarIds}
                        onChange={(e) => setUserHeyGenAvatarIds(e.target.value)}
                        rows={3}
                        className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none resize-none"
                      />
                      <div className="rounded-xl border border-cyan-100 bg-cyan-50/70 px-3 py-2 text-[11px] leading-5 text-cyan-900">
                        Nhap 1 hoac nhieu <span className="font-mono font-semibold">Avatar ID</span>. Moi ID co the cach nhau bang dau phay hoac xuong dong.
                        Vi du: <span className="font-mono">avatar_001, avatar_002</span> hoac moi dong 1 ID.
                        Avatar dau tien se duoc dung lam mac dinh trong studio.
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Mã Giọng Đọc</label>
                      <input
                        type="text"
                        placeholder="Nhập 1 mã giọng đọc"
                        value={userHeyGenVoiceId}
                        onChange={(e) => setUserHeyGenVoiceId(e.target.value)}
                        className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Khóa API HeyGen</label>
                    <input
                      type="text"
                      placeholder="Để trống nếu dùng khóa hệ thống"
                      value={userHeyGenApiKey}
                      onChange={(e) => setUserHeyGenApiKey(e.target.value)}
                      className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex gap-3 justify-end p-6 border-t border-gray-100 bg-white shrink-0">
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
      {isBalanceModalOpen && editingBalanceUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-[440px] w-full overflow-hidden transform transition-all scale-100 flex flex-col">
            <div className="bg-emerald-600 text-white px-5 py-4 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white/15 rounded-lg">
                  <Wallet className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-sm uppercase tracking-wider font-sans">
                    {balanceAction === "add" ? "Cộng số dư người dùng" : "Trừ số dư người dùng"}
                  </h3>
                  <p className="mt-0.5 text-[11px] text-emerald-100">
                    {editingBalanceUser.displayName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeBalanceModal}
                className="p-1.5 hover:bg-emerald-500 rounded-md text-emerald-100 hover:text-white transition-all cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSaveBalance} className="flex flex-col">
              <div className="p-5 space-y-3.5 text-left">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setBalanceAction("add")}
                    className={`rounded-xl border px-3 py-2.5 text-left transition ${
                      balanceAction === "add"
                        ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                        : "border-gray-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <div className="text-[10px] font-bold uppercase tracking-wider">Tác vụ</div>
                    <div className="mt-0.5 text-sm font-bold">+ Cộng</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBalanceAction("subtract")}
                    className={`rounded-xl border px-3 py-2.5 text-left transition ${
                      balanceAction === "subtract"
                        ? "border-amber-300 bg-amber-50 text-amber-800"
                        : "border-gray-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <div className="text-[10px] font-bold uppercase tracking-wider">Tác vụ</div>
                    <div className="mt-0.5 text-sm font-bold">- Trừ</div>
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Số dư hiện tại</div>
                    <div className="mt-1 text-lg font-bold text-slate-800">
                      {new Intl.NumberFormat("vi-VN", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(editingBalanceUser.balance || 0)} Credit
                    </div>
                  </div>
                  <div className="rounded-xl border border-dashed border-gray-200 bg-white px-3 py-3">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Sau điều chỉnh</div>
                    <div className="mt-1 text-lg font-bold text-slate-800">
                      {new Intl.NumberFormat("vi-VN", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(
                        Math.max(
                          0,
                          Number(
                            (
                              Number(editingBalanceUser.balance || 0) +
                              (balanceAction === "add" ? 1 : -1) * (Number(newBalanceValue || 0) || 0)
                            ).toFixed(2)
                          )
                        )
                      )} Credit
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                    So tien {balanceAction === "add" ? "cong them" : "tru di"} (Credit)
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={newBalanceValue}
                    onChange={(e) => setNewBalanceValue(e.target.value)}
                    className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Ghi chu noi bo</label>
                  <textarea
                    value={balanceNote}
                    onChange={(e) => setBalanceNote(e.target.value)}
                    rows={2}
                    placeholder="Vi du: cap bu cong no, tang thuong, dieu chinh sau doi soat..."
                    className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none"
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end px-5 py-4 border-t border-gray-100 bg-gray-50/70">
                <button
                  type="button"
                  onClick={closeBalanceModal}
                  className="min-w-[94px] px-4 py-2 border border-gray-200 bg-white rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-50 transition-all cursor-pointer"
                >
                  Huy bo
                </button>
                <button
                  type="submit"
                  disabled={submittingBalance}
                  className="min-w-[150px] px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/10 flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {submittingBalance ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      Dang luu...
                    </>
                  ) : (
                    balanceAction === "add" ? "Xac nhan cong tien" : "Xac nhan tru tien"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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

      {isHeyGenModalOpen && editingHeyGenUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden transform transition-all scale-100 flex flex-col max-h-[90vh]">
            <div className="bg-cyan-600 text-white p-6 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white/15 rounded-xl">
                  <SlidersHorizontal className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-sm uppercase tracking-wider font-sans">
                    Cấu hình HeyGen cho người dùng
                  </h3>
                  <p className="text-[10px] text-cyan-100 font-mono mt-0.5">
                    {editingHeyGenUser.displayName} · {editingHeyGenUser.email}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsHeyGenModalOpen(false);
                  setEditingHeyGenUser(null);
                }}
                className="p-1.5 hover:bg-cyan-500 rounded-lg text-cyan-100 hover:text-white transition-all cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveHeyGenAccess} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 space-y-4 overflow-y-auto flex-1 text-left">
                <div className="rounded-2xl border border-cyan-100 bg-cyan-50/60 p-4 text-xs text-cyan-900">
                  Có thể gán nhiều avatar cho người dùng này. Avatar đầu tiên sẽ được dùng làm mặc định trong studio.
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Mã Avatar</label>
                    <textarea
                      value={editingHeyGenAvatarIds}
                      onChange={(e) => setEditingHeyGenAvatarIds(e.target.value)}
                      placeholder="Nhập nhiều mã avatar, cách nhau bằng dấu phẩy hoặc xuống dòng"
                      rows={4}
                      className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none resize-none"
                    />
                    <div className="rounded-xl border border-cyan-100 bg-cyan-50/70 px-3 py-2 text-[11px] leading-5 text-cyan-900">
                      Có thể thêm nhiều <span className="font-mono font-semibold">Avatar ID</span> cho user này.
                      mỗi ID nhập trên 1 dòng hoặc cách nhau bằng dấu phẩy.
                      Ví dụ: <span className="font-mono">avatar_001, avatar_002, avatar_003</span>.
                      Avatar đầu tiên trong danh sách sẽ là avatar mặc định khi mở studio.
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Mã Giọng Đọc</label>
                    <input
                      type="text"
                      value={editingHeyGenVoiceId}
                      onChange={(e) => setEditingHeyGenVoiceId(e.target.value)}
                      placeholder="Nhập 1 mã giọng đọc"
                      className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Khóa API HeyGen</label>
                  <input
                    type="text"
                    value={editingHeyGenApiKey}
                    onChange={(e) => setEditingHeyGenApiKey(e.target.value)}
                    placeholder="Để trống nếu dùng khóa hệ thống"
                    className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 justify-end p-6 border-t border-gray-100 shrink-0 bg-gray-50/50">
                <button
                  type="button"
                  onClick={() => {
                    setIsHeyGenModalOpen(false);
                    setEditingHeyGenUser(null);
                  }}
                  className="px-4 py-2 border border-gray-200 bg-white rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-50 transition-all cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={savingHeyGenAccess}
                  className="px-5 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-cyan-600/10 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {savingHeyGenAccess ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      Đang lưu...
                    </>
                  ) : (
                    "Lưu cấu hình HeyGen"
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
