import { AI_CREDITS_ENABLED } from "../../shared/features";
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
import { Shield, RefreshCw, Plus, User, X, Wallet, Mail, Lock, SlidersHorizontal } from "lucide-react";
import { parseFirebaseError } from "../utils/firebaseErrorParser";
import { getApiErrorMessage } from "../utils/errorMessage";
import { rolePermissionService, RolePermission, Permission } from "../services/rolePermissionService";
import { CompanyModal } from "../components/user-admin/CompanyModal";
import { UserAdminHeader } from "../components/user-admin/UserAdminHeader";
import { UserAdminTabs } from "../components/user-admin/UserAdminTabs";
import { UserFiltersBar } from "../components/user-admin/UserFiltersBar";
import { UserListTable } from "../components/user-admin/UserListTable";
import { CompanyEditFormState, CompanyFormState, UserAdminTabKey } from "../components/user-admin/types";
import { UserFormModal } from "../components/user-admin/UserFormModal";
import { RoleModal } from "../components/user-admin/RoleModal";
import { ConfirmDialog } from "../components/common/ConfirmDialog";
import { MODULE_KEYS } from "../config/modules";
import { getPermissionLabel, getRoleDisplayName } from "../utils/permissionUtils";
import { DEFAULT_ROLE_PERMISSIONS as SHARED_DEFAULT_ROLE_PERMISSIONS } from "../../shared/permissions";
import CreateBlogAuthorModal from "../components/blog/CreateBlogAuthorModal";

export default function UserAdminTab() {
  const { userProfile } = useAuth();
  const { activeBranchId } = useBranch();
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
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
    cancelLabel = "Hủy",
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
  const [selectedModules, setSelectedModules] = useState<string[]>([...MODULE_KEYS]);

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
  const [userDepartmentId, setUserDepartmentId] = useState("");
  const [userDepartment, setUserDepartment] = useState("");
  const [userQualification, setUserQualification] = useState("");
  const [userJobDescriptionLink, setUserJobDescriptionLink] = useState("");
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
    setUserDepartmentId("");
    setUserDepartment("");
    setUserQualification("");
    setUserJobDescriptionLink("");
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
  const [activeTab, setActiveTab] = useState<UserAdminTabKey>("users");
  const [isBlogAuthorModalOpen, setIsBlogAuthorModalOpen] = useState(false);
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
  const [scrolledDown, setScrolledDown] = useState(false);
  const lastScrollY = React.useRef(0);

  useEffect(() => {
    const handleScroll = (e: Event) => {
      if (window.innerWidth >= 768) {
        setScrolledDown(false);
        return;
      }
      const target = e.target as HTMLElement;
      if (target && (target.id === "user_admin_content" || target.id === "roles_permissions_tab_content")) {
        const currentScrollY = target.scrollTop;
        if (currentScrollY < 65) {
          setScrolledDown(false);
          lastScrollY.current = currentScrollY;
          return;
        }
        const diff = currentScrollY - lastScrollY.current;
        if (Math.abs(diff) < 15) return;
        if (diff > 0) {
          setScrolledDown(true);
        } else {
          setScrolledDown(false);
        }
        lastScrollY.current = currentScrollY;
      }
    };
    window.addEventListener("scroll", handleScroll, true);
    return () => window.removeEventListener("scroll", handleScroll, true);
  }, []);

  // Role Permission States
  const [rolePermissionsList, setRolePermissionsList] = useState<RolePermission[]>([]);
  const [systemPermissions, setSystemPermissions] = useState<Permission[]>([]);
  const [permissionCatalogError, setPermissionCatalogError] = useState("");
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
    if (!isUserModalOpen || !userCompanyCode || userCompanyCode === "SYSTEM") {
      setBranches([]);
      return;
    }
    branchService
      .list()
      .then(setBranches)
      .catch(() => setBranches([]));
  }, [isUserModalOpen, userCompanyCode]);

  // Handle parentId based on userRole and userCompanyCode automatically
  useEffect(() => {
    if (isUserModalOpen) {
      if (userRole === "manager") {
        if (userCompanyCode && userCompanyCode !== "SYSTEM") {
          const companyAdmin = usersList.find((u) => u.companyCode === userCompanyCode && u.role === "admin");
          setUserParentId(companyAdmin?.uid || "");
        } else {
          setUserParentId("");
        }
      } else {
        setUserParentId("");
      }
    }
  }, [userRole, userCompanyCode, usersList, isUserModalOpen]);

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
    setPermissionCatalogError("");
    try {
      const data = await rolePermissionService.getPermissions();
      if (data && data.length > 0) {
        setSystemPermissions(data);
      } else {
        setSystemPermissions([]);
        setPermissionCatalogError("Danh mục quyền hệ thống đang trống. Không thể lưu phân quyền.");
      }
    } catch (error) {
      console.error("Lấy mã quyền hệ thống thất bại:", error);
      setSystemPermissions([]);
      setPermissionCatalogError("Không thể tải danh mục quyền hệ thống. Vui lòng thử lại.");
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchCompanies();
    fetchRolePermissions();
    fetchSystemPermissions();
  }, [
    userProfile?.uid,
    userProfile?.role,
    userProfile?.companyCode,
    userProfile?.branchId,
    selectedCompanyCode,
    activeBranchId,
  ]);

  // Close action menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-action-menu]")) {
        setOpenActionMenuId(null);
      }
    };

    if (openActionMenuId) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [openActionMenuId]);

  useEffect(() => {
    setUserPage(1);
  }, [searchQuery, filterStartDate, filterEndDate, selectedCompanyCode, userProfile?.role]);

  const getAvailableRoles = (targetUser?: UserProfile | null) => {
    const isSuperAdmin = userProfile?.role === "superadmin";
    const currentTarget = targetUser !== undefined ? targetUser : (isUserModalOpen ? editingUser : null);

    const defaultRoles: Array<{ role: string; displayName: string; level: number }> = [
      { role: "user", displayName: getRoleDisplayName("user"), level: 4 },
      { role: "manager", displayName: getRoleDisplayName("manager"), level: 3 },
      { role: "branch_owner", displayName: getRoleDisplayName("branch_owner"), level: 2 },
    ];

    // Quyền admin / superadmin: Chỉ Superadmin mới có quyền gán hoặc tạo tài khoản Admin.
    // Nếu tài khoản đang được chỉnh sửa vốn dĩ đã là Admin thì chỉ giữ lại để hiển thị (disabled).
    if (isSuperAdmin || currentTarget?.role === "admin") {
      defaultRoles.push(
        { role: "admin", displayName: getRoleDisplayName("admin"), level: 2 },
      );
    }

    if (isSuperAdmin || currentTarget?.role === "superadmin") {
      defaultRoles.push(
        { role: "superadmin", displayName: getRoleDisplayName("superadmin"), level: 1 },
      );
    }

    if (isSuperAdmin || currentTarget?.role === "blog_editor") {
      defaultRoles.push(
        { role: "blog_editor", displayName: "Ban biên tập Blog / Tác giả đặc quyền", level: 3 },
      );
    }

    // Merge with custom roles
    const customRoles = rolePermissionsList
      .filter((rp) => !["user", "manager", "admin", "superadmin"].includes(rp.role))
      .map((rp) => ({
        role: rp.role,
        displayName: getRoleDisplayName(rp.role, rp.displayName),
        level: rp.level,
      }));

    const allRoles = [...defaultRoles, ...customRoles];

    // Ensure the existing role of the target user is included
    if (currentTarget?.role && !allRoles.some((r) => r.role === currentTarget.role)) {
      allRoles.push({
        role: currentTarget.role,
        displayName: getRoleDisplayName(currentTarget.role),
        level: 2,
      });
    }

    // Phân quyền chọn vai trò:
    // - Superadmin: được tạo/gán tất cả vai trò.
    // - Admin / Người dùng khác: tuyệt đối không được gán vai trò Admin hoặc Superadmin cho bất kỳ tài khoản nào.
    //   (Nếu tài khoản vốn là Admin thì chỉ giữ lại vai trò Admin để hiển thị cố định).
    return allRoles.filter((r) => {
      if (isSuperAdmin) return true;
      if (currentTarget?.role === "admin") return r.role === "admin";
      if (r.role === "admin" || r.role === "superadmin") return false;
      return r.level >= 2;
    });
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
  const paginatedVisibleUsers = visibleUsers.slice((safeUserPage - 1) * USERS_PER_PAGE, safeUserPage * USERS_PER_PAGE);

  const handleRoleChange = async (
    targetUid: string,
    targetName: string,
    newRole: "user" | "manager" | "admin" | "superadmin",
  ) => {
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
            const dept =
              newRole === "admin" || newRole === "superadmin"
                ? "Ban Giám đốc"
                : newRole === "manager"
                  ? "Quản lý"
                  : "Nhân viên";
            const div =
              newRole === "admin" || newRole === "superadmin"
                ? "Ban Giám đốc"
                : newRole === "manager"
                  ? "Quản lý"
                  : "Nhân viên";
            const title = newRole === "admin" ? "CEO" : newRole === "manager" ? "Quản lý phòng ban" : "Nhân viên";
            return { ...u, role: newRole, department: dept, division: div, jobTitle: title };
          }
          return u;
        }),
      );
    } catch (error) {
      console.error("Lỗi cập nhật quyền:", error);
      toast.error(getApiErrorMessage(error, "Lỗi khi cập nhật quyền hạn người dùng."));
    }
  };

  const handleRegisterCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !companyName.trim() ||
      !companyCode.trim() ||
      !ownerName.trim() ||
      !ownerEmail.trim() ||
      !ownerPassword.trim()
    ) {
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
        selectedModules,
      );
      toast.success(`Đăng ký doanh nghiệp ${companyName} và tài khoản Admin thành công!`);
      setIsCompanyModalOpen(false);
      // Reset form
      setCompanyName("");
      setCompanyCode("");
      setOwnerName("");
      setOwnerEmail("");
      setOwnerPassword("");
      setSelectedModules([...MODULE_KEYS]);
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
      enabledModules: targetCompany.enabledModules?.length ? targetCompany.enabledModules : [...MODULE_KEYS],
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
    if (userProfile?.role !== "superadmin" && ["admin", "superadmin"].includes(userRole)) {
      if (!editingUser || editingUser.role !== userRole) {
        toast.warning("Chỉ Superadmin được tạo hoặc cấp vai trò Admin/Superadmin.");
        return;
      }
    }
    if (!userDisplayName.trim() || !userEmail.trim() || !userCompanyCode) {
      toast.warning("Vui lòng điền đầy đủ thông tin người dùng!");
      return;
    }
    if (!editingUser && userPassword.length < 6) {
      toast.warning("Mật khẩu phải từ 6 ký tự trở lên!");
      return;
    }
    if (editingUser && userPassword.trim() && userPassword.trim().length < 6) {
      toast.warning("Mật khẩu mới phải từ 6 ký tự trở lên!");
      return;
    }
    setSubmittingUser(true);
    try {
      let compName = "";
      if (userCompanyCode === "SYSTEM") {
        compName = "Hệ thống";
      } else {
        const found = companies.find((c) => c.code === userCompanyCode);
        compName = found ? found.name : userCompanyCode;
      }

      // Tìm level của người quản lý để tính level nhân viên mới
      const managerProfile = userParentId ? usersList.find((u) => u.uid === userParentId) : null;

      if (editingUser) {
        await authService.updateUser(editingUser.uid, {
          displayName: userDisplayName.trim(),
          role: userRole,
          companyCode: userCompanyCode,
          companyName: compName,
          ...(userPassword.trim() ? { password: userPassword.trim() } : {}),
          parentId: userParentId || null,
          level: managerProfile?.level
            ? managerProfile.level + 1
            : (userRole === "admin" ? 1 : userRole === "branch_owner" ? 2 : userRole === "manager" ? 3 : 4),
          departmentId: userDepartmentId || undefined,
          department: userDepartment.trim() || "",
          division: userDepartment.trim() || "",
          phone: userPhone.trim(),
          birthDate: userBirthDate || null,
          qualification: userQualification.trim(),
          jobDescriptionLink: userJobDescriptionLink.trim() || "",
          monthlySalary: userMonthlySalary === "" ? undefined : Number(userMonthlySalary),
          branchId: userBranchId || null,
        });

        toast.success(`Đã cập nhật tài khoản "${userDisplayName}".`);
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
          userPhone.trim() || undefined,
          undefined,
          userJobDescriptionLink.trim() || undefined,
          userBranchId || undefined,
          userBirthDate || undefined,
          userQualification.trim() || undefined,
          userMonthlySalary === "" ? undefined : Number(userMonthlySalary),
          userDepartmentId || undefined,
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
        editingUser ? "Không thể cập nhật người dùng." : "Không thể đăng ký người dùng mới.",
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
    setUserDepartmentId(user.departmentId || "");
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
      "Hủy",
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
      "Hủy",
    );
  };

  return (
    <div className={`flex flex-col h-full bg-white max-h-[85vh] overflow-hidden ${scrolledDown ? "admin-scrolled-down" : ""}`} id="user_admin_tab_wrapper">
      <h1 className="sr-only">Quản trị Hệ thống & Phân quyền - {activeTab}</h1>

      {userProfile?.role === "admin" && <a href="/company-invitations" className="m-3 w-fit rounded-lg border px-4 py-2 font-semibold text-emerald-700">Mời nhân viên qua email</a>}
      {AI_CREDITS_ENABLED && userProfile?.role === "admin" && <a href="/company-wallet" className="m-3 w-fit rounded-lg border px-4 py-2 font-semibold text-emerald-700">Ví Credit công ty</a>}
      <UserAdminHeader
        userProfile={userProfile}
        companies={companies}
        selectedCompanyCode={selectedCompanyCode}
        onSelectedCompanyCodeChange={setSelectedCompanyCode}
        onOpenCompanyModal={() => setIsCompanyModalOpen(true)}
        onOpenCreateUserModal={openCreateUserModal}
        onOpenBlogAuthorModal={() => setIsBlogAuthorModalOpen(true)}
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
          <div className="flex-1 p-6 overflow-y-auto" id="user_admin_content">
            {loading ? (
              <div className="h-48 flex flex-col items-center justify-center text-center">
                <RefreshCw className="h-8 w-8 text-indigo-650 animate-spin mb-3" />
                <span className="text-xs font-bold font-mono text-indigo-800 uppercase tracking-widest">
                  Đang tải danh sách tài khoản...
                </span>
              </div>
            ) : visibleUsers.length === 0 ? (
              <div className="p-12 text-center bg-gray-50 text-gray-400 italic rounded-2xl border border-dashed">
                Không tìm thấy tài khoản nào trong hệ thống!
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
              />
            )}
          </div>
        </>
      ) : (
        <div className="flex-1 p-6 overflow-y-auto space-y-6" id="roles_permissions_tab_content">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center bg-gray-50 p-4 rounded-2xl border border-gray-150 gap-4">
            <div>
              <h5 className="font-bold text-slate-800 text-sm">Danh sách vai trò & Cấu hình phân quyền</h5>
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
              className="p-2 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold font-sans flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-emerald-600/10 active:scale-95 text-center justify-center"
            >
              <Plus className="h-3.5 w-3.5" />
              Thêm vai trò tùy chỉnh
            </button>
          </div>

          {roleLoading ? (
            <div className="h-48 flex flex-col items-center justify-center text-center">
              <RefreshCw className="h-8 w-8 text-indigo-650 animate-spin mb-3" />
              <span className="text-xs font-bold font-mono text-indigo-800 uppercase tracking-widest">
                Đang tải danh sách vai trò...
              </span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Render Default roles and Custom roles */}
              {(() => {
                const defaultRolesList = [
                  {
                    role: "admin",
                    displayName: getRoleDisplayName("admin"),
                    level: 2,
                    isDefault: true,
                    permissions: SHARED_DEFAULT_ROLE_PERMISSIONS.admin,
                  },
                  {
                    role: "manager",
                    displayName: getRoleDisplayName("manager"),
                    level: 3,
                    isDefault: true,
                    permissions: SHARED_DEFAULT_ROLE_PERMISSIONS.manager,
                  },
                  {
                    role: "branch_owner",
                    displayName: getRoleDisplayName("branch_owner"),
                    level: 2,
                    isDefault: true,
                    permissions: SHARED_DEFAULT_ROLE_PERMISSIONS.branch_owner,
                  },
                  {
                    role: "user",
                    displayName: getRoleDisplayName("user"),
                    level: 4,
                    isDefault: true,
                    permissions: SHARED_DEFAULT_ROLE_PERMISSIONS.user,
                  },
                ];

                const customRolesList = rolePermissionsList.filter(
                  (rp) => !["superadmin", "admin", "manager", "branch_owner", "user"].includes(rp.role),
                );

                const rolesToDisplay = [
                  ...defaultRolesList.map((dr) => {
                    const dbRecord = rolePermissionsList.find((rp) => rp.role === dr.role);
                    return {
                      ...dr,
                      permissions: dbRecord ? dbRecord.permissions : SHARED_DEFAULT_ROLE_PERMISSIONS[dr.role] || [],
                      displayName: dbRecord?.displayName || dr.displayName,
                      level: dbRecord?.level || dr.level,
                      _id: dbRecord?._id,
                    };
                  }),
                  ...customRolesList.map((cr) => ({
                    role: cr.role,
                    displayName: getRoleDisplayName(cr.role, cr.displayName),
                    level: cr.level,
                    permissions: cr.permissions,
                    isDefault: false,
                    _id: cr._id,
                  })),
                ];

                return rolesToDisplay.map((roleInfo) => {
                  return (
                    <div
                      key={roleInfo.role}
                      className="bg-white border border-gray-150 hover:border-indigo-200 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between gap-4"
                    >
                      <div className="space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded text-[9px] font-bold font-mono tracking-wider">
                              LEVEL {userProfile?.role === "superadmin" ? roleInfo.level : roleInfo.level - 1}
                            </span>
                            <h6 className="font-bold text-slate-800 text-sm mt-1">{roleInfo.displayName}</h6>
                          </div>
                          {roleInfo.isDefault && (
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-150 rounded-sm text-[8px] font-bold font-mono">
                              MẶC ĐỊNH
                            </span>
                          )}
                        </div>

                        {/* Permissions display */}
                        <div className="space-y-1.5 text-left">
                          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                            Các quyền được cấp phép:
                          </span>
                          <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                            {roleInfo.permissions.length === 0 ? (
                              <span className="text-[10px] text-gray-400 italic">Chưa cấu hình quyền nào</span>
                            ) : roleInfo.permissions.includes("*") ? (
                              <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-[10px] font-bold flex items-center gap-1">
                                ✓ Toàn quyền hệ thống
                              </span>
                            ) : (
                              roleInfo.permissions.map((p) => {
                                const sysPerm = systemPermissions.find((sp) => sp.code === p);
                                const labelText = getPermissionLabel(p, sysPerm?.name);
                                return (
                                  <span
                                    key={p}
                                    className="px-2 py-0.75 bg-indigo-50 text-indigo-800 border border-indigo-150 rounded-lg text-[10px] font-semibold"
                                    title={`Mã hệ thống: ${p}`}
                                  >
                                    {labelText}
                                  </span>
                                );
                              })
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
                            Thiết lập phân quyền
                          </button>
                        )}
                        {!roleInfo.isDefault && (
                          <button
                            onClick={() => handleDeleteRole(roleInfo)}
                            className="p-1.5 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl text-[10px] font-bold text-red-650 cursor-pointer transition-all active:scale-95"
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
        form={editingCompany || { id: "", name: "", code: "", ownerEmail: "", enabledModules: [...MODULE_KEYS] }}
        submitting={submittingCompany}
        onClose={() => setIsEditCompanyModalOpen(false)}
        onChange={(field, value) => handleEditCompanyFormChange(field as keyof CompanyEditFormState, value)}
        onModulesChange={(enabledModules) => setEditingCompany((prev) => (prev ? { ...prev, enabledModules } : prev))}
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
        userDepartmentId={userDepartmentId}
        setUserDepartmentId={setUserDepartmentId}
        userDepartment={userDepartment}
        setUserDepartment={setUserDepartment}
        userQualification={userQualification}
        setUserQualification={setUserQualification}
        userJobDescriptionLink={userJobDescriptionLink}
        userMonthlySalary={userMonthlySalary}
        setUserMonthlySalary={setUserMonthlySalary}
        setUserJobDescriptionLink={setUserJobDescriptionLink}
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
        catalogError={permissionCatalogError}
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

      {/* Modal Cấp Quyền Ban Biên Tập Dành Riêng Cho Superadmin */}
      {userProfile?.role === "superadmin" && (
        <CreateBlogAuthorModal
          open={isBlogAuthorModalOpen}
          onClose={() => setIsBlogAuthorModalOpen(false)}
          onSuccess={fetchUsers}
        />
      )}
    </div>
  );
}
