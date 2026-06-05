import React, { useState, useEffect } from "react";
import { 
  Building2, 
  UserSquare, 
  Briefcase, 
  MapPin, 
  Phone, 
  Mail, 
  Plus, 
  UserPlus, 
  BookOpen, 
  Search,
  CheckCircle,
  Clock,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Award,
  Filter,
  Users,
  Activity,
  Trash2,
  X
} from "lucide-react";
import { HRSubTabType, EmployeeNode, HRTask, TrainingCourse, UserProfile } from "../types";
import { useAuth } from "../context/AuthContext";
import { db } from "../config/firebase";
import { doc, updateDoc, setDoc } from "firebase/firestore";
import { authService } from "../services/authService";
import { toast } from "./Toast";

export default function HRTab() {
  const { userProfile } = useAuth();
  const isManager = userProfile?.role === "superadmin" || userProfile?.role === "admin" || userProfile?.role === "manager";
  const [subTab, setSubTab] = useState<HRSubTabType>("SƠ ĐỒ TỔ CHỨC");
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmp, setSelectedEmp] = useState<EmployeeNode | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [filterDivision, setFilterDivision] = useState<string>("Tất cả");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [kanbanFilter, setKanbanFilter] = useState<string | null>(null);
  const [trainingFilter, setTrainingFilter] = useState<string | null>(null);
  
  // SaaS States
  const [companies, setCompanies] = useState<any[]>([]);
  const [selectedCompanyCode, setSelectedCompanyCode] = useState<string>("");
  
  // Add Employee Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [addDepartment, setAddDepartment] = useState("Phòng Kỹ Thuật");
  const [addParentId, setAddParentId] = useState("");
  const [addRole, setAddRole] = useState<"user" | "manager">("user");

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
  }, [userProfile]);

  // Fetch users list from Firestore based on company filter
  const fetchUsers = async () => {
    if (!selectedCompanyCode) return;
    setLoading(true);
    try {
      let data: UserProfile[] = [];
      if (selectedCompanyCode === "SYSTEM") {
        const allUsers = await authService.getAllUsers();
        data = allUsers.filter(u => !u.companyCode || u.companyCode === "SYSTEM");
      } else {
        data = await authService.getUsersByCompany(selectedCompanyCode);
      }
      
      // Seed initial structure if database is empty/contains only 1 user for this company
      if (data.length <= 1 && userProfile) {
        const currentCompanyOwner = data.find(u => u.role === "admin") || data.find(u => u.role === "superadmin") || userProfile;
        const companyName = currentCompanyOwner.companyName || (selectedCompanyCode === "SYSTEM" ? "iGen Tech" : selectedCompanyCode);
        
        console.log(`[iGen HR Hub] Seeding default organizational structure connected to CEO: ${currentCompanyOwner.uid} for company ${selectedCompanyCode}`);
        
        // 1. Update current owner profile to CEO
        const ownerRef = doc(db, "users", currentCompanyOwner.uid);
        await updateDoc(ownerRef, {
          jobTitle: "Chief Executive Officer (CEO)",
          department: "Ban Giám Đốc",
          division: "Ban Giám Đốc",
          phone: "0901234567",
          photoURL: "👨‍💼",
          level: 1,
          status: "online",
          companyCode: selectedCompanyCode,
          companyName: companyName
        });
        
        // 2. Seed other mock employees with matching companyCode and companyName
        const mockEmployees = [
          { uid: `e2_${selectedCompanyCode}`, email: `hai.nl@${selectedCompanyCode.toLowerCase()}.vn`, displayName: "Nguyễn Lê Hải", jobTitle: "Chief Operations Officer (COO)", department: "Ban Giám Đốc", phone: "0901112223", photoURL: "👨‍💻", level: 2, parentId: currentCompanyOwner.uid, role: "admin", division: "Khối Vận Hành", status: "online" },
          { uid: `e3_${selectedCompanyCode}`, email: `anh.tm@${selectedCompanyCode.toLowerCase()}.vn`, displayName: "Trần Mai Anh", jobTitle: "Chief CMO", department: "Ban Giám Đốc", phone: "0903334445", photoURL: "👩‍💼", level: 2, parentId: currentCompanyOwner.uid, role: "admin", division: "Khối Marketing", status: "online" },
          { uid: `e4_${selectedCompanyCode}`, email: `huy.hg@${selectedCompanyCode.toLowerCase()}.vn`, displayName: "Hoàng Gia Huy", jobTitle: "Trưởng phòng Kho vận", department: "Phòng Kho Vận", phone: "0905556667", photoURL: "📦", level: 3, parentId: `e2_${selectedCompanyCode}`, role: "user", division: "Khối Vận Hành", status: "online" },
          { uid: `e5_${selectedCompanyCode}`, email: `tuan.lq@${selectedCompanyCode.toLowerCase()}.vn`, displayName: "Lưu Quốc Tuấn", jobTitle: "Trưởng phòng Marketing", department: "Phòng Marketing", phone: "0907778889", photoURL: "📣", level: 3, parentId: `e3_${selectedCompanyCode}`, role: "user", division: "Khối Marketing", status: "offline" },
          { uid: `e6_${selectedCompanyCode}`, email: `vy.nb@${selectedCompanyCode.toLowerCase()}.vn`, displayName: "Nguyễn Bích Vy", jobTitle: "Trưởng phòng Sales CRM", department: "Phòng Sales", phone: "0908889990", photoURL: "👩‍💻", level: 3, parentId: `e2_${selectedCompanyCode}`, role: "user", division: "Khối Sales", status: "online" },
          { uid: `e7_${selectedCompanyCode}`, email: `sang.ln@${selectedCompanyCode.toLowerCase()}.vn`, displayName: "Lê Ngọc Sang", jobTitle: "Chuyên viên Vận chuyển", department: "Phòng Kho Vận", phone: "0909990001", photoURL: "🚛", level: 4, parentId: `e4_${selectedCompanyCode}`, role: "user", division: "Khối Vận Hành", status: "offline" },
          { uid: `e8_${selectedCompanyCode}`, email: `nam.pd@${selectedCompanyCode.toLowerCase()}.vn`, displayName: "Phan Đình Nam", jobTitle: "AI Copywriter Specialist", department: "Phòng Marketing", phone: "0909990002", photoURL: "💡", level: 4, parentId: `e5_${selectedCompanyCode}`, role: "user", division: "Khối Marketing", status: "online" },
          { uid: `e9_${selectedCompanyCode}`, email: `linh.vt@${selectedCompanyCode.toLowerCase()}.vn`, displayName: "Vũ Thùy Linh", jobTitle: "Chăm sóc khách hàng VIP", department: "Phòng Sales", phone: "0909990003", photoURL: "👩‍⚕️", level: 4, parentId: `e6_${selectedCompanyCode}`, role: "user", division: "Khối Sales", status: "online" }
        ];
        
        for (const emp of mockEmployees) {
          const docRef = doc(db, "users", emp.uid);
          await setDoc(docRef, {
            ...emp,
            companyCode: selectedCompanyCode,
            companyName: companyName,
            createdAt: new Date()
          });
        }
        
        // Fetch again after seeding
        if (selectedCompanyCode === "SYSTEM") {
          const allUsers = await authService.getAllUsers();
          data = allUsers.filter(u => !u.companyCode || u.companyCode === "SYSTEM");
        } else {
          data = await authService.getUsersByCompany(selectedCompanyCode);
        }
      }
      setUsersList(data);
    } catch (error) {
      console.error("Lỗi khi tải hoặc seed danh sách nhân sự:", error);
      toast.error("Không thể tải sơ đồ nhân sự.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedCompanyCode) {
      fetchUsers();
    }
  }, [selectedCompanyCode, userProfile?.uid]);

  // Map user profile from Firestore to EmployeeNode tree model
  const employees: EmployeeNode[] = usersList.map(usr => ({
    id: usr.uid,
    name: usr.displayName,
    role: usr.jobTitle || (usr.role === "superadmin" ? "Chief Executive Officer (CEO)" : "Nhân viên"),
    department: usr.department || "Ban Giám Đốc",
    email: usr.email,
    phone: usr.phone || "Chưa cập nhật",
    avatar: usr.photoURL || (usr.role === "superadmin" ? "👨‍💼" : "👨‍💻"),
    level: usr.level || 4,
    parentId: usr.parentId,
    status: usr.status || "offline",
    division: usr.division || "Khối Vận Hành"
  }));

  // Auto select root node on load
  useEffect(() => {
    if (employees.length > 0 && !selectedEmp) {
      const root = employees.find(e => e.level === 1) || employees[0];
      setSelectedEmp(root);
    }
  }, [usersList]);

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

  // Handle parentId based on addRole automatically in HRTab modal
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

  // 2. HR Tasks Data for Recruitment & Onboarding Kanban
  const [tasks, setTasks] = useState<HRTask[]>([
    { id: "t1", title: "Phỏng vấn ứng viên Sales Supervisor", assignee: "Vũ Thùy Linh", assigneeAvatar: "👩‍⚕️", dueDate: "Ngày mai, 14:00", priority: "Cao", status: "todo", category: "Tuyển dụng" },
    { id: "t2", title: "Thiết lập tài khoản ERP cho nhân sự Kho mới", assignee: "Hoàng Gia Huy", assigneeAvatar: "📦", dueDate: "15/10/2026", priority: "Trung bình", status: "doing", category: "Onboarding" },
    { id: "t3", title: "Hoàn thành video Đào tạo Bảo mật hệ thống", assignee: "Trần Mai Anh", assigneeAvatar: "👩‍💼", dueDate: "18/10/2026", priority: "Thấp", status: "doing", category: "Đào tạo" },
    { id: "t4", title: "Soạn thảo tài liệu Quy tắc Văn hóa Ứng xử", assignee: "Phạm Minh Hoàng", assigneeAvatar: "👨‍💼", dueDate: "Đã xong", priority: "Cao", status: "done", category: "Văn hóa" },
  ]);

  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskCategory, setNewTaskCategory] = useState<"Onboarding" | "Đào tạo" | "Tuyển dụng" | "Văn hóa">("Onboarding");
  const [newTaskPriority, setNewTaskPriority] = useState<"Cao" | "Trung bình" | "Thấp">("Trung bình");

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTaskTitle.trim() === "") return;
    const newTask: HRTask = {
      id: "t_" + Date.now(),
      title: newTaskTitle,
      assignee: kanbanFilter || "Chưa phân công",
      assigneeAvatar: kanbanFilter ? (employees.find(emp => emp.name === kanbanFilter)?.avatar || "🤔") : "🤔",
      dueDate: "Chưa cập nhật",
      priority: newTaskPriority,
      status: "todo",
      category: newTaskCategory
    };
    setTasks([...tasks, newTask]);
    setNewTaskTitle("");
  };

  const moveTaskStatus = (id: string, newStatus: "todo" | "doing" | "done") => {
    setTasks(tasks.map(t => t.id === id ? { ...t, status: newStatus } : t));
  };

  const deleteTask = (id: string) => {
    setTasks(tasks.filter(t => t.id !== id));
  };

  // 3. Onboarding Video Training Courses List Catalog
  const [courses, setCourses] = useState<TrainingCourse[]>([
    { id: "c1", title: "Hội nhập Văn hóa doanh nghiệp iGen", category: "Văn hóa", duration: "1.5 giờ (5 bài học)", progress: 100, instructor: "Phạm Minh Hoàng", icon: "🏫", enrolledStudents: 15 },
    { id: "c2", title: "Làm chủ AI Copywriter & Ideas Engine", category: "Công cụ AI", duration: "2 giờ (6 bài học)", progress: 45, instructor: "Phan Đình Nam", icon: "🧠", enrolledStudents: 8 },
    { id: "c3", title: "Quy trình Vận hành phân khu Kho ERP", category: "Nghiệp vụ", duration: "1 tiếng (4 bài học)", progress: 0, instructor: "Hoàng Gia Huy", icon: "📦", enrolledStudents: 12 },
    { id: "c4", title: "Kỹ năng Chăm sóc khách hàng VIP & Giải quyết than phiền", category: "Sales CRM", duration: "3 giờ (8 bài học)", progress: 85, instructor: "Trần Mai Anh", icon: "🏅", enrolledStudents: 22 }
  ]);

  const handleStudyProgress = (courseId: string) => {
    setCourses(courses.map(course => {
      if (course.id === courseId) {
        const nextProgress = Math.min(course.progress + 15, 100);
        return { ...course, progress: nextProgress };
      }
      return course;
    }));
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
      // Filter out only modified employees to commit updates to Firestore
      const updatePromises = updatedEmployees
        .filter(emp => {
          const original = employees.find(o => o.id === emp.id);
          return original && (original.parentId !== emp.parentId || original.level !== emp.level);
        })
        .map(emp => {
          const docRef = doc(db, "users", emp.id);
          return updateDoc(docRef, {
            parentId: emp.parentId || null,
            level: emp.level
          });
        });

      await Promise.all(updatePromises);
      toast.success(`Đã điều chuyển ${draggedEmp.name} báo cáo cho ${targetEmp.name}. Quyền hệ thống được đồng bộ.`);
      await fetchUsers();
    } catch (err) {
      console.error("Lỗi cập nhật cơ cấu:", err);
      toast.error("Không thể lưu cập nhật cơ cấu nhân sự lên cloud.");
    }
  };

  // Division Tag color schemes
  const getDivisionBadgeStyles = (division: string) => {
    switch (division) {
      case "Khối Kỹ Thuật":
        return "bg-indigo-50 text-indigo-700 border-indigo-200";
      case "Khối Vận Hành":
        return "bg-amber-50 text-amber-705 text-amber-700 border-amber-205 border-amber-200";
      case "Khối Marketing":
        return "bg-rose-50 text-rose-700 border-rose-200";
      case "Khối Sales":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200";
    }
  };

  // Filtering matching logic
  const isMatchingFilter = (emp: EmployeeNode): boolean => {
    const matchSearch = searchQuery.trim() === "" ||
      emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.role.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchDivision = filterDivision === "Tất cả" || emp.division === filterDivision;
    
    return matchSearch && matchDivision;
  };

  // Handle adding new employee user profile
  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addName.trim() || !addEmail.trim()) {
      toast.warning("Vui lòng nhập đầy đủ Họ tên và Email!");
      return;
    }

    let level = 1;
    if (addParentId) {
      const manager = employees.find(emp => emp.id === addParentId);
      if (manager) {
        level = manager.level + 1;
      }
    } else {
      level = addRole === "manager" ? 2 : 4;
    }

    const newUid = "emp_" + Date.now();
    const compCode = selectedCompanyCode || userProfile?.companyCode || "SYSTEM";
    const compName = userProfile?.role === "superadmin" 
      ? (companies.find(c => c.code === selectedCompanyCode)?.name || "SYSTEM")
      : (userProfile?.companyName || "");

    try {
      const docRef = doc(db, "users", newUid);
      await setDoc(docRef, {
        uid: newUid,
        email: addEmail.trim(),
        displayName: addName.trim(),
        photoURL: "👨‍💻",
        role: addRole,
        jobTitle: addRole === "manager" ? "Quản lý phòng ban" : "Nhân viên",
        department: addRole === "manager" ? "Quản lý" : addDepartment,
        phone: addPhone.trim() || "Chưa cập nhật",
        level,
        parentId: addParentId || null,
        status: "online",
        division: addRole === "manager" ? "Quản lý" : addDepartment.trim() || "Nhân sự",
        companyCode: compCode,
        companyName: compName,
        createdAt: new Date()
      });

      toast.success(`Đã thêm nhân sự "${addName}" thành công!`);
      setIsAddModalOpen(false);

      // Reset Form
      setAddName("");
      setAddEmail("");
      setAddPhone("");
      setAddParentId("");
      setAddRole("user");

      await fetchUsers();
    } catch (err) {
      console.error(err);
      toast.error("Lỗi khi thêm thành viên mới.");
    }
  };

  // Identify root employees (level 1 or nodes with no parent in the displayed tree)
  const rootEmployees = employees.filter(e => !e.parentId || !employees.some(p => p.id === e.parentId));

  // Recursive Branch rendering component helper
  const renderBranch = (node: EmployeeNode) => {
    const children = employees.filter(e => e.parentId === node.id);
    const isSelected = selectedEmp?.id === node.id;
    const isMatch = isMatchingFilter(node);
    const isFilteredOut = (searchQuery.trim() !== "" || filterDivision !== "Tất cả") && !isMatch;
    
    const directReportsCount = employees.filter(e => e.parentId === node.id).length;

    return (
      <div className="flex flex-col items-center" key={node.id}>
        {/* Smart Employee Card */}
        <div 
          draggable={isManager ? "true" : "false"}
          onDragStart={(e) => handleDragStart(e, node.id)}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, node.id)}
          onClick={() => setSelectedEmp(node)}
          className={`p-3 bg-white text-gray-800 border rounded-2xl shadow-xs w-52 text-center cursor-pointer relative hover:scale-104 active:scale-95 transition-all duration-300 ${
            isSelected 
              ? "ring-4 ring-indigo-500 shadow-indigo-200 border-transparent z-10" 
              : "border-gray-250 hover:border-indigo-300 hover:shadow-md"
          } ${
            isFilteredOut ? "opacity-30 blur-[0.5px] scale-98" : "opacity-100"
          }`}
          id={`org_node_${node.id}`}
        >
          {/* Online/Offline Dot Indicator */}
          <div className="absolute top-2 left-2 flex items-center justify-center">
            {node.status === "online" ? (
              <span className="w-2 h-2 rounded-full bg-emerald-500 block border-2 border-white animate-pulse" title="Đang hoạt động" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-gray-300 block border-2 border-white" title="Ngoại tuyến" />
            )}
          </div>

          <div className="text-3xl mb-1 inline-block p-1.5 bg-slate-50 rounded-full select-none">{node.avatar}</div>
          <h4 className="font-bold text-xs leading-tight text-slate-800 font-sans truncate px-1">{node.name}</h4>
          <p className="text-[9px] text-indigo-650 font-bold font-mono mt-0.5 uppercase tracking-wide truncate px-1">{node.role}</p>
          
          <div className="mt-2 pt-1.5 border-t border-gray-100 flex items-center justify-center gap-1 flex-wrap">
            <span className={`text-[8px] font-bold border px-1 rounded-sm uppercase tracking-wider font-mono ${getDivisionBadgeStyles(node.division)}`}>
              {node.division}
            </span>
          </div>

          {/* Subordinates counter badge */}
          {directReportsCount > 0 && (
            <span className="absolute -bottom-2 -right-2 bg-emerald-500 text-white text-[9px] font-extrabold w-5 h-5 rounded-full flex items-center justify-center shadow-sm border-2 border-white select-none" title={`${directReportsCount} báo cáo trực tiếp`}>
              {directReportsCount}
            </span>
          )}
        </div>

        {/* Children Render recursive block */}
        {children.length > 0 && (
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

  // Filter tasks in Kanban Board based on selected employee name filter
  const visibleTasks = kanbanFilter 
    ? tasks.filter(t => t.assignee.toLowerCase() === kanbanFilter.toLowerCase())
    : tasks;

  return (
    <div className="flex flex-col h-full bg-white max-h-[85vh] overflow-hidden" id="hr_tab_wrapper">
      {/* Sub Tabs switcher navigation bar */}
      <div className="border-b border-gray-200 bg-gray-50/50 p-2 text-xs flex justify-between shrink-0" id="hr_sub_tabs_bar">
        <div className="flex gap-2">
          {["SƠ ĐỒ TỔ CHỨC", "GIAO VIỆC KANBAN", "ĐÀO TẠO"].map((tab) => (
            <button
              key={tab}
              onClick={() => setSubTab(tab as HRSubTabType)}
              className={`px-4 py-2 rounded-lg border font-bold uppercase transition-all tracking-wide ${
                subTab === tab 
                  ? "bg-slate-800 text-white border-slate-800 shadow-xs" 
                  : "bg-white text-gray-500 border-gray-200 hover:bg-gray-100"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="hidden md:flex items-center gap-1.5 px-3 py-1 bg-emerald-50 rounded-full border border-emerald-200 text-emerald-800 font-mono text-[10px]">
          <Activity className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
          <span>Lưu tự động vào iGen ERP</span>
        </div>
      </div>

      {/* Division filter and search bar for Org Chart tab */}
      {subTab === "SƠ ĐỒ TỔ CHỨC" && (
        <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-55/40 bg-slate-50 p-4 border-b border-gray-200 shrink-0">
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
          </div>
          
          <div className="flex flex-wrap items-center gap-4 text-xs font-semibold">
            {/* SaaS Multi-tenant Company Filter for Superadmin */}
            {userProfile?.role === "superadmin" && (
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-slate-400" />
                <select
                  value={selectedCompanyCode}
                  onChange={(e) => setSelectedCompanyCode(e.target.value)}
                  className="p-2 border border-gray-200 bg-white rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                >
                  <option value="SYSTEM">Hệ thống (SYSTEM)</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.code}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Filter by specialized divisions */}
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-400" />
              <select
                value={filterDivision}
                onChange={(e) => setFilterDivision(e.target.value)}
                className="p-2 border border-gray-200 bg-white rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
              >
                <option value="Tất cả">Tất cả Khối chuyên môn</option>
                <option value="Khối Kỹ Thuật">Khối Kỹ Thuật</option>
                <option value="Khối Vận Hành">Khối Vận Hành</option>
                <option value="Khối Marketing">Khối Marketing</option>
                <option value="Khối Sales">Khối Sales</option>
              </select>
            </div>

            {/* Slider zoom controls */}
            <div className="flex items-center gap-2 font-mono">
              <span className="text-slate-400 text-xxs font-bold font-sans">THU PHÓNG:</span>
              <input 
                type="range" 
                min="0.5" 
                max="1.5" 
                step="0.05"
                value={zoomLevel} 
                onChange={(e) => setZoomLevel(parseFloat(e.target.value))}
                className="w-28 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-650"
              />
              <span className="w-10 text-right text-[10px] font-bold text-slate-650">{Math.round(zoomLevel * 100)}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Primary Sub Tab Layout View */}
      <div className="flex-1 p-6 overflow-y-auto" id="hr_tab_content">
        
        {/* SUB TAB 1: SƠ ĐỒ TỔ CHỨC */}
        {subTab === "SƠ ĐỒ TỔ CHỨC" && (
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 h-full min-h-[500px]" id="org_chart_block">
            
            {/* Sidebar View employee card detail panel */}
            <div className="xl:col-span-1 bg-slate-50 p-5 rounded-2xl border border-gray-200 max-h-[70vh] overflow-y-auto flex flex-col justify-between" id="employee_detail_card">
              {loading ? (
                <div className="h-full flex flex-col items-center justify-center py-20 text-center">
                  <Activity className="h-8 w-8 text-indigo-600 animate-spin mb-3" />
                  <span className="text-xs font-bold font-mono text-indigo-800 uppercase tracking-wider">Đang kết nối database...</span>
                </div>
              ) : selectedEmp ? (
                <div>
                  <div className="text-center relative">
                    <div className="text-5xl my-4 inline-block p-4 bg-white rounded-full shadow-md select-none border border-gray-150 relative">
                      {selectedEmp.avatar}
                      <span className={`absolute bottom-2 right-2 w-3.5 h-3.5 rounded-full border-2 border-white ${
                        selectedEmp.status === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'
                      }`} />
                    </div>
                    <h3 className="text-base font-bold text-slate-800 font-sans">{selectedEmp.name}</h3>
                    <p className="text-xs text-indigo-650 font-bold uppercase tracking-wider mt-1 leading-tight">{selectedEmp.role}</p>
                    
                    <div className="mt-3.5 flex flex-col gap-1.5 items-center justify-center">
                      <span className="px-3 py-0.5 bg-white border border-gray-200 rounded-full text-[10px] text-gray-500 font-mono">
                        Phòng: {selectedEmp.department}
                      </span>
                      <span className={`text-[9px] font-bold border px-2 py-0.5 rounded-md uppercase tracking-wider font-mono ${getDivisionBadgeStyles(selectedEmp.division)}`}>
                        {selectedEmp.division}
                      </span>
                    </div>
                  </div>

                  <div className="mt-6 space-y-3.5 text-xs text-slate-600 border-t border-gray-200 pt-5 text-left">
                    <div className="flex items-center gap-2.5">
                      <Mail className="h-4 w-4 text-gray-400 shrink-0" />
                      <span className="font-mono truncate">{selectedEmp.email}</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <Phone className="h-4 w-4 text-gray-400 shrink-0" />
                      <span className="font-mono">{selectedEmp.phone}</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <UserSquare className="h-4 w-4 text-gray-400 shrink-0" />
                      <span>Cấp quản lý: <strong className="text-slate-800 font-semibold font-mono">Cấp {selectedEmp.level}</strong></span>
                    </div>
                    
                    {/* Boss / Manager details */}
                    {selectedEmp.parentId && (
                      <div className="flex items-center gap-2.5">
                        <Briefcase className="h-4 w-4 text-gray-400 shrink-0" />
                        <span>Báo cáo cho: <strong className="text-indigo-600 hover:underline cursor-pointer" onClick={() => {
                          const boss = employees.find(e => e.id === selectedEmp.parentId);
                          if (boss) setSelectedEmp(boss);
                        }}>{employees.find(e => e.id === selectedEmp.parentId)?.name || 'Quản lý cấp trên'}</strong></span>
                      </div>
                    )}
                    
                    {/* Direct Subordinates list */}
                    {employees.some(e => e.parentId === selectedEmp.id) && (
                      <div className="pt-2">
                        <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 font-mono">Nhân sự dưới quyền ({employees.filter(e => e.parentId === selectedEmp.id).length}):</span>
                        <div className="space-y-1 max-h-[120px] overflow-y-auto pr-1">
                          {employees.filter(e => e.parentId === selectedEmp.id).map(sub => (
                            <div 
                              key={sub.id} 
                              onClick={() => setSelectedEmp(sub)}
                              className="p-1.5 bg-white border border-gray-150 hover:border-indigo-300 hover:text-indigo-650 rounded-xl text-[10px] font-semibold text-slate-700 transition-all cursor-pointer flex items-center gap-1.5"
                            >
                              <span>{sub.avatar}</span>
                              <span className="truncate">{sub.name}</span>
                              {sub.status === 'online' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse ml-auto" />}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Linked Navigation Operations */}
                  <div className="mt-6 pt-4 border-t border-gray-200 space-y-2">
                    <button 
                      onClick={() => {
                        setSubTab("GIAO VIỆC KANBAN");
                        setKanbanFilter(selectedEmp.name);
                      }}
                      className="w-full text-center py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-150 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-98 cursor-pointer shadow-2xs"
                    >
                      <UserSquare className="h-3.5 w-3.5" />
                      Kiểm tra công việc Kanban
                    </button>
                    <button 
                      onClick={() => {
                        setSubTab("ĐÀO TẠO");
                        setTrainingFilter(selectedEmp.name);
                      }}
                      className="w-full text-center py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-150 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-98 cursor-pointer shadow-2xs"
                    >
                      <BookOpen className="h-3.5 w-3.5" />
                      Giám sát tiến độ học tập
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-gray-400 text-xs italic">
                  Click chọn nhân sự trên sơ đồ để xem thông tin chi tiết.
                </div>
              )}

              {isManager ? (
                <div className="mt-6 pt-4 border-t border-gray-200">
                  <button 
                    onClick={() => setIsAddModalOpen(true)}
                    className="w-full text-center py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
                  >
                    <UserPlus className="h-4 w-4" />
                    Thêm thành viên mới
                  </button>
                </div>
              ) : (
                <div className="mt-6 pt-4 border-t border-gray-200 text-center text-slate-400 text-[10px] font-semibold flex items-center justify-center gap-1.5 font-mono select-none">
                  <Activity className="h-3.5 w-3.5 text-slate-400 animate-pulse" />
                  Sơ đồ ở chế độ Chỉ đọc (Read-only)
                </div>
              )}
            </div>

            {/* Hierarchical Org Index tree container */}
            <div className="xl:col-span-3 bg-slate-50/50 border border-gray-200 rounded-3xl relative overflow-hidden flex flex-col justify-between" id="org_chart_interactive_canvas">
              
              {/* Reset view helper */}
              <div className="absolute top-4 left-4 bg-white/90 shadow-md border border-gray-150 rounded-xl p-1.5 flex items-center gap-1.5 text-[10px] font-bold text-slate-650 font-sans z-10 select-none">
                <Activity className="h-3.5 w-3.5 text-indigo-500 animate-pulse" />
                <span>Kéo thả thẻ nhân viên để tái cấu trúc đội ngũ</span>
              </div>

              {/* Hierarchy Tree Grid Canvas */}
              <div className="p-8 flex-1 flex flex-col justify-center items-center overflow-auto min-h-[500px]" style={{ transform: `scale(${zoomLevel})`, transformOrigin: "center center", transition: "transform 0.2s ease-out" }}>
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-20">
                    <Activity className="h-8 w-8 text-indigo-600 animate-spin mb-3" />
                    <span className="text-xs font-bold font-mono text-indigo-800 uppercase tracking-wider">Đang tải sơ đồ...</span>
                  </div>
                ) : rootEmployees.length === 0 ? (
                  <div className="p-12 text-center text-gray-400 text-sm">
                    Không tìm thấy nhân sự cấp cao nhất (CEO). Vui lòng thêm nhân sự mới làm CEO.
                  </div>
                ) : (
                  <div className="flex gap-20 items-start justify-center">
                    {rootEmployees.map(root => renderBranch(root))}
                  </div>
                )}
              </div>

              {/* Chart footer notification guide */}
              <div className="p-3 bg-white border-t border-gray-200 select-none text-center text-xs text-gray-400 font-medium">
                💡 Nhấn chọn nhân sự để hiển thị liên kết vận hành Kanban / e-Learning của thành viên đó
              </div>
            </div>
          </div>
        )}

        {/* SUB TAB 2: GIAO VIỆC KANBAN */}
        {subTab === "GIAO VIỆC KANBAN" && (
          <div className="space-y-6" id="job_delegation_kanban">
            
            {/* Filter active banner */}
            {kanbanFilter && (
              <div className="bg-indigo-50 border border-indigo-150 text-indigo-850 text-xs p-3.5 rounded-2xl flex justify-between items-center mb-4 font-semibold text-left">
                <span className="flex items-center gap-1.5 text-indigo-800">
                  <UserSquare className="h-4.5 w-4.5 text-indigo-600" />
                  Đang lọc hiển thị công việc được giao cho: <strong className="text-indigo-950 font-bold">{kanbanFilter}</strong>
                </span>
                <button 
                  onClick={() => setKanbanFilter(null)}
                  className="px-3 py-1 bg-white hover:bg-slate-100 border border-indigo-200 rounded-xl text-indigo-750 font-bold transition-all shadow-xs cursor-pointer text-xs"
                >
                  Hiển thị tất cả nhân sự
                </button>
              </div>
            )}

            {/* Quick Task creation panel */}
            <form onSubmit={handleAddTask} className="bg-slate-50 border border-gray-200 p-5 rounded-2xl flex flex-wrap gap-4 items-end" id="add_task_form">
              <div className="flex-1 min-w-[200px] text-left">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Công việc mới</label>
                <input 
                  type="text" 
                  placeholder={kanbanFilter ? `Giao việc cho ${kanbanFilter}...` : "Ví dụ: Hoàn tất giấy tờ tuyển dụng thử việc..."} 
                  className="w-full px-4 py-2 border border-gray-200 bg-white rounded-xl text-xs font-sans focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                />
              </div>

              <div className="text-left">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 font-sans">Bắc Phận</label>
                <select 
                  className="px-3 py-2 border border-gray-200 bg-white rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                  value={newTaskCategory}
                  onChange={(e: any) => setNewTaskCategory(e.target.value)}
                >
                  <option value="Onboarding">Onboarding</option>
                  <option value="Đào tạo">Đào tạo</option>
                  <option value="Tuyển dụng">Tuyển dụng</option>
                  <option value="Văn hóa">Văn hóa</option>
                </select>
              </div>

              <div className="text-left">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 font-sans">Độ ưu tiên</label>
                <select 
                  className="px-3 py-2 border border-gray-200 bg-white rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                  value={newTaskPriority}
                  onChange={(e: any) => setNewTaskPriority(e.target.value)}
                >
                  <option value="Cao">Cao</option>
                  <option value="Trung bình">Trung bình</option>
                  <option value="Thấp">Thấp</option>
                </select>
              </div>

              <button type="submit" className="px-5 py-2.5 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 select-none shadow-sm transition-all focus:outline-hidden cursor-pointer active:scale-95">
                <Plus className="h-4 w-4" />
                Thêm Công Việc
              </button>
            </form>

            {/* Kanban columns flex board */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6" id="three_column_kanban">
              
              {/* TO DO (CẦN LÀM) */}
              <div className="bg-slate-50/50 rounded-2xl p-4 border border-gray-200 flex flex-col min-h-[450px]">
                <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-200/50">
                  <span className="text-xs font-bold text-slate-700 tracking-wider font-sans uppercase">CHỜ THỰC HIỆN</span>
                  <span className="bg-slate-200 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {visibleTasks.filter(t => t.status === "todo").length}
                  </span>
                </div>
                <div className="space-y-3 flex-1 overflow-y-auto">
                  {visibleTasks.filter(t => t.status === "todo").length === 0 ? (
                    <div className="p-8 text-center text-gray-400 text-xs italic">Hết công việc chờ!</div>
                  ) : (
                    visibleTasks.filter(t => t.status === "todo").map(task => (
                      <KanbanCard 
                        key={task.id} 
                        task={task} 
                        onMove={(newSt) => moveTaskStatus(task.id, newSt)} 
                        onDelete={() => deleteTask(task.id)}
                      />
                    ))
                  )}
                </div>
              </div>

              {/* DOING (ĐANG LÀM) */}
              <div className="bg-slate-50/50 rounded-2xl p-4 border border-gray-200 flex flex-col min-h-[450px]">
                <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-200/50">
                  <span className="text-xs font-bold text-amber-700 tracking-wider font-sans uppercase">ĐANG THỰC HIỆN</span>
                  <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {visibleTasks.filter(t => t.status === "doing").length}
                  </span>
                </div>
                <div className="space-y-3 flex-1 overflow-y-auto">
                  {visibleTasks.filter(t => t.status === "doing").length === 0 ? (
                    <div className="p-8 text-center text-gray-400 text-xs italic">Kéo thả hoặc click tiến độ để bắt đầu</div>
                  ) : (
                    visibleTasks.filter(t => t.status === "doing").map(task => (
                      <KanbanCard 
                        key={task.id} 
                        task={task} 
                        onMove={(newSt) => moveTaskStatus(task.id, newSt)} 
                        onDelete={() => deleteTask(task.id)}
                      />
                    ))
                  )}
                </div>
              </div>

              {/* DONE (ĐÃ XONG) */}
              <div className="bg-slate-50/50 rounded-2xl p-4 border border-gray-200 flex flex-col min-h-[450px]">
                <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-200/50">
                  <span className="text-xs font-bold text-emerald-800 tracking-wider font-sans uppercase font-medium">ĐÃ HOÀN THÀNH</span>
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {visibleTasks.filter(t => t.status === "done").length}
                  </span>
                </div>
                <div className="space-y-3 flex-1 overflow-y-auto">
                  {visibleTasks.filter(t => t.status === "done").length === 0 ? (
                    <div className="p-8 text-center text-gray-400 text-xs italic">Chưa có công việc nào hoàn tất</div>
                  ) : (
                    visibleTasks.filter(t => t.status === "done").map(task => (
                      <KanbanCard 
                        key={task.id} 
                        task={task} 
                        onMove={(newSt) => moveTaskStatus(task.id, newSt)} 
                        onDelete={() => deleteTask(task.id)}
                      />
                    ))
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* SUB TAB 3: ĐÀO TẠO */}
        {subTab === "ĐÀO TẠO" && (
          <div className="space-y-6" id="elearning_catalog">
            
            {/* Monitor Training Progress Section */}
            {trainingFilter && (
              <div className="bg-emerald-50 border border-emerald-250 text-emerald-850 p-5 rounded-2xl mb-6 relative text-left">
                <h5 className="font-bold text-xs uppercase tracking-wider text-emerald-900 flex items-center gap-1.5 mb-2">
                  <Award className="h-4.5 w-4.5 text-emerald-700 animate-bounce" />
                  Tiến trình Đào tạo của: {trainingFilter}
                </h5>
                <p className="text-xs text-emerald-700 mb-4">Các khóa học chuyên môn nhân sự này đã hoàn thành hoặc đang nghiên cứu phục vụ đánh giá thăng cấp và KPI.</p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-white border border-emerald-100 p-3.5 rounded-xl shadow-2xs">
                    <span className="text-[10px] text-slate-400 block font-mono font-bold">KHÓA HỌC ĐÃ TỐT NGHIỆP</span>
                    <span className="font-bold text-slate-800 text-xs mt-1 block">🏫 Hội nhập Văn hóa doanh nghiệp iGen</span>
                    <span className="text-[10px] text-emerald-600 font-bold font-mono mt-1.5 block">● Đạt 100% điểm thi kiểm tra</span>
                  </div>
                  <div className="bg-white border border-emerald-100 p-3.5 rounded-xl shadow-2xs">
                    <span className="text-[10px] text-slate-400 block font-mono font-bold">KHÓA HỌC ĐANG THEO HỌC</span>
                    <span className="font-bold text-slate-800 text-xs mt-1 block">🧠 Làm chủ AI Copywriter & Ideas Engine</span>
                    <span className="text-[10px] text-amber-600 font-bold font-mono mt-1.5 block">○ Đang hoàn thành 45% bài giảng</span>
                  </div>
                </div>
                
                <div className="mt-4 pt-4 border-t border-emerald-150 flex justify-between items-center text-xs">
                  <span className="text-emerald-700 font-medium">Đánh giá chung: <strong className="text-emerald-900">Mức độ hoàn thành đạt chuẩn chỉ tiêu</strong></span>
                  <button 
                    onClick={() => setTrainingFilter(null)}
                    className="px-3 py-1 bg-white hover:bg-slate-100 border border-emerald-250 rounded-xl text-emerald-750 font-bold transition-all shadow-xs cursor-pointer text-xs"
                  >
                    Đóng giám sát
                  </button>
                </div>
              </div>
            )}

            <div className="flex justify-between items-center text-left" id="training_header_info">
              <div>
                <h4 className="text-sm font-bold text-slate-800 font-sans tracking-wide uppercase">Cổng Học Tập & Hội Nhập iGen e-Learning</h4>
                <p className="text-xs text-gray-500 mt-1">Đào tạo nhân sự tự động, rèn luyện kỹ năng và nắm bắt hệ thống ERP</p>
              </div>
              <div className="flex gap-2 text-xs font-semibold px-3 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-xl">
                <Award className="h-4 w-4 animate-bounce text-indigo-650" />
                <span>Hoàn tất khóa học nhận ERP Token</span>
              </div>
            </div>

            {/* Courses grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5" id="courses_grid">
              {courses.map((course) => {
                const isCompleted = course.progress === 100;
                return (
                  <div key={course.id} className="p-5 bg-white border border-gray-250/70 hover:border-indigo-300 hover:shadow-md rounded-2xl transition-all flex flex-col justify-between" id={`course_card_${course.id}`}>
                    <div className="text-left">
                      <div className="flex justify-between items-start gap-4">
                        <div className="p-3 bg-slate-50 border rounded-2xl my-1 text-2xl select-none">{course.icon}</div>
                        <div className="text-right">
                          <span className="inline-block px-2.5 py-0.5 bg-slate-100 text-[9px] font-bold font-mono rounded-full text-slate-500 uppercase tracking-widest leading-none">
                            {course.category}
                          </span>
                          <p className="text-[10px] text-gray-400 mt-1.5 font-mono">Giảng viên: {course.instructor}</p>
                        </div>
                      </div>

                      <h4 className="text-sm font-bold text-slate-800 font-sans text-left mt-4 leading-snug">{course.title}</h4>
                      
                      <div className="flex items-center gap-2 text-[11px] text-gray-500 mt-2">
                        <Clock className="w-3.5 h-3.5 text-gray-400" />
                        <span>{course.duration}</span>
                        <span className="mx-1">•</span>
                        <span>{course.enrolledStudents} học viên đang học</span>
                      </div>
                    </div>

                    {/* Progression Bar section */}
                    <div className="mt-5 border-t border-gray-100 pt-4 text-left">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-mono text-gray-450 font-medium">Tiến trình lớp học:</span>
                        <span className="font-bold text-slate-700 font-mono">{course.progress}%</span>
                      </div>
                      
                      <div className="w-full bg-slate-150 bg-slate-100 h-2 rounded-full overflow-hidden mb-4">
                        <div 
                          className={`h-full transition-all duration-500 ${isCompleted ? "bg-emerald-500" : "bg-indigo-650"}`}
                          style={{ width: `${course.progress}%` }}
                        />
                      </div>

                      <div className="flex justify-between items-center text-xs">
                        {isCompleted ? (
                          <span className="text-emerald-600 font-bold flex items-center gap-1">
                            <CheckCircle className="h-4 w-4" />
                            Đã hoàn thành
                          </span>
                        ) : (
                          <span className="text-gray-400 font-mono text-[10px]">ERP Token: 15 đ</span>
                        )}

                        <button 
                          onClick={() => handleStudyProgress(course.id)}
                          className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                            isCompleted 
                              ? "bg-slate-100 text-slate-400 cursor-not-allowed border" 
                              : "bg-indigo-650 hover:bg-indigo-700 text-white active:scale-95 shadow-2xs"
                          }`}
                          disabled={isCompleted}
                        >
                          {course.progress === 0 ? "Bắt đầu học" : isCompleted ? "Xem văn bằng" : "Học tiếp bài sau"}
                        </button>
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>

      {/* Add Employee Modal */}
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
                    {employees.filter(emp => {
                      // Only show managers
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
                      <option key={emp.id} value={emp.id}>{emp.name} ({emp.role})</option>
                    ))}
                  </select>
                </div>
              )}

              {addRole === "user" && (
                <div>
                  <label className="block font-bold text-gray-500 mb-1">Phòng ban</label>
                  <input 
                    type="text" 
                    placeholder="Ví dụ: Phòng Kỹ Thuật"
                    value={addDepartment}
                    onChange={(e) => setAddDepartment(e.target.value)}
                    className="w-full px-3.5 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}
            </div>
            
            <div className="pt-4 border-t flex justify-end gap-3 text-xs font-bold">
              <button 
                type="button" 
                onClick={() => setIsAddModalOpen(false)} 
                className="px-4 py-2 border rounded-xl hover:bg-slate-50 cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button 
                type="submit" 
                className="px-5 py-2 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl cursor-pointer transition-all active:scale-95"
              >
                Lưu nhân sự
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// Kanban drag helper subcard
function KanbanCard({ task, onMove, onDelete }: { key?: any; task: HRTask; onMove: (status: "todo" | "doing" | "done") => void; onDelete: () => void }) {
  return (
    <div className="bg-white border text-left border-gray-200 p-4 rounded-2xl shadow-2xs hover:shadow-md transition-all flex flex-col gap-3 relative group" id={`kanban_card_${task.id}`}>
      
      {/* Category and priority indicator tags */}
      <div className="flex justify-between items-center">
        <span className="px-2 py-0.5 bg-slate-50 border border-gray-200 rounded-md text-[9px] font-mono font-bold text-gray-400 uppercase tracking-wider">
          {task.category}
        </span>
        <span className={`px-2 py-0.5 rounded-md text-[9px] font-mono font-bold uppercase ${
          task.priority === "Cao" 
            ? "bg-rose-50 border border-rose-100 text-rose-700" 
            : task.priority === "Trung bình" 
              ? "bg-amber-50 border border-amber-100 text-amber-700" 
              : "bg-indigo-50 border border-indigo-100 text-indigo-750"
        }`}>
          ƯU TIÊN: {task.priority}
        </span>
      </div>

      <h5 className="font-semibold text-slate-800 leading-normal text-xs font-sans line-clamp-2">{task.title}</h5>

      <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 text-[10px]">
        {/* Assignee profile avatar */}
        <div className="flex items-center gap-1.5">
          <span className="text-sm select-none">{task.assigneeAvatar}</span>
          <span className="text-slate-500 font-semibold">{task.assignee}</span>
        </div>

        {/* Due date */}
        <span className="text-slate-400 font-mono font-medium">Hạn: {task.dueDate}</span>
      </div>

      {/* Interactive transition buttons */}
      <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between opacity-80 group-hover:opacity-100 transition-opacity">
        <button 
          onClick={onDelete}
          className="text-rose-500 hover:text-rose-700 text-[10px] font-extrabold font-mono transition-colors cursor-pointer"
        >
          Xóa bỏ
        </button>
        <div className="flex gap-2">
          {task.status !== "todo" && (
            <button 
              onClick={() => onMove(task.status === "done" ? "doing" : "todo")}
              className="px-2 py-1 bg-slate-50 hover:bg-slate-100 border text-slate-700 rounded-lg text-[9px] font-bold cursor-pointer"
            >
              ← Quay lại
            </button>
          )}
          {task.status !== "done" && (
            <button 
              onClick={() => onMove(task.status === "todo" ? "doing" : "done")}
              className="px-2 py-1 bg-indigo-650 hover:bg-indigo-700 text-white rounded-lg text-[9px] font-bold cursor-pointer"
            >
              Tiếp tục →
            </button>
          )}
        </div>
      </div>

    </div>
  );
}
