import React, { useState, useEffect, useRef } from "react";
import {
  Users,
  Search,
  Plus,
  Building2,
  Trash2,
  X,
  RefreshCw,
  Activity,
  Briefcase,
  MapPin,
  Phone,
  Mail,
  UserPlus,
  Maximize2,
  Minimize2,
  Edit,
  Link2,
  Upload,
  Eye,
  CalendarDays,
  List,
  Network,
  Crown
} from "lucide-react";
import { HrFormSelect } from "./HrFormSelect";
import { HrDepartmentManager } from "./HrDepartmentManager";
import { hrDepartmentService, type HrDepartment } from "../../services/hrDepartmentService";
import { EmployeeNode, UserProfile, TrainingCourse } from "../../types";
import { authService, getAccessToken } from "../../services/authService";
import { toast } from "../../pages/Toast";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { getApiErrorMessage } from "../../utils/errorMessage";
import { filterOrgChartEmployees, getManagerForEmployee } from "./orgChartUtils";
import { useIsMobile } from "../../hooks/useMediaQuery";

interface OrgChartTabProps {
  userProfile: any;
  selectedCompanyCode: string;
  usersList: UserProfile[];
  employees: EmployeeNode[];
  fetchUsers: () => Promise<void>;
  isManager: boolean;
  canManageDepartments: boolean;
  companies: any[];
  courses: TrainingCourse[];
  fetchCourses: (compCode: string) => Promise<void>;
  loading: boolean;
  activeBranchId?: string;
}

const isUrl = (str?: string): boolean => {
  if (!str) return false;
  return str.startsWith("http://") || str.startsWith("https://") || str.startsWith("data:image/") || str.startsWith("/");
};

const normalizeString = (str: string): string => {
  return String(str ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d");
};

const parseDurationToHours = (durationStr: string): number => {
  if (!durationStr) return 0;
  const cleanStr = durationStr.toLowerCase().trim();
  const match = cleanStr.match(/(\d+(\.\d+)?)/);
  if (!match) return 0;
  const value = parseFloat(match[1]);

  if (cleanStr.includes("phut") || cleanStr.includes("m") || cleanStr.includes("minutes") || cleanStr.includes("minute")) {
    return Number((value / 60).toFixed(1));
  }
  return value;
};

const renderAvatar = (avatar: string, sizeClasses: string = "w-8 h-8", textClass: string = "text-base") => {
  if (isUrl(avatar)) {
    return (
      <div className={`${sizeClasses} rounded-full overflow-hidden shrink-0 flex items-center justify-center border border-gray-150`}>
        <img src={avatar} className="w-full h-full object-cover" alt="Avatar nhân sự" />
      </div>
    );
  }
  return (
    <div className={`${sizeClasses} bg-slate-50 rounded-full shrink-0 flex items-center justify-center border border-gray-100 select-none`}>
      <span className={textClass}>{avatar || "👤"}</span>
    </div>
  );
};

const FUNCTIONAL_CATEGORIES = [
  { key: "governance", label: "Quản trị", badge: "GOVERNANCE", color: "bg-slate-900", border: "border-t-4 border-slate-900", dot: "#0f172a" },
  { key: "finance", label: "Tài chính - Pháp lý", badge: "FINANCE", color: "bg-emerald-500", border: "border-t-4 border-emerald-500", dot: "#10b981" },
  { key: "tech", label: "Hệ thống & Công nghệ", badge: "TECH", color: "bg-indigo-655", border: "border-t-4 border-indigo-650", dot: "#4f46e5" },
  { key: "operations", label: "Vận hành - Sản xuất", badge: "OPERATIONS", color: "bg-cyan-500", border: "border-t-4 border-cyan-500", dot: "#06b6d4" },
  { key: "sales", label: "Kinh doanh & Tiếp thị", badge: "SALES", color: "bg-amber-500", border: "border-t-4 border-amber-500", dot: "#f59e0b" },
  { key: "hr", label: "Hành chính & Nhân sự", badge: "HR", color: "bg-rose-500", border: "border-t-4 border-rose-500", dot: "#f43f5e" },
  { key: "other", label: "Khác", badge: "OTHER", color: "bg-slate-500", border: "border-t-4 border-slate-500", dot: "#64748b" }
];

const getCategoryByDivision = (division: string) => {
  const divLower = (division || "").toLowerCase();
  if (
    divLower.includes("quản trị") ||
    divLower.includes("giám đốc") ||
    divLower.includes("governance") ||
    divLower.includes("ceo") ||
    divLower.includes("coo") ||
    divLower.includes("hội đồng") ||
    divLower.includes("kiểm soát")
  ) {
    return FUNCTIONAL_CATEGORIES[0];
  }
  if (
    divLower.includes("tài chính") ||
    divLower.includes("kế toán") ||
    divLower.includes("pháp lý") ||
    divLower.includes("finance") ||
    divLower.includes("legal")
  ) {
    return FUNCTIONAL_CATEGORIES[1];
  }
  if (
    divLower.includes("kỹ thuật") ||
    divLower.includes("công nghệ") ||
    divLower.includes("hệ thống") ||
    divLower.includes("tech") ||
    divLower.includes("it") ||
    divLower.includes("phần mềm") ||
    divLower.includes("software")
  ) {
    return FUNCTIONAL_CATEGORIES[2];
  }
  if (
    divLower.includes("vận hành") ||
    divLower.includes("sản xuất") ||
    divLower.includes("kho") ||
    divLower.includes("operations") ||
    divLower.includes("logistics")
  ) {
    return FUNCTIONAL_CATEGORIES[3];
  }
  if (
    divLower.includes("kinh doanh") ||
    divLower.includes("tiếp thị") ||
    divLower.includes("sales") ||
    divLower.includes("marketing") ||
    divLower.includes("csm") ||
    divLower.includes("cso") ||
    divLower.includes("thương mại")
  ) {
    return FUNCTIONAL_CATEGORIES[4];
  }
  if (
    divLower.includes("nhân sự") ||
    divLower.includes("hành chính") ||
    divLower.includes("hr") ||
    divLower.includes("admin") ||
    divLower.includes("tuyển dụng") ||
    divLower.includes("đào tạo")
  ) {
    return FUNCTIONAL_CATEGORIES[5];
  }
  return FUNCTIONAL_CATEGORIES[6];
};

export default function OrgChartTab({
  userProfile,
  selectedCompanyCode,
  usersList,
  employees,
  fetchUsers,
  isManager,
  canManageDepartments,
  companies,
  courses,
  fetchCourses,
  loading,
  activeBranchId,
}: OrgChartTabProps) {
  const isMobile = useIsMobile();
  const [zoomLevel, setZoomLevel] = useState<number>(0.65);
  const [isChartFullscreen, setIsChartFullscreen] = useState(false);
  const [isSafari, setIsSafari] = useState<boolean>(false);
  const [departments, setDepartments] = useState<HrDepartment[]>([]);
  const [isDepartmentManagerOpen, setIsDepartmentManagerOpen] = useState(false);
  const departmentCompanyCode = selectedCompanyCode || userProfile?.companyCode || "";

  const refreshDepartments = async () => {
    if (!departmentCompanyCode) return;
    setDepartments(await hrDepartmentService.list(departmentCompanyCode));
  };

  useEffect(() => {
    let active = true;
    setDepartments([]);
    if (departmentCompanyCode) {
      hrDepartmentService.list(departmentCompanyCode)
        .then(data => { if (active) setDepartments(data); })
        .catch(error => { if (active) toast.error(getApiErrorMessage(error, "Không thể tải phòng ban.")); });
    }
    return () => { active = false; };
  }, [departmentCompanyCode]);
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
  const containerRef = useRef<HTMLDivElement>(null);
  const chartViewportRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startY, setStartY] = useState(0);
  const [scrollLeftState, setScrollLeftState] = useState(0);
  const [scrollTopState, setScrollTopState] = useState(0);

  useEffect(() => {
    const syncFullscreen = () => setIsChartFullscreen(document.fullscreenElement === chartViewportRef.current);
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);

  const toggleChartFullscreen = async () => {
    if (document.fullscreenElement === chartViewportRef.current) {
      await document.exitFullscreen();
    } else if (chartViewportRef.current) {
      await chartViewportRef.current.requestFullscreen();
    }
  };

  const hasDragMovedRef = useRef(false);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (
      target.closest("button") ||
      target.closest("select") ||
      target.closest("input") ||
      target.closest("[draggable='true']")
    ) {
      return;
    }
    hasDragMovedRef.current = false;
    if (containerRef.current) {
      setStartX(e.pageX - containerRef.current.offsetLeft);
      setStartY(e.pageY - containerRef.current.offsetTop);
      setScrollLeftState(containerRef.current.scrollLeft);
      setScrollTopState(containerRef.current.scrollTop);
    }
    setIsDragging(true);
  };

  const handleMouseLeaveOrUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !containerRef.current) return;
    e.preventDefault();
    const x = e.pageX - containerRef.current.offsetLeft;
    const y = e.pageY - containerRef.current.offsetTop;
    const walkX = (x - startX) * 1.5;
    const walkY = (y - startY) * 1.5;
    // Only activate panning after moving more than 5px (prevents click suppression on laptop trackpads)
    if (!hasDragMovedRef.current && Math.abs(walkX) < 5 && Math.abs(walkY) < 5) return;
    hasDragMovedRef.current = true;
    containerRef.current.scrollLeft = scrollLeftState - walkX;
    containerRef.current.scrollTop = scrollTopState - walkY;
  };

  // Lắng nghe sự kiện wheel với passive: false để chặn touchpad/trackpad zoom toàn trang
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleNativeWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const zoomFactor = e.deltaY < 0 ? 0.05 : -0.05;
      setZoomLevel((prev) => Math.max(0.3, Math.min(1.8, Number((prev + zoomFactor).toFixed(2)))));
    };

    container.addEventListener("wheel", handleNativeWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", handleNativeWheel);
    };
  }, []);

  const [filterDepartment, setFilterDepartment] = useState<string>("Tất cả");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());
  const [selectedEmp, setSelectedEmp] = useState<EmployeeNode | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [activeDropdownCardId, setActiveDropdownCardId] = useState<string | null>(null);
  const [selectedLeaveBalance, setSelectedLeaveBalance] = useState<any>(null);
  const [viewMode, setViewMode] = useState<"tree" | "list">("tree");
  const [listPage, setListPage] = useState<number>(1);
  const listLimit = 10;

  useEffect(() => {
    setListPage(1);
  }, [searchQuery, filterDepartment]);

  useEffect(() => {
    if (!selectedEmp || !selectedCompanyCode) {
      setSelectedLeaveBalance(null);
      return;
    }
    const loadLeaveBalance = async () => {
      try {
        const res = await fetch(`/api/v1/leave/balance?employeeId=${encodeURIComponent(selectedEmp.id)}&year=${new Date().getFullYear()}`, { headers: { Authorization: `Bearer ${getAccessToken()}` } });
        if (res.ok) setSelectedLeaveBalance((await res.json()).data || null);
      } catch (error) { console.error("Không thể tải số phép nhân viên", error); }
    };
    loadLeaveBalance();
  }, [selectedEmp?.id, selectedCompanyCode]);

  useEffect(() => {
    if (selectedEmp) {
      setIsDetailModalOpen(true);
    } else {
      setIsDetailModalOpen(false);
    }
  }, [selectedEmp?.id]);

  const closeDetailModal = () => {
    setIsDetailModalOpen(false);
    setSelectedEmp(null);
    setSelectedLeaveBalance(null);
    setIsEditing(false);
  };

  const getDirectSubordinates = (nodeId: string): EmployeeNode[] => {
    return employees.filter(e => e.parentId === nodeId);
  };

  // Add Employee Modal States

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAddingEmployee, setIsAddingEmployee] = useState(false);
  const [addName, setAddName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addPassword, setAddPassword] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [addDepartment, setAddDepartment] = useState("");
  const [isNewAddDepartment, setIsNewAddDepartment] = useState(false);
  const [addParentId, setAddParentId] = useState("");
  const [addRole, setAddRole] = useState<"user" | "manager" | "branch_owner" | "admin">("user");
  const [addJobDescriptionLink, setAddJobDescriptionLink] = useState("");
  const [addJobDescriptionUploadToken, setAddJobDescriptionUploadToken] = useState("");
  const [addQualification, setAddQualification] = useState("");
  const [addMonthlySalary, setAddMonthlySalary] = useState("");
  const [uploadingAddJobDescription, setUploadingAddJobDescription] = useState(false);
  const addJobDescriptionFileInputRef = useRef<HTMLInputElement>(null);

  // Edit Employee States
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editRoleText, setEditRoleText] = useState("");
  const [editQualification, setEditQualification] = useState("");
  const [editDivision, setEditDivision] = useState("");
  const [editDepartment, setEditDepartment] = useState("");
  const [isNewEditDepartment, setIsNewEditDepartment] = useState(false);
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editLevel, setEditLevel] = useState<number>(4);
  const [editParentId, setEditParentId] = useState("");
  const [editJobDescriptionLink, setEditJobDescriptionLink] = useState("");
  const [editJobDescriptionUploadToken, setEditJobDescriptionUploadToken] = useState("");
  const [editMonthlySalary, setEditMonthlySalary] = useState("");
  const [uploadingEditJobDescription, setUploadingEditJobDescription] = useState(false);
  const [showJobDescriptionPreview, setShowJobDescriptionPreview] = useState(false);
  const editJobDescriptionFileInputRef = useRef<HTMLInputElement>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingLeader, setIsSavingLeader] = useState(false);

  // Reset editing state when selected employee changes
  useEffect(() => {
    setIsEditing(false);
  }, [selectedEmp?.id]);

  const startEditing = () => {
    if (!selectedEmp) return;
    setEditName(selectedEmp.name || "");
    setEditRoleText(selectedEmp.role || "");
    setEditQualification(selectedEmp.qualification || "");
    setEditDivision(selectedEmp.division || "Khối Vận Hành");
    setEditDepartment(selectedEmp.department || "");
    setIsNewEditDepartment(false);
    setEditMonthlySalary(selectedEmp.monthlySalary == null ? "" : String(selectedEmp.monthlySalary));
    setEditEmail(selectedEmp.email || "");
    setEditPhone(selectedEmp.phone && selectedEmp.phone !== "Chưa cập nhật" ? selectedEmp.phone : "");
    setEditLevel(selectedEmp.level || 4);
    setEditParentId(selectedEmp.parentId || "");
    setEditJobDescriptionLink(selectedEmp.jobDescriptionLink || "");
    setEditJobDescriptionUploadToken("");
    setIsEditing(true);
  };

  const handleToggleLeader = async () => {
    if (!selectedEmp) return;
    try {
      setIsSavingLeader(true);
      const newLeaderState = !selectedEmp.isLeader;
      await authService.updateUser(selectedEmp.id, { isLeader: newLeaderState });
      toast.success(
        newLeaderState
          ? `Đã đặt ${selectedEmp.name} làm Trưởng nhóm (Leader) phòng ban!`
          : `Đã hủy chức vụ Trưởng nhóm (Leader) của ${selectedEmp.name}!`
      );
      setSelectedEmp(prev => prev ? { ...prev, isLeader: newLeaderState } : null);
      await fetchUsers();
    } catch (err) {
      console.error("Lỗi cập nhật chức danh leader:", err);
      toast.error(getApiErrorMessage(err, "Không thể cập nhật chức vụ Trưởng nhóm."));
    } finally {
      setIsSavingLeader(false);
    }
  };

  const handleJobDescriptionFileChange = async (e: React.ChangeEvent<HTMLInputElement>, target: "add" | "edit") => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const setUploading = target === "add" ? setUploadingAddJobDescription : setUploadingEditJobDescription;
    const setLink = target === "add" ? setAddJobDescriptionLink : setEditJobDescriptionLink;
    const setToken = target === "add" ? setAddJobDescriptionUploadToken : setEditJobDescriptionUploadToken;

    setUploading(true);
    try {
      const uploaded = await authService.uploadManagedFile(file, "hr.org-chart", selectedCompanyCode || userProfile?.companyCode);
      setLink(uploaded.url);
      setToken(uploaded.uploadToken);
      toast.success("Đã tải lên mô tả công việc.");
    } catch (error: any) {
      toast.error(error?.message || "Tải file mô tả công việc lên Cloudinary thất bại.");
    } finally {
      setUploading(false);
    }
  };

  const handleEditEmployeeSave = async () => {
    if (!selectedEmp) return;

    if (!editName.trim()) {
      toast.warning("Vui lòng nhập đầy đủ Họ tên!");
      return;
    }
    if (isNewEditDepartment && !editDepartment.trim()) {
      toast.warning("Vui lòng nhập tên phòng ban mới!");
      return;
    }

    // Kiểm tra định dạng Số điện thoại Việt Nam (nếu nhập)
    if (editPhone.trim()) {
      const vnPhoneRegex = /^(0|\+84|84)(3|5|7|8|9)[0-9]{8}$/;
      if (!vnPhoneRegex.test(editPhone.trim().replace(/\s+/g, ""))) {
        toast.warning("Số điện thoại Việt Nam không đúng định dạng (ví dụ: 0987654321)!");
        return;
      }
    }

    // Kiểm tra trùng số điện thoại
    if (editPhone.trim()) {
      const phoneNormalized = editPhone.trim().replace(/\s+/g, "");
      const duplicatePhone = usersList.find(u => u.uid !== selectedEmp.id && u.phone && u.phone.replace(/\s+/g, "") === phoneNormalized);
      if (duplicatePhone) {
        toast.error(`❌ Số điện thoại "${editPhone.trim()}" đã được sử dụng bởi nhân sự khác!`);
        return;
      }
    }

    setIsSaving(true);
    try {
      const updateData = {
        displayName: editName.trim(),
        jobTitle: editRoleText.trim(),
        qualification: editQualification.trim(),
        division: editDivision,
        department: editDepartment.trim(),
        phone: editPhone.trim() || "",
        parentId: editParentId || null,
        jobDescriptionLink: editJobDescriptionLink.trim() || "",
        jobDescriptionUploadToken: editJobDescriptionUploadToken || undefined,
        monthlySalary: editMonthlySalary === "" ? undefined : Number(editMonthlySalary),
      };

      await authService.updateUser(selectedEmp.id, updateData);
      toast.success("Cập nhật thông tin nhân sự thành công!");
      setIsEditing(false);
      await fetchUsers();
      await refreshDepartments();

      // Cập nhật selectedEmp cục bộ
      const updatedNode = {
        ...selectedEmp,
        name: updateData.displayName,
        role: updateData.jobTitle,
        qualification: updateData.qualification,
        division: updateData.division,
        department: updateData.department,
        phone: updateData.phone || "Chưa cập nhật",
        parentId: updateData.parentId || undefined,
        jobDescriptionLink: updateData.jobDescriptionLink || "",
      };
      setSelectedEmp(updatedNode);
    } catch (err) {
      console.error(err);
      toast.error(getApiErrorMessage(err, "Lỗi khi cập nhật thông tin nhân sự."));
    } finally {
      setIsSaving(false);
    }
  };

  const canEditEmployee = (selectedEmpId: string): boolean => {
    if (!userProfile) return false;
    if (selectedEmpId === userProfile.uid) {
      // Cho phép admin, superadmin và manager tự chỉnh sửa thông tin của chính mình
      return ["superadmin", "admin", "manager"].includes(userProfile.role);
    }

    const selectedUserRaw = usersList.find(u => u.uid === selectedEmpId);
    if (!selectedUserRaw) return false;

    if (userProfile.role === "superadmin") return true;
    if (selectedUserRaw.role === "superadmin") return false;

    if (selectedUserRaw.companyCode !== userProfile.companyCode) return false;

    const rolesHierarchy = {
      superadmin: 4,
      admin: 3,
      manager: 2,
      user: 1
    };

    const currentUserWeight = rolesHierarchy[userProfile.role as keyof typeof rolesHierarchy] || 0;
    const selectedUserWeight = rolesHierarchy[selectedUserRaw.role as keyof typeof rolesHierarchy] || 0;

    return currentUserWeight >= selectedUserWeight;
  };

  const toggleCollapse = (nodeId: string) => {
    setCollapsedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  const collapseAll = () => {
    const nodesWithChildren = new Set(
      employees
        .filter(e => employees.some(c => c.parentId === e.id))
        .map(e => e.id)
    );
    setCollapsedNodes(nodesWithChildren);
  };

  const expandAll = () => setCollapsedNodes(new Set());

  const canDeleteEmployee = (selectedEmpId: string): boolean => {
    if (!userProfile) return false;
    if (selectedEmpId === userProfile.uid) return false; // Không tự xóa chính mình

    const selectedUserRaw = usersList.find(u => u.uid === selectedEmpId);
    if (!selectedUserRaw) return false;

    const rolesHierarchy = {
      superadmin: 4,
      admin: 3,
      manager: 2,
      user: 1
    };

    const currentUserWeight = rolesHierarchy[userProfile.role as keyof typeof rolesHierarchy] || 0;
    const selectedUserWeight = rolesHierarchy[selectedUserRaw.role as keyof typeof rolesHierarchy] || 0;

    return currentUserWeight > selectedUserWeight;
  };

  const deleteEmployeeConfirmed = async (empId: string) => {
    try {
      await authService.deleteUser(empId);
      toast.success("Đã xóa nhân sự thành công!");
      setSelectedEmp(null);
      await fetchUsers();
    } catch (error) {
      console.error("Lỗi khi xóa nhân sự:", error);
      toast.error(getApiErrorMessage(error, "Không thể xóa nhân sự. Vui lòng kiểm tra quyền hạn."));
    }
  };

  const handleDeleteEmployeeSubmit = (empId: string) => {
    const targetEmp = employees.find(e => e.id === empId);
    if (!targetEmp) return;

    askConfirm(
      "Xóa nhân sự này?",
      `Bạn có chắc chắn muốn xóa nhân sự "${targetEmp.name}" khỏi hệ thống? Sơ đồ sẽ tự động chuyển cấp dưới trực thuộc của nhân sự này báo cáo lên quản lý cấp trên.`,
      () => deleteEmployeeConfirmed(empId),
      "Xóa nhân sự",
      "Hủy"
    );
  };

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    const isSaf = ua.includes("safari") && !ua.includes("chrome") && !ua.includes("chromium");
    setIsSafari(isSaf);
  }, []);

  // Set default parentId when add employee modal is opened
  useEffect(() => {
    if (isAddModalOpen) {
      setAddRole("user");
      if (userProfile?.role === "manager") {
        setAddParentId(userProfile.uid);
      } else {
        const compCode = selectedCompanyCode || userProfile?.companyCode || "SYSTEM";
        const firstCompanyManager = usersList.find(
          (u) => u.companyCode === compCode && u.role === "manager"
        );
        const firstBranchOwner = usersList.find(
          (u) => u.companyCode === compCode && u.role === "branch_owner"
        );
        const firstAdmin = usersList.find(
          (u) => u.companyCode === compCode && u.role === "admin"
        );
        setAddParentId(firstCompanyManager?.uid || firstBranchOwner?.uid || firstAdmin?.uid || "");
      }
    }
  }, [isAddModalOpen, userProfile, selectedCompanyCode, usersList]);

  // Handle parentId based on addRole automatically
  useEffect(() => {
    if (isAddModalOpen) {
      const compCode = selectedCompanyCode || userProfile?.companyCode || "SYSTEM";
      if (addRole === "admin") {
        setAddParentId("");
      } else if (addRole === "branch_owner") {
        const companyAdmin = usersList.find(
          (u) => u.companyCode === compCode && u.role === "admin"
        );
        setAddParentId(companyAdmin?.uid || "");
      } else if (addRole === "manager") {
        const branchOwner = usersList.find(
          (u) => u.companyCode === compCode && u.role === "branch_owner"
        );
        const companyAdmin = usersList.find(
          (u) => u.companyCode === compCode && u.role === "admin"
        );
        setAddParentId(branchOwner?.uid || companyAdmin?.uid || "");
      } else { // addRole === "user"
        if (userProfile?.role === "manager") {
          setAddParentId(userProfile.uid);
        } else {
          const firstCompanyManager = usersList.find(
            (u) => u.companyCode === compCode && u.role === "manager"
          );
          const branchOwner = usersList.find(
            (u) => u.companyCode === compCode && u.role === "branch_owner"
          );
          const companyAdmin = usersList.find(
            (u) => u.companyCode === compCode && u.role === "admin"
          );
          setAddParentId(firstCompanyManager?.uid || branchOwner?.uid || companyAdmin?.uid || "");
        }
      }
    }
  }, [addRole, isAddModalOpen, selectedCompanyCode, userProfile, usersList]);

  // Auto fill department based on manager (addParentId)
  useEffect(() => {
    if (isAddModalOpen && addRole === "user" && addParentId) {
      const selectedManager = usersList.find(u => u.uid === addParentId);
      if (selectedManager && selectedManager.department) {
        setAddDepartment(selectedManager.department);
        setIsNewAddDepartment(false);
      }
    } else if (isAddModalOpen && addRole === "user" && !addParentId) {
      setAddDepartment("");
    }
  }, [addRole, addParentId, usersList, isAddModalOpen]);

  // Reset addDepartment when modal closes
  useEffect(() => {
    if (!isAddModalOpen) {
      setAddDepartment("");
      setIsNewAddDepartment(false);
      setAddJobDescriptionLink("");
      setAddJobDescriptionUploadToken("");
    }
  }, [isAddModalOpen]);



  // Tự động gán khóa học Onboarding / Bắt buộc + tạo Kanban task khi thêm nhân viên mới
  const autoAssignCourseOnNewEmployee = async (newEmpUid: string, newEmpName: string, companyCode: string) => {
    const targetCourses = courses.filter(c => (c.autoAssignOnboarding || c.isRequired) && c.companyCode === companyCode);
    for (const course of targetCourses) {
      try {
        // Tạo enrollment
        await fetch("/api/v1/crud/training-enrollments", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${getAccessToken()}`,
          },
          body: JSON.stringify({
            courseId: course.id,
            courseTitle: course.title,
            uid: newEmpUid,
            userName: newEmpName,
            companyCode,
            progress: 0,
            status: "in_progress",
            createdAt: new Date().toISOString(),
            startedAt: new Date().toISOString(),
            completedLessons: [],
            quizPassed: false,
          }),
        });

        // Tăng enrolledCount trên khóa học
        await fetch(`/api/v1/crud/training-courses/${course.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${getAccessToken()}`,
          },
          body: JSON.stringify({
            enrolledCount: (course.enrolledCount || 0) + 1
          }),
        });
      } catch (err) {
        console.error(`Lỗi auto-assign course ${course.id}:`, err);
      }
    }
  };

  // Handle adding new employee user profile
  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addName.trim() || !addEmail.trim() || !addPassword.trim()) {
      toast.warning("Vui lòng nhập đầy đủ Họ tên, Email và Mật khẩu!");
      return;
    }
    if ((addRole === "user" || addRole === "manager") && !addDepartment.trim()) {
      toast.warning("Vui lòng chọn phòng ban!");
      return;
    }
    if (addPassword.length < 6) {
      toast.warning("Mật khẩu phải chứa ít nhất 6 ký tự!");
      return;
    }

    // Kiểm tra định dạng Email
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(addEmail.trim())) {
      toast.warning("Địa chỉ email không đúng định dạng!");
      return;
    }

    // Kiểm tra định dạng Số điện thoại Việt Nam (nếu nhập)
    if (addPhone.trim()) {
      const vnPhoneRegex = /^(0|\+84|84)(3|5|7|8|9)[0-9]{8}$/;
      if (!vnPhoneRegex.test(addPhone.trim().replace(/\s+/g, ""))) {
        toast.warning("Số điện thoại Việt Nam không đúng định dạng (ví dụ: 0987654321)!");
        return;
      }
    }

    // Kiểm tra email trùng trong công ty
    const emailNormalized = addEmail.trim().toLowerCase();
    const duplicateEmail = usersList.find(u => u.email?.toLowerCase() === emailNormalized);
    if (duplicateEmail) {
      toast.error(`❌ Email "${addEmail.trim()}" đã được sử dụng bởi nhân sự "${duplicateEmail.displayName || duplicateEmail.email}". Vui lòng dùng email khác!`);
      return;
    }

    // Kiểm tra số điện thoại trùng (nếu có nhập)
    if (addPhone.trim()) {
      const phoneNormalized = addPhone.trim().replace(/\s+/g, "");
      const duplicatePhone = usersList.find(u => u.phone && u.phone.replace(/\s+/g, "") === phoneNormalized);
      if (duplicatePhone) {
        toast.error(`❌ Số điện thoại "${addPhone.trim()}" đã được sử dụng bởi nhân sự "${duplicatePhone.displayName || duplicatePhone.email}". Vui lòng dùng số khác!`);
        return;
      }
    }

    const compCode = selectedCompanyCode || userProfile?.companyCode || "SYSTEM";
    const compName = userProfile?.role === "superadmin"
      ? (companies.find(c => c.code === selectedCompanyCode)?.name || "SYSTEM")
      : (userProfile?.companyName || "");

    const manager = addParentId ? employees.find(emp => emp.id === addParentId) : undefined;
    const managerLevel = manager ? manager.level : undefined;
    const isDeptScopedRole = addRole === "user" || addRole === "manager";
    const deptName = isDeptScopedRole ? (addDepartment.trim() || (addRole === "manager" ? "Quản lý" : "Nhân sự")) : undefined;

    try {
      setIsAddingEmployee(true);
      const newUid = await authService.registerUserForCompany(
        addName.trim(),
        addEmail.trim(),
        addPassword,
        addRole,
        compCode,
        compName,
        addParentId || undefined,
        managerLevel,
        deptName,
        deptName,
        addPhone.trim(),
        undefined,
        addJobDescriptionLink.trim() || undefined,
        activeBranchId || undefined,
        undefined,
        addQualification.trim() || undefined,
        addMonthlySalary.trim() === "" ? undefined : Number(addMonthlySalary),
        addJobDescriptionUploadToken || undefined,
      );

      toast.success(`Đã thêm nhân sự "${addName}" thành công!`);

      // Tự động gán khóa học Onboarding + tạo Kanban task
      await autoAssignCourseOnNewEmployee(newUid, addName.trim(), compCode);

      setIsAddModalOpen(false);

      // Reset Form
      setAddName("");
      setAddEmail("");
      setAddPassword("");
      setAddPhone("");
      setAddParentId("");
      setAddRole("user");
      setAddDepartment("Phòng Kỹ Thuật");
      setAddJobDescriptionLink("");
      setAddJobDescriptionUploadToken("");
      setAddQualification("");
      setAddMonthlySalary("");

      await fetchUsers();
      await refreshDepartments();
      if (compCode) {
        await fetchCourses(compCode);
      }
    } catch (err) {
      console.error(err);
      toast.error(getApiErrorMessage(err, "Lỗi khi thêm thành viên mới."));
    } finally {
      setIsAddingEmployee(false);
    }
  };

  // Drag & Drop logic for reorganizing reporting structures
  const handleDragStart = (e: React.DragEvent, id: string) => {
    const isSuperAdminOrAdmin = userProfile?.role === "superadmin" || userProfile?.role === "admin";
    const isRoleManager = userProfile?.role === "manager";

    if (!isSuperAdminOrAdmin && !isRoleManager) {
      e.preventDefault();
      return;
    }

    // Nếu là manager, chỉ cho phép kéo nhân viên thuộc nhánh con của mình
    if (isRoleManager) {
      if (id === userProfile?.uid) {
        toast.warning("Bạn không thể tự kéo thả chính mình!");
        e.preventDefault();
        return;
      }

      const checkIsDescendant = (parentId: string, childId: string): boolean => {
        const child = employees.find(emp => emp.id === childId);
        if (!child || !child.parentId) return false;
        if (child.parentId === parentId) return true;
        return checkIsDescendant(parentId, child.parentId);
      };

      if (!checkIsDescendant(userProfile.uid, id)) {
        toast.warning("Bạn chỉ có quyền thuyên chuyển nhân viên thuộc nhánh do mình quản lý!");
        e.preventDefault();
        return;
      }
    }

    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!isManager) return;
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const isSuperAdminOrAdmin = userProfile?.role === "superadmin" || userProfile?.role === "admin";
    const isRoleManager = userProfile?.role === "manager";

    if (!isSuperAdminOrAdmin && !isRoleManager) {
      toast.warning("Bạn không có quyền thuyên chuyển nhân sự!");
      return;
    }

    const draggedId = e.dataTransfer.getData("text/plain");
    if (!draggedId || draggedId === targetId) return;

    // Check circular dependencies helper
    const checkIsDescendant = (parentId: string, childId: string): boolean => {
      const child = employees.find(emp => emp.id === childId);
      if (!child || !child.parentId) return false;
      if (child.parentId === parentId) return true;
      return checkIsDescendant(parentId, child.parentId);
    };

    // Manager specific rules
    if (isRoleManager && userProfile) {
      const isTargetValid = targetId === userProfile.uid || checkIsDescendant(userProfile.uid, targetId);
      const isDraggedValid = checkIsDescendant(userProfile.uid, draggedId);

      if (!isDraggedValid) {
        toast.error("Không thể thuyên chuyển: Nhân sự được chọn không nằm trong nhánh quản lý của bạn!");
        return;
      }
      if (!isTargetValid) {
        toast.error("Không thể thuyên chuyển: Người quản lý mới phải thuộc phạm vi nhánh do bạn quản lý!");
        return;
      }
    }

    if (checkIsDescendant(draggedId, targetId)) {
      toast.error("Không thể điều chuyển: Người quản lý mới không được là cấp dưới của nhân sự này!");
      return;
    }

    const draggedEmp = employees.find(emp => emp.id === draggedId);
    const targetEmp = employees.find(emp => emp.id === targetId);

    if (!draggedEmp || !targetEmp) return;

    if (draggedEmp.level === 1) {
      toast.warning("CEO không thể điều chuyển báo cáo cho người khác!");
      return;
    }

    // Helper function to dynamically update hierarchy in state list
    const updateHierarchy = (list: EmployeeNode[], dragged: string, target: string): EmployeeNode[] => {
      const parent = list.find(emp => emp.id === target);
      if (!parent) return list;

      const newLevel = parent.level + 1;

      const nextList = list.map(emp => {
        if (emp.id === dragged) {
          return { ...emp, parentId: target, level: newLevel };
        }
        return emp;
      });

      const adjust = (currentList: EmployeeNode[]): EmployeeNode[] => {
        let changed = false;
        const updated = currentList.map(emp => {
          if (emp.parentId) {
            const p = currentList.find(parentEmp => parentEmp.id === emp.parentId);
            if (p && emp.level !== p.level + 1) {
              changed = true;
              return { ...emp, level: p.level + 1 };
            }
          }
          return emp;
        });
        return changed ? adjust(updated) : updated;
      };

      return adjust(nextList);
    };

    const updatedEmployees = updateHierarchy(employees, draggedId, targetId);

    try {
      const updates = updatedEmployees
        .filter(emp => {
          const original = employees.find(o => o.id === emp.id);
          return original && (original.parentId !== emp.parentId || original.level !== emp.level);
        })
        .map(emp => ({
          id: emp.id,
          parentId: emp.parentId || null,
          level: emp.level
        }));

      if (updates.length > 0) {
        await authService.bulkUpdateUsers(updates);
      }
      toast.success(`Đã điều chuyển ${draggedEmp.name} báo cáo cho ${targetEmp.name}. Quyền hệ thống được đồng bộ.`);
      await fetchUsers();
    } catch (err) {
      console.error("Lỗi cập nhật cơ cấu:", err);
      toast.error(getApiErrorMessage(err, "Không thể lưu cập nhật cơ cấu nhân sự."));
    }
  };

  // Division Tag color schemes — dynamic, using FUNCTIONAL_CATEGORIES
  const getDivisionBadgeStyles = (division: string) => {
    const cat = getCategoryByDivision(division);
    switch (cat.key) {
      case "governance": return "bg-slate-100 text-slate-800 border-slate-300";
      case "finance": return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "tech": return "bg-indigo-50 text-indigo-700 border-indigo-200";
      case "operations": return "bg-cyan-50 text-cyan-700 border-cyan-200";
      case "sales": return "bg-amber-50 text-amber-700 border-amber-200";
      case "hr": return "bg-rose-50 text-rose-700 border-rose-200";
      default: return "bg-slate-50 text-slate-700 border-slate-200";
    }
  };

  // Danh sách phân khối động lấy từ dữ liệu nhân sự kết hợp các khối mặc định
  const uniqueDivisions = Array.from(
    new Set([
      "Khối Kỹ Thuật",
      "Khối Vận Hành",
      "Khối Marketing",
      "Khối Sales",
      ...employees.map(e => e.division).filter(Boolean)
    ])
  ).sort();

  // Danh mục lưu độc lập, kèm dữ liệu hồ sơ cũ trong lúc tải lần đầu.
  const uniqueDepartments = Array.from(
    new Set([...departments.map(department => department.name), ...usersList.map(user => user.department)].filter(Boolean))
  ).sort();

  // Filtering matching logic
  const isMatchingFilter = (emp: EmployeeNode): boolean => {
    const query = normalizeString(searchQuery);
    const matchSearch = query === "" ||
      normalizeString(emp.name).includes(query) ||
      normalizeString(emp.role).includes(query) ||
      normalizeString(emp.department).includes(query);

    const matchDepartment = filterDepartment === "Tất cả" || emp.department === filterDepartment;

    return matchSearch && matchDepartment;
  };

  // Auto-arrange employees without parentId into the correct hierarchy based on role
  const arrangedEmployees = (() => {
    const ROLE_LEVEL: Record<string, number> = {
      superadmin: 0,
      admin: 1,
      branch_owner: 2,
      manager: 3,
      user: 4,
    };

    // Build a mutable copy with virtual parentId for rendering
    const list = employees.map(e => ({ ...e }));

    list.forEach(emp => {
      // If already has a valid parentId that exists, skip
      if (emp.parentId && list.some(p => p.id === emp.parentId)) return;

      const myLevel = ROLE_LEVEL[usersList.find(u => u.uid === emp.id)?.role ?? "user"] ?? 4;

      // Find the best parent: highest-level employee that is strictly above this one
      let bestParent: typeof list[0] | undefined;

      for (let targetLevel = myLevel - 1; targetLevel >= 0; targetLevel--) {
        const candidates = list.filter(p => {
          const pRole = usersList.find(u => u.uid === p.id)?.role ?? "user";
          return ROLE_LEVEL[pRole] === targetLevel && p.id !== emp.id;
        });
        if (candidates.length > 0) {
          bestParent = candidates[0];
          break;
        }
      }

      if (bestParent) {
        emp.parentId = bestParent.id;
      } else {
        // This employee is truly at the top
        emp.parentId = undefined;
      }
    });

    return list;
  })();

  // Identify root employees (nodes with no parent in the arranged tree)
  const rootEmployees = arrangedEmployees.filter(e => !e.parentId || !arrangedEmployees.some(p => p.id === e.parentId))
    .sort((a, b) => (a.level ?? 99) - (b.level ?? 99));
  const visibleEmployees = filterOrgChartEmployees(employees, searchQuery, filterDepartment);
  const paginatedEmployees = visibleEmployees.slice((listPage - 1) * listLimit, listPage * listLimit);
  const missingValue = "Chưa cập nhật";
  // Recursive Branch rendering component helper
  const renderBranch = (node: EmployeeNode) => {
    const children = arrangedEmployees.filter(e => e.parentId === node.id);
    const isSelected = selectedEmp?.id === node.id;
    const isMatch = isMatchingFilter(node);
    const isFilteredOut = (searchQuery.trim() !== "" || filterDepartment !== "Tất cả") && !isMatch;
    const isCollapsed = collapsedNodes.has(node.id);
    const directReportsCount = employees.filter(e => e.parentId === node.id).length;

    const category = getCategoryByDivision(`${node.division || ""} ${node.department || ""}`);

    const getCategoryBadgeStyles = (key: string) => {
      switch (key) {
        case "governance": return "bg-blue-50 text-blue-700";
        case "finance": return "bg-[#E4F6EA] text-[#176B3A]";
        case "tech": return "bg-violet-50 text-violet-700";
        case "operations": return "bg-cyan-50 text-cyan-700";
        case "sales": return "bg-[#E4F6EA] text-[#176B3A]";
        case "hr": return "bg-rose-50 text-rose-700";
        default: return "bg-slate-100 text-slate-700";
      }
    };

    const getCategoryHeaderStyles = (key: string) => {
      switch (key) {
        case "governance": return "bg-blue-50";
        case "finance": return "bg-[#F0FAF4]";
        case "tech": return "bg-violet-50";
        case "operations": return "bg-cyan-50";
        case "sales": return "bg-[#F0FAF4]";
        case "hr": return "bg-rose-50";
        default: return "bg-slate-50";
      }
    };

    return (
      <div className="flex flex-col items-center" key={node.id}>
        {/* Smart Employee Card */}
        <div
          draggable={isManager ? "true" : "false"}
          onDragStart={(e) => handleDragStart(e, node.id)}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, node.id)}
          onClick={async () => {
            if (document.fullscreenElement === chartViewportRef.current) await document.exitFullscreen();
            setSelectedEmp(node);
          }}
          onMouseLeave={() => setActiveDropdownCardId(null)}
          className={`landing-rainbow-card relative w-44 cursor-pointer rounded-2xl p-2 text-center shadow-[0_8px_28px_rgba(57,87,132,0.10)] transition-all duration-200 sm:w-48 ${isSelected
            ? "z-10 ring-2 ring-[#00ADFC] shadow-[0_10px_30px_rgba(0,173,252,0.22)]"
            : "hover:-translate-y-1 hover:shadow-[0_12px_30px_rgba(57,87,132,0.16)]"
            } ${isFilteredOut ? "opacity-30 blur-[0.5px] scale-98" : "opacity-100"}`}
          id={`org_node_${node.id}`}
        >
          <div className={`absolute inset-x-1.5 top-1.5 h-14 rounded-xl ${getCategoryHeaderStyles(category.key)}`} />

          {/* Online/Offline Dot */}
          <div className="absolute top-2.5 right-2.5 z-10 flex items-center justify-center">
            {node.status === "online" ? (
              <span className="block h-2 w-2 rounded-full border border-white bg-emerald-500 shadow-xs animate-pulse" title="Đang hoạt động" />
            ) : (
              <span className="block h-2 w-2 rounded-full border border-white bg-slate-300" title="Ngoại tuyến" />
            )}
          </div>

          {node.isLeader && (
            <span className="absolute left-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 shadow-xs" title="Trưởng nhóm" aria-label="Trưởng nhóm">
              <Crown className="h-3.5 w-3.5 fill-amber-400 stroke-amber-700" />
            </span>
          )}

          <div className="relative z-[1] flex flex-col items-center pt-1">
            <div className="rounded-full bg-white p-0.5 shadow-sm">
              {renderAvatar(node.avatar, "w-12 h-12 sm:w-14 sm:h-14", "text-xl")}
            </div>
            <h4 className="mt-1.5 line-clamp-2 min-h-8 px-1 text-xs font-bold leading-4 text-slate-900" title={node.name}>
              {node.name || missingValue}
            </h4>
            <p className="w-full truncate px-1 text-[10px] leading-4 text-slate-600" title={node.role}>
              {node.role || missingValue}
            </p>
            <span className={`mt-1.5 max-w-full truncate rounded-lg px-2.5 py-1 text-[9px] font-semibold ${getCategoryBadgeStyles(category.key)}`} title={node.department || node.division}>
              {node.department || node.division || missingValue}
            </span>
          </div>

          {/* Collapse/Expand toggle badge */}
          {directReportsCount > 0 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); toggleCollapse(node.id); }}
              title={isCollapsed ? `Mở rộng ${directReportsCount} nhân viên cấp dưới` : `Thu gọn ${directReportsCount} nhân viên cấp dưới`}
              className={`absolute -bottom-2 right-2 flex h-5 w-5 cursor-pointer select-none items-center justify-center rounded-full border-2 border-white text-[10px] font-bold shadow-xs transition-all ${isCollapsed ? "bg-sky-100 text-sky-700 hover:bg-sky-200" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
            >
              {isCollapsed ? `+${directReportsCount}` : "−"}
            </button>
          )}
        </div>

        {/* Children Render recursive block */}
        {children.length > 0 && !isCollapsed && (
          <>
            <div className="h-5 w-px bg-[#B8C9E1]" />
            <div className="flex relative items-start">
              {children.map((child, index) => {
                const isFirst = index === 0;
                const isLast = index === children.length - 1;
                const hasSiblings = children.length > 1;

                return (
                  <div key={child.id} className="relative flex flex-col items-center px-2 sm:px-3">
                    {/* Horizontal Connector bar */}
                    {hasSiblings && (
                      <div className="absolute left-0 right-0 top-0 flex h-px">
                        <div className={`w-1/2 ${isFirst ? '' : 'border-t border-[#B8C9E1]'}`} />
                        <div className={`w-1/2 ${isLast ? '' : 'border-t border-[#B8C9E1]'}`} />
                      </div>
                    )}
                    <div className="h-5 w-px bg-[#B8C9E1]" />

                    {renderBranch(child)}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <>
      {isDepartmentManagerOpen && <HrDepartmentManager
        companyCode={departmentCompanyCode}
        departments={departments}
        managers={usersList.filter(user => user.companyCode === departmentCompanyCode).map(user => ({ id: user.uid, name: user.displayName || user.email || user.uid }))}
        onClose={() => setIsDepartmentManagerOpen(false)}
        onChanged={async (refreshUsers = false) => {
          await refreshDepartments();
          if (refreshUsers) await fetchUsers();
          setFilterDepartment("Tất cả");
        }}
      />}
      {/* Division filter and search bar for Org Chart tab */}
      <div data-testid="org-chart-toolbar" className="flex shrink-0 flex-col gap-3 border-b border-slate-200/80 bg-white p-3 md:px-5 md:py-3.5 min-[1200px]:flex-row min-[1200px]:items-center min-[1200px]:justify-between">
        <div data-testid="org-chart-filters" className="grid w-full flex-1 grid-cols-1 items-stretch gap-2.5 min-[640px]:grid-cols-2 min-[1200px]:max-w-md">
          <div className="relative w-full">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo tên hoặc chức danh..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200/80 bg-white rounded-xl text-xs focus:ring-2 focus:ring-[#00ADFC]/15 focus:border-[#00ADFC] outline-none text-slate-800 placeholder:text-slate-400 transition-all"
            />
          </div>
          <div data-testid="org-chart-department-filter" className="w-full text-xs">
            <HrFormSelect
              value={filterDepartment}
              onChange={setFilterDepartment}
              label="Lọc phòng ban"
              options={[{ value: "Tất cả", label: "Tất cả phòng ban" }, ...uniqueDepartments.map(dept => ({ value: dept, label: dept }))]}
            />
          </div>
        </div>

        <div data-testid="org-chart-actions" className="grid w-full grid-cols-1 items-center gap-2 min-[420px]:grid-cols-2 min-[768px]:grid-cols-3 min-[1200px]:flex min-[1200px]:w-auto">
          <div data-testid="org-chart-view-toggle" className="flex w-full items-center rounded-xl border border-slate-200/80 bg-slate-100/70 p-1 min-[1200px]:w-auto">
            <button type="button" onClick={() => setViewMode("tree")} className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer transition-all ${viewMode === "tree" ? "bg-white text-[#007EB8] shadow-xs font-bold" : "text-slate-600 hover:text-slate-900"}`}><Network className="h-3.5 w-3.5 text-[#00ADFC]" /> Cây</button>
            <button type="button" onClick={() => setViewMode("list")} className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer transition-all ${viewMode === "list" ? "bg-white text-[#007EB8] shadow-xs font-bold" : "text-slate-600 hover:text-slate-900"}`}><List className="h-3.5 w-3.5 text-[#00ADFC]" /> Danh sách</button>
          </div>

          <div data-testid="org-chart-zoom-control" className="flex w-full items-center justify-center gap-2 px-2.5 py-1.5 min-[1200px]:w-auto min-[1200px]:px-0">
            <span className="text-xs font-medium text-slate-500 normal-case">Thu phóng:</span>
            <input
              type="range"
              min="0.5"
              max="1.5"
              step="0.05"
              value={zoomLevel}
              onChange={(e) => {
                setZoomLevel(parseFloat(e.target.value));
              }}
              className="w-20 accent-[#00ADFC] cursor-pointer"
            />
            <span className="w-10 text-right text-xs font-bold text-slate-800 tabular-nums mr-1">{Math.round(zoomLevel * 100)}%</span>
          </div>

          {isManager && (
            <>
              {canManageDepartments && <button
                type="button"
                onClick={() => setIsDepartmentManagerOpen(true)}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#00ADFC]/30 bg-[#00ADFC]/5 px-3 py-2 text-xs font-normal text-[#007EB8] transition-colors hover:bg-[#00ADFC]/10 min-[1200px]:w-auto"
              ><Building2 className="h-4 w-4" /> Quản lý phòng ban</button>}
              <button
                data-testid="org-chart-add-button"
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                className="col-span-full flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#00ADFC] hover:bg-[#0095d9] active:bg-[#0085c2] px-4 py-2 text-xs font-semibold text-white shadow-xs transition-all active:scale-95 cursor-pointer normal-case min-[768px]:col-span-1 min-[1200px]:w-auto"
              >
                <Plus className="h-4 w-4 stroke-[2.5]" />
                <span>Thêm nhân sự</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Primary Sub Tab Layout View */}
      <div className="flex-1 p-3 md:p-6 overflow-y-auto" id="hr_tab_content">
        <div className="grid grid-cols-1 gap-6 h-full min-h-[500px]" id="org_chart_block">

          {viewMode === "list" && (
            <div className="col-span-1 bg-white border border-gray-200 rounded-2xl overflow-hidden min-h-[500px] flex flex-col justify-between">
              {isMobile ? (
                <div className="divide-y divide-slate-100 p-2">
                  {paginatedEmployees.map((employee) => {
                    const manager = getManagerForEmployee(employee, employees);
                    return (
                      <div
                        key={employee.id}
                        onClick={() => setSelectedEmp(employee)}
                        className="p-3 hover:bg-indigo-50/30 active:bg-indigo-50/60 cursor-pointer flex items-center justify-between gap-3 text-xs transition-all"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {renderAvatar(employee.avatar, "w-10 h-10 shrink-0", "text-sm")}
                          <div className="min-w-0">
                            <div className="font-bold text-slate-800 truncate">{employee.name || missingValue}</div>
                            <div className="text-[10px] text-slate-400 font-medium truncate mt-0.5">
                              {employee.role || missingValue} • {employee.department || missingValue}
                            </div>
                            {manager && (
                              <div className="text-[9px] text-slate-400 mt-0.5">
                                QL: <span className="font-semibold text-slate-655">{manager.name}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-bold ${
                            employee.status === "online"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-250 animate-pulse"
                              : "bg-slate-50 text-slate-500 border border-slate-200"
                          }`}>
                            {employee.status === "online" ? "Online" : "Offline"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  {visibleEmployees.length === 0 && (
                    <div className="py-16 text-center text-sm text-slate-400">Không tìm thấy nhân viên</div>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[980px] text-left text-xs">
                    <thead className="bg-slate-50 border-b border-gray-200 text-[10px] uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Nhân viên</th>
                        <th className="px-4 py-3">Chức danh</th>
                        <th className="px-4 py-3">Phòng ban</th>
                        <th className="px-4 py-3">Khối</th>
                        <th className="px-4 py-3">Quản lý trực tiếp</th>
                        <th className="px-4 py-3">Liên hệ</th>
                        <th className="px-4 py-3">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedEmployees.map((employee) => {
                        const manager = getManagerForEmployee(employee, employees);
                        return (
                          <tr
                            key={employee.id}
                            onClick={() => setSelectedEmp(employee)}
                            className="border-b border-slate-100 hover:bg-[#E8F7FF]/40 cursor-pointer transition-colors"
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2.5">
                                {renderAvatar(employee.avatar, "w-8 h-8", "text-xs")}
                                <div>
                                  <div className="font-bold text-slate-800">{employee.name || missingValue}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">{employee.role || missingValue}</td>
                            <td className="px-4 py-3">{employee.department || missingValue}</td>
                            <td className="px-4 py-3">{employee.division || missingValue}</td>
                            <td className="px-4 py-3">{manager?.name || missingValue}</td>
                            <td className="px-4 py-3">
                              {employee.email || missingValue}
                              <div className="text-[10px] text-slate-400">{employee.phone || missingValue}</div>
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                  employee.status === "online"
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : "bg-slate-50 text-slate-500 border border-slate-200"
                                }`}
                              >
                                {employee.status === "online" ? "Đang hoạt động" : "Ngoại tuyến"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {visibleEmployees.length === 0 && (
                    <div className="py-16 text-center text-sm text-slate-400">Không tìm thấy nhân viên</div>
                  )}
                </div>
              )}

              {/* Pagination Controls */}
              {visibleEmployees.length > listLimit && (
                <div className="flex items-center justify-between border-t border-slate-100 bg-white px-4 py-3 sm:px-6">
                  <div className="flex flex-1 justify-between sm:hidden">
                    <button
                      disabled={listPage === 1}
                      onClick={() => setListPage((p) => Math.max(p - 1, 1))}
                      className="relative inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Trước
                    </button>
                    <button
                      disabled={listPage * listLimit >= visibleEmployees.length}
                      onClick={() => setListPage((p) => p + 1)}
                      className="relative ml-3 inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Sau
                    </button>
                  </div>
                  <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs text-slate-700">
                        Hiển thị từ <span className="font-medium">{(listPage - 1) * listLimit + 1}</span> đến{" "}
                        <span className="font-medium">{Math.min(listPage * listLimit, visibleEmployees.length)}</span> trong tổng số{" "}
                        <span className="font-medium">{visibleEmployees.length}</span> nhân viên
                      </p>
                    </div>
                    <div>
                      <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                        <button
                          disabled={listPage === 1}
                          onClick={() => setListPage(1)}
                          className="relative inline-flex items-center rounded-l-md px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus:z-20 focus:outline-offset-0 disabled:opacity-30 text-xs font-semibold"
                        >
                          «
                        </button>
                        <button
                          disabled={listPage === 1}
                          onClick={() => setListPage((p) => Math.max(p - 1, 1))}
                          className="relative inline-flex items-center px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus:z-20 focus:outline-offset-0 disabled:opacity-30 text-xs font-semibold"
                        >
                          ‹
                        </button>
                        {Array.from({ length: Math.ceil(visibleEmployees.length / listLimit) }).map((_, idx) => {
                          const pageNum = idx + 1;
                          if (Math.abs(listPage - pageNum) > 2) return null;
                          return (
                            <button
                              key={pageNum}
                              onClick={() => setListPage(pageNum)}
                              className={`relative inline-flex items-center px-4 py-2 text-xs font-semibold focus:z-20 ${
                                listPage === pageNum
                                  ? "z-10 bg-[#00ADFC] text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00ADFC]"
                                  : "text-slate-900 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus:outline-offset-0"
                              }`}
                            >
                              {pageNum}
                            </button>
                          );
                        })}
                        <button
                          disabled={listPage * listLimit >= visibleEmployees.length}
                          onClick={() => setListPage((p) => p + 1)}
                          className="relative inline-flex items-center px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus:z-20 focus:outline-offset-0 disabled:opacity-30 text-xs font-semibold"
                        >
                          ›
                        </button>
                        <button
                          disabled={listPage * listLimit >= visibleEmployees.length}
                          onClick={() => setListPage(Math.ceil(visibleEmployees.length / listLimit))}
                          className="relative inline-flex items-center rounded-r-md px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus:z-20 focus:outline-offset-0 disabled:opacity-30 text-xs font-semibold"
                        >
                          »
                        </button>
                      </nav>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Interactive Tree viewport diagram - full width */}
          <div ref={chartViewportRef} className={`relative col-span-1 flex min-h-[580px] flex-col overflow-hidden rounded-2xl border border-[#E1EAF5] bg-gradient-to-b from-white via-[#F8FBFF] to-[#F2F7FD] ${isChartFullscreen ? "h-dvh w-dvw rounded-none border-0" : ""} ${viewMode === "tree" ? "" : "hidden"}`} id="tree_viewport">
            <div className="absolute right-3 top-3 z-20">
              <button
                type="button"
                onClick={toggleChartFullscreen}
                className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-[#DCE7F4] bg-white text-slate-700 shadow-2xs transition-all hover:bg-[#E8F7FF] hover:text-[#007EB8] active:scale-95"
                title={isChartFullscreen ? "Thoát toàn màn hình" : "Xem sơ đồ toàn màn hình"}
                aria-label={isChartFullscreen ? "Thoát toàn màn hình" : "Xem sơ đồ toàn màn hình"}
              >
                {isChartFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>
            </div>
            <div
              ref={containerRef}
              onMouseDown={isMobile ? undefined : handleMouseDown}
              onMouseLeave={isMobile ? undefined : handleMouseLeaveOrUp}
              onMouseUp={isMobile ? undefined : handleMouseLeaveOrUp}
              onMouseMove={isMobile ? undefined : handleMouseMove}
              className={`flex-1 overflow-auto flex items-start justify-start select-none overscroll-none p-4 pt-14 sm:p-8 sm:pt-14 ${isChartFullscreen ? "min-h-0" : "min-h-[500px]"} ${
                isMobile ? "" : "cursor-grab"
              } ${isDragging && !isMobile ? "cursor-grabbing" : ""}`}
              id="interactive_org_chart"
            >
              <div
                style={
                  isSafari
                    ? {
                      transform: `scale(${zoomLevel})`,
                      transformOrigin: "top center",
                      transition: "transform 0.2s ease-out",
                    }
                    : {
                      zoom: zoomLevel,
                      transition: "zoom 0.2s ease-out",
                    }
                }
                className="flex flex-col items-center mx-auto min-w-max"
              >
                {employees.length === 0 ? (
                  <div className="text-center py-20 text-gray-400">
                    <Users className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm font-bold">Chưa có cơ cấu nhân sự</p>
                    <p className="text-xs mt-1">Vui lòng thêm thành viên mới đầu tiên</p>
                  </div>
                ) : (
                  rootEmployees.map(root => renderBranch(root))
                )}
              </div>
            </div>

            {/* Chart footer notification guide */}

          </div>
        </div>
      </div>

      {/* EMPLOYEE DETAIL & EDIT MODAL */}
      {isDetailModalOpen && selectedEmp && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-2xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200" id="employee_detail_modal">
          {isEditing ? (
            <div className="org-chart-edit-popup relative flex max-h-[calc(100dvh-2rem)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white p-4 text-left shadow-xl animate-in fade-in zoom-in-95 duration-200 md:p-5">
              <div className="mb-3 flex shrink-0 items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-1 shrink-0 rounded-full bg-[#00ADFC]" />
                  {renderAvatar(selectedEmp.avatar, "w-9 h-9", "text-base")}
                  <h4 className="font-bold text-slate-900 text-sm font-sans">Chỉnh sửa nhân sự</h4>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  aria-label="Đóng popup chỉnh sửa nhân sự"
                  className="w-7 h-7 rounded-full bg-rose-500 hover:bg-rose-600 active:scale-95 text-white flex items-center justify-center transition-all cursor-pointer shadow-xs shrink-0"
                >
                  <X className="w-4 h-4 stroke-[2.5]" />
                </button>
              </div>

              <div className="grid min-h-0 grid-cols-1 gap-x-4 gap-y-3 overflow-y-auto pr-1 text-left text-xs sm:grid-cols-2">
                <div>
                  <label className="block font-bold text-gray-500 mb-1">Họ tên *</label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3.5 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#00ADFC]/20 focus:border-[#00ADFC] text-slate-700 bg-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-500 mb-1">Trình độ</label>
                  <input type="text" value={editQualification} onChange={(e) => setEditQualification(e.target.value)} placeholder="Ví dụ: TESOL, Cử nhân Sư phạm" className="w-full px-3.5 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#00ADFC]/20 focus:border-[#00ADFC] text-slate-700 bg-white" />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:col-span-2 sm:grid-cols-2">
                  <div>
                    <label className="block font-bold text-gray-500 mb-1">Chức danh</label>
                    <input
                      type="text"
                      value={editRoleText}
                      onChange={(e) => setEditRoleText(e.target.value)}
                      className="w-full px-3.5 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#00ADFC]/20 focus:border-[#00ADFC] text-slate-700 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-gray-500 mb-1">Phân khối</label>
                    <HrFormSelect
                      value={editDivision}
                      onChange={setEditDivision}
                      label="Phân khối"
                      options={uniqueDivisions.map(div => ({ value: div, label: div }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:col-span-2 sm:grid-cols-2">
                  <div>
                    <label className="block font-bold text-gray-500 mb-1">Phòng ban</label>
                    <HrFormSelect
                      value={isNewEditDepartment ? "__new_department__" : editDepartment}
                      onChange={(department) => {
                        setIsNewEditDepartment(department === "__new_department__");
                        setEditDepartment(department === "__new_department__" ? "" : department);
                      }}
                      label="Phòng ban"
                      options={[{ value: "", label: "Chọn phòng ban" }, ...uniqueDepartments.map(dept => ({ value: dept, label: dept })), { value: "__new_department__", label: "+ Thêm phòng ban mới" }]}
                    />
                    {isNewEditDepartment && (
                      <input
                        type="text"
                        value={editDepartment}
                        onChange={(e) => setEditDepartment(e.target.value)}
                        placeholder="Tên phòng ban mới"
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-slate-700 outline-none focus:border-[#00ADFC] focus:ring-2 focus:ring-[#00ADFC]/20"
                      />
                    )}
                  </div>
                  <div>
                    <label className="block font-bold text-gray-500 mb-1">Số điện thoại</label>
                    <input
                      type="text"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      className="w-full px-3.5 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#00ADFC]/20 focus:border-[#00ADFC] text-slate-700 bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-gray-500 mb-1">Lương tháng (VND)</label><input type="number" min="0" step="1000" value={editMonthlySalary} onChange={(e) => setEditMonthlySalary(e.target.value)} className="no-number-spinner w-full px-3.5 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#00ADFC]/20 focus:border-[#00ADFC]" placeholder="26000000" />
                </div>
                <div>
                  <label className="block font-bold text-gray-500 mb-1">Email liên lạc (Cố định)</label>
                  <input
                    type="email"
                    value={editEmail}
                    disabled
                    className="w-full px-3.5 py-2 border border-gray-200 rounded-xl outline-none bg-slate-50 text-slate-800 cursor-not-allowed select-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-gray-500 mb-1">Link mô tả công việc</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="url"
                      placeholder="Dán link hoặc tải file lên"
                      value={editJobDescriptionLink}
                      onChange={(e) => setEditJobDescriptionLink(e.target.value)}
                      className="flex-1 px-3.5 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#00ADFC]/20 focus:border-[#00ADFC] text-slate-700 bg-white"
                    />
                    <input
                      ref={editJobDescriptionFileInputRef}
                      type="file"
                      className="hidden"
                      onChange={(e) => handleJobDescriptionFileChange(e, "edit")}
                    />
                    <button
                      type="button"
                      onClick={() => editJobDescriptionFileInputRef.current?.click()}
                      disabled={uploadingEditJobDescription}
                      title="Tải file lên Google Drive"
                      className="shrink-0 p-2 px-2.5 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {uploadingEditJobDescription ? (
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Upload className="h-3.5 w-3.5" />
                      )}
                    </button>
                    {editJobDescriptionLink && (
                      <button
                        type="button"
                        onClick={() => setShowJobDescriptionPreview(true)}
                        title="Xem trước"
                        className="shrink-0 p-2 px-2.5 border border-[#00ADFC]/30 bg-[#E8F7FF] rounded-xl text-[#007EB8] hover:bg-[#00ADFC] hover:text-white transition-all cursor-pointer"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-gray-500 mb-1">Quản lý trực tiếp</label>
                  <HrFormSelect
                    value={editParentId}
                    onChange={setEditParentId}
                    label="Quản lý trực tiếp"
                    options={[{ value: "", label: "Không phân công" }, ...employees
                      .filter(emp => {
                        const checkIsDescendant = (pId: string, cId: string): boolean => {
                          const child = employees.find(e => e.id === cId);
                          if (!child || !child.parentId) return false;
                          if (child.parentId === pId) return true;
                          return checkIsDescendant(pId, child.parentId);
                        };

                        const targetUserRaw = usersList.find(u => u.uid === selectedEmp.id);
                        const rawUser = usersList.find(u => u.uid === emp.id);
                        if (!targetUserRaw || !rawUser) return false;

                        const ROLES_HIERARCHY: Record<string, number> = {
                          admin: 1,
                          branch_owner: 2,
                          manager: 3,
                          user: 4
                        };
                        const targetLevel = ROLES_HIERARCHY[targetUserRaw.role] || 4;
                        const parentLevel = ROLES_HIERARCHY[rawUser.role] || 4;

                        // Chỉ cho phép chọn quản lý có vai trò cấp cao hơn và không phải là chính mình/cấp dưới
                        return parentLevel < targetLevel && emp.id !== selectedEmp.id && !checkIsDescendant(selectedEmp.id, emp.id);
                      })
                      .map(emp => ({ value: emp.id, label: `${emp.name} (${emp.role})` }))]}
                  />
                </div>
              </div>

              <div className="mt-3 flex shrink-0 justify-end gap-2 border-t border-slate-100 pt-3 text-xs">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={handleEditEmployeeSave}
                  className="flex items-center gap-1.5 rounded-xl bg-[#00ADFC] px-5 py-2 text-white transition-all hover:bg-[#0095d9] active:scale-95 active:bg-[#0085c2] disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {isSaving ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Đang lưu...
                    </>
                  ) : (
                    "Lưu thay đổi"
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="org-chart-detail-popup relative grid w-full max-w-4xl max-h-[calc(100dvh-2rem)] grid-cols-1 gap-3 overflow-y-auto rounded-2xl border border-slate-100 bg-white p-4 text-left shadow-xl animate-in fade-in zoom-in-95 duration-200 animate-out duration-150 md:grid-cols-[220px_minmax(0,1fr)] md:p-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2 md:col-span-2">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-1 shrink-0 rounded-full bg-[#00ADFC]" />
                  <h4 className="font-bold text-slate-900 text-sm font-sans">Chi tiết nhân sự</h4>
                </div>
                <button
                  type="button"
                  onClick={closeDetailModal}
                  className="w-7 h-7 rounded-full bg-rose-500 hover:bg-rose-600 active:scale-95 text-white flex items-center justify-center transition-all cursor-pointer shadow-xs shrink-0"
                >
                  <X className="w-4 h-4 stroke-[2.5]" />
                </button>
              </div>

              <div className="self-start rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-center md:col-start-1 md:row-start-2">
                <div className="mb-2 flex justify-center">{renderAvatar(selectedEmp.avatar, "w-16 h-16", "text-3xl")}</div>
                <h3 className="text-base text-slate-900 leading-snug">{selectedEmp.name}</h3>
                <p className="mt-1 text-xs text-[#007EB8]">{selectedEmp.role}</p>
                <span className={`mt-2 inline-block rounded-lg border px-2.5 py-0.5 text-[11px] ${getDivisionBadgeStyles(selectedEmp.division)}`}>
                  {selectedEmp.division}
                </span>
              </div>

              {selectedLeaveBalance && (
                <div className="self-start rounded-xl border border-emerald-100 bg-emerald-50/70 p-3 md:col-start-1 md:row-start-3">
                  <div className="mb-2 flex items-center gap-2 text-xs text-emerald-800"><CalendarDays className="h-4 w-4" /> Phép năm {selectedLeaveBalance.year}</div>
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div><div className="text-[10px] text-slate-500">Hạn mức</div><span className="text-sm text-emerald-700">{selectedLeaveBalance.entitlement}</span></div>
                    <div><div className="text-[10px] text-slate-500">Đã dùng</div><span className="text-sm text-slate-700">{selectedLeaveBalance.used}</span></div>
                    <div><div className="text-[10px] text-slate-500">Chờ duyệt</div><span className="text-sm text-amber-600">{selectedLeaveBalance.pending}</span></div>
                    <div><div className="text-[10px] text-slate-500">Còn lại</div><span className="text-sm text-cyan-700">{selectedLeaveBalance.remaining}</span></div>
                  </div>
                </div>
              )}

              <div className="org-chart-detail-popup__details grid grid-cols-1 content-start gap-2 text-xs text-slate-700 sm:grid-cols-2 md:col-start-2 md:row-span-2 md:row-start-2">
                <div className="grid grid-cols-2 gap-3"><div><span className="block text-[9.5px] font-extrabold text-slate-400 uppercase tracking-wider">Trạng thái</span><strong>{selectedEmp.status === "online" ? "Đang hoạt động" : "Ngoại tuyến"}</strong></div><div><span className="block text-[9.5px] font-extrabold text-slate-400 uppercase tracking-wider">Cấp nhân sự</span><strong>Cấp {selectedEmp.level || missingValue}</strong></div></div>
                <div><span className="block text-[9.5px] font-extrabold text-slate-400 uppercase tracking-wider">Lương tháng</span><strong>{selectedEmp.monthlySalary != null ? new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(Number(selectedEmp.monthlySalary)) : missingValue}</strong></div>
                <div className="flex items-center gap-3">
                  <Building2 className="w-4.5 h-4.5 text-gray-400 shrink-0" />
                  <div>
                    <span className="block text-[9.5px] font-extrabold text-slate-400 uppercase tracking-wider">Phòng ban</span>
                    <strong className="text-slate-800 text-xs font-bold">{selectedEmp.department}</strong>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="w-4.5 h-4.5 text-gray-400 shrink-0" />
                  <div>
                    <span className="block text-[9.5px] font-extrabold text-slate-400 uppercase tracking-wider">Email liên lạc</span>
                    <strong className="text-slate-800 text-xs font-bold">{selectedEmp.email}</strong>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="w-4.5 h-4.5 text-gray-400 shrink-0" />
                  <div>
                    <span className="block text-[9.5px] font-extrabold text-slate-400 uppercase tracking-wider">Số điện thoại</span>
                    <strong className="text-slate-800 text-xs font-bold">{selectedEmp.phone}</strong>
                  </div>
                </div>
                {selectedEmp.jobDescriptionLink && (
                  <div className="flex items-center gap-3">
                    <Link2 className="w-4.5 h-4.5 text-gray-400 shrink-0" />
                    <div className="flex-1 flex items-center justify-between gap-2">
                      <div>
                        <span className="block text-[9.5px] font-extrabold text-slate-400 uppercase tracking-wider">Mô tả công việc</span>
                        <strong className="text-slate-800 text-xs font-bold">Đã đính kèm</strong>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setEditJobDescriptionLink(selectedEmp.jobDescriptionLink || "");
                          setShowJobDescriptionPreview(true);
                        }}
                        title="Xem trước"
                        className="shrink-0 p-2 border border-[#00ADFC]/30 bg-[#E8F7FF] rounded-xl text-[#007EB8] hover:bg-[#00ADFC] hover:text-white transition-all cursor-pointer"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
                {selectedEmp.parentId && (() => {
                  const manager = employees.find(e => e.id === selectedEmp.parentId);
                  return (
                    <div className="flex items-center gap-3">
                      <Users className="w-4.5 h-4.5 text-gray-400 shrink-0" />
                      <div>
                        <span className="block text-[9.5px] font-extrabold text-slate-400 uppercase tracking-wider">Quản lý trực tiếp</span>
                        <strong className="text-[#007EB8] text-xs font-bold">
                          {manager ? `${manager.name} (${manager.department})` : 'Quản lý cấp trên'}
                        </strong>
                      </div>
                    </div>
                  );
                })()}
                {(() => {
                  const directSubs = getDirectSubordinates(selectedEmp.id);
                  if (directSubs.length > 0) {
                    return (
                      <div className="flex flex-col gap-1.5 pt-1">
                        <div className="flex items-start gap-3">
                          <Users className="w-4.5 h-4.5 text-gray-400 shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <span className="block text-[9.5px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">
                              Nhân sự cấp dưới trực tiếp ({directSubs.length})
                            </span>
                            <div className="grid grid-cols-1 gap-1.5 pt-1 sm:grid-cols-2 xl:grid-cols-3">
                              {directSubs.map((sub) => (
                                <button
                                  type="button"
                                  key={sub.id}
                                  onClick={() => setSelectedEmp(sub)}
                                  className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-left font-sans transition-all duration-200 hover:border-[#00ADFC]/30 hover:bg-[#E8F7FF]/50 active:scale-95 outline-none cursor-pointer"
                                  title={`Bấm để xem chi tiết ${sub.name}`}
                                >
                                  {renderAvatar(sub.avatar, "w-7 h-7", "text-xs")}
                                  <div className="min-w-0">
                                    <span className="block text-xs font-bold text-slate-800 truncate">
                                      {sub.name}
                                    </span>
                                    <span className="block text-[10px] text-slate-500 truncate mt-0.5">
                                      {sub.role}
                                    </span>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  } else {
                    return (
                      <div className="flex items-center gap-3">
                        <Users className="w-4.5 h-4.5 text-gray-400 shrink-0" />
                        <div>
                          <span className="block text-[9.5px] font-extrabold text-slate-400 uppercase tracking-wider">
                            Nhân sự cấp dưới trực tiếp
                          </span>
                          <span className="text-[11px] text-gray-400 italic font-medium">Không có nhân sự cấp dưới trực tiếp</span>
                        </div>
                      </div>
                    );
                  }
                })()}
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-3 font-sans md:col-span-2">
                {isManager && usersList.find(u => u.uid === selectedEmp.id)?.role === "user" && (
                  <button
                    type="button"
                    onClick={handleToggleLeader}
                    disabled={isSavingLeader}
                    className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs transition-colors cursor-pointer active:scale-95 disabled:opacity-50 ${selectedEmp.isLeader
                        ? "bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-800"
                        : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700"
                      }`}
                  >
                    <Crown className="h-4 w-4 fill-amber-400 stroke-amber-700" />
                    {selectedEmp.isLeader ? "Hủy chức vụ Trưởng nhóm (Leader)" : "Đặt làm Trưởng nhóm (Leader)"}
                  </button>
                )}
                {canEditEmployee(selectedEmp.id) && (
                  <button
                    type="button"
                    onClick={startEditing}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-[#00ADFC]/20 bg-[#E8F7FF] px-3 py-2 text-xs text-[#007EB8] transition-colors hover:bg-[#00ADFC] hover:text-white cursor-pointer"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    Chỉnh sửa thông tin
                  </button>
                )}
                {isManager && canDeleteEmployee(selectedEmp.id) && (
                  <button
                    type="button"
                    onClick={() => {
                      handleDeleteEmployeeSubmit(selectedEmp.id);
                      closeDetailModal();
                    }}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 transition-colors hover:bg-rose-100 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Xóa khỏi hệ thống
                  </button>
                )}
                <button
                  type="button"
                  onClick={closeDetailModal}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-center text-xs text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {/* ADD EMPLOYEE MODAL */}
      {isAddModalOpen && (

        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-3 backdrop-blur-2xs sm:p-4">
          <form onSubmit={handleAddEmployee} className="org-chart-add-popup relative flex max-h-[calc(100dvh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white p-4 text-left shadow-xl md:p-5">
            <div className="mb-3 flex shrink-0 items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="h-4 w-1 shrink-0 rounded-full bg-[#00ADFC]" />
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#E8F7FF] text-[#007EB8]"><UserPlus className="h-4 w-4" /></span>
                <h4 className="text-sm text-slate-900 font-sans">Thêm nhân sự mới</h4>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                aria-label="Đóng popup thêm nhân sự"
                className="w-7 h-7 rounded-full bg-rose-500 hover:bg-rose-600 active:scale-95 text-white flex items-center justify-center transition-all cursor-pointer shadow-xs shrink-0"
              >
                <X className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>

            <div className="grid min-h-0 grid-cols-1 gap-x-4 gap-y-3 overflow-y-auto pr-1 text-xs sm:grid-cols-2">
              <div>
                <label className="block font-bold text-gray-500 mb-1">Họ tên *</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Lê Thị B"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-[#00ADFC]/20 focus:border-[#00ADFC]"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-500 mb-1">Trình độ</label>
                <input
                  type="text"
                  placeholder="Ví dụ: TESOL, Cử nhân Sư phạm"
                  value={addQualification}
                  onChange={(e) => setAddQualification(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-[#00ADFC]/20 focus:border-[#00ADFC]"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-500 mb-1">Lương tháng (VND)</label>
                <input type="number" min="0" step="1000" value={addMonthlySalary} onChange={(e) => setAddMonthlySalary(e.target.value)} className="no-number-spinner w-full px-3.5 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-[#00ADFC]/20 focus:border-[#00ADFC]" placeholder="26000000" />
              </div>
              <div>
                <label className="block font-bold text-gray-500 mb-1">Email *</label>
                <input
                  type="email"
                  required
                  placeholder="b.lt@igen.vn"
                  value={addEmail}
                  onChange={(e) => setAddEmail(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-[#00ADFC]/20 focus:border-[#00ADFC]"
                />
              </div>
              <div>
                <label className="block font-bold text-gray-500 mb-1">Số điện thoại</label>
                <input
                  type="text"
                  placeholder="090XXXXXXXX"
                  value={addPhone}
                  onChange={(e) => setAddPhone(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-[#00ADFC]/20 focus:border-[#00ADFC]"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-500 mb-1">Mật khẩu khởi tạo *</label>
                <input
                  type="password"
                  required
                  placeholder="Tối thiểu 6 ký tự"
                  value={addPassword}
                  onChange={(e) => setAddPassword(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-[#00ADFC]/20 focus:border-[#00ADFC]"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-500 mb-1">Quyền hạn (Role) *</label>
                <HrFormSelect
                  value={addRole}
                  onChange={(nextRole) => setAddRole(nextRole as typeof addRole)}
                  label="Quyền hạn"
                  options={[
                    { value: "user", label: "Nhân viên" },
                    { value: "manager", label: "Quản lý" },
                    { value: "branch_owner", label: "Chủ chi nhánh" },
                  ]}
                />
              </div>

              {addRole !== "admin" && (
                <div>
                  <label className="block font-bold text-gray-500 mb-1">Quản lý trực tiếp (Báo cáo cho)</label>
                  <HrFormSelect
                    value={addParentId}
                    onChange={setAddParentId}
                    label="Quản lý trực tiếp"
                    options={[{ value: "", label: "Không phân công" }, ...employees.filter(emp => {
                      const rawUser = usersList.find(u => u.uid === emp.id);
                      if (!rawUser) return false;

                      const ROLES_HIERARCHY: Record<string, number> = {
                        admin: 1,
                        branch_owner: 2,
                        manager: 3,
                        user: 4
                      };
                      const targetLevel = ROLES_HIERARCHY[addRole] || 4;
                      const parentLevel = ROLES_HIERARCHY[rawUser.role] || 4;

                      // Chỉ cho phép chọn quản lý có vai trò cấp cao hơn
                      if (parentLevel >= targetLevel) return false;

                      if (userProfile?.role === "superadmin" || userProfile?.role === "admin") {
                        return true;
                      }
                      if (userProfile?.role === "manager") {
                        const checkIsDescendant = (parentId: string, childId: string): boolean => {
                          const child = employees.find(e => e.id === childId);
                          if (!child || !child.parentId) return false;
                          if (child.parentId === parentId) return true;
                          return checkIsDescendant(parentId, child.parentId);
                        };
                        return emp.id === userProfile.uid || checkIsDescendant(userProfile.uid, emp.id);
                      }
                      return false;
                    }).map(emp => ({ value: emp.id, label: `${emp.name} (${emp.role}${emp.department ? ` · ${emp.department}` : ""})` }))]}
                  />
                </div>
              )}

              {(addRole === "user" || addRole === "manager") && (
                <div>
                  <label className="block font-bold text-gray-500 mb-1">
                    {addRole === "manager" ? "Phòng ban quản lý *" : "Phòng ban *"}
                  </label>
                  <HrFormSelect
                    disabled={addRole === "user" && !!addParentId}
                    value={isNewAddDepartment ? "__new_department__" : addDepartment}
                    onChange={(department) => {
                      setIsNewAddDepartment(department === "__new_department__");
                      setAddDepartment(department === "__new_department__" ? "" : department);
                    }}
                    label="Phòng ban"
                    options={[{ value: "", label: "Chọn phòng ban" }, ...uniqueDepartments.map(dept => ({ value: dept, label: dept })), { value: "__new_department__", label: "+ Thêm phòng ban mới" }]}
                  />
                  {isNewAddDepartment && (
                    <input
                      type="text"
                      value={addDepartment}
                      onChange={(e) => setAddDepartment(e.target.value)}
                      placeholder="Tên phòng ban mới"
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-slate-700 outline-none focus:border-[#00ADFC] focus:ring-2 focus:ring-[#00ADFC]/20"
                    />
                  )}
                  {addRole === "user" && !!addParentId && (
                    <p className="text-[10px] text-[#007EB8] font-mono mt-0.5">
                      Tự động điền theo phòng ban của quản lý trực tiếp.
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="block font-bold text-gray-500 mb-1">Link mô tả công việc</label>
                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    placeholder="Dán link hoặc tải file lên"
                    value={addJobDescriptionLink}
                    onChange={(e) => setAddJobDescriptionLink(e.target.value)}
                    className="flex-1 px-3.5 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-[#00ADFC]/20 focus:border-[#00ADFC]"
                  />
                  <input
                    ref={addJobDescriptionFileInputRef}
                    type="file"
                    className="hidden"
                    onChange={(e) => handleJobDescriptionFileChange(e, "add")}
                  />
                  <button
                    type="button"
                    onClick={() => addJobDescriptionFileInputRef.current?.click()}
                    disabled={uploadingAddJobDescription}
                    title="Tải file lên Google Drive"
                    className="shrink-0 p-2 px-2.5 border border-slate-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {uploadingAddJobDescription ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Upload className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-3 flex shrink-0 justify-end gap-2 border-t border-slate-100 pt-3 text-xs">
              <button
                type="submit"
                disabled={isAddingEmployee}
                className="px-5 py-2 bg-[#00ADFC] hover:bg-[#0095d9] active:bg-[#0085c2] text-white font-semibold rounded-xl cursor-pointer transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-xs"
              >
                {isAddingEmployee ? (
                  <>
                    <RefreshCw className="animate-spin h-3.5 w-3.5" />
                    Đang tạo tài khoản...
                  </>
                ) : (
                  "Lưu nhân sự"
                )}
              </button>
            </div>
          </form>
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

      {/* Job description preview modal */}
      {showJobDescriptionPreview && editJobDescriptionLink && (
        <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4" onClick={() => setShowJobDescriptionPreview(false)}>
          <div
            className="bg-white rounded-2xl border border-slate-100 shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-3.5 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <div className="h-4 w-1 shrink-0 rounded-full bg-[#00ADFC]" />
                <span className="text-xs font-bold text-slate-900">Xem trước mô tả công việc</span>
              </div>
              <div className="flex items-center gap-3">
                <a
                  href={editJobDescriptionLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] font-bold text-[#007EB8] hover:underline px-2"
                >
                  Mở trong tab mới
                </a>
                <button
                  type="button"
                  onClick={() => setShowJobDescriptionPreview(false)}
                  className="w-7 h-7 rounded-full bg-rose-500 hover:bg-rose-600 active:scale-95 text-white flex items-center justify-center transition-all cursor-pointer shadow-xs shrink-0"
                >
                  <X className="w-4 h-4 stroke-[2.5]" />
                </button>
              </div>
            </div>
            <div className="flex-1 bg-gray-50">
              <iframe
                src={
                  editJobDescriptionLink.includes("drive.google.com")
                    ? editJobDescriptionLink.replace(/\/(edit|view)(\?.*)?$/, "/preview")
                    : editJobDescriptionLink
                }
                className="w-full h-full border-0"
                title="Xem trước mô tả công việc"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
