/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useBranch } from "../context/BranchContext";
import { resolveUserAdminBranchId } from "../components/user-admin/userBranchScope";
import { authService } from "../services/authService";
import { branchService, BranchRecord } from "../services/branchService";
import { CompanyProfile, UserProfile } from "../types";
import { toast } from "./Toast";
import { Shield, RefreshCw, Plus, User, X, Wallet, Mail, Lock, SlidersHorizontal, Check } from "lucide-react";
import "./user-admin-theme.css";
import { parseFirebaseError } from "../utils/firebaseErrorParser";
import { getApiErrorMessage } from "../utils/errorMessage";
import { rolePermissionService, RolePermission, Permission } from "../services/rolePermissionService";
import { CompanyModal } from "../components/user-admin/CompanyModal";
import { UserAdminHeader } from "../components/user-admin/UserAdminHeader";
import { UserAdminTabs } from "../components/user-admin/UserAdminTabs";
import { UserFiltersBar } from "../components/user-admin/UserFiltersBar";
import { UserListTable } from "../components/user-admin/UserListTable";
import { CompanyEditFormState, CompanyFormState } from "../components/user-admin/types";
import { UserFormModal } from "../components/user-admin/UserFormModal";
import { RoleModal } from "../components/user-admin/RoleModal";
import { ConfirmDialog } from "../components/common/ConfirmDialog";
import { HrEmptyIllustration } from "../components/hr/HrEmptyIllustration";
import { primaryCreateButtonClass } from "../components/common/primaryCreateButton";
import { DEFAULT_MODULE_KEYS, MODULE_KEYS } from "../config/modules";
import { DEFAULT_SYSTEM_PERMISSIONS, getPermissionLabel, getRoleDisplayName } from "../utils/permissionUtils";
import { UserActivityTimeline } from "./super-admin/users/UserActivityTimeline";

export default function UserAdminTab() {
  const { userProfile } = useAuth();
  const { activeBranchId } = useBranch();
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [activityUser, setActivityUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void | Promise<void>;
  } | null>(null);

  const askConfirm = (
    title: string,
    description: string,
    onConfirm: () => void | Promise<void>,
    confirmLabel = "Xác nhận",
    cancelLabel = "Hủy"
  ) => {
    setConfirmState({
      isOpen: true,
      title,
      description,
      confirmLabel,
      cancelLabel,
      onConfirm: async () => {
        await onConfirm();
        setConfirmState(null);
      },
    });
  };
  
  // SaaS States
  const [companies, setCompanies] = useState<CompanyProfile[]>([]);
  const [branches, setBranches] = useState<BranchRecord[]>([]);
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
  const [isEditCompanyModalOpen, setIsEditCompanyModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<CompanyEditFormState | null>(null);
  const [selectedModules, setSelectedModules] = useState<string[]>([...DEFAULT_MODULE_KEYS]);

  // Register User Modal States
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [userDisplayName, setUserDisplayName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userPhone, setUserPhone] = useState("");
  const [userBirthDate, setUserBirthDate] = useState("");
  const [userPassword, setUserPassword] = useState("");
  const [userRole, setUserRole] = useState<string>("user");
  const [userCompanyCode, setUserCompanyCode] = useState<string>("");
  const [userBranchId, setUserBranchId] = useState<string>("");
  const [userParentId, setUserParentId] = useState<string>("");
  const [userDepartment, setUserDepartment] = useState("");
  const [userQualification, setUserQualification] = useState("");
  const [userJobDescriptionLink, setUserJobDescriptionLink] = useState("");
  const [userJobDescriptionUploadToken, setUserJobDescriptionUploadToken] = useState("");
  const [userMonthlySalary, setUserMonthlySalary] = useState("");
  const [submittingUser, setSubmittingUser] = useState(false);

  const resetUserForm = () => {
    setEditingUser(null);
    setUserDisplayName("");
    setUserEmail("");
    setUserPhone("");
    setUserBirthDate("");
    setUserPassword("");
    setUserRole("user");
    setUserBranchId("");
    setUserParentId("");
    setUserDepartment("");
    setUserQualification("");
    setUserJobDescriptionLink("");
    setUserJobDescriptionUploadToken("");
    setUserMonthlySalary("");
  };
  const companyFormState: CompanyFormState = {
    companyName,
    companyCode,
    ownerName,
    ownerEmail,
    ownerPassword,
    enabledModules: selectedModules,
  };

  // Sub-tabs State
  const [activeTab, setActiveTab] = useState<"users" | "roles">("users");
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);


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
      if (editingUser?.companyCode) {
        setUserCompanyCode(editingUser.companyCode);
      } else if (userProfile?.role === "admin") {
        setUserCompanyCode(userProfile.companyCode || "");
      } else {
        setUserCompanyCode(selectedCompanyCode === "all" ? "SYSTEM" : selectedCompanyCode);
      }
    }
  }, [editingUser, isUserModalOpen, userProfile, selectedCompanyCode]);

  useEffect(() => {
    if (!isUserModalOpen || !userCompanyCode || userCompanyCode === "SYSTEM") { setBranches([]); return; }
    branchService.list().then(setBranches).catch(() => setBranches([]));
  }, [isUserModalOpen, userCompanyCode]);

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
    setUserQualification("");
    }
  }, [userRole, userParentId, usersList, isUserModalOpen]);

  // Reset userDepartment when modal is closed
  useEffect(() => {
    if (!isUserModalOpen) {
      setUserDepartment("");
    setUserQualification("");
      setUserJobDescriptionLink("");
    setUserMonthlySalary("");
      setEditingUser(null);
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
        const branchId = resolveUserAdminBranchId(userProfile.role, activeBranchId, userProfile.branchId);
        data = await authService.getUsersByCompany(userProfile.companyCode, branchId);
      }
      setUsersList(data);
    } catch (error) {
      console.error("Lấy danh sách user thất bại:", error);
      toast.error(getApiErrorMessage(error, "Không thể tải danh sách tài khoản người dùng."));
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
      console.error("Lấy danh sách doanh nghiệp thất bại:", error);
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
      console.error("Lấy cấu hình vai trò thất bại:", error);
    } finally {
      setRoleLoading(false);
    }
  };

  const fetchSystemPermissions = async () => {
    try {
      const data = await rolePermissionService.getPermissions();
      if (data && data.length > 0) {
        setSystemPermissions(data);
      } else {
        setSystemPermissions(DEFAULT_SYSTEM_PERMISSIONS as any);
      }
    } catch (error) {
      console.error("Lấy mã quyền hệ thống thất bại:", error);
      setSystemPermissions(DEFAULT_SYSTEM_PERMISSIONS as any);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchCompanies();
    fetchRolePermissions();
    fetchSystemPermissions();
  }, [userProfile?.uid, userProfile?.role, userProfile?.companyCode, userProfile?.branchId, selectedCompanyCode, activeBranchId]);


  // Close action menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-action-menu]')) {
        setOpenActionMenuId(null);
      }
    };
    
    if (openActionMenuId) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [openActionMenuId]);

  useEffect(() => {
    setUserPage(1);
  }, [searchQuery, filterStartDate, filterEndDate, selectedCompanyCode, userProfile?.role]);

  const getAvailableRoles = () => {
    const defaultRoles = [
      { role: "user", displayName: "USER (Nhân viên)", level: 4 },
      { role: "teacher", displayName: getRoleDisplayName("teacher"), level: 4 },
      { role: "pos_cashier", displayName: getRoleDisplayName("pos_cashier"), level: 5 },
      { role: "manager", displayName: "MANAGER (Quản lý)", level: 3 },
      { role: "branch_owner", displayName: "BRANCH OWNER", level: 2 }
    ];
    
    if (userProfile?.role === "superadmin") {
      defaultRoles.push(
        { role: "admin", displayName: getRoleDisplayName("admin"), level: 2 },
        { role: "superadmin", displayName: getRoleDisplayName("superadmin"), level: 1 }
      );
    } else if (userProfile?.role === "admin") {
      defaultRoles.push(
        { role: "admin", displayName: getRoleDisplayName("admin"), level: 2 }
      );
    }

    // Merge with custom roles
    const customRoles = rolePermissionsList
      .filter(rp => !["user", "teacher", "pos_cashier", "manager", "branch_owner", "admin", "superadmin"].includes(rp.role))
      .map(rp => ({
        role: rp.role,
        displayName: getRoleDisplayName(rp.role, rp.displayName),
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


  const totalUserPages = Math.max(1, Math.ceil(visibleUsers.length / USERS_PER_PAGE));
  const safeUserPage = Math.min(userPage, totalUserPages);
  const paginatedVisibleUsers = visibleUsers.slice(
    (safeUserPage - 1) * USERS_PER_PAGE,
    safeUserPage * USERS_PER_PAGE
  );

  const handleRoleChange = async (targetUid: string, targetName: string, newRole: string) => {
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
      toast.success(`Đã cập nhật quyền hạn cho "${targetName}" thành ${newRole.toUpperCase()}. Người dùng cần đăng nhập lại.`);
      // Cập nhật lại list ở client
      setUsersList((prev) =>
        prev.map((u) => {
          if (u.uid === targetUid) {
            const dept = newRole === "admin" || newRole === "superadmin" ? "Ban Giám đốc" : (newRole === "manager" ? "Quản lý" : (newRole === "teacher" ? "Đào tạo" : (newRole === "pos_cashier" ? "Bán lẻ" : "Nhân viên")));
            const div = newRole === "admin" || newRole === "superadmin" ? "Ban Giám đốc" : (newRole === "manager" ? "Quản lý" : (newRole === "teacher" ? "Đào tạo" : (newRole === "pos_cashier" ? "Bán lẻ" : "Nhân viên")));
            const title = newRole === "admin" ? "CEO" : (newRole === "manager" ? "Quản lý phòng ban" : (newRole === "teacher" ? "Giảng viên" : (newRole === "pos_cashier" ? "Nhân viên bán hàng POS" : "Nhân viên")));
            return { ...u, role: newRole, department: dept, division: div, jobTitle: title };
          }
          return u;
        })
      );
    } catch (error) {
      console.error("Lỗi cập nhật quyền:", error);
      toast.error(getApiErrorMessage(error, "Lỗi khi cập nhật quyền hạn người dùng."));
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
    if (selectedModules.length === 0) {
      toast.warning("Vui lòng chọn ít nhất một phân hệ.");
      return;
    }

    setSubmittingCompany(true);
    try {
      await authService.registerCompanyAndAdmin(
        companyName,
        companyCode,
        ownerName,
        ownerEmail,
        ownerPassword,
        selectedModules
      );
      toast.success(`Đăng ký doanh nghiệp ${companyName} và tài khoản Admin thành công!`);
      setIsCompanyModalOpen(false);
      // Reset form
      setCompanyName("");
      setCompanyCode("");
      setOwnerName("");
      setOwnerEmail("");
      setOwnerPassword("");
      setSelectedModules([...DEFAULT_MODULE_KEYS]);
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

  const handleCompanyFormChange = (field: keyof CompanyFormState, value: string) => {
    if (field === "companyName") setCompanyName(value);
    if (field === "companyCode") setCompanyCode(value);
    if (field === "ownerName") setOwnerName(value);
    if (field === "ownerEmail") setOwnerEmail(value);
    if (field === "ownerPassword") setOwnerPassword(value);
  };

  const handleEditCompanyFormChange = (field: keyof CompanyEditFormState, value: string) => {
    setEditingCompany((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const openEditCompanyModal = () => {
    if (userProfile?.role !== "superadmin" || selectedCompanyCode === "all") return;
    const targetCompany = companies.find((company) => company.code === selectedCompanyCode);
    if (!targetCompany) {
      toast.warning("Không tìm thấy doanh nghiệp để chỉnh sửa.");
      return;
    }
    setEditingCompany({
      id: targetCompany.id,
      name: targetCompany.name,
      code: targetCompany.code,
      ownerEmail: targetCompany.ownerEmail,
      enabledModules: targetCompany.enabledModules?.length ? targetCompany.enabledModules : [...DEFAULT_MODULE_KEYS],
    });
    setIsEditCompanyModalOpen(true);
  };

  const handleUpdateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (userProfile?.role !== "superadmin" || !editingCompany) {
      toast.error("Chỉ superadmin mới được chỉnh sửa doanh nghiệp.");
      return;
    }

    if (editingCompany.enabledModules.length === 0) {
      toast.warning("Vui lòng chọn ít nhất một phân hệ.");
      return;
    }
    setSubmittingCompany(true);
    try {
      await authService.updateCompany(editingCompany.id, {
        name: editingCompany.name.trim(),
        code: editingCompany.code.trim(),
        ownerEmail: editingCompany.ownerEmail.trim(),
        enabledModules: editingCompany.enabledModules,
      });
      toast.success(`Đã cập nhật doanh nghiệp "${editingCompany.name}".`);
      setIsEditCompanyModalOpen(false);
      await fetchCompanies();
      await fetchUsers();
      setSelectedCompanyCode(editingCompany.code.trim().toUpperCase());
    } catch (error: any) {
      console.error("Lỗi cập nhật doanh nghiệp:", error);
      toast.error(parseFirebaseError(error, "Không thể cập nhật doanh nghiệp."));
    } finally {
      setSubmittingCompany(false);
    }
  };

  const handleRegisterUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userDisplayName.trim() || !userEmail.trim() || !userCompanyCode) {
      toast.warning("Vui lòng điền đầy đủ thông tin người dùng!");
      return;
    }
    if (!editingUser && userPassword.length < 6) {
      toast.warning("Mật khẩu phải từ 6 ký tự trở lên!");
      return;
    }
    if (userProfile?.role === "admin" && userRole === "admin") {
      toast.warning("Chủ doanh nghiệp không được phép tạo tài khoản có vai trò Admin!");
      return;
    }
    if (userRole === "pos_cashier" && (userCompanyCode === "SYSTEM" || !userBranchId)) {
      toast.warning("Nhân viên bán hàng POS cần được gán vào một chi nhánh đang hoạt động của doanh nghiệp.");
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

      if (editingUser) {
        await authService.updateUser(editingUser.uid, {
          displayName: userDisplayName.trim(),
          role: userRole,
          companyCode: userCompanyCode,
          companyName: compName,
          parentId: userParentId || null,
          level: userRole === "user" && managerProfile?.level ? managerProfile.level + 1 : undefined,
          department: userDepartment.trim() || "",
          division: userDepartment.trim() || "",
          phone: userPhone.trim(),
          birthDate: userBirthDate || null,
          qualification: userQualification.trim(),
          jobDescriptionLink: userJobDescriptionLink.trim() || "",
          jobDescriptionUploadToken: userJobDescriptionUploadToken || undefined,
          monthlySalary: userMonthlySalary === "" ? undefined : Number(userMonthlySalary),
          branchId: userBranchId || null,
        });

        toast.success(editingUser.role !== userRole
          ? `Đã cập nhật tài khoản "${userDisplayName}". Người dùng cần đăng nhập lại để áp dụng vai trò mới.`
          : `Đã cập nhật tài khoản "${userDisplayName}".`);
      } else {
        await authService.registerUserForCompany(
          userDisplayName,
          userEmail,
          userPassword,
          userRole as any,
          userCompanyCode,
          compName,
          userParentId || undefined,
          managerProfile?.level,
          userDepartment.trim() || undefined,
          userDepartment.trim() || undefined,
          undefined,
          undefined,
          userJobDescriptionLink.trim() || undefined,
          userBranchId || undefined,
          userBirthDate || undefined,
          userQualification.trim() || undefined,
          undefined,
          userJobDescriptionUploadToken || undefined,
        );

        toast.success(`Đăng ký tài khoản cho "${userDisplayName}" thành công!`);
      }
      setIsUserModalOpen(false);
      resetUserForm();
      // Refresh lists
      await fetchUsers();
    } catch (error: any) {
      console.error(editingUser ? "Lỗi cập nhật người dùng:" : "Lỗi đăng ký người dùng:", error);
      const errMsg = parseFirebaseError(
        error,
        editingUser ? "Không thể cập nhật người dùng." : "Không thể đăng ký người dùng mới."
      );
      toast.error(errMsg);
    } finally {
      setSubmittingUser(false);
    }
  };

  const openCreateUserModal = () => {
    resetUserForm();
    if (activeBranchId) {
      setUserBranchId(activeBranchId);
    }
    setIsUserModalOpen(true);
  };

  const openEditUserModal = (user: UserProfile) => {
    setOpenActionMenuId(null);
    setEditingUser(user);
    setUserDisplayName(user.displayName || "");
    setUserEmail(user.email || "");
    setUserPhone(user.phone && user.phone !== "Chưa cập nhật" ? user.phone : "");
    setUserBirthDate(user.birthDate ? String(user.birthDate).slice(0, 10) : "");
    setUserPassword("");
    setUserRole(user.role || "user");
    setUserCompanyCode(user.companyCode || "");
    setUserBranchId(user.branchId || "");
    setUserParentId(user.parentId || "");
    setUserDepartment(user.department || "");
    setUserQualification(user.qualification || "");
    setUserJobDescriptionLink(user.jobDescriptionLink || "");
    setUserMonthlySalary(user.monthlySalary == null ? "" : String(user.monthlySalary));
    setIsUserModalOpen(true);
  };

  const deleteRoleConfirmed = async (role: string) => {
    try {
      let code = undefined;
      if (userProfile?.role === "superadmin") {
        code = selectedCompanyCode === "all" ? "SYSTEM" : selectedCompanyCode;
      } else {
        code = userProfile?.companyCode;
      }
      await rolePermissionService.deleteRolePermission(role, code);
      toast.success("Xóa cấu hình vai trò thành công!");
      await fetchRolePermissions();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Xóa vai trò thất bại.");
    }
  };

  const handleDeleteRole = (roleInfo: any) => {
    askConfirm(
      "Xóa vai trò?",
      `Bạn có chắc chắn muốn xóa vai trò "${roleInfo.displayName}"? Hành động này sẽ bỏ phân quyền vai trò.`,
      () => deleteRoleConfirmed(roleInfo.role),
      "Xóa vai trò",
      "Hủy"
    );
  };

  const deleteUserConfirmed = async (user: UserProfile) => {
    try {
      await authService.deleteUser(user.uid);
      setUsersList((prev) => prev.filter((item) => item.uid !== user.uid));
      toast.success(`Đã xóa người dùng "${user.displayName}".`);
    } catch (error: any) {
      console.error("Lỗi xóa người dùng:", error);
      toast.error(error.message || "Không thể xóa người dùng.");
    }
  };

  const handleDeleteUser = (user: UserProfile) => {
    setOpenActionMenuId(null);
    if (user.uid === userProfile?.uid) {
      toast.warning("Bạn không thể tự xóa chính mình.");
      return;
    }

    askConfirm(
      "Xóa người dùng?",
      `Bạn có chắc chắn muốn xóa người dùng "${user.displayName}"? Thao tác này không thể hoàn tác.`,
      () => deleteUserConfirmed(user),
      "Xóa",
      "Hủy"
    );
  };


  return (
    <div className="user-admin-ui flex h-full min-h-0 flex-col overflow-hidden bg-surface" id="user_admin_tab_wrapper">
      <h1 className="sr-only">Quản trị Hệ thống & Phân quyền - {activeTab}</h1>
      
      <UserAdminHeader
        userProfile={userProfile}
        companies={companies}
        selectedCompanyCode={selectedCompanyCode}
        onSelectedCompanyCodeChange={setSelectedCompanyCode}
        onOpenCompanyModal={() => setIsCompanyModalOpen(true)}
        onOpenCreateUserModal={openCreateUserModal}
        onRefresh={fetchUsers}
        loading={loading}
      />

      <UserAdminTabs activeTab={activeTab} onChange={setActiveTab} userProfile={userProfile} />
      {activeTab === "users" ? (
        <>
          <UserFiltersBar
            searchQuery={searchQuery}
            filterStartDate={filterStartDate}
            filterEndDate={filterEndDate}
            visibleUsersCount={visibleUsers.length}
            totalUsersCount={usersList.length}
            onSearchChange={setSearchQuery}
            onFilterStartDateChange={setFilterStartDate}
            onFilterEndDateChange={setFilterEndDate}
            onClear={() => {
              setSearchQuery("");
              setFilterStartDate("");
              setFilterEndDate("");
            }}
          />
          {/* Main List Area */}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3" id="user_admin_content">
            {loading ? (
              <div className="flex flex-1 flex-col items-center justify-center rounded-md border border-outline-variant bg-surface-container-lowest text-center">
                <RefreshCw className="h-8 w-8 text-indigo-650 animate-spin mb-3" />
                <span className="text-sm text-slate-500">Đang tải danh sách tài khoản...</span>
              </div>
            ) : visibleUsers.length === 0 ? (
              <div className="flex flex-1 items-center justify-center rounded-md border border-outline-variant bg-surface-container-lowest">
                <div className="flex w-full max-w-md flex-col items-center px-6 py-6 text-center">
                  <HrEmptyIllustration kind="worker" className="mb-2" />
                  <p className="text-pretty text-sm font-medium text-on-surface">Không tìm thấy tài khoản</p>
                  <p className="mt-1 text-pretty text-xs font-normal text-on-surface-variant">{searchQuery || filterStartDate || filterEndDate ? "Thử thay đổi từ khóa hoặc khoảng ngày." : "Danh sách sẽ hiển thị khi có tài khoản."}</p>
                </div>
              </div>
            ) : (
              <UserListTable
                users={paginatedVisibleUsers}
                currentUser={userProfile}
                rolePermissionsList={rolePermissionsList}
                userPage={safeUserPage}
                totalUserPages={totalUserPages}
                onPageChange={setUserPage}
                getAvailableRoles={getAvailableRoles}
                onRoleChange={handleRoleChange}
                openActionMenuId={openActionMenuId}
                onToggleActionMenu={(uid) => setOpenActionMenuId(openActionMenuId === uid ? null : uid)}
                onEditUser={openEditUserModal}
                onDeleteUser={handleDeleteUser}
                onViewActivity={(user) => { setOpenActionMenuId(null); setActivityUser(user); }}
              />
            )}
          </div>
        </>      ) : (
        <div className="flex-1 space-y-3 overflow-y-auto p-3" id="roles_permissions_tab_content">
          <div className="flex flex-wrap items-center gap-3">
            <button
              disabled={!(userProfile?.role === "superadmin" || userProfile?.role === "admin" || userProfile?.permissions?.includes("*") || userProfile?.permissions?.includes("access:manage"))}
              onClick={() => {
                if (!(userProfile?.role === "superadmin" || userProfile?.role === "admin" || userProfile?.permissions?.includes("*") || userProfile?.permissions?.includes("access:manage"))) return;
                setEditingRole(null);
                setRoleSlug("");
                setRoleDisplayName("");
                setRoleLevel(3);
                setSelectedPermissions([]);
                setIsRoleModalOpen(true);
              }}
              className={`${primaryCreateButtonClass} user-admin-create-button min-h-9`}
            >
              <Plus className="h-3.5 w-3.5" />
              Thêm vai trò tùy chỉnh
            </button>
          </div>

          {roleLoading ? (
            <div className="h-48 flex flex-col items-center justify-center text-center">
              <RefreshCw className="h-8 w-8 text-indigo-650 animate-spin mb-3" />
              <span className="text-sm text-slate-500">Đang tải danh sách vai trò...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {/* Render Default roles and Custom roles */}
              {(() => {
                const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
                  admin: ["*"],
                  branch_owner: ["access:read", "access:manage", "hr:read", "timekeeping:read", "timekeeping:manage", "people:read", "people:manage", "resource:read", "chat:read", "work:read", "work:manage"],
                  manager: [
                    "access:read", "access:manage",
                    "timekeeping:read", "timekeeping:manage",
                    "payroll-period:read",
                    "work:read", "work:manage",
                    "work:read", "work:manage",
                    "inventory:read", "inventory:manage",
                    "people:read", "people:manage",
                    "resource:read", "resource:manage",
                    "chat:read", "chat:manage",
                    "finance-receivable:read"
                  ],
                  user: [
                    "access:read",
                    "timekeeping:read",
                    "work:read", "work:manage",
                    "work:read",
                    "inventory:read",
                    "people:read",
                    "resource:read",
                    "chat:read",
                    "finance-receivable:read"
                  ],
                  teacher: ["people:read", "people:manage"],
                  pos_cashier: ["pos:manage"]
                };

                const defaultRolesList = [
                  { role: "admin", displayName: getRoleDisplayName("admin"), level: 2, isDefault: true, permissions: DEFAULT_ROLE_PERMISSIONS.admin },
                  { role: "manager", displayName: getRoleDisplayName("manager"), level: 3, isDefault: true, permissions: DEFAULT_ROLE_PERMISSIONS.manager },
                  { role: "branch_owner", displayName: getRoleDisplayName("branch_owner"), level: 2, isDefault: true, permissions: DEFAULT_ROLE_PERMISSIONS.branch_owner },
                  { role: "pos_cashier", displayName: getRoleDisplayName("pos_cashier"), level: 5, isDefault: true, permissions: DEFAULT_ROLE_PERMISSIONS.pos_cashier },
                  { role: "teacher", displayName: getRoleDisplayName("teacher"), level: 4, isDefault: true, permissions: DEFAULT_ROLE_PERMISSIONS.teacher },
                  { role: "user", displayName: getRoleDisplayName("user"), level: 4, isDefault: true, permissions: DEFAULT_ROLE_PERMISSIONS.user }
                ];
                
                const customRolesList = rolePermissionsList.filter(rp => !["superadmin", "admin", "manager", "branch_owner", "teacher", "user", "pos_cashier"].includes(rp.role));
                
                const rolesToDisplay = [
                  ...defaultRolesList.map(dr => {
                    const dbRecord = rolePermissionsList.find(rp => rp.role === dr.role);
                    return {
                      ...dr,
                      permissions: dbRecord
                        ? Array.from(new Set([...dbRecord.permissions, ...(dr.role === "pos_cashier" ? ["pos:manage"] : [])]))
                        : (DEFAULT_ROLE_PERMISSIONS[dr.role] || []),
                      displayName: dbRecord?.displayName || dr.displayName,
                      level: dbRecord?.level || dr.level,
                      _id: dbRecord?._id
                    };
                  }),
                  ...customRolesList.map(cr => ({
                    role: cr.role,
                    displayName: getRoleDisplayName(cr.role, cr.displayName),
                    level: cr.level,
                    permissions: cr.permissions,
                    isDefault: false,
                    _id: cr._id
                  }))
                ];

                const canEditRole = (roleInfo: { role: string; level: number }) => {
                  const currentRole = userProfile?.role;
                  if (!currentRole || roleInfo.role === "superadmin") return false;
                  if (currentRole === "superadmin" || currentRole === "admin") {
                    return roleInfo.role !== "admin";
                  }
                  if (roleInfo.role === currentRole) return false;
                  const callerLevel = rolePermissionsList.find((item) => item.role === currentRole)?.level
                    ?? ({ manager: 3, branch_owner: 2, teacher: 4, user: 4 }[currentRole] ?? 4);
                  return roleInfo.level > callerLevel;
                };

                return rolesToDisplay.map((roleInfo) => {
                  return (
                    <div key={roleInfo.role} className="flex flex-col justify-between gap-3 rounded-md border border-outline-variant bg-surface-container-lowest p-4 shadow-xs transition-colors hover:border-primary/35">
                      <div className="space-y-2.5">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="inline-flex rounded-sm border border-outline-variant bg-surface px-2 py-0.5 text-xs font-medium text-on-surface-variant">
                              Cấp {userProfile?.role === "superadmin" ? roleInfo.level : roleInfo.level - 1}
                            </span>
                            <h3 className="mt-1 text-sm font-semibold text-on-surface">{roleInfo.displayName}</h3>
                            <span className="block text-xs font-normal text-on-surface-variant">Mã: {roleInfo.role}</span>
                          </div>
                          {roleInfo.isDefault && (
                            <span className="rounded-sm border border-outline-variant bg-surface px-2 py-0.5 text-xs font-medium text-on-surface-variant">
                              Mặc định
                            </span>
                          )}
                        </div>

                        {/* Permissions display */}
                        <div className="space-y-1.5 text-left">
                          <span className="block text-xs font-medium text-on-surface-variant">Các quyền được cấp phép:</span>
                          <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto pr-1">
                            {roleInfo.permissions.length === 0 ? (
                              <span className="text-xs font-normal text-on-surface-variant">Chưa cấu hình quyền nào</span>
                            ) : roleInfo.permissions.includes("*") ? (
                              <span className="flex items-center gap-1 rounded-sm bg-primary/10 px-2.5 py-1 text-xs font-medium text-on-surface">
                                <Check className="h-3 w-3" /> Toàn quyền hệ thống
                              </span>
                            ) : (
                              roleInfo.permissions.map(p => {
                                const sysPerm = systemPermissions.find(sp => sp.code === p);
                                const labelText = getPermissionLabel(p, sysPerm?.name);
                                return (
                                  <span key={p} className="rounded-sm border border-outline-variant bg-surface px-2 py-0.5 text-xs font-normal text-on-surface-variant" title={`Mã hệ thống: ${p}`}>
                                    {labelText}
                                  </span>
                                );
                              })
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="mt-auto flex justify-end gap-2 border-t border-outline-variant pt-3">
                        {canEditRole(roleInfo) && (
                          <button
                            onClick={() => {
                              setEditingRole(roleInfo as any);
                              setRoleSlug(roleInfo.role);
                              setRoleDisplayName(roleInfo.displayName);
                              setRoleLevel(roleInfo.level);
                              setSelectedPermissions(roleInfo.permissions);
                              setIsRoleModalOpen(true);
                            }}
                            className="flex min-h-9 cursor-pointer items-center gap-1 rounded-md border border-outline-variant bg-surface-container-lowest px-3 py-1.5 text-xs font-medium text-on-surface transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-primary"
                          >
                            Thiết lập phân quyền
                          </button>
                        )}
                        {!roleInfo.isDefault && (
                          <button
                            onClick={() => handleDeleteRole(roleInfo)}
                            className="min-h-9 cursor-pointer rounded-md border border-error/30 bg-error-container/40 px-3 py-1.5 text-xs font-medium text-error transition-colors hover:bg-error-container/60 focus-visible:outline-2 focus-visible:outline-error"
                            title="Xóa vai trò"
                          >
                            Xóa
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

      <CompanyModal
        mode="create"
        open={isCompanyModalOpen}
        form={companyFormState}
        submitting={submittingCompany}
        onClose={() => setIsCompanyModalOpen(false)}
        onChange={(field, value) => handleCompanyFormChange(field as keyof CompanyFormState, value)}
        onModulesChange={setSelectedModules}
        onSubmit={handleRegisterCompany}
      />

      <CompanyModal
        mode="edit"
        open={isEditCompanyModalOpen && !!editingCompany}
        form={editingCompany || { id: "", name: "", code: "", ownerEmail: "", enabledModules: [...DEFAULT_MODULE_KEYS] }}
        submitting={submittingCompany}
        onClose={() => setIsEditCompanyModalOpen(false)}
        onChange={(field, value) => handleEditCompanyFormChange(field as keyof CompanyEditFormState, value)}
        onModulesChange={(enabledModules) => setEditingCompany((prev) => prev ? { ...prev, enabledModules } : prev)}
        onSubmit={handleUpdateCompany}
      />

      <UserFormModal
        open={isUserModalOpen}
        onClose={() => {
          setIsUserModalOpen(false);
          resetUserForm();
        }}
        editingUser={editingUser}
        userDisplayName={userDisplayName}
        setUserDisplayName={setUserDisplayName}
        userEmail={userEmail}
        userPhone={userPhone}
        setUserPhone={setUserPhone}
        userBirthDate={userBirthDate}
        setUserBirthDate={setUserBirthDate}
        setUserEmail={setUserEmail}
        userPassword={userPassword}
        setUserPassword={setUserPassword}
        userRole={userRole}
        setUserRole={setUserRole}
        userCompanyCode={userCompanyCode}
        setUserCompanyCode={setUserCompanyCode}
        userBranchId={userBranchId}
        setUserBranchId={setUserBranchId}
        userParentId={userParentId}
        setUserParentId={setUserParentId}
        userDepartment={userDepartment}
        setUserDepartment={setUserDepartment}
        userQualification={userQualification}
        setUserQualification={setUserQualification}
        userJobDescriptionLink={userJobDescriptionLink}
        userMonthlySalary={userMonthlySalary}
        setUserMonthlySalary={setUserMonthlySalary}
        setUserJobDescriptionLink={setUserJobDescriptionLink}
        setUserJobDescriptionUploadToken={setUserJobDescriptionUploadToken}
        getAvailableRoles={getAvailableRoles}
        userProfile={userProfile}
        companies={companies}
        branches={branches}
        usersList={usersList}
        onSubmit={handleRegisterUser}
        submittingUser={submittingUser}
      />


      <RoleModal
        open={isRoleModalOpen}
        onClose={() => setIsRoleModalOpen(false)}
        editingRole={editingRole}
        roleSlug={roleSlug}
        setRoleSlug={setRoleSlug}
        roleDisplayName={roleDisplayName}
        setRoleDisplayName={setRoleDisplayName}
        roleLevel={roleLevel}
        setRoleLevel={setRoleLevel}
        selectedPermissions={selectedPermissions}
        setSelectedPermissions={setSelectedPermissions}
        userProfile={userProfile}
        selectedCompanyCode={selectedCompanyCode}
        systemPermissions={systemPermissions}
        submittingRole={submittingRole}
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
          } catch (error) {
            console.error(error);
            toast.error(error.message || "Không thể cập nhật cấu hình vai trò.");
          } finally {
            setSubmittingRole(false);
          }
        }}
      />

      {activityUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4" role="dialog" aria-label="Lịch sử hoạt động người dùng">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-slate-900 p-5 text-white shadow-2xl">
            <div className="mb-4 flex items-center justify-between"><div><h3 className="font-bold">Lịch sử hoạt động</h3><p className="text-sm text-slate-400">{activityUser.displayName || activityUser.email}</p></div><button type="button" onClick={() => setActivityUser(null)} aria-label="Đóng lịch sử hoạt động" className="rounded-lg p-2 hover:bg-white/10" data-erp-modal-close><X className="h-5 w-5" /></button></div>
            <UserActivityTimeline tenantId={activityUser.companyCode || userProfile?.companyCode || ""} userId={activityUser.uid} loadActivity={userProfile?.role === "superadmin" ? undefined : async (_tenantId, userId, filters) => authService.getUserActivity(userId, filters as any)} />
          </div>
        </div>
      )}

      {/* Custom confirm dialog */}
      {confirmState && (
        <ConfirmDialog
          isOpen={confirmState.isOpen}
          title={confirmState.title}
          description={confirmState.description}
          confirmLabel={confirmState.confirmLabel}
          cancelLabel={confirmState.cancelLabel}
          onClose={() => setConfirmState(null)}
          onConfirm={confirmState.onConfirm}
        />
      )}
    </div>
  );
}

