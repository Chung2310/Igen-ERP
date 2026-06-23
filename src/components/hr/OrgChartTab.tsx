import React, { useState, useEffect, useRef } from "react";
import {
  Users,
  Search,
  Filter,
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
  Edit
} from "lucide-react";
import { EmployeeNode, UserProfile, TrainingCourse } from "../../types";
import { authService, getAccessToken } from "../../services/authService";
import { toast } from "../../pages/Toast";

interface OrgChartTabProps {
  userProfile: any;
  selectedCompanyCode: string;
  usersList: UserProfile[];
  employees: EmployeeNode[];
  fetchUsers: () => Promise<void>;
  isManager: boolean;
  companies: any[];
  courses: TrainingCourse[];
  fetchCourses: (compCode: string) => Promise<void>;
  loading: boolean;
}

const isUrl = (str?: string): boolean => {
  if (!str) return false;
  return str.startsWith("http://") || str.startsWith("https://") || str.startsWith("data:image/") || str.startsWith("/");
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
  companies,
  courses,
  fetchCourses,
  loading
}: OrgChartTabProps) {
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startY, setStartY] = useState(0);
  const [scrollLeftState, setScrollLeftState] = useState(0);
  const [scrollTopState, setScrollTopState] = useState(0);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (
      target.closest("button") ||
      target.closest("select") ||
      target.closest("input") ||
      target.closest("[draggable='true']") ||
      target.closest(".cursor-pointer")
    ) {
      return;
    }
    setIsDragging(true);
    if (containerRef.current) {
      setStartX(e.pageX - containerRef.current.offsetLeft);
      setStartY(e.pageY - containerRef.current.offsetTop);
      setScrollLeftState(containerRef.current.scrollLeft);
      setScrollTopState(containerRef.current.scrollTop);
    }
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
    containerRef.current.scrollLeft = scrollLeftState - walkX;
    containerRef.current.scrollTop = scrollTopState - walkY;
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const zoomFactor = 0.05;
    if (e.deltaY < 0) {
      setZoomLevel(prev => Math.min(1.5, Number((prev + zoomFactor).toFixed(2))));
    } else {
      setZoomLevel(prev => Math.max(0.5, Number((prev - zoomFactor).toFixed(2))));
    }
  };

   const [filterDivision, setFilterDivision] = useState<string>("Tất cả");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());
  const [selectedEmp, setSelectedEmp] = useState<EmployeeNode | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

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
    setIsEditing(false);
  };

  // Add Employee Modal States

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAddingEmployee, setIsAddingEmployee] = useState(false);
  const [addName, setAddName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addPassword, setAddPassword] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [addDepartment, setAddDepartment] = useState("Phòng Kỹ Thuật");
  const [addParentId, setAddParentId] = useState("");
  const [addRole, setAddRole] = useState<"user" | "manager">("user");

  // Edit Employee States
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editRoleText, setEditRoleText] = useState("");
  const [editDivision, setEditDivision] = useState("");
  const [editDepartment, setEditDepartment] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editLevel, setEditLevel] = useState<number>(4);
  const [editParentId, setEditParentId] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Reset editing state when selected employee changes
  useEffect(() => {
    setIsEditing(false);
  }, [selectedEmp?.id]);

  const startEditing = () => {
    if (!selectedEmp) return;
    setEditName(selectedEmp.name || "");
    setEditRoleText(selectedEmp.role || "");
    setEditDivision(selectedEmp.division || "Khối Vận Hành");
    setEditDepartment(selectedEmp.department || "");
    setEditEmail(selectedEmp.email || "");
    setEditPhone(selectedEmp.phone && selectedEmp.phone !== "Chưa cập nhật" ? selectedEmp.phone : "");
    setEditLevel(selectedEmp.level || 4);
    setEditParentId(selectedEmp.parentId || "");
    setIsEditing(true);
  };

  const handleEditEmployeeSave = async () => {
    if (!selectedEmp) return;

    if (!editName.trim()) {
      toast.warning("Vui lòng nhập đầy đủ Họ tên!");
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
        division: editDivision,
        department: editDepartment.trim(),
        phone: editPhone.trim() || "",
        parentId: editParentId || null,
      };

      await authService.updateUser(selectedEmp.id, updateData);
      toast.success("Cập nhật thông tin nhân sự thành công!");
      setIsEditing(false);
      await fetchUsers();
      
      // Cập nhật selectedEmp cục bộ
      const updatedNode = {
        ...selectedEmp,
        name: updateData.displayName,
        role: updateData.jobTitle,
        division: updateData.division,
        department: updateData.department,
        phone: updateData.phone || "Chưa cập nhật",
        parentId: updateData.parentId || undefined,
      };
      setSelectedEmp(updatedNode);
    } catch (err) {
      console.error(err);
      toast.error("Lỗi khi cập nhật thông tin nhân sự.");
    } finally {
      setIsSaving(false);
    }
  };

  const canEditEmployee = (selectedEmpId: string): boolean => {
    if (!userProfile) return false;
    if (selectedEmpId === userProfile.uid) return false; // Không tự chỉnh sửa chính mình ở đây

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

  const handleDeleteEmployeeSubmit = async (empId: string) => {
    const targetEmp = employees.find(e => e.id === empId);
    if (!targetEmp) return;

    if (!window.confirm(`Bạn có chắc chắn muốn xóa nhân sự "${targetEmp.name}" khỏi hệ thống? Sơ đồ sẽ tự động chuyển cấp dưới trực thuộc của nhân sự này báo cáo lên quản lý cấp trên.`)) {
      return;
    }

    try {
      await authService.deleteUser(empId);
      toast.success("Đã xóa nhân sự thành công!");
      setSelectedEmp(null);
      await fetchUsers();
    } catch (error) {
      console.error("Lỗi khi xóa nhân sự:", error);
      toast.error("Không thể xóa nhân sự. Vui lòng kiểm tra quyền hạn.");
    }
  };

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
        setAddParentId(firstCompanyManager?.uid || "");
      }
    }
  }, [isAddModalOpen, userProfile, selectedCompanyCode, usersList]);

  // Handle parentId based on addRole automatically
  useEffect(() => {
    if (isAddModalOpen) {
      const compCode = selectedCompanyCode || userProfile?.companyCode || "SYSTEM";
      if (addRole === "manager") {
        const companyAdmin = usersList.find(
          (u) => u.companyCode === compCode && u.role === "admin"
        );
        setAddParentId(companyAdmin?.uid || "");
      } else {
        if (userProfile?.role === "manager") {
          setAddParentId(userProfile.uid);
        } else {
          const firstCompanyManager = usersList.find(
            (u) => u.companyCode === compCode && u.role === "manager"
          );
          setAddParentId(firstCompanyManager?.uid || "");
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
      }
    } else if (isAddModalOpen && addRole === "user" && !addParentId) {
      setAddDepartment("");
    }
  }, [addRole, addParentId, usersList, isAddModalOpen]);

  // Reset addDepartment when modal closes
  useEffect(() => {
    if (!isAddModalOpen) {
      setAddDepartment("Phòng Kỹ Thuật");
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

        // Tạo Kanban task tương ứng
        const taskDueDate = new Date();
        taskDueDate.setDate(taskDueDate.getDate() + 7);
        await fetch("/api/v1/crud/kanban-tasks", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${getAccessToken()}`,
          },
          body: JSON.stringify({
            title: `[Đào tạo] ${course.title}`,
            description: course.isRequired
              ? `Khóa học bắt buộc của công ty. Hoàn thành trong vòng 7 ngày kể từ ngày vào công ty.`
              : `Khóa học Onboarding. Hoàn thành trong vòng 7 ngày kể từ ngày vào công ty.`,
            assigneeUid: newEmpUid,
            assignee: newEmpName,
            assigneeAvatar: "👤",
            dueDate: taskDueDate.toLocaleDateString("vi-VN"),
            priority: course.isRequired ? "High" : "Medium",
            status: "Not Started",
            category: "Đào tạo",
            companyCode,
            creatorUid: userProfile?.uid || "system",
            createdAt: new Date().toISOString(),
            projectId: "",
            tags: course.tags,
            linkNote: "",
            history: [{
              time: new Date().toLocaleString("vi-VN"),
              user: "Hệ thống",
              action: `Tự động tạo từ khóa học ${course.isRequired ? "Bắt buộc" : "Onboarding"}: "${course.title}"`
            }]
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
    const deptName = addDepartment.trim() || (addRole === "manager" ? "Quản lý" : "Nhân sự");

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
        addPhone.trim()
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

      await fetchUsers();
      if (compCode) {
        await fetchCourses(compCode);
      }
    } catch (err) {
      console.error(err);
      toast.error("Lỗi khi thêm thành viên mới.");
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
      toast.error("Không thể lưu cập nhật cơ cấu nhân sự.");
    }
  };

  // Division Tag color schemes — dynamic, using FUNCTIONAL_CATEGORIES
  const getDivisionBadgeStyles = (division: string) => {
    const cat = getCategoryByDivision(division);
    switch (cat.key) {
      case "governance": return "bg-slate-100 text-slate-800 border-slate-300";
      case "finance":    return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "tech":       return "bg-indigo-50 text-indigo-700 border-indigo-200";
      case "operations": return "bg-cyan-50 text-cyan-700 border-cyan-200";
      case "sales":      return "bg-amber-50 text-amber-700 border-amber-200";
      case "hr":         return "bg-rose-50 text-rose-700 border-rose-200";
      default:           return "bg-slate-50 text-slate-700 border-slate-200";
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

  // Filtering matching logic
  const isMatchingFilter = (emp: EmployeeNode): boolean => {
    const matchSearch = searchQuery.trim() === "" ||
      emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.role.toLowerCase().includes(searchQuery.toLowerCase());

    const matchDivision = filterDivision === "Tất cả" || emp.division === filterDivision;

    return matchSearch && matchDivision;
  };

  // Identify root employees (level 1 or nodes with no parent in the displayed tree)
  const rootEmployees = employees.filter(e => !e.parentId || !employees.some(p => p.id === e.parentId));

  // Recursive Branch rendering component helper
  const renderBranch = (node: EmployeeNode) => {
    const children = employees.filter(e => e.parentId === node.id);
    const isSelected = selectedEmp?.id === node.id;
    const isMatch = isMatchingFilter(node);
    const isFilteredOut = (searchQuery.trim() !== "" || filterDivision !== "Tất cả") && !isMatch;
    const isCollapsed = collapsedNodes.has(node.id);
    const directReportsCount = employees.filter(e => e.parentId === node.id).length;

    const category = getCategoryByDivision(node.division);

    const getCategoryBadgeStyles = (key: string) => {
      switch (key) {
        case "governance": return "bg-slate-100 text-slate-800 border-slate-200";
        case "finance": return "bg-emerald-50 text-emerald-700 border-emerald-200";
        case "tech": return "bg-indigo-50 text-indigo-700 border-indigo-200";
        case "operations": return "bg-cyan-50 text-cyan-700 border-cyan-200";
        case "sales": return "bg-amber-50 text-amber-700 border-amber-200";
        case "hr": return "bg-rose-50 text-rose-700 border-rose-200";
        default: return "bg-slate-50 text-slate-655 border-slate-200";
      }
    };

    const renderCardIcon = (role: string) => {
      const rLower = (role || "").toLowerCase();
      if (rLower.includes("ceo") || rLower.includes("chủ tịch") || rLower.includes("coo") || rLower.includes("cfo") || rLower.includes("cmo") || rLower.includes("cso") || rLower.includes("director") || rLower.includes("giám đốc")) {
        return "👑";
      }
      if (rLower.includes("trưởng phòng") || rLower.includes("manager") || rLower.includes("leader") || rLower.includes("trưởng nhóm")) {
        return "💼";
      }
      return "👤";
    };

    return (
      <div className="flex flex-col items-center" key={node.id}>
        {/* Smart Employee Card */}
        <div
          draggable={isManager ? "true" : "false"}
          onDragStart={(e) => handleDragStart(e, node.id)}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, node.id)}
          onClick={() => setSelectedEmp(node)}
          className={`p-3 bg-white text-gray-800 rounded-2xl shadow-xs w-56 text-left cursor-pointer relative hover:scale-104 active:scale-95 transition-all duration-300 border border-gray-200 ${category.border} ${isSelected
              ? "ring-4 ring-indigo-500 shadow-indigo-100 border-transparent z-10"
              : "hover:border-indigo-300 hover:shadow-md"
            } ${isFilteredOut ? "opacity-30 blur-[0.5px] scale-98" : "opacity-100"
            }`}
          id={`org_node_${node.id}`}
        >
          {/* Online/Offline Dot Indicator */}
          <div className="absolute top-2.5 right-2.5 flex items-center justify-center">
            {node.status === "online" ? (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 block border border-white animate-pulse" title="Đang hoạt động" />
            ) : (
              <span className="w-1.5 h-1.5 rounded-full bg-gray-300 block border border-white" title="Ngoại tuyến" />
            )}
          </div>

          <div className="space-y-2">
            {/* Top row: Category Badge */}
            <div className="flex items-center justify-between">
              <span className={`text-[8px] font-extrabold border px-1.5 py-0.5 rounded-md uppercase tracking-wider font-mono ${getCategoryBadgeStyles(category.key)}`}>
                {category.badge}
              </span>
            </div>

            {/* Middle row: Department (Main Title) */}
            <div className="min-h-[32px] flex items-center">
              <h4 className="font-bold text-xs text-slate-800 leading-snug font-sans line-clamp-2">
                {node.department}
              </h4>
            </div>

            {/* Bottom row: Manager Info */}
            <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
              {renderAvatar(node.avatar, "w-6 h-6", "text-xs")}
              <div className="min-w-0 flex-1">
                <span className="block text-[8px] font-bold text-gray-400 uppercase tracking-wider truncate font-mono">
                  {renderCardIcon(node.role)} {node.role}
                </span>
                <span className="block text-[10px] font-bold text-indigo-950 truncate">
                  {node.name}
                </span>
              </div>
            </div>
          </div>

          {/* Collapse/Expand toggle badge */}
          {directReportsCount > 0 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); toggleCollapse(node.id); }}
              title={isCollapsed ? `Mở rộng ${directReportsCount} nhân viên cấp dưới` : `Thu gọn ${directReportsCount} nhân viên cấp dưới`}
              className={`absolute -bottom-2.5 left-1/2 -translate-x-1/2 text-white text-[9px] font-extrabold w-5 h-5 rounded-full flex items-center justify-center shadow-xs border-2 border-white select-none transition-all cursor-pointer ${
                isCollapsed ? "bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white" : "bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white"
              }`}
            >
              {isCollapsed ? `+${directReportsCount}` : "^"}
            </button>
          )}
        </div>

        {/* Children Render recursive block */}
        {children.length > 0 && !isCollapsed && (
          <>
            <div className="w-0.5 h-6 bg-slate-300" />
            <div className="flex relative items-start">
              {children.map((child, index) => {
                const isFirst = index === 0;
                const isLast = index === children.length - 1;
                const hasSiblings = children.length > 1;

                return (
                  <div key={child.id} className="flex flex-col items-center px-4 relative">
                    {/* Horizontal Connector bar */}
                    {hasSiblings && (
                      <div className="absolute top-0 left-0 right-0 h-0.5 flex">
                        <div className={`w-1/2 ${isFirst ? '' : 'border-t-2 border-slate-300'}`} />
                        <div className={`w-1/2 ${isLast ? '' : 'border-t-2 border-slate-300'}`} />
                      </div>
                    )}
                    <div className="w-0.5 h-6 border-l-2 border-slate-300" />

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
      {/* Division filter and search bar for Org Chart tab */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-50 p-4 border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-4 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo tên hoặc chức danh..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 bg-white rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              value={filterDivision}
              onChange={(e) => setFilterDivision(e.target.value)}
              className="border border-gray-200 p-1.5 rounded-xl text-xs bg-white outline-none cursor-pointer"
            >
              <option value="Tất cả">Tất cả Khối</option>
              {uniqueDivisions.map(div => (
                <option key={div} value={div}>{div}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={collapseAll}
            className="px-3 py-1.5 border border-gray-200 hover:bg-slate-50 rounded-xl text-xs font-semibold cursor-pointer active:scale-95 transition-all"
          >
            Thu gọn tất cả
          </button>
          <button
            onClick={expandAll}
            className="px-3 py-1.5 border border-gray-200 hover:bg-slate-50 rounded-xl text-xs font-semibold cursor-pointer active:scale-95 transition-all"
          >
            Mở rộng tất cả
          </button>
          <div className="h-6 w-px bg-gray-200 mx-1" />
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Thu Phóng:</span>
            <input
              type="range"
              min="0.5"
              max="1.5"
              step="0.1"
              value={zoomLevel}
              onChange={(e) => setZoomLevel(parseFloat(e.target.value))}
              className="w-20 accent-indigo-600 cursor-pointer"
            />
            <span className="w-10 text-right text-[10px] font-bold text-slate-650">{Math.round(zoomLevel * 100)}%</span>
          </div>
          {isManager && (
            <>
              <div className="h-6 w-px bg-gray-200 mx-1" />
              <button
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                className="px-4 py-2 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 active:scale-95 cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                Thêm Nhân Sự
              </button>
            </>
          )}
        </div>
      </div>

      {/* Primary Sub Tab Layout View */}
      <div className="flex-1 p-6 overflow-y-auto" id="hr_tab_content">
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 h-full min-h-[500px]" id="org_chart_block">
          {/* Functional categories and operating instructions sidebar */}
          <div className="xl:col-span-1 bg-white p-5 rounded-2xl border border-gray-200 flex flex-col justify-between h-full space-y-6" id="employee_detail_card">
            <div className="space-y-4">
              <h3 className="text-xs font-extrabold uppercase text-slate-400 tracking-wider font-mono">
                MÀU SẮC CHỨC NĂNG
              </h3>
              <div className="space-y-2">
                {FUNCTIONAL_CATEGORIES.map(cat => {
                  const count = employees.filter(emp => getCategoryByDivision(emp.division).key === cat.key).length;
                  return (
                    <div key={cat.key} className="flex items-center justify-between p-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl transition-all duration-200">
                      <div className="flex items-center gap-2.5">
                        <span className="w-3.5 h-3.5 rounded-full border border-white shadow-xs shrink-0" style={{ backgroundColor: cat.dot }} />
                        <span className="text-xs font-bold text-slate-700">{cat.label}</span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white border border-gray-200 text-slate-600 min-w-[20px] text-center shadow-2xs font-mono">
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Interactive guidelines bottom banner */}
            <div className="p-4 bg-indigo-50/70 border border-indigo-100 rounded-2xl space-y-2.5">
              <div className="flex items-center gap-1.5 text-indigo-850 text-xs font-bold">
                <span className="text-sm">💡</span>
                <h4 className="uppercase tracking-wide font-sans text-indigo-900">HƯỚNG DẪN THAO TÁC</h4>
              </div>
              <ul className="text-[10px] text-indigo-700 space-y-2 font-medium leading-relaxed list-disc list-inside">
                <li className="pl-0.5">Kéo thả chuột trái lên nền để di chuyển sơ đồ.</li>
                <li className="pl-0.5">Sử dụng con lăn chuột hoặc thanh zoom để thu phóng.</li>
                <li className="pl-0.5">Kéo thả thẻ nhân sự để thay đổi cấp quản lý.</li>
                <li className="pl-0.5">Nhấp vào thẻ nhân sự để xem chi tiết / chỉnh sửa.</li>
              </ul>
            </div>
          </div>

          {/* Interactive Tree viewport diagram */}
          <div className="xl:col-span-3 bg-slate-50 border border-gray-250 rounded-2xl relative overflow-hidden flex flex-col min-h-[500px]" id="tree_viewport">
            <div className="absolute top-4 left-4 bg-white/85 border px-2.5 py-1 rounded-full text-[10px] font-bold text-slate-500 select-none z-10 flex items-center gap-1 shadow-2xs">
              <span>🖱️ Giữ chuột trái kéo để xem sơ đồ</span>
            </div>

            <div
              ref={containerRef}
              onMouseDown={handleMouseDown}
              onMouseLeave={handleMouseLeaveOrUp}
              onMouseUp={handleMouseLeaveOrUp}
              onMouseMove={handleMouseMove}
              onWheel={handleWheel}
              className={`flex-1 overflow-auto p-12 flex items-start justify-start min-h-[440px] select-none ${
                isDragging ? "cursor-grabbing" : "cursor-grab"
              }`}
              id="interactive_org_chart"
            >
              <div style={{ zoom: zoomLevel, transition: "zoom 0.2s ease-out" }} className="flex flex-col items-center mx-auto min-w-max">
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
            <div className="p-3 bg-white border-t border-gray-200 select-none text-center text-xs text-gray-400 font-medium">
              💡 Nhấn chọn nhân sự để hiển thị liên kết vận hành Kanban / e-Learning của thành viên đó
            </div>
          </div>
        </div>
      </div>

      {/* EMPLOYEE DETAIL & EDIT MODAL */}
      {isDetailModalOpen && selectedEmp && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-2xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200" id="employee_detail_modal">
          {isEditing ? (
            <div className="bg-white border border-slate-100 rounded-2xl shadow-xl w-full max-w-md p-6 relative text-left space-y-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex justify-between items-center pb-2 border-b">
                <h4 className="font-bold text-slate-800 text-sm font-sans uppercase">Chỉnh Sửa Nhân Sự</h4>
                <button type="button" onClick={() => setIsEditing(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-3.5 text-xs text-left">
                <div className="flex justify-center pb-2">
                  {renderAvatar(selectedEmp.avatar, "w-16 h-16", "text-3xl")}
                </div>

                <div>
                  <label className="block font-bold text-gray-500 mb-1">Họ tên *</label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3.5 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 bg-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-gray-500 mb-1">Chức danh</label>
                    <input
                      type="text"
                      value={editRoleText}
                      onChange={(e) => setEditRoleText(e.target.value)}
                      className="w-full px-3.5 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-gray-500 mb-1">Phân khối</label>
                    <select
                      value={editDivision}
                      onChange={(e) => setEditDivision(e.target.value)}
                      className="w-full p-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-white cursor-pointer text-slate-700"
                    >
                      {uniqueDivisions.map(div => (
                        <option key={div} value={div}>{div}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-gray-500 mb-1">Phòng ban</label>
                    <input
                      type="text"
                      value={editDepartment}
                      onChange={(e) => setEditDepartment(e.target.value)}
                      className="w-full px-3.5 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-gray-500 mb-1">Số điện thoại</label>
                    <input
                      type="text"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      className="w-full px-3.5 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-gray-500 mb-1">Email liên lạc (Cố định)</label>
                  <input
                    type="email"
                    value={editEmail}
                    disabled
                    className="w-full px-3.5 py-2 border border-gray-200 rounded-xl outline-none bg-gray-100 text-gray-400 cursor-not-allowed select-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-500 mb-1">Quản lý trực tiếp</label>
                  <select
                    value={editParentId}
                    onChange={(e) => setEditParentId(e.target.value)}
                    className="w-full p-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-white cursor-pointer text-slate-700"
                  >
                    <option value="">Không phân công</option>
                    {employees
                      .filter(emp => {
                        const checkIsDescendant = (pId: string, cId: string): boolean => {
                          const child = employees.find(e => e.id === cId);
                          if (!child || !child.parentId) return false;
                          if (child.parentId === pId) return true;
                          return checkIsDescendant(pId, child.parentId);
                        };
                        return emp.id !== selectedEmp.id && !checkIsDescendant(selectedEmp.id, emp.id);
                      })
                      .map(emp => (
                        <option key={emp.id} value={emp.id}>{emp.name} ({emp.role})</option>
                      ))
                    }
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t flex justify-end gap-3 text-xs font-bold">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 border rounded-xl hover:bg-slate-50 cursor-pointer disabled:opacity-50"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={handleEditEmployeeSave}
                  className="px-5 py-2 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl cursor-pointer transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
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
            <div className="bg-white border border-slate-100 rounded-2xl shadow-xl w-full max-w-sm p-6 relative text-left space-y-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex justify-between items-center pb-2 border-b">
                <h4 className="font-bold text-slate-800 text-sm font-sans uppercase">Chi Tiết Nhân Sự</h4>
                <button type="button" onClick={closeDetailModal} className="text-gray-400 hover:text-gray-650 cursor-pointer">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="text-center pb-4 border-b border-gray-200">
                <div className="mb-2 mx-auto flex justify-center">{renderAvatar(selectedEmp.avatar, "w-20 h-20", "text-4xl")}</div>
                <h3 className="font-bold text-base text-slate-800 font-sans leading-snug">{selectedEmp.name}</h3>
                <p className="text-[10.5px] font-bold font-mono uppercase tracking-wide mt-1 text-indigo-600">{selectedEmp.role}</p>
                <span className={`inline-block text-[9px] font-bold border px-2 py-0.5 rounded-md uppercase tracking-wider font-mono mt-2 ${getDivisionBadgeStyles(selectedEmp.division)}`}>
                  {selectedEmp.division}
                </span>
              </div>

              <div className="space-y-3.5 text-xs text-slate-655 text-slate-600">
                <div className="flex items-center gap-2.5">
                  <Building2 className="w-4 h-4 text-gray-400 shrink-0" />
                  <div>
                    <span className="block text-[8px] font-bold text-gray-400 uppercase tracking-wider">Phòng ban</span>
                    <strong className="text-slate-800">{selectedEmp.department}</strong>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <Mail className="w-4 h-4 text-gray-400 shrink-0" />
                  <div>
                    <span className="block text-[8px] font-bold text-gray-400 uppercase tracking-wider">Email liên lạc</span>
                    <strong className="text-slate-800">{selectedEmp.email}</strong>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <Phone className="w-4 h-4 text-gray-400 shrink-0" />
                  <div>
                    <span className="block text-[8px] font-bold text-gray-400 uppercase tracking-wider">Số điện thoại</span>
                    <strong className="text-slate-800">{selectedEmp.phone}</strong>
                  </div>
                </div>
                {selectedEmp.parentId && (
                  <div className="flex items-center gap-2.5">
                    <Users className="w-4 h-4 text-gray-400 shrink-0" />
                    <div>
                      <span className="block text-[8px] font-bold text-gray-400 uppercase tracking-wider">Quản lý trực tiếp</span>
                      <strong className="text-slate-855 text-indigo-705">{employees.find(e => e.id === selectedEmp.parentId)?.name || 'Quản lý cấp trên'}</strong>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t flex flex-col gap-2 font-sans font-bold">
                {canEditEmployee(selectedEmp.id) && (
                  <button
                    type="button"
                    onClick={startEditing}
                    className="w-full py-2.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    Chỉnh Sửa Thông Tin
                  </button>
                )}
                {isManager && canDeleteEmployee(selectedEmp.id) && (
                  <button
                    type="button"
                    onClick={() => {
                      handleDeleteEmployeeSubmit(selectedEmp.id);
                      closeDetailModal();
                    }}
                    className="w-full py-2.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Xóa Khỏi Hệ Thống
                  </button>
                )}
                <button
                  type="button"
                  onClick={closeDetailModal}
                  className="w-full py-2 border rounded-xl hover:bg-slate-50 text-gray-500 text-xs font-bold cursor-pointer text-center"
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

        <div className="fixed inset-0 bg-black/50 backdrop-blur-2xs flex items-center justify-center z-50 p-4">
          <form onSubmit={handleAddEmployee} className="bg-white border rounded-2xl shadow-xl w-full max-w-md p-6 relative text-left space-y-4">
            <div className="flex justify-between items-center pb-2 border-b">
              <h4 className="font-bold text-slate-800 text-sm font-sans uppercase">Thêm Nhân Sự Mới</h4>
              <button type="button" onClick={() => setIsAddModalOpen(false)} className="text-gray-400 hover:text-gray-650 cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-gray-500 mb-1">Họ tên *</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Lê Thị B"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  className="w-full px-3.5 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-500 mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    placeholder="b.lt@igen.vn"
                    value={addEmail}
                    onChange={(e) => setAddEmail(e.target.value)}
                    className="w-full px-3.5 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-500 mb-1">Số điện thoại</label>
                  <input
                    type="text"
                    placeholder="090XXXXXXXX"
                    value={addPhone}
                    onChange={(e) => setAddPhone(e.target.value)}
                    className="w-full px-3.5 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-500 mb-1">Mật khẩu khởi tạo *</label>
                <input
                  type="password"
                  required
                  placeholder="Tối thiểu 6 ký tự"
                  value={addPassword}
                  onChange={(e) => setAddPassword(e.target.value)}
                  className="w-full px-3.5 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-500 mb-1">Quyền hạn (Role) *</label>
                <select
                  value={addRole}
                  onChange={(e) => setAddRole(e.target.value as any)}
                  className="w-full p-2 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-white cursor-pointer"
                >
                  <option value="user">USER (Nhân viên)</option>
                  <option value="manager">MANAGER (Quản lý)</option>
                </select>
              </div>

              {addRole === "user" && (
                <div>
                  <label className="block font-bold text-gray-500 mb-1">Quản lý trực tiếp (Báo cáo cho)</label>
                  <select
                    value={addParentId}
                    onChange={(e) => setAddParentId(e.target.value)}
                    className="w-full p-2 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-white cursor-pointer"
                  >
                    <option value="">Không phân công</option>
                    {employees.filter(emp => {
                      const rawUser = usersList.find(u => u.uid === emp.id);
                      if (rawUser?.role !== "manager") return false;

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
                    }).map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.role}{emp.department ? ` · ${emp.department}` : ""})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {(addRole === "user" || addRole === "manager") && (
                <div>
                  <label className="block font-bold text-gray-500 mb-1">
                    {addRole === "manager" ? "Phòng ban quản lý *" : "Phòng ban *"}
                  </label>
                  <input
                    type="text"
                    required
                    disabled={addRole === "user" && !!addParentId}
                    placeholder="Ví dụ: Phòng Kỹ Thuật"
                    value={addDepartment}
                    onChange={(e) => setAddDepartment(e.target.value)}
                    className="w-full px-3.5 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-400"
                  />
                  {addRole === "user" && !!addParentId && (
                    <p className="text-[10px] text-indigo-650 font-mono mt-0.5">
                      Tự động điền theo phòng ban của quản lý trực tiếp.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="pt-4 border-t flex justify-end gap-3 text-xs font-bold">
              <button
                type="button"
                disabled={isAddingEmployee}
                onClick={() => setIsAddModalOpen(false)}
                className="px-4 py-2 border rounded-xl hover:bg-slate-50 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                disabled={isAddingEmployee}
                className="px-5 py-2 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl cursor-pointer transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
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
    </>
  );
}
