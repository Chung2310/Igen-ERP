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
  X,
  Calendar,
  AlertCircle,
  Tag,
  User,
  Target,
  RefreshCw
} from "lucide-react";
import { HRSubTabType, EmployeeNode, HRTask, TrainingCourse, TrainingEnrollment, UserProfile, Project, TaskHistoryEntry, Lesson, QuizQuestion } from "../types";
import { useAuth } from "../context/AuthContext";
import { db } from "../config/firebase";
import { doc, updateDoc, setDoc, deleteDoc, writeBatch, collection, getDocs, addDoc, serverTimestamp, query, where, orderBy } from "firebase/firestore";
import { authService } from "../services/authService";
import { toast } from "./Toast";

const isUrl = (str?: string): boolean => {
  if (!str) return false;
  return str.startsWith("http://") || str.startsWith("https://") || str.startsWith("data:image/") || str.startsWith("/");
};

const renderAvatar = (avatar: string, sizeClasses: string = "w-8 h-8", textClass: string = "text-base") => {
  if (isUrl(avatar)) {
    return (
      <div className={`${sizeClasses} rounded-full overflow-hidden shrink-0 flex items-center justify-center border border-gray-150`}>
        <img src={avatar} className="w-full h-full object-cover" alt="" />
      </div>
    );
  }
  return (
    <div className={`${sizeClasses} bg-slate-50 rounded-full shrink-0 flex items-center justify-center border border-gray-100 select-none`}>
      <span className={textClass}>{avatar || "👤"}</span>
    </div>
  );
};

export default function HRTab() {
  const { userProfile } = useAuth();
  const isManager = userProfile?.role === "superadmin" || userProfile?.role === "admin" || userProfile?.role === "manager";

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
      const batch = writeBatch(db);

      // 1. Delete user doc
      const userRef = doc(db, "users", empId);
      batch.delete(userRef);

      // 2. Find children and update their parentId to the parentId of the deleted user
      const deletedUser = usersList.find(u => u.uid === empId);
      const parentId = deletedUser?.parentId || null;
      let parentLevel = 1;
      if (parentId) {
        const parentUser = usersList.find(u => u.uid === parentId);
        parentLevel = parentUser?.level || 1;
      }

      const children = usersList.filter(u => u.parentId === empId);
      for (const child of children) {
        const childRef = doc(db, "users", child.uid);
        batch.update(childRef, {
          parentId: parentId || null,
          level: parentLevel + 1
        });
      }

      await batch.commit();
      toast.success("Đã xóa nhân sự thành công!");
      setSelectedEmp(null);
      await fetchUsers();
    } catch (error) {
      console.error("Lỗi khi xóa nhân sự:", error);
      toast.error("Không thể xóa nhân sự. Vui lòng kiểm tra quyền hạn.");
    }
  };

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
  const [isAddingEmployee, setIsAddingEmployee] = useState(false);
  const [addName, setAddName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addPassword, setAddPassword] = useState("");
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
        if (userProfile?.role === "superadmin") {
          const allUsers = await authService.getAllUsers();
          data = allUsers.filter(u => !u.companyCode || u.companyCode === "SYSTEM");
        } else {
          data = userProfile ? [userProfile] : [];
        }
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
          if (userProfile?.role === "superadmin") {
            const allUsers = await authService.getAllUsers();
            data = allUsers.filter(u => !u.companyCode || u.companyCode === "SYSTEM");
          } else {
            data = userProfile ? [userProfile] : [];
          }
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
    avatar: usr.photoURL && (usr.photoURL.startsWith("http") || usr.photoURL.startsWith("/"))
      ? usr.photoURL
      : `https://ui-avatars.com/api/?name=${encodeURIComponent(usr.displayName)}&background=random&color=fff`,
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

  // Auto fill department based on manager (addParentId) in HRTab
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

  useEffect(() => {
    if (selectedCompanyCode) {
      fetchUsers();
      fetchTasks();
      fetchProjects();
      fetchCourses(selectedCompanyCode);
    }
    if (selectedCompanyCode && userProfile?.uid) {
      fetchMyEnrollments(userProfile.uid, selectedCompanyCode);
    }
  }, [selectedCompanyCode, userProfile?.uid]);

  // Reset addDepartment when modal closes
  useEffect(() => {
    if (!isAddModalOpen) {
      setAddDepartment("Phòng Kỹ Thuật");
    }
  }, [isAddModalOpen]);

  // 2. HR Tasks Data for Recruitment & Onboarding Kanban
  const [tasks, setTasks] = useState<HRTask[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [kanbanViewTab, setKanbanViewTab] = useState<"By project" | "Board" | "All tasks">("By project");
  const [selectedKanbanTask, setSelectedKanbanTask] = useState<HRTask | null>(null);

  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});

  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editAssigneeUid, setEditAssigneeUid] = useState("");
  const [editStatus, setEditStatus] = useState<"Not Started" | "In Progress" | "Review/Testing" | "Done" | "Archived">("Not Started");
  const [editPriority, setEditPriority] = useState<"High" | "Medium" | "Low">("Medium");
  const [editDueDate, setEditDueDate] = useState("");

  // New Notion Task fields
  const [editProjectId, setEditProjectId] = useState("");
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");
  const [editEstTime, setEditEstTime] = useState<number | "">("");
  const [editActualTime, setEditActualTime] = useState<number | "">("");
  const [editTags, setEditTags] = useState("");
  const [editLinkNote, setEditLinkNote] = useState("");
  const [taskHistory, setTaskHistory] = useState<TaskHistoryEntry[]>([]);
  const [editCategory, setEditCategory] = useState<"Onboarding" | "Đào tạo" | "Tuyển dụng" | "Văn hóa">("Onboarding");

  useEffect(() => {
    if (selectedKanbanTask) {
      setEditTitle(selectedKanbanTask.title || "");
      setEditDescription(selectedKanbanTask.description || "");
      setEditAssigneeUid(selectedKanbanTask.assigneeUid || "");

      // Status mapping for compatibility
      let initialStatus = selectedKanbanTask.status || "Not Started";
      if (initialStatus === "todo") initialStatus = "Not Started";
      else if (initialStatus === "doing") initialStatus = "In Progress";
      else if (initialStatus === "done") initialStatus = "Done";
      setEditStatus(initialStatus as any);

      // Priority mapping for compatibility
      let initialPriority = selectedKanbanTask.priority || "Medium";
      if (initialPriority === "Cao") initialPriority = "High";
      else if (initialPriority === "Trung bình") initialPriority = "Medium";
      else if (initialPriority === "Thấp") initialPriority = "Low";
      setEditPriority(initialPriority as any);

      setEditDueDate(selectedKanbanTask.dueDate || "");

      // Notion specific fields
      setEditProjectId(selectedKanbanTask.projectId || "");
      setEditStartTime(selectedKanbanTask.startTime || "");
      setEditEndTime(selectedKanbanTask.endTime || "");
      setEditEstTime(selectedKanbanTask.estTime ?? "");
      setEditActualTime(selectedKanbanTask.actualTime ?? "");
      setEditTags(selectedKanbanTask.tags ? selectedKanbanTask.tags.join(", ") : "");
      setEditLinkNote(selectedKanbanTask.linkNote || "");
      setTaskHistory(selectedKanbanTask.history || []);
      setEditCategory(selectedKanbanTask.category || "Onboarding");
    }
  }, [selectedKanbanTask]);

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedKanbanTask) return;

    if (editTitle.trim() === "") {
      toast.warning("Vui lòng nhập tiêu đề công việc!");
      return;
    }

    const assignedEmp = employees.find(emp => emp.id === editAssigneeUid);
    if (!assignedEmp) {
      toast.error("Nhân sự được giao việc không hợp lệ!");
      return;
    }

    try {
      const compCode = selectedCompanyCode || userProfile?.companyCode || "SYSTEM";
      const creatorUid = userProfile?.uid || "";
      const userName = userProfile?.displayName || userProfile?.email || "Thành viên";

      const parsedTags = editTags.split(",")
        .map(t => t.trim())
        .filter(t => t.length > 0);

      const estNum = editEstTime === "" ? 0 : Number(editEstTime);
      const actNum = editActualTime === "" ? 0 : Number(editActualTime);

      if (selectedKanbanTask.id === "new") {
        const taskId = "task_" + Date.now();
        const initialHistory = [
          {
            time: new Date().toLocaleString("vi-VN"),
            user: userName,
            action: "Tạo công việc mới"
          }
        ];

        const newTaskDoc = {
          title: editTitle.trim(),
          description: editDescription.trim(),
          assigneeUid: editAssigneeUid,
          assignee: assignedEmp.name,
          assigneeAvatar: assignedEmp.avatar || "👨‍💻",
          dueDate: editDueDate.trim() || "Chưa cập nhật",
          priority: editPriority,
          status: editStatus,
          companyCode: compCode,
          creatorUid: creatorUid,
          createdAt: new Date(),

          projectId: editProjectId,
          startTime: editStartTime,
          endTime: editEndTime,
          estTime: estNum,
          actualTime: actNum,
          tags: parsedTags,
          linkNote: editLinkNote.trim(),
          history: initialHistory,
          category: editCategory
        };

        await setDoc(doc(db, "kanbanTasks", taskId), newTaskDoc);
        toast.success("Đã thêm công việc thành công!");
        setTasks(prev => [...prev, { id: taskId, ...newTaskDoc }]);
      } else {
        const taskRef = doc(db, "kanbanTasks", selectedKanbanTask.id);

        const changes: string[] = [];
        if ((selectedKanbanTask.title || "") !== editTitle.trim()) {
          changes.push(`Đổi tên việc: "${selectedKanbanTask.title || 'Trống'}" → "${editTitle.trim()}"`);
        }
        if ((selectedKanbanTask.status || "") !== editStatus) {
          changes.push(`Đổi trạng thái: "${selectedKanbanTask.status}" → "${editStatus}"`);
        }
        if ((selectedKanbanTask.priority || "") !== editPriority) {
          changes.push(`Đổi độ ưu tiên: "${selectedKanbanTask.priority}" → "${editPriority}"`);
        }
        if ((selectedKanbanTask.assigneeUid || "") !== editAssigneeUid) {
          changes.push(`Đổi người thực hiện: "${selectedKanbanTask.assignee || 'Chưa phân công'}" → "${assignedEmp.name}"`);
        }
        if ((selectedKanbanTask.projectId || "") !== editProjectId) {
          const oldProj = projects.find(p => p.id === selectedKanbanTask.projectId)?.name || "Không có dự án";
          const newProj = projects.find(p => p.id === editProjectId)?.name || "Không có dự án";
          changes.push(`Chuyển dự án: "${oldProj}" → "${newProj}"`);
        }
        if ((selectedKanbanTask.startTime || "") !== editStartTime) {
          changes.push(`Sửa TG bắt đầu: "${selectedKanbanTask.startTime || 'Chưa thiết lập'}" → "${editStartTime || 'Chưa thiết lập'}"`);
        }
        if ((selectedKanbanTask.endTime || "") !== editEndTime) {
          changes.push(`Sửa TG kết thúc: "${selectedKanbanTask.endTime || 'Chưa thiết lập'}" → "${editEndTime || 'Chưa thiết lập'}"`);
        }
        if ((selectedKanbanTask.estTime ?? 0) !== estNum) {
          changes.push(`Sửa giờ dự tính: ${selectedKanbanTask.estTime ?? 0}h → ${estNum}h`);
        }
        if ((selectedKanbanTask.actualTime ?? 0) !== actNum) {
          changes.push(`Sửa giờ thực tế: ${selectedKanbanTask.actualTime ?? 0}h → ${actNum}h`);
        }
        if ((selectedKanbanTask.linkNote || "") !== editLinkNote.trim()) {
          changes.push(`Cập nhật link ghi chú`);
        }
        if ((selectedKanbanTask.category || "Onboarding") !== editCategory) {
          changes.push(`Đổi phân loại: "${selectedKanbanTask.category || 'Onboarding'}" → "${editCategory}"`);
        }

        const updatedHistory = [
          ...(selectedKanbanTask.history || []),
          ...(changes.length > 0 ? [{
            time: new Date().toLocaleString("vi-VN"),
            user: userName,
            action: changes.join(", ")
          }] : [])
        ];

        const updatedFields = {
          title: editTitle.trim(),
          description: editDescription.trim(),
          assigneeUid: editAssigneeUid,
          assignee: assignedEmp.name,
          assigneeAvatar: assignedEmp.avatar || "👨‍💻",
          dueDate: editDueDate.trim() || "Chưa cập nhật",
          priority: editPriority,
          status: editStatus,
          projectId: editProjectId,
          startTime: editStartTime,
          endTime: editEndTime,
          estTime: estNum,
          actualTime: actNum,
          tags: parsedTags,
          linkNote: editLinkNote.trim(),
          history: updatedHistory,
          category: editCategory
        };

        await updateDoc(taskRef, updatedFields);
        toast.success("Đã lưu thay đổi công việc!");
        setTasks(prev => prev.map(t => t.id === selectedKanbanTask.id ? { ...t, ...updatedFields } : t));
      }
      setSelectedKanbanTask(null);
    } catch (error) {
      console.error("Lỗi khi lưu công việc:", error);
      toast.error("Không thể lưu thay đổi. Vui lòng kiểm tra quyền hạn.");
    }
  };

  const fetchTasks = async () => {
    if (!selectedCompanyCode) return;
    try {
      const q = query(
        collection(db, "kanbanTasks"),
        where("companyCode", "==", selectedCompanyCode)
      );
      const querySnapshot = await getDocs(q);
      const tasksData: HRTask[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        tasksData.push({
          id: docSnap.id,
          title: data.title || "",
          description: data.description || "",
          assigneeUid: data.assigneeUid || "",
          assignee: data.assignee || "",
          assigneeAvatar: data.assigneeAvatar || "",
          dueDate: data.dueDate || "",
          priority: data.priority || "Medium",
          status: data.status || "Not Started",
          category: data.category || "Onboarding",
          companyCode: data.companyCode || "",
          creatorUid: data.creatorUid || "",
          createdAt: data.createdAt,
          projectId: data.projectId || "",
          startTime: data.startTime || "",
          estTime: data.estTime,
          endTime: data.endTime || "",
          actualTime: data.actualTime,
          tags: data.tags || [],
          linkNote: data.linkNote || "",
          history: data.history || []
        });
      });
      setTasks(tasksData);
    } catch (error) {
      console.error("Lỗi khi tải danh sách công việc:", error);
    }
  };

  const fetchProjects = async () => {
    if (!selectedCompanyCode) return;
    try {
      const q = query(
        collection(db, "projects"),
        where("companyCode", "==", selectedCompanyCode)
      );
      const querySnapshot = await getDocs(q);
      const projData: Project[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        projData.push({
          id: docSnap.id,
          name: data.name || "",
          companyCode: data.companyCode || "",
          creatorUid: data.creatorUid || "",
          createdAt: data.createdAt
        });
      });
      setProjects(projData);

      const expanded: Record<string, boolean> = {};
      projData.forEach(p => {
        expanded[p.id] = true;
      });
      expanded["unassigned"] = true;
      setExpandedProjects(expanded);
    } catch (error) {
      console.error("Lỗi khi tải danh sách dự án:", error);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newProjectName.trim() === "") {
      toast.warning("Vui lòng nhập tên dự án!");
      return;
    }
    try {
      const compCode = selectedCompanyCode || userProfile?.companyCode || "SYSTEM";
      const projectId = "project_" + Date.now();
      const newProj = {
        name: newProjectName.trim(),
        companyCode: compCode,
        creatorUid: userProfile?.uid || "",
        createdAt: new Date()
      };
      await setDoc(doc(db, "projects", projectId), newProj);
      toast.success("Đã tạo dự án mới thành công!");
      setProjects(prev => [...prev, { id: projectId, ...newProj }]);
      setExpandedProjects(prev => ({ ...prev, [projectId]: true }));
      setNewProjectName("");
      setIsNewProjectModalOpen(false);
    } catch (error) {
      console.error("Lỗi khi tạo dự án:", error);
      toast.error("Không thể tạo dự án. Vui lòng thử lại.");
    }
  };

  const moveTaskStatus = async (id: string, newStatus: "Not Started" | "In Progress" | "Review/Testing" | "Done" | "Archived") => {
    try {
      const taskRef = doc(db, "kanbanTasks", id);
      const taskObj = tasks.find(t => t.id === id);
      const userName = userProfile?.displayName || userProfile?.email || "Thành viên";
      const oldStatus = taskObj?.status || "Not Started";
      const updatedHistory = [
        ...(taskObj?.history || []),
        {
          time: new Date().toLocaleString("vi-VN"),
          user: userName,
          action: `Đổi trạng thái: "${oldStatus}" → "${newStatus}"`
        }
      ];

      await updateDoc(taskRef, {
        status: newStatus,
        history: updatedHistory
      });
      setTasks(prev => prev.map(t => t.id === id ? { ...t, status: newStatus, history: updatedHistory } : t));
      toast.success("Đã cập nhật trạng thái công việc!");
    } catch (error) {
      console.error("Lỗi khi cập nhật trạng thái công việc:", error);
      toast.error("Không thể cập nhật trạng thái. Vui lòng thử lại.");
    }
  };

  const deleteTask = async (id: string) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa công việc này?")) return;
    try {
      const taskRef = doc(db, "kanbanTasks", id);
      await deleteDoc(taskRef);
      setTasks(prev => prev.filter(t => t.id !== id));
      toast.success("Đã xóa công việc thành công!");
    } catch (error) {
      console.error("Lỗi khi xóa công việc:", error);
      toast.error("Không thể xóa công việc. Chỉ quản lý mới có quyền.");
    }
  };

  // 3. Training / e-Learning — Firestore-backed
  const [courses, setCourses] = useState<TrainingCourse[]>([]);
  const [enrollments, setEnrollments] = useState<TrainingEnrollment[]>([]);
  const [isAddCourseModalOpen, setIsAddCourseModalOpen] = useState(false);
  const [courseFormTitle, setCourseFormTitle] = useState("");
  const [courseFormDesc, setCourseFormDesc] = useState("");
  const [courseFormCategory, setCourseFormCategory] = useState("Văn hóa");
  const [courseFormInstructor, setCourseFormInstructor] = useState("");
  const [courseFormDuration, setCourseFormDuration] = useState("");
  const [courseFormIcon, setCourseFormIcon] = useState("📚");
  const [courseFormIsRequired, setCourseFormIsRequired] = useState(false);
  const [courseFormAutoOnboarding, setCourseFormAutoOnboarding] = useState(false);

  // New state variables for lessons and quizzes
  const [courseFormLessons, setCourseFormLessons] = useState<Lesson[]>([]);
  const [courseFormQuizzes, setCourseFormQuizzes] = useState<QuizQuestion[]>([]);

  // Active study player state
  const [activeStudyCourse, setActiveStudyCourse] = useState<TrainingCourse | null>(null);
  const [activeLessonIndex, setActiveLessonIndex] = useState<number>(-1);
  const [quizAnswers, setQuizAnswers] = useState<number[]>([]);
  const [quizSubmitted, setQuizSubmitted] = useState<boolean>(false);
  const [quizErrors, setQuizErrors] = useState<boolean[]>([]);
  const [isQuizEvaluating, setIsQuizEvaluating] = useState<boolean>(false);

  const fetchCourses = async (companyCode: string) => {
    try {
      const q = query(collection(db, "trainingCourses"), where("companyCode", "==", companyCode));
      const snap = await getDocs(q);
      const list: TrainingCourse[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as TrainingCourse));
      setCourses(list);
    } catch (err) {
      console.error("Lỗi tải khóa học:", err);
    }
  };

  const fetchMyEnrollments = async (uid: string, companyCode: string) => {
    try {
      const q = query(
        collection(db, "trainingEnrollments"),
        where("uid", "==", uid),
        where("companyCode", "==", companyCode)
      );
      const snap = await getDocs(q);
      const list: TrainingEnrollment[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as TrainingEnrollment));
      setEnrollments(list);
    } catch (err) {
      console.error("Lỗi tải tiến độ học:", err);
    }
  };

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile || !courseFormTitle.trim()) return;
    const companyCode = selectedCompanyCode || userProfile.companyCode || "SYSTEM";
    if (userProfile.role !== "superadmin" && (!companyCode || companyCode === "SYSTEM")) {
      toast.error("Tài khoản của bạn chưa được gắn với doanh nghiệp. Không thể tạo khóa học.");
      return;
    }
    const creatorName = userProfile.displayName || userProfile.email || "iGen Academy";
    try {
      const docRef = await addDoc(collection(db, "trainingCourses"), {
        title: courseFormTitle.trim(),
        description: courseFormDesc.trim(),
        category: courseFormCategory,
        tags: courseFormIsRequired ? ["Bắt buộc"] : [courseFormCategory],
        isRequired: courseFormIsRequired,
        icon: "📚",
        duration: courseFormDuration.trim() || "Chưa xác định",
        instructor: creatorName,
        companyCode: companyCode,
        creatorUid: userProfile.uid,
        createdAt: serverTimestamp(),
        enrolledCount: 0,
        companyProgress: 0,
        autoAssignOnboarding: courseFormAutoOnboarding,
        lessons: courseFormLessons,
        quizzes: courseFormQuizzes,
      });

      let enrolledCount = 0;
      if (courseFormIsRequired) {
        try {
          const companyUsers = await authService.getUsersByCompany(companyCode);
          // Lọc danh sách nhân viên: cùng công ty và không phải superadmin
          const targetEmployees = companyUsers.filter(u => u.role !== "superadmin");

          if (targetEmployees.length > 0) {
            const batch = writeBatch(db);
            targetEmployees.forEach((emp) => {
              const enrollRef = doc(collection(db, "trainingEnrollments"));
              batch.set(enrollRef, {
                courseId: docRef.id,
                courseTitle: courseFormTitle.trim(),
                uid: emp.uid,
                userName: emp.displayName || emp.email || "Nhân viên",
                companyCode: companyCode,
                progress: 0,
                status: "in_progress",
                createdAt: serverTimestamp(),
                startedAt: serverTimestamp(),
                completedLessons: [],
                quizPassed: false,
              });
            });
            await batch.commit();
            enrolledCount = targetEmployees.length;

            // Cập nhật lại enrolledCount trên khóa học
            await updateDoc(doc(db, "trainingCourses", docRef.id), {
              enrolledCount: enrolledCount
            });
          }
        } catch (enrollErr) {
          console.error("Lỗi tự động gán khóa học bắt buộc:", enrollErr);
        }
      }

      toast.success("Đã tạo khóa học thành công!");
      setIsAddCourseModalOpen(false);
      setCourseFormTitle(""); setCourseFormDesc("");
      setCourseFormDuration("");
      setCourseFormIsRequired(false); setCourseFormAutoOnboarding(false);
      setCourseFormLessons([]);
      setCourseFormQuizzes([]);

      // Thêm vào local state ngay không cần reload
      setCourses(prev => [...prev, {
        id: docRef.id, title: courseFormTitle.trim(), description: courseFormDesc.trim(),
        category: courseFormCategory, tags: courseFormIsRequired ? ["Bắt buộc"] : [courseFormCategory],
        isRequired: courseFormIsRequired, icon: "📚",
        duration: courseFormDuration.trim() || "Chưa xác định",
        instructor: creatorName,
        companyCode: companyCode, creatorUid: userProfile.uid,
        createdAt: new Date(),
        enrolledCount: enrolledCount,
        companyProgress: 0,
        autoAssignOnboarding: courseFormAutoOnboarding,
        lessons: courseFormLessons,
        quizzes: courseFormQuizzes,
      }]);

      if (courseFormIsRequired) {
        // Tải lại danh sách enrollment cá nhân để cập nhật giao diện học tập nếu bản thân là đối tượng được gán
        await fetchMyEnrollments(userProfile.uid, companyCode);
      }
    } catch (err) {
      console.error("Lỗi tạo khóa học:", err);
      toast.error("Không thể tạo khóa học.");
    }
  };

  const handleEnrollAndStart = async (course: TrainingCourse) => {
    if (!userProfile) return;
    const existing = enrollments.find(e => e.courseId === course.id);
    if (!existing) {
      // Chưa enroll → tạo enrollment mới
      try {
        const enrollRef = await addDoc(collection(db, "trainingEnrollments"), {
          courseId: course.id,
          courseTitle: course.title,
          uid: userProfile.uid,
          userName: userProfile.displayName || userProfile.email || "Nhân viên",
          companyCode: course.companyCode,
          progress: 0,
          status: "in_progress",
          startedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
          completedLessons: [],
          quizPassed: false,
        });
        // Tăng enrolledCount trên course
        await updateDoc(doc(db, "trainingCourses", course.id), {
          enrolledCount: (course.enrolledCount || 0) + 1
        });
        const newEnroll: TrainingEnrollment = {
          id: enrollRef.id, courseId: course.id, courseTitle: course.title,
          uid: userProfile.uid, userName: userProfile.displayName || userProfile.email || "Nhân viên",
          companyCode: course.companyCode, progress: 0,
          status: "in_progress", createdAt: new Date(),
          completedLessons: [],
          quizPassed: false,
        };
        setEnrollments(prev => [...prev, newEnroll]);
        setCourses(prev => prev.map(c => c.id === course.id
          ? { ...c, enrolledCount: c.enrolledCount + 1 }
          : c
        ));

        // Mở modal học tập
        setActiveStudyCourse(course);
        setActiveLessonIndex(-1); // Intro
        setQuizAnswers([]);
        setQuizSubmitted(false);
        setQuizErrors([]);
        toast.success(`Bắt đầu học "${course.title}"!`);
      } catch (err) {
        console.error(err);
        toast.error("Không thể đăng ký khóa học.");
      }
    } else {
      // Đã enroll → Mở modal học tập
      setActiveStudyCourse(course);

      const completed = existing.completedLessons || [];
      const lessons = course.lessons || [];
      let nextIdx = -1;
      for (let i = 0; i < lessons.length; i++) {
        if (!completed.includes(`lesson_${i}`)) {
          nextIdx = i;
          break;
        }
      }

      if (nextIdx === -1 && lessons.length > 0 && !existing.quizPassed && (course.quizzes && course.quizzes.length > 0)) {
        nextIdx = lessons.length;
      }

      setActiveLessonIndex(nextIdx);
      setQuizAnswers([]);
      setQuizSubmitted(false);
      setQuizErrors([]);
    }
  };

  const handleMarkLessonComplete = async (lesson: Lesson, currentIdx?: number) => {
    if (!activeStudyCourse || !userProfile) return;
    const enroll = enrollments.find(e => e.courseId === activeStudyCourse.id);
    if (!enroll) return;

    const completed = enroll.completedLessons || [];
    const lessons = activeStudyCourse.lessons || [];
    const currentIndex = currentIdx !== undefined ? currentIdx : lessons.findIndex(l => l.url === lesson.url);
    const lessonKey = `lesson_${currentIndex}`;

    if (!completed.includes(lessonKey)) {
      const nextCompleted = [...completed, lessonKey];

      const totalLessons = lessons.length;
      const totalQuizzes = (activeStudyCourse.quizzes && activeStudyCourse.quizzes.length > 0) ? 1 : 0;
      const totalItems = totalLessons + totalQuizzes;

      const finishedItems = nextCompleted.length + (enroll.quizPassed ? 1 : 0);
      const progressPercent = Math.round((finishedItems / (totalItems || 1)) * 100);
      const isCourseDone = progressPercent >= 100;
      const newStatus = isCourseDone ? "completed" : "in_progress";

      try {
        await updateDoc(doc(db, "trainingEnrollments", enroll.id), {
          completedLessons: nextCompleted,
          progress: progressPercent,
          status: newStatus,
          ...(isCourseDone ? { completedAt: serverTimestamp() } : {}),
        });

        setEnrollments(prev => prev.map(e => e.id === enroll.id
          ? { ...e, completedLessons: nextCompleted, progress: progressPercent, status: newStatus }
          : e
        ));

        // Tự động chuyển bài học tiếp theo hoặc quiz
        if (currentIndex < lessons.length - 1) {
          setActiveLessonIndex(currentIndex + 1);
        } else if (totalQuizzes > 0) {
          setActiveLessonIndex(lessons.length); // Chuyển sang phần thi trắc nghiệm
        } else {
          toast.success(`🎉 Chúc mừng! Bạn đã hoàn thành khóa học "${activeStudyCourse.title}"!`);
          setActiveStudyCourse(null);
          fetchCourses(userProfile.companyCode!);
        }
      } catch (err) {
        toast.error("Không thể lưu tiến độ học tập.");
      }
    } else {
      const totalQuizzes = (activeStudyCourse.quizzes && activeStudyCourse.quizzes.length > 0) ? 1 : 0;

      if (currentIndex < lessons.length - 1) {
        setActiveLessonIndex(currentIndex + 1);
      } else if (totalQuizzes > 0) {
        setActiveLessonIndex(lessons.length);
      } else {
        setActiveStudyCourse(null);
      }
    }
  };

  const handleSubmitQuiz = async () => {
    if (!activeStudyCourse || !userProfile) return;
    const enroll = enrollments.find(e => e.courseId === activeStudyCourse.id);
    if (!enroll) return;

    const quizzes = activeStudyCourse.quizzes || [];
    if (quizzes.length === 0) return;

    // Kiểm tra xem đã trả lời hết câu hỏi chưa
    const unanswered = quizzes.some((_, idx) => quizAnswers[idx] === undefined || quizAnswers[idx] === null);
    if (unanswered) {
      toast.warning("Vui lòng trả lời đầy đủ tất cả các câu hỏi trắc nghiệm!");
      return;
    }

    let allCorrect = true;
    const errorsCopy = new Array(quizzes.length).fill(false);
    for (let i = 0; i < quizzes.length; i++) {
      if (quizAnswers[i] !== quizzes[i].correctOptionIndex) {
        allCorrect = false;
        errorsCopy[i] = true;
      }
    }

    if (allCorrect) {
      setIsQuizEvaluating(true);
      const totalLessons = activeStudyCourse.lessons?.length ?? 0;
      const totalItems = totalLessons + 1;
      const finishedItems = (enroll.completedLessons || []).length + 1;
      const progressPercent = Math.round((finishedItems / (totalItems || 1)) * 100);
      const isCourseDone = progressPercent >= 100;
      const newStatus = isCourseDone ? "completed" : "in_progress";

      try {
        await updateDoc(doc(db, "trainingEnrollments", enroll.id), {
          quizPassed: true,
          progress: progressPercent,
          status: newStatus,
          ...(isCourseDone ? { completedAt: serverTimestamp() } : {}),
        });

        setEnrollments(prev => prev.map(e => e.id === enroll.id
          ? { ...e, quizPassed: true, progress: progressPercent, status: newStatus }
          : e
        ));

        setQuizSubmitted(true);
        setQuizErrors(errorsCopy);
        toast.success("🎉 Xuất sắc! Bạn đã trả lời đúng tất cả các câu hỏi trắc nghiệm!");
      } catch (err) {
        console.error(err);
        toast.error("Không thể lưu kết quả thi.");
      } finally {
        setIsQuizEvaluating(false);
      }
    } else {
      setQuizSubmitted(true);
      setQuizErrors(errorsCopy);
      toast.error("Có câu trả lời chưa đúng. Vui lòng kiểm tra lại!");
    }
  };

  const handleFinishCourse = () => {
    if (!activeStudyCourse || !userProfile) return;
    toast.success(`🎉 Chúc mừng! Bạn đã hoàn thành khóa học "${activeStudyCourse.title}"!`);
    setActiveStudyCourse(null);
    fetchCourses(userProfile.companyCode!);
  };

  const handleCompleteCourseDirectly = async () => {
    if (!activeStudyCourse || !userProfile) return;
    const enroll = enrollments.find(e => e.courseId === activeStudyCourse.id);
    if (!enroll) return;

    try {
      await updateDoc(doc(db, "trainingEnrollments", enroll.id), {
        progress: 100,
        status: "completed",
        completedAt: serverTimestamp(),
      });
      setEnrollments(prev => prev.map(e => e.id === enroll.id
        ? { ...e, progress: 100, status: "completed" }
        : e
      ));
      toast.success(`🎉 Bạn đã hoàn thành khóa học "${activeStudyCourse.title}"!`);
      setActiveStudyCourse(null);
      fetchCourses(userProfile.companyCode!);
    } catch (err) {
      toast.error("Không thể hoàn thành khóa học.");
    }
  };

  const handleDeleteCourse = async (courseId: string) => {
    if (!window.confirm("Xác nhận xóa khóa học này?")) return;
    try {
      await deleteDoc(doc(db, "trainingCourses", courseId));
      setCourses(prev => prev.filter(c => c.id !== courseId));
      toast.success("Đã xóa khóa học.");
    } catch (err) {
      toast.error("Không thể xóa khóa học.");
    }
  };

  // Tự động gán khóa học Onboarding / Bắt buộc + tạo Kanban task khi thêm nhân viên mới
  const autoAssignCourseOnNewEmployee = async (newEmpUid: string, newEmpName: string, companyCode: string) => {
    const targetCourses = courses.filter(c => (c.autoAssignOnboarding || c.isRequired) && c.companyCode === companyCode);
    for (const course of targetCourses) {
      try {
        // Tạo enrollment
        await addDoc(collection(db, "trainingEnrollments"), {
          courseId: course.id,
          courseTitle: course.title,
          uid: newEmpUid,
          userName: newEmpName,
          companyCode,
          progress: 0,
          status: "in_progress",
          createdAt: serverTimestamp(),
          startedAt: serverTimestamp(),
          completedLessons: [],
          quizPassed: false,
        });

        // Tăng enrolledCount trên khóa học
        await updateDoc(doc(db, "trainingCourses", course.id), {
          enrolledCount: (course.enrolledCount || 0) + 1
        });

        // Tạo Kanban task tương ứng
        const taskDueDate = new Date();
        taskDueDate.setDate(taskDueDate.getDate() + 7);
        const taskId = `onboarding_${newEmpUid}_${course.id}_${Date.now()}`;
        await setDoc(doc(db, "kanbanTasks", taskId), {
          id: taskId,
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
          createdAt: new Date(),
          projectId: "",
          tags: course.tags,
          linkNote: "",
          history: [{
            time: new Date().toLocaleString("vi-VN"),
            user: "Hệ thống",
            action: `Tự động tạo từ khóa học ${course.isRequired ? "Bắt buộc" : "Onboarding"}: "${course.title}"`
          }]
        });
      } catch (err) {
        console.error(`Lỗi auto-assign course ${course.id}:`, err);
      }
    }
  };

  // Legacy: kept for compatibility
  const handleStudyProgress = (courseId: string) => {
    const course = courses.find(c => c.id === courseId);
    if (course) handleEnrollAndStart(course);
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
    if (!addName.trim() || !addEmail.trim() || !addPassword.trim()) {
      toast.warning("Vui lòng nhập đầy đủ Họ tên, Email và Mật khẩu!");
      return;
    }
    if (addPassword.length < 6) {
      toast.warning("Mật khẩu phải chứa ít nhất 6 ký tự!");
      return;
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
          className={`p-3 bg-white text-gray-800 border rounded-2xl shadow-xs w-52 text-center cursor-pointer relative hover:scale-104 active:scale-95 transition-all duration-300 ${isSelected
              ? "ring-4 ring-indigo-500 shadow-indigo-200 border-transparent z-10"
              : "border-gray-250 hover:border-indigo-300 hover:shadow-md"
            } ${isFilteredOut ? "opacity-30 blur-[0.5px] scale-98" : "opacity-100"
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

          <div className="mb-1 mx-auto flex items-center justify-center">
            {renderAvatar(node.avatar, "w-12 h-12", "text-2xl")}
          </div>
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
              className={`px-4 py-2 rounded-lg border font-bold uppercase transition-all tracking-wide ${subTab === tab
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
                    <div className="my-4 mx-auto relative w-20 h-20">
                      {renderAvatar(selectedEmp.avatar, "w-full h-full", "text-4xl")}
                      <span className={`absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${selectedEmp.status === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'
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
                              {renderAvatar(sub.avatar, "w-5 h-5", "text-xs")}
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

                    {/* Delete button (Manager/Admin/Superadmin only) */}
                    {canDeleteEmployee(selectedEmp.id) && (
                      <button
                        onClick={() => handleDeleteEmployeeSubmit(selectedEmp.id)}
                        className="w-full text-center py-2.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-150 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer shadow-2xs mt-2"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Xóa nhân sự khỏi sơ đồ
                      </button>
                    )}
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
          <div className="bg-white text-slate-800 p-8 rounded-3xl border border-gray-200 shadow-xs space-y-6 text-left" id="job_delegation_kanban">

            {/* Header section */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 pb-4 border-b border-gray-200">
              <div className="flex items-center gap-4">
                <h2 className="text-2xl font-bold font-sans text-slate-800">Tasks</h2>

                {/* Tab buttons */}
                <div className="flex bg-gray-100 border border-gray-200 p-1 rounded-xl text-xs font-semibold gap-1 select-none">
                  <button
                    onClick={() => setKanbanViewTab("By project")}
                    className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${kanbanViewTab === "By project" ? "bg-slate-800 text-white shadow-xs" : "text-gray-500 hover:text-slate-800"
                      }`}
                  >
                    <Target className="h-3.5 w-3.5" />
                    By project
                  </button>
                  <button
                    onClick={() => setKanbanViewTab("Board")}
                    className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${kanbanViewTab === "Board" ? "bg-slate-800 text-white shadow-xs" : "text-gray-500 hover:text-slate-800"
                      }`}
                  >
                    <Activity className="h-3.5 w-3.5" />
                    Board
                  </button>
                  <button
                    onClick={() => setKanbanViewTab("All tasks")}
                    className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${kanbanViewTab === "All tasks" ? "bg-slate-800 text-white shadow-xs" : "text-gray-500 hover:text-slate-800"
                      }`}
                  >
                    <BookOpen className="h-3.5 w-3.5" />
                    All tasks
                  </button>
                </div>
              </div>

              {/* Action Buttons on the right */}
              <div className="flex items-center gap-3">
                {/* Search / Filter Active Badge */}
                {kanbanFilter && (
                  <span className="text-[10px] bg-indigo-50 border border-indigo-200 text-indigo-700 font-mono font-bold px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                    Lọc: {kanbanFilter}
                    <button onClick={() => setKanbanFilter(null)} className="hover:text-indigo-900 cursor-pointer"><X className="h-3 w-3" /></button>
                  </span>
                )}
                <span className="text-[10px] text-gray-400 font-mono font-semibold flex items-center gap-1 select-none">
                  <Clock className="h-3 w-3" />
                  Đã khóa
                </span>

                {/* Mới Dropdown / Action buttons */}
                <div className="relative flex gap-2">
                  <button
                    onClick={() => setIsNewProjectModalOpen(true)}
                    className="px-3 py-1.5 bg-white border border-gray-200 text-gray-600 hover:text-slate-850 hover:bg-gray-55/40 hover:bg-gray-50 rounded-xl text-xs font-bold transition-all shadow-xxs flex items-center gap-1.5 cursor-pointer font-sans"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Dự án mới
                  </button>
                  <button
                    onClick={() => setSelectedKanbanTask({
                      id: "new",
                      title: "",
                      description: "",
                      assigneeUid: employees[0]?.id || "",
                      assignee: employees[0]?.name || "",
                      assigneeAvatar: employees[0]?.avatar || "👨‍💻",
                      dueDate: "Hôm nay",
                      priority: "Medium",
                      status: "Not Started",
                      companyCode: selectedCompanyCode || userProfile?.companyCode || "SYSTEM",
                      creatorUid: userProfile?.uid || "",
                      createdAt: new Date(),
                      projectId: projects[0]?.id || ""
                    })}
                    className="px-4 py-1.5 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer font-sans"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Mới
                  </button>
                </div>
              </div>
            </div>

            {/* TAB CONTENT: By project */}
            {kanbanViewTab === "By project" && (
              <div className="space-y-6">
                {projects.length === 0 && (
                  <div className="p-12 text-center text-gray-500 border border-gray-200 border-dashed rounded-2xl">
                    Chưa có dự án nào được tạo. Hãy bấm <strong>+ Dự án mới</strong> để bắt đầu!
                  </div>
                )}

                {/* Render task lists grouped by project */}
                {[...projects, { id: "unassigned", name: "Không phân loại dự án" }].map((proj) => {
                  const projTasks = visibleTasks.filter(t => proj.id === "unassigned" ? !t.projectId : t.projectId === proj.id);
                  if (proj.id === "unassigned" && projTasks.length === 0) return null;

                  const isExpanded = expandedProjects[proj.id] !== false;

                  return (
                    <div key={proj.id} className="border border-gray-200 bg-white rounded-2xl overflow-hidden transition-all shadow-xxs">
                      {/* Accordion header */}
                      <div
                        onClick={() => setExpandedProjects(prev => ({ ...prev, [proj.id]: !isExpanded }))}
                        className="px-5 py-3.5 bg-gray-50/50 border-b border-gray-200 flex items-center justify-between cursor-pointer select-none hover:bg-gray-55/40 hover:bg-gray-50"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-gray-400 text-[10px] transition-transform duration-200" style={{ display: "inline-block", transform: isExpanded ? "rotate(0deg)" : "rotate(-90deg)" }}>
                            ▼
                          </span>
                          <span className="text-sm font-bold text-slate-800 flex items-center gap-1.5 font-sans">
                            🎯 {proj.name}
                          </span>
                          <span className="bg-gray-150 text-gray-500 text-[10px] font-bold px-2 py-0.5 rounded-full">
                            {projTasks.length}
                          </span>
                        </div>
                      </div>

                      {/* Accordion task list table */}
                      {isExpanded && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs text-left border-collapse font-sans">
                            <thead>
                              <tr className="border-b border-gray-200 bg-gray-50/60 text-gray-500 font-bold">
                                <th className="p-3 border-r border-gray-200 min-w-[200px]">Task name</th>
                                <th className="p-3 border-r border-gray-200">Status</th>
                                <th className="p-3 border-r border-gray-200">Priority</th>
                                <th className="p-3 border-r border-gray-200">Tags</th>
                                <th className="p-3 border-r border-gray-200">Assignee</th>
                                <th className="p-3 border-r border-gray-200">Start Time</th>
                                <th className="p-3 border-r border-gray-200">Est. Time (Hour)</th>
                                <th className="p-3 border-r border-gray-200">End Time</th>
                                <th className="p-3 border-r border-gray-200">Actual Time (Hour)</th>
                                <th className="p-3 border-r border-gray-200">KPI</th>
                                <th className="p-3 border-r border-gray-200">Description</th>
                                <th className="p-3 border-r border-gray-200">Link note</th>
                                <th className="p-3 text-center">Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {projTasks.length === 0 ? (
                                <tr>
                                  <td colSpan={13} className="p-8 text-center text-gray-400 italic">
                                    Chưa có nhiệm vụ nào trong dự án này.
                                  </td>
                                </tr>
                              ) : (
                                projTasks.map(task => {
                                  const est = task.estTime || 0;
                                  const act = task.actualTime || 0;

                                  let kpiText = "Not Started";
                                  let kpiColor = "bg-gray-100 text-gray-600 border border-gray-200";

                                  let finalStatus = task.status || "Not Started";
                                  if (finalStatus === "todo") finalStatus = "Not Started";
                                  else if (finalStatus === "doing") finalStatus = "In Progress";
                                  else if (finalStatus === "done") finalStatus = "Done";

                                  if (finalStatus === "Not Started") {
                                    kpiText = "⚪ Not Started";
                                    kpiColor = "bg-slate-50 text-slate-500 border border-slate-200";
                                  } else {
                                    if (act === 0) {
                                      kpiText = "⚪ Not Started";
                                      kpiColor = "bg-slate-50 text-slate-500 border border-slate-200";
                                    } else if (act > est) {
                                      const delay = (act - est).toFixed(1);
                                      kpiText = `❌ Trễ hạn ${delay}h`;
                                      kpiColor = "bg-red-50 text-red-700 border border-red-200";
                                    } else {
                                      kpiText = "✅ Đúng hạn";
                                      kpiColor = "bg-emerald-50 text-emerald-700 border border-emerald-200";
                                    }
                                  }

                                  return (
                                    <tr
                                      key={task.id}
                                      className="border-b border-gray-150/60 hover:bg-gray-50/45 cursor-pointer font-sans"
                                      onClick={() => setSelectedKanbanTask(task)}
                                    >
                                      {/* Task name */}
                                      <td className="p-3 border-r border-gray-150/60 font-semibold text-slate-800 flex items-center gap-1.5 min-w-[200px] select-text">
                                        📄 {task.title || "Không có tiêu đề"}
                                      </td>

                                      {/* Status */}
                                      <td className="p-3 border-r border-gray-150/60">
                                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${finalStatus === "Done" ? "bg-emerald-50 border border-emerald-250 border-emerald-200 text-emerald-700" :
                                            finalStatus === "In Progress" ? "bg-blue-50 border border-blue-200 text-blue-700" :
                                              finalStatus === "Review/Testing" ? "bg-amber-50 border border-amber-250 border-amber-200 text-amber-700" :
                                                finalStatus === "Archived" ? "bg-gray-100 border border-gray-250/70 border-gray-200 text-gray-600" :
                                                  "bg-gray-50 border border-gray-250/70 text-gray-500"
                                          }`}>
                                          {finalStatus}
                                        </span>
                                      </td>

                                      {/* Priority */}
                                      <td className="p-3 border-r border-gray-150/60">
                                        <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold whitespace-nowrap ${task.priority === "High" || task.priority === "Cao" ? "bg-red-50 border border-red-150 border-red-100 text-red-700" :
                                            task.priority === "Medium" || task.priority === "Trung bình" ? "bg-amber-50 border border-amber-150 border-amber-100 text-amber-750" :
                                              "bg-blue-50 border border-blue-150 border-blue-100 text-blue-700"
                                          }`}>
                                          {task.priority || "Medium"}
                                        </span>
                                      </td>

                                      {/* Tags */}
                                      <td className="p-3 border-r border-gray-150/60 min-w-[100px]">
                                        <div className="flex flex-wrap gap-1">
                                          {(task.tags || []).map((t, idx) => (
                                            <span key={idx} className="px-2 py-0.5 bg-gray-100 border border-gray-200 text-gray-600 rounded-md text-[9px] font-mono font-semibold">
                                              {t}
                                            </span>
                                          ))}
                                        </div>
                                      </td>

                                      {/* Assignee */}
                                      <td className="p-3 border-r border-gray-150/60 min-w-[130px]">
                                        <div className="flex items-center gap-1.5">
                                          {renderAvatar(task.assigneeAvatar || "👨‍💻", "w-5 h-5", "text-[10px]")}
                                          <span className="font-semibold text-slate-700">{task.assignee}</span>
                                        </div>
                                      </td>

                                      {/* Start Time */}
                                      <td className="p-3 border-r border-gray-150/60 font-mono text-slate-500 min-w-[110px]">
                                        {task.startTime ? new Date(task.startTime).toLocaleDateString("vi-VN") : "—"}
                                      </td>

                                      {/* Est Time */}
                                      <td className="p-3 border-r border-gray-150/60 font-mono text-right font-bold text-slate-700">
                                        {task.estTime ?? 0}h
                                      </td>

                                      {/* End Time */}
                                      <td className="p-3 border-r border-gray-150/60 font-mono text-slate-500 min-w-[110px]">
                                        {task.endTime ? new Date(task.endTime).toLocaleDateString("vi-VN") : "—"}
                                      </td>

                                      {/* Actual Time */}
                                      <td className="p-3 border-r border-gray-150/60 font-mono text-right font-bold text-slate-700">
                                        {task.actualTime ?? 0}h
                                      </td>

                                      {/* KPI */}
                                      <td className="p-3 border-r border-gray-150/60 min-w-[120px]">
                                        <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-semibold whitespace-nowrap ${kpiColor}`}>
                                          {kpiText}
                                        </span>
                                      </td>

                                      {/* Description */}
                                      <td className="p-3 border-r border-gray-150/60 text-slate-500 truncate max-w-[150px] min-w-[100px]">
                                        {task.description || "—"}
                                      </td>

                                      {/* Link Note */}
                                      <td className="p-3 border-r border-gray-150/60 text-indigo-650 hover:underline min-w-[100px]">
                                        {task.linkNote ? (
                                          <a href={task.linkNote} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="flex items-center gap-1 font-semibold">
                                            Link note
                                            <ExternalLink className="h-3 w-3" />
                                          </a>
                                        ) : "—"}
                                      </td>

                                      {/* Action */}
                                      <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                                        {isManager && (
                                          <button
                                            onClick={() => deleteTask(task.id)}
                                            className="p-1 hover:bg-slate-100 text-gray-400 hover:text-red-650 rounded-lg transition-colors cursor-pointer"
                                          >
                                            <Trash2 className="h-3.5 w-3.5" />
                                          </button>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Accordion footer button */}
                      {isExpanded && (
                        <div className="px-5 py-3 border-t border-gray-200 bg-gray-50/20 text-left">
                          <button
                            onClick={() => setSelectedKanbanTask({
                              id: "new",
                              title: "",
                              description: "",
                              assigneeUid: employees[0]?.id || "",
                              assignee: employees[0]?.name || "",
                              assigneeAvatar: employees[0]?.avatar || "👨‍💻",
                              dueDate: "Hôm nay",
                              priority: "Medium",
                              status: "Not Started",
                              companyCode: selectedCompanyCode || userProfile?.companyCode || "SYSTEM",
                              creatorUid: userProfile?.uid || "",
                              createdAt: new Date(),
                              projectId: proj.id === "unassigned" ? "" : proj.id
                            })}
                            className="text-slate-500 hover:text-indigo-650 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer font-sans"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Nhiệm vụ mới
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* TAB CONTENT: Board */}
            {kanbanViewTab === "Board" && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6" id="three_column_kanban">

                {/* 1. NOT STARTED */}
                <div className="bg-slate-50/70 rounded-2xl p-4 border border-gray-200/60 flex flex-col min-h-[450px]">
                  <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-200 select-none">
                    <span className="text-xs font-bold text-gray-500 tracking-wider font-sans uppercase">⚪ Not Started</span>
                    <span className="bg-gray-200 text-gray-650 text-[10px] font-bold px-2 py-0.5 rounded-full border border-gray-300/60">
                      {visibleTasks.filter(t => (t.status === "Not Started" || t.status === "todo")).length}
                    </span>
                  </div>
                  <div className="space-y-3 flex-1 overflow-y-auto">
                    {visibleTasks.filter(t => (t.status === "Not Started" || t.status === "todo")).length === 0 ? (
                      <div className="p-8 text-center text-gray-400 text-xs italic">Hết công việc chờ!</div>
                    ) : (
                      visibleTasks.filter(t => (t.status === "Not Started" || t.status === "todo")).map(task => (
                        <KanbanCard
                          key={task.id}
                          task={task}
                          onMove={(newSt) => moveTaskStatus(task.id, newSt)}
                          onDelete={() => deleteTask(task.id)}
                          canDelete={isManager}
                          onClick={() => setSelectedKanbanTask(task)}
                          projects={projects}
                        />
                      ))
                    )}
                  </div>
                  <button
                    onClick={() => setSelectedKanbanTask({
                      id: "new",
                      title: "",
                      description: "",
                      assigneeUid: employees[0]?.id || "",
                      assignee: employees[0]?.name || "",
                      assigneeAvatar: employees[0]?.avatar || "👨‍💻",
                      dueDate: "Hôm nay",
                      priority: "Medium",
                      status: "Not Started",
                      companyCode: selectedCompanyCode || userProfile?.companyCode || "SYSTEM",
                      creatorUid: userProfile?.uid || "",
                      createdAt: new Date(),
                      projectId: projects[0]?.id || ""
                    })}
                    className="mt-3 w-full py-2 border border-dashed border-gray-300 hover:border-indigo-500 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-500 hover:text-indigo-650 transition-all flex items-center justify-center gap-1.5 cursor-pointer select-none font-sans"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Nhiệm vụ mới
                  </button>
                </div>

                {/* 2. IN PROGRESS */}
                <div className="bg-slate-50/70 rounded-2xl p-4 border border-gray-200/60 flex flex-col min-h-[450px]">
                  <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-200 select-none">
                    <span className="text-xs font-bold text-blue-650 tracking-wider font-sans uppercase">🔵 In Progress</span>
                    <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-100">
                      {visibleTasks.filter(t => (t.status === "In Progress" || t.status === "doing")).length}
                    </span>
                  </div>
                  <div className="space-y-3 flex-1 overflow-y-auto">
                    {visibleTasks.filter(t => (t.status === "In Progress" || t.status === "doing")).length === 0 ? (
                      <div className="p-8 text-center text-gray-400 text-xs italic">Kéo thả hoặc chuyển tiến độ để bắt đầu</div>
                    ) : (
                      visibleTasks.filter(t => (t.status === "In Progress" || t.status === "doing")).map(task => (
                        <KanbanCard
                          key={task.id}
                          task={task}
                          onMove={(newSt) => moveTaskStatus(task.id, newSt)}
                          onDelete={() => deleteTask(task.id)}
                          canDelete={isManager}
                          onClick={() => setSelectedKanbanTask(task)}
                          projects={projects}
                        />
                      ))
                    )}
                  </div>
                  <button
                    onClick={() => setSelectedKanbanTask({
                      id: "new",
                      title: "",
                      description: "",
                      assigneeUid: employees[0]?.id || "",
                      assignee: employees[0]?.name || "",
                      assigneeAvatar: employees[0]?.avatar || "👨‍💻",
                      dueDate: "Hôm nay",
                      priority: "Medium",
                      status: "In Progress",
                      companyCode: selectedCompanyCode || userProfile?.companyCode || "SYSTEM",
                      creatorUid: userProfile?.uid || "",
                      createdAt: new Date(),
                      projectId: projects[0]?.id || ""
                    })}
                    className="mt-3 w-full py-2 border border-dashed border-gray-300 hover:border-indigo-500 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-500 hover:text-indigo-650 transition-all flex items-center justify-center gap-1.5 cursor-pointer select-none font-sans"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Nhiệm vụ mới
                  </button>
                </div>

                {/* 3. REVIEW / TESTING */}
                <div className="bg-slate-50/70 rounded-2xl p-4 border border-gray-200/60 flex flex-col min-h-[450px]">
                  <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-200 select-none">
                    <span className="text-xs font-bold text-amber-650 tracking-wider font-sans uppercase">🟡 Review/Testing</span>
                    <span className="bg-amber-50 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-100">
                      {visibleTasks.filter(t => t.status === "Review/Testing").length}
                    </span>
                  </div>
                  <div className="space-y-3 flex-1 overflow-y-auto">
                    {visibleTasks.filter(t => t.status === "Review/Testing").length === 0 ? (
                      <div className="p-8 text-center text-gray-400 text-xs italic">Không có nhiệm vụ nào cần review</div>
                    ) : (
                      visibleTasks.filter(t => t.status === "Review/Testing").map(task => (
                        <KanbanCard
                          key={task.id}
                          task={task}
                          onMove={(newSt) => moveTaskStatus(task.id, newSt)}
                          onDelete={() => deleteTask(task.id)}
                          canDelete={isManager}
                          onClick={() => setSelectedKanbanTask(task)}
                          projects={projects}
                        />
                      ))
                    )}
                  </div>
                  <button
                    onClick={() => setSelectedKanbanTask({
                      id: "new",
                      title: "",
                      description: "",
                      assigneeUid: employees[0]?.id || "",
                      assignee: employees[0]?.name || "",
                      assigneeAvatar: employees[0]?.avatar || "👨‍💻",
                      dueDate: "Hôm nay",
                      priority: "Medium",
                      status: "Review/Testing",
                      companyCode: selectedCompanyCode || userProfile?.companyCode || "SYSTEM",
                      creatorUid: userProfile?.uid || "",
                      createdAt: new Date(),
                      projectId: projects[0]?.id || ""
                    })}
                    className="mt-3 w-full py-2 border border-dashed border-gray-300 hover:border-indigo-500 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-500 hover:text-indigo-650 transition-all flex items-center justify-center gap-1.5 cursor-pointer select-none font-sans"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Nhiệm vụ mới
                  </button>
                </div>

                {/* 4. DONE */}
                <div className="bg-slate-50/70 rounded-2xl p-4 border border-gray-200/60 flex flex-col min-h-[450px]">
                  <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-200 select-none">
                    <span className="text-xs font-bold text-emerald-650 tracking-wider font-sans uppercase">🟢 Done</span>
                    <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-100">
                      {visibleTasks.filter(t => (t.status === "Done" || t.status === "done")).length}
                    </span>
                  </div>
                  <div className="space-y-3 flex-1 overflow-y-auto">
                    {visibleTasks.filter(t => (t.status === "Done" || t.status === "done")).length === 0 ? (
                      <div className="p-8 text-center text-gray-400 text-xs italic">Chưa có công việc nào hoàn thành</div>
                    ) : (
                      visibleTasks.filter(t => (t.status === "Done" || t.status === "done")).map(task => (
                        <KanbanCard
                          key={task.id}
                          task={task}
                          onMove={(newSt) => moveTaskStatus(task.id, newSt)}
                          onDelete={() => deleteTask(task.id)}
                          canDelete={isManager}
                          onClick={() => setSelectedKanbanTask(task)}
                          projects={projects}
                        />
                      ))
                    )}
                  </div>
                  <button
                    onClick={() => setSelectedKanbanTask({
                      id: "new",
                      title: "",
                      description: "",
                      assigneeUid: employees[0]?.id || "",
                      assignee: employees[0]?.name || "",
                      assigneeAvatar: employees[0]?.avatar || "👨‍💻",
                      dueDate: "Hôm nay",
                      priority: "Medium",
                      status: "Done",
                      companyCode: selectedCompanyCode || userProfile?.companyCode || "SYSTEM",
                      creatorUid: userProfile?.uid || "",
                      createdAt: new Date(),
                      projectId: projects[0]?.id || ""
                    })}
                    className="mt-3 w-full py-2 border border-dashed border-gray-300 hover:border-indigo-500 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-500 hover:text-indigo-650 transition-all flex items-center justify-center gap-1.5 cursor-pointer select-none font-sans"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Nhiệm vụ mới
                  </button>
                </div>

              </div>
            )}

            {/* TAB CONTENT: All tasks */}
            {kanbanViewTab === "All tasks" && (
              <div className="overflow-x-auto border border-gray-200 bg-white rounded-2xl shadow-xxs">
                <table className="w-full text-xs text-left border-collapse font-sans">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50/60 text-gray-500 font-bold">
                      <th className="p-3 border-r border-gray-200">Task name</th>
                      <th className="p-3 border-r border-gray-200">Status</th>
                      <th className="p-3 border-r border-gray-200">Assignee</th>
                      <th className="p-3 border-r border-gray-200">Est. Time (Detail)</th>
                      <th className="p-3 border-r border-gray-200">Priority</th>
                      <th className="p-3 border-r border-gray-200">Tags</th>
                      <th className="p-3 border-r border-gray-200">Project</th>
                      <th className="p-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleTasks.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-12 text-center text-gray-400 italic">
                          Chưa có nhiệm vụ nào được tạo.
                        </td>
                      </tr>
                    ) : (
                      visibleTasks.map(task => {
                        let finalStatus = task.status || "Not Started";
                        if (finalStatus === "todo") finalStatus = "Not Started";
                        else if (finalStatus === "doing") finalStatus = "In Progress";
                        else if (finalStatus === "done") finalStatus = "Done";

                        const taskProj = projects.find(p => p.id === task.projectId);

                        return (
                          <tr
                            key={task.id}
                            className="border-b border-gray-150/60 hover:bg-gray-55/45 cursor-pointer font-sans"
                            onClick={() => setSelectedKanbanTask(task)}
                          >
                            {/* Task name */}
                            <td className="p-3 border-r border-gray-150/60 font-semibold text-slate-800 flex items-center gap-1.5 min-w-[200px] select-text">
                              📄 {task.title || "Không có tiêu đề"}
                            </td>

                            {/* Status */}
                            <td className="p-3 border-r border-gray-150/60">
                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${finalStatus === "Done" ? "bg-emerald-50 border border-emerald-255 border-emerald-200 text-emerald-700" :
                                  finalStatus === "In Progress" ? "bg-blue-50 border border-blue-200 text-blue-700" :
                                    finalStatus === "Review/Testing" ? "bg-amber-50 border border-amber-250 border-amber-200 text-amber-700" :
                                      finalStatus === "Archived" ? "bg-gray-100 border border-gray-200 text-gray-600" :
                                        "bg-gray-50 border border-gray-250/70 text-gray-500"
                                }`}>
                                {finalStatus}
                              </span>
                            </td>

                            {/* Assignee */}
                            <td className="p-3 border-r border-gray-150/60 min-w-[130px]">
                              <div className="flex items-center gap-1.5">
                                {renderAvatar(task.assigneeAvatar || "👨‍💻", "w-5 h-5", "text-[10px]")}
                                <span className="font-semibold text-slate-700">{task.assignee}</span>
                              </div>
                            </td>

                            {/* Est Time Detail */}
                            <td className="p-3 border-r border-gray-150/60 font-mono text-slate-700 font-bold">
                              {task.estTime ?? 0}h
                            </td>

                            {/* Priority */}
                            <td className="p-3 border-r border-gray-150/60">
                              <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold whitespace-nowrap ${task.priority === "High" || task.priority === "Cao" ? "bg-red-50 border border-red-100 text-red-700" :
                                  task.priority === "Medium" || task.priority === "Trung bình" ? "bg-amber-50 border border-amber-100 text-amber-750" :
                                    "bg-blue-50 border border-blue-100 text-blue-700"
                                }`}>
                                {task.priority || "Medium"}
                              </span>
                            </td>

                            {/* Tags */}
                            <td className="p-3 border-r border-gray-150/60 min-w-[120px]">
                              <div className="flex flex-wrap gap-1">
                                {(task.tags || []).map((t, idx) => (
                                  <span key={idx} className="px-2 py-0.5 bg-gray-100 border border-gray-200 text-gray-600 rounded-md text-[9px] font-mono font-semibold">
                                    {t}
                                  </span>
                                ))}
                              </div>
                            </td>

                            {/* Project */}
                            <td className="p-3 border-r border-gray-150/60 font-semibold text-slate-600 min-w-[150px]">
                              {taskProj ? `🎯 {taskProj.name}` : "Không có dự án"}
                            </td>

                            {/* Action */}
                            <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                              {isManager && (
                                <button
                                  onClick={() => deleteTask(task.id)}
                                  className="p-1 hover:bg-slate-100 text-gray-400 hover:text-red-650 rounded-lg transition-colors cursor-pointer"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}

          </div>
        )}

        {/* SUB TAB 3: ĐÀO TẠO */}
        {subTab === "ĐÀO TẠO" && (
          <div className="space-y-6" id="elearning_catalog">

            {/* Monitor Training Progress Banner */}
            {trainingFilter && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-850 p-5 rounded-2xl mb-6 relative text-left">
                <h5 className="font-bold text-xs uppercase tracking-wider text-emerald-900 flex items-center gap-1.5 mb-2">
                  <Award className="h-4.5 w-4.5 text-emerald-700 animate-bounce" />
                  Tiến trình Đào tạo của: {trainingFilter}
                </h5>
                <p className="text-xs text-emerald-700 mb-4">Các khóa học chuyên môn nhân sự này đã hoàn thành hoặc đang nghiên cứu phục vụ đánh giá thăng cấp và KPI.</p>
                <div className="mt-4 pt-4 border-t border-emerald-150 flex justify-end items-center text-xs">
                  <button
                    onClick={() => setTrainingFilter(null)}
                    className="px-3 py-1 bg-white hover:bg-slate-100 border border-emerald-200 rounded-xl text-emerald-750 font-bold transition-all shadow-xs cursor-pointer text-xs"
                  >
                    Đóng giám sát
                  </button>
                </div>
              </div>
            )}

            {/* Header */}
            <div className="flex justify-between items-center text-left" id="training_header_info">
              <div>
                <h4 className="text-sm font-bold text-slate-800 font-sans tracking-wide uppercase">Cổng Học Tập & Hội Nhập iGen e-Learning</h4>
                <p className="text-xs text-gray-500 mt-1">Đào tạo nhân sự tự động, rèn luyện kỹ năng và nắm bắt hệ thống ERP</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex gap-2 text-xs font-semibold px-3 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-xl">
                  <Award className="h-4 w-4 animate-bounce text-indigo-650" />
                  <span>Hoàn tất khóa học nhận ERP Token</span>
                </div>
                {isManager && (
                  <button
                    onClick={() => setIsAddCourseModalOpen(true)}
                    id="btn_create_course"
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-650 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl cursor-pointer transition-all active:scale-95 shadow-xs"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Tạo khóa học mới
                  </button>
                )}
              </div>
            </div>

            {/* Empty state */}
            {courses.length === 0 && (
              <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-2xl">
                <div className="text-4xl mb-3">📚</div>
                <p className="text-sm font-bold text-slate-700">Chưa có khóa học nào</p>
                <p className="text-xs text-gray-400 mt-1">
                  {isManager ? 'Nhấn "Tạo khóa học mới" để thêm khóa học đầu tiên.' : 'Quản lý sẽ sớm thêm khóa học cho bạn.'}
                </p>
              </div>
            )}

            {/* Courses Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5" id="courses_grid">
              {courses.map((course) => {
                const myEnrollment = enrollments.find(e => e.courseId === course.id);
                const myProgress = myEnrollment?.progress ?? 0;
                const isCompleted = myEnrollment?.status === "completed";
                const isStarted = myEnrollment?.status === "in_progress";

                return (
                  <div key={course.id} className="p-5 bg-white border border-gray-200/70 hover:border-indigo-300 hover:shadow-md rounded-2xl transition-all flex flex-col justify-between" id={`course_card_${course.id}`}>
                    <div className="text-left">

                      {/* Card Header: Icon + Tags + Admin Actions */}
                      <div className="flex justify-between items-start gap-3">
                        <div className="flex items-center gap-3">
                          <div className="p-3 bg-slate-50 border border-gray-100 rounded-2xl text-2xl select-none flex-shrink-0">{course.icon}</div>
                          <div className="flex flex-wrap gap-1">
                            {course.isRequired && (
                              <span className="inline-flex items-center px-2 py-0.5 bg-rose-50 border border-rose-200 text-rose-700 text-[9px] font-black font-mono rounded-full uppercase tracking-widest">
                                🔴 Bắt buộc
                              </span>
                            )}
                            {(course.tags || []).filter(t => t !== 'Bắt buộc').map(tag => (
                              <span key={tag} className="inline-flex items-center px-2 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-600 text-[9px] font-bold font-mono rounded-full uppercase tracking-widest">
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                        {isManager && (
                          <button
                            onClick={() => handleDeleteCourse(course.id)}
                            className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-rose-500 transition-colors cursor-pointer p-1 rounded-lg hover:bg-rose-50 flex-shrink-0"
                            title="Xóa khóa học"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Title */}
                      <h4 className="text-sm font-bold text-slate-800 font-sans text-left mt-3.5 leading-snug">{course.title}</h4>

                      {/* Description */}
                      {course.description && (
                        <p className="text-[11px] text-gray-400 mt-1.5 leading-relaxed line-clamp-2">{course.description}</p>
                      )}

                      {/* Meta: instructor + enrolled */}
                      <div className="flex items-center gap-3 text-[11px] text-gray-500 mt-3">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-gray-400" />
                          <span>{course.duration}</span>
                        </div>
                        <span className="text-gray-200">|</span>
                        <div className="flex items-center gap-1">
                          <Users className="w-3 h-3 text-gray-400" />
                          <span><strong className="text-slate-700">{course.enrolledCount}</strong> nhân viên đang học</span>
                        </div>
                      </div>
                    </div>

                    {/* Progress Section */}
                    <div className="mt-5 border-t border-gray-100 pt-4 text-left">
                      {/* Company average progress */}
                      <div className="mb-3">
                        <div className="flex items-center justify-between text-[10px] mb-1">
                          <span className="font-mono text-gray-400 font-medium">Tiến độ trung bình toàn công ty:</span>
                          <span className="font-bold text-slate-600 font-mono">{course.companyProgress ?? 0}%</span>
                        </div>
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-indigo-200 transition-all duration-500"
                            style={{ width: `${course.companyProgress ?? 0}%` }}
                          />
                        </div>
                      </div>

                      {/* My personal progress */}
                      <div className="mb-4">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-mono text-gray-500 font-medium">Tiến độ của bạn:</span>
                          <span className="font-bold text-slate-700 font-mono">{myProgress}%</span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-500 ${isCompleted ? 'bg-emerald-500' : 'bg-indigo-650'}`}
                            style={{ width: `${myProgress}%` }}
                          />
                        </div>
                      </div>

                      {/* Action row */}
                      <div className="flex justify-between items-center text-xs">
                        {isCompleted ? (
                          <span className="text-emerald-600 font-bold flex items-center gap-1">
                            <CheckCircle className="h-4 w-4" />
                            Đã hoàn thành
                          </span>
                        ) : (
                          <span className="text-gray-400 font-mono text-[10px]">{isStarted ? `Đang học • ${myProgress}%` : 'ERP Token: 15 đ'}</span>
                        )}
                        <button
                          onClick={() => handleEnrollAndStart(course)}
                          disabled={isCompleted}
                          id={`btn_study_${course.id}`}
                          className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${isCompleted
                              ? 'bg-slate-100 text-slate-400 cursor-not-allowed border'
                              : 'bg-indigo-650 hover:bg-indigo-700 text-white active:scale-95 shadow-2xs'
                            }`}
                        >
                          {!myEnrollment ? 'Bắt đầu học' : isCompleted ? 'Xem văn bằng' : 'Học tiếp bài sau'}
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

      {/* Notion-style Task Detail Modal */}
      {selectedKanbanTask && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-2xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-gray-200 text-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl p-8 relative text-left flex flex-col max-h-[90vh] overflow-y-auto font-sans">

            {/* Top Breadcrumb and Close */}
            <div className="flex justify-between items-center mb-6 text-[11px] text-gray-450 font-semibold uppercase tracking-wider select-none">
              <div className="flex items-center gap-1">
                <span className="text-gray-500">Nhân sự</span>
                <ChevronRight className="h-3 w-3 text-gray-450" />
                <span className="text-gray-500">Kanban</span>
                <ChevronRight className="h-3 w-3 text-gray-450" />
                <span className="text-indigo-650">{editCategory || "Onboarding"}</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedKanbanTask(null)}
                className="p-1.5 hover:bg-slate-50 rounded-lg text-gray-400 hover:text-slate-800 transition-colors cursor-pointer"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            {/* Notion-style Title Input */}
            <div className="mb-6">
              <input
                type="text"
                placeholder="Không có tiêu đề"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full text-2xl font-bold text-slate-800 placeholder-gray-300 border-none outline-none focus:ring-0 p-0 bg-transparent font-sans"
              />
            </div>

            {/* Notion-style Properties Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3.5 mb-8 pb-6 border-b border-gray-150 text-xs">

              {/* Project Property */}
              <div className="flex items-center">
                <div className="w-28 flex items-center gap-2 text-gray-500 font-medium select-none font-sans">
                  <Target className="h-3.5 w-3.5 text-gray-400" />
                  <span>Dự án</span>
                </div>
                <div className="flex-1">
                  <select
                    value={editProjectId}
                    onChange={(e) => setEditProjectId(e.target.value)}
                    className="w-full px-2 py-1 bg-transparent hover:bg-slate-50 border border-transparent hover:border-gray-200 outline-none focus:bg-slate-50 focus:border-gray-200 rounded-lg text-slate-800 font-semibold cursor-pointer transition-all font-sans"
                  >
                    <option value="" className="bg-white text-slate-650">Không phân loại dự án</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id} className="bg-white text-slate-850">
                        🎯 {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Status Property */}
              <div className="flex items-center">
                <div className="w-28 flex items-center gap-2 text-gray-500 font-medium select-none font-sans">
                  <Activity className="h-3.5 w-3.5 text-gray-400" />
                  <span>Trạng thái</span>
                </div>
                <div className="flex-1">
                  <select
                    value={editStatus}
                    onChange={(e: any) => setEditStatus(e.target.value)}
                    className="w-full px-2 py-1 bg-transparent hover:bg-slate-50 border border-transparent hover:border-gray-200 outline-none focus:bg-slate-50 focus:border-gray-200 rounded-lg text-slate-800 font-semibold cursor-pointer transition-all font-sans"
                  >
                    <option value="Not Started" className="bg-white text-slate-850">⚪ Not Started</option>
                    <option value="In Progress" className="bg-white text-slate-850">🔵 In Progress</option>
                    <option value="Review/Testing" className="bg-white text-slate-850">🟡 Review/Testing</option>
                    <option value="Done" className="bg-white text-slate-850">🟢 Done</option>
                    <option value="Archived" className="bg-white text-slate-850">⚫ Archived</option>
                  </select>
                </div>
              </div>

              {/* Assignee Property */}
              <div className="flex items-center">
                <div className="w-28 flex items-center gap-2 text-gray-500 font-medium select-none font-sans">
                  <User className="h-3.5 w-3.5 text-gray-400" />
                  <span>Giao cho</span>
                </div>
                <div className="flex-1">
                  <select
                    value={editAssigneeUid}
                    onChange={(e) => setEditAssigneeUid(e.target.value)}
                    className="w-full px-2 py-1 bg-transparent hover:bg-slate-50 border border-transparent hover:border-gray-200 outline-none focus:bg-slate-50 focus:border-gray-200 rounded-lg text-slate-800 font-semibold cursor-pointer transition-all font-sans"
                  >
                    <option value="" className="bg-white text-slate-655">— Chưa chọn —</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id} className="bg-white text-slate-855">
                        {emp.name} ({emp.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Due Date Property */}
              <div className="flex items-center">
                <div className="w-28 flex items-center gap-2 text-gray-500 font-medium select-none font-sans">
                  <Calendar className="h-3.5 w-3.5 text-gray-400" />
                  <span>Hạn hoàn thành</span>
                </div>
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="Ví dụ: Hôm nay"
                    value={editDueDate}
                    onChange={(e) => setEditDueDate(e.target.value)}
                    className="w-full px-2 py-1 bg-transparent hover:bg-slate-50 border border-transparent hover:border-gray-200 outline-none focus:bg-slate-50 focus:border-gray-200 rounded-lg text-slate-800 font-semibold transition-all font-sans"
                  />
                </div>
              </div>

              {/* Start Time Property */}
              <div className="flex items-center">
                <div className="w-28 flex items-center gap-2 text-gray-500 font-medium select-none font-sans">
                  <Calendar className="h-3.5 w-3.5 text-gray-400" />
                  <span>TG Bắt đầu</span>
                </div>
                <div className="flex-1">
                  <input
                    type="datetime-local"
                    value={editStartTime}
                    onChange={(e) => setEditStartTime(e.target.value)}
                    className="w-full px-2 py-1 bg-transparent hover:bg-slate-50 border border-transparent hover:border-gray-200 outline-none focus:bg-slate-50 focus:border-gray-200 rounded-lg text-slate-800 font-semibold transition-all font-sans"
                  />
                </div>
              </div>

              {/* End Time Property */}
              <div className="flex items-center">
                <div className="w-28 flex items-center gap-2 text-gray-500 font-medium select-none font-sans">
                  <Calendar className="h-3.5 w-3.5 text-gray-400" />
                  <span>TG Kết thúc</span>
                </div>
                <div className="flex-1">
                  <input
                    type="datetime-local"
                    value={editEndTime}
                    onChange={(e) => setEditEndTime(e.target.value)}
                    className="w-full px-2 py-1 bg-transparent hover:bg-slate-50 border border-transparent hover:border-gray-200 outline-none focus:bg-slate-50 focus:border-gray-200 rounded-lg text-slate-800 font-semibold transition-all font-sans"
                  />
                </div>
              </div>

              {/* Est Time Property */}
              <div className="flex items-center">
                <div className="w-28 flex items-center gap-2 text-gray-500 font-medium select-none font-sans">
                  <Clock className="h-3.5 w-3.5 text-gray-400" />
                  <span>Giờ dự tính (h)</span>
                </div>
                <div className="flex-1">
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={editEstTime}
                    onChange={(e) => setEditEstTime(e.target.value === "" ? "" : Number(e.target.value))}
                    className="w-full px-2 py-1 bg-transparent hover:bg-slate-50 border border-transparent hover:border-gray-200 outline-none focus:bg-slate-50 focus:border-gray-200 rounded-lg text-slate-800 font-semibold transition-all font-sans"
                  />
                </div>
              </div>

              {/* Actual Time Property */}
              <div className="flex items-center">
                <div className="w-28 flex items-center gap-2 text-gray-500 font-medium select-none font-sans">
                  <Clock className="h-3.5 w-3.5 text-gray-400" />
                  <span>Giờ thực tế (h)</span>
                </div>
                <div className="flex-1">
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={editActualTime}
                    onChange={(e) => setEditActualTime(e.target.value === "" ? "" : Number(e.target.value))}
                    className="w-full px-2 py-1 bg-transparent hover:bg-slate-50 border border-transparent hover:border-gray-200 outline-none focus:bg-slate-50 focus:border-gray-200 rounded-lg text-slate-800 font-semibold transition-all font-sans"
                  />
                </div>
              </div>

              {/* Priority Property */}
              <div className="flex items-center">
                <div className="w-28 flex items-center gap-2 text-gray-500 font-medium select-none font-sans">
                  <AlertCircle className="h-3.5 w-3.5 text-gray-400" />
                  <span>Độ ưu tiên</span>
                </div>
                <div className="flex-1">
                  <select
                    value={editPriority}
                    onChange={(e: any) => setEditPriority(e.target.value)}
                    className="w-full px-2 py-1 bg-transparent hover:bg-slate-50 border border-transparent hover:border-gray-200 outline-none focus:bg-slate-50 focus:border-gray-200 rounded-lg text-slate-800 font-semibold cursor-pointer transition-all font-sans"
                  >
                    <option value="High" className="bg-white text-slate-850">Cao</option>
                    <option value="Medium" className="bg-white text-slate-850">Trung bình</option>
                    <option value="Low" className="bg-white text-slate-850">Thấp</option>
                  </select>
                </div>
              </div>

              {/* Category Property */}
              <div className="flex items-center">
                <div className="w-28 flex items-center gap-2 text-gray-500 font-medium select-none font-sans">
                  <Tag className="h-3.5 w-3.5 text-gray-400" />
                  <span>Phân loại</span>
                </div>
                <div className="flex-1">
                  <select
                    value={editCategory}
                    onChange={(e: any) => setEditCategory(e.target.value)}
                    className="w-full px-2 py-1 bg-transparent hover:bg-slate-50 border border-transparent hover:border-gray-200 outline-none focus:bg-slate-50 focus:border-gray-200 rounded-lg text-slate-800 font-semibold cursor-pointer transition-all font-sans"
                  >
                    <option value="Onboarding" className="bg-white text-slate-855">Onboarding</option>
                    <option value="Đào tạo" className="bg-white text-slate-855">Đào tạo</option>
                    <option value="Tuyển dụng" className="bg-white text-slate-855">Tuyển dụng</option>
                    <option value="Văn hóa" className="bg-white text-slate-855">Văn hóa</option>
                  </select>
                </div>
              </div>

              {/* Tags Property */}
              <div className="flex items-center">
                <div className="w-28 flex items-center gap-2 text-gray-500 font-medium select-none font-sans">
                  <Tag className="h-3.5 w-3.5 text-gray-400" />
                  <span>Thẻ (Tags)</span>
                </div>
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="Phân cách bằng dấu phẩy (,)"
                    value={editTags}
                    onChange={(e) => setEditTags(e.target.value)}
                    className="w-full px-2 py-1 bg-transparent hover:bg-slate-50 border border-transparent hover:border-gray-200 outline-none focus:bg-slate-50 focus:border-gray-200 rounded-lg text-slate-800 font-semibold transition-all font-sans"
                  />
                </div>
              </div>

              {/* Link Note Property */}
              <div className="flex items-center">
                <div className="w-28 flex items-center gap-2 text-gray-500 font-medium select-none font-sans">
                  <ExternalLink className="h-3.5 w-3.5 text-gray-400" />
                  <span>Link ghi chú</span>
                </div>
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="https://..."
                    value={editLinkNote}
                    onChange={(e) => setEditLinkNote(e.target.value)}
                    className="w-full px-2 py-1 bg-transparent hover:bg-slate-50 border border-transparent hover:border-gray-200 outline-none focus:bg-slate-50 focus:border-gray-200 rounded-lg text-indigo-650 font-semibold transition-all font-sans placeholder-gray-300"
                  />
                </div>
              </div>

              {/* Creator Property */}
              <div className="flex items-center">
                <div className="w-28 flex items-center gap-2 text-gray-500 font-medium select-none font-sans">
                  <UserPlus className="h-3.5 w-3.5 text-gray-400" />
                  <span>Người giao</span>
                </div>
                <div className="flex-1 px-2 py-1 text-gray-500 font-semibold select-none font-sans">
                  {selectedKanbanTask.id === "new" ? (
                    <span>{userProfile?.displayName || userProfile?.email || "iGen Admin"} (Bạn)</span>
                  ) : (
                    <span>
                      {usersList.find(u => u.uid === selectedKanbanTask.creatorUid)?.displayName ||
                        usersList.find(u => u.uid === selectedKanbanTask.creatorUid)?.email ||
                        selectedKanbanTask.creatorUid ||
                        "iGen Admin"}
                    </span>
                  )}
                </div>
              </div>

            </div>

            {/* Notion-style Description Title */}
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 select-none font-sans">Mô tả chi tiết</div>

            {/* Notion-style Document Description Editor */}
            <div className="flex-1 min-h-[120px] mb-6 border border-gray-200 hover:border-gray-300 p-3 rounded-xl bg-slate-50/40">
              <textarea
                placeholder="Viết mô tả hoặc ghi chú cho công việc này..."
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="w-full h-full min-h-[120px] p-0 border-none outline-none focus:ring-0 text-slate-700 bg-transparent resize-none text-xs font-sans placeholder-gray-400 leading-relaxed"
              />
            </div>

            {/* Timeline Edit History logs */}
            <div className="mt-6 pt-6 border-t border-gray-150">
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 select-none font-sans flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-gray-400" />
                Lịch sử chỉnh sửa
              </div>
              <div className="space-y-3 max-h-[150px] overflow-y-auto pr-2">
                {taskHistory.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">Chưa có lịch sử ghi chép.</p>
                ) : (
                  taskHistory.map((h, idx) => (
                    <div key={idx} className="flex gap-3 text-[11px] leading-relaxed font-sans">
                      <span className="text-gray-400 shrink-0 select-none">{h.time}</span>
                      <span className="text-slate-750 font-bold shrink-0">{h.user}:</span>
                      <span className="text-slate-600">{h.action}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex justify-end gap-3.5 pt-6 mt-6 border-t border-gray-150 text-xs font-bold">
              <button
                type="button"
                onClick={() => setSelectedKanbanTask(null)}
                className="px-4 py-2 border border-gray-200 text-slate-500 hover:text-slate-800 rounded-xl bg-white hover:bg-slate-50 cursor-pointer transition-all active:scale-95 font-sans"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={(e) => handleSaveTask(e)}
                className="px-5 py-2 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl shadow-xs cursor-pointer transition-all active:scale-95 font-sans"
              >
                {selectedKanbanTask.id === "new" ? "Tạo công việc" : "Lưu thay đổi"}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Modal Tạo Khóa Học Mới */}
      {isAddCourseModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-2xs flex items-center justify-center z-50 p-4">
          <form onSubmit={handleCreateCourse} className="bg-white border border-gray-200 rounded-2xl shadow-xl w-full max-w-lg p-6 relative text-left space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-gray-150">
              <h4 className="font-bold text-slate-800 text-sm font-sans uppercase flex items-center gap-2">
                <Award className="h-4 w-4 text-indigo-655" />
                Tạo Khóa Học Mới
              </h4>
              <button type="button" onClick={() => setIsAddCourseModalOpen(false)} className="text-gray-400 hover:text-slate-800 cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-gray-500 mb-1.5 font-sans">Tên khóa học *</label>
                <input
                  type="text" required
                  placeholder="Ví dụ: Văn hóa Doanh nghiệp iGen"
                  value={courseFormTitle}
                  onChange={(e) => setCourseFormTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 text-slate-800 placeholder-gray-300 hover:border-gray-300 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-50 rounded-xl font-sans"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-500 mb-1.5 font-sans">Mô tả ngắn</label>
                <textarea
                  rows={2}
                  placeholder="Mô tả nội dung và mục tiêu khóa học..."
                  value={courseFormDesc}
                  onChange={(e) => setCourseFormDesc(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 text-slate-800 placeholder-gray-300 hover:border-gray-300 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-50 rounded-xl font-sans resize-none"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-500 mb-1.5 font-sans">Danh mục</label>
                <select
                  value={courseFormCategory}
                  onChange={(e) => setCourseFormCategory(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white border border-gray-200 text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-50 rounded-xl font-sans cursor-pointer"
                >
                  <option>Văn hóa</option>
                  <option>Onboarding</option>
                  <option>Kỹ năng mềm</option>
                  <option>Nghiệp vụ</option>
                  <option>Công cụ AI</option>
                  <option>Sales CRM</option>
                  <option>ERP System</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-500 mb-1.5 font-sans">Giảng viên</label>
                  <div className="w-full px-3.5 py-2.5 bg-slate-50 border border-gray-200 text-slate-600 rounded-xl font-sans text-xs flex items-center gap-1.5">
                    <span className="text-sm">👤</span>
                    <span className="font-semibold">{userProfile?.displayName || userProfile?.email || 'Bạn'}</span>
                  </div>
                </div>
                <div>
                  <label className="block font-bold text-gray-500 mb-1.5 font-sans">Thời lượng</label>
                  <input
                    type="text"
                    placeholder="Ví dụ: 2 giờ (6 bài học)"
                    value={courseFormDuration}
                    onChange={(e) => setCourseFormDuration(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-gray-200 text-slate-800 placeholder-gray-300 hover:border-gray-300 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-50 rounded-xl font-sans"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2.5 pt-1">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={courseFormIsRequired}
                    onChange={(e) => setCourseFormIsRequired(e.target.checked)}
                    className="w-4 h-4 accent-rose-600 rounded cursor-pointer"
                  />
                  <span className="text-xs font-semibold text-slate-700">
                    🔴 Khóa học <strong>Bắt buộc</strong> (hiển thị nhãn đỏ)
                  </span>
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={courseFormAutoOnboarding}
                    onChange={(e) => setCourseFormAutoOnboarding(e.target.checked)}
                    className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                  />
                  <span className="text-xs font-semibold text-slate-700">
                    🔄 Tự động gán cho <strong>nhân viên mới</strong> + tạo Kanban task
                  </span>
                </label>
              </div>
              {/* Dynamic Lessons Creator */}
              <div className="border-t border-gray-100 pt-3.5 space-y-2">
                <div className="flex justify-between items-center">
                  <label className="block font-bold text-gray-500 font-sans flex items-center gap-1">
                    <span>📚 Bài học ({courseFormLessons.length})</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setCourseFormLessons(prev => [...prev, { title: "", url: "", type: "youtube" }])}
                    className="px-2 py-1 bg-indigo-50 text-indigo-650 hover:bg-indigo-100 rounded-lg font-bold text-[10px] flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                  >
                    <Plus className="h-3 w-3" />
                    Thêm bài học
                  </button>
                </div>
                {courseFormLessons.map((les, index) => (
                  <div key={index} className="p-3 bg-slate-50 rounded-xl space-y-2 border border-gray-150 relative">
                    <button
                      type="button"
                      onClick={() => setCourseFormLessons(prev => prev.filter((_, idx) => idx !== index))}
                      className="absolute top-2 right-2 text-gray-400 hover:text-rose-500 cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-2">
                        <input
                          type="text"
                          required
                          placeholder="Tên bài học (ví dụ: Giới thiệu văn hóa)"
                          value={les.title}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCourseFormLessons(prev => prev.map((l, idx) => idx === index ? { ...l, title: val } : l));
                          }}
                          className="w-full px-2.5 py-1.5 bg-white border border-gray-200 text-slate-800 rounded-lg text-xs"
                        />
                      </div>
                      <div>
                        <select
                          value={les.type}
                          onChange={(e) => {
                            const val = e.target.value as any;
                            setCourseFormLessons(prev => prev.map((l, idx) => idx === index ? { ...l, type: val } : l));
                          }}
                          className="w-full px-2 py-1.5 bg-white border border-gray-200 text-slate-800 rounded-lg text-xs cursor-pointer"
                        >
                          <option value="youtube">YouTube</option>
                          <option value="document">Tài liệu</option>
                          <option value="other">Khác</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <input
                        type="text"
                        required
                        placeholder="Link (ví dụ: https://youtube.com/watch?v=... hoặc link tài liệu)"
                        value={les.url}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCourseFormLessons(prev => prev.map((l, idx) => idx === index ? { ...l, url: val } : l));
                        }}
                        className="w-full px-2.5 py-1.5 bg-white border border-gray-200 text-slate-800 rounded-lg text-xs"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Dynamic Quizzes Creator */}
              <div className="border-t border-gray-100 pt-3.5 space-y-2">
                <div className="flex justify-between items-center">
                  <label className="block font-bold text-gray-500 font-sans flex items-center gap-1">
                    <span>📝 Câu hỏi trắc nghiệm ({courseFormQuizzes.length})</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setCourseFormQuizzes(prev => [...prev, { question: "", options: ["", "", "", ""], correctOptionIndex: 0 }])}
                    className="px-2 py-1 bg-indigo-50 text-indigo-650 hover:bg-indigo-100 rounded-lg font-bold text-[10px] flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                  >
                    <Plus className="h-3 w-3" />
                    Thêm câu hỏi
                  </button>
                </div>
                {courseFormQuizzes.map((quiz, qIdx) => (
                  <div key={qIdx} className="p-3 bg-slate-50 rounded-xl space-y-2.5 border border-gray-150 relative">
                    <button
                      type="button"
                      onClick={() => setCourseFormQuizzes(prev => prev.filter((_, idx) => idx !== qIdx))}
                      className="absolute top-2 right-2 text-gray-400 hover:text-rose-500 cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                    <div>
                      <input
                        type="text"
                        required
                        placeholder="Câu hỏi (ví dụ: Sứ mệnh của iGen là gì?)"
                        value={quiz.question}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCourseFormQuizzes(prev => prev.map((q, idx) => idx === qIdx ? { ...q, question: val } : q));
                        }}
                        className="w-full px-2.5 py-1.5 bg-white border border-gray-200 text-slate-800 rounded-lg text-xs font-semibold"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      {quiz.options.map((opt, oIdx) => (
                        <div key={oIdx} className="flex items-center gap-1">
                          <span className="font-bold text-gray-400">{String.fromCharCode(65 + oIdx)}.</span>
                          <input
                            type="text"
                            required
                            placeholder={`Đáp án ${String.fromCharCode(65 + oIdx)}`}
                            value={opt}
                            onChange={(e) => {
                              const val = e.target.value;
                              setCourseFormQuizzes(prev => prev.map((q, idx) => idx === qIdx ? {
                                ...q,
                                options: q.options.map((o, oi) => oi === oIdx ? val : o)
                              } : q));
                            }}
                            className="w-full px-2 py-1 bg-white border border-gray-200 text-slate-800 rounded-lg"
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-bold text-gray-450 font-sans">Đáp án đúng:</span>
                      <select
                        value={quiz.correctOptionIndex}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          setCourseFormQuizzes(prev => prev.map((q, idx) => idx === qIdx ? { ...q, correctOptionIndex: val } : q));
                        }}
                        className="px-2 py-1 bg-white border border-gray-200 text-slate-800 rounded-lg font-bold"
                      >
                        <option value={0}>A</option>
                        <option value={1}>B</option>
                        <option value={2}>C</option>
                        <option value={3}>D</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-gray-150 flex justify-end gap-3 text-xs font-bold">
              <button
                type="button"
                onClick={() => setIsAddCourseModalOpen(false)}
                className="px-4 py-2 border border-gray-200 text-slate-500 hover:text-slate-800 rounded-xl bg-white hover:bg-slate-50 cursor-pointer transition-all active:scale-95 font-sans"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl cursor-pointer transition-all active:scale-95 font-sans"
              >
                Tạo khóa học
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Course Player Modal */}
      {activeStudyCourse && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white text-slate-800 w-full h-full sm:h-[90vh] sm:max-w-5xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden font-sans">

            {/* Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-150 flex-shrink-0 bg-indigo-950 text-white">
              <div className="text-left">
                <span className="px-2 py-0.5 bg-indigo-800 text-indigo-100 rounded text-[9px] font-mono font-bold uppercase tracking-wider">
                  {activeStudyCourse.category}
                </span>
                <h4 className="font-bold text-sm sm:text-base font-sans leading-tight mt-1">
                  {activeStudyCourse.title}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveStudyCourse(null);
                  if (userProfile?.companyCode) fetchCourses(userProfile.companyCode);
                }}
                className="p-1.5 hover:bg-white/10 rounded-lg text-gray-300 hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Split Screen Layout */}
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">

              {/* Left Sidebar - Lesson Navigation */}
              <div className="w-full md:w-80 border-r border-gray-150 flex flex-col overflow-y-auto bg-slate-50 flex-shrink-0 text-left">
                <div className="p-4 border-b border-gray-150 bg-slate-100/50">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-mono text-gray-500 font-bold">Tiến độ bài học:</span>
                    <span className="font-bold text-indigo-650 font-mono">
                      {enrollments.find(e => e.courseId === activeStudyCourse.id)?.progress ?? 0}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-600 transition-all duration-500"
                      style={{ width: `${enrollments.find(e => e.courseId === activeStudyCourse.id)?.progress ?? 0}%` }}
                    />
                  </div>
                </div>

                <div className="divide-y divide-gray-150/60 flex-1">

                  {/* Introduction Item */}
                  <button
                    type="button"
                    onClick={() => setActiveLessonIndex(-1)}
                    className={`w-full p-4 flex items-start gap-3 transition-colors text-left ${activeLessonIndex === -1 ? "bg-white border-l-4 border-indigo-600 font-bold" : "hover:bg-slate-100/80"
                      }`}
                  >
                    <BookOpen className="h-4.5 w-4.5 text-gray-400 mt-0.5 shrink-0" />
                    <div className="text-xs">
                      <h6 className="text-slate-800">Giới thiệu khóa học</h6>
                      <p className="text-[10px] text-gray-400 mt-0.5 font-medium">Tổng quan & mục tiêu</p>
                    </div>
                  </button>

                  {/* Lessons List */}
                  {(() => {
                    const myEnroll = enrollments.find(e => e.courseId === activeStudyCourse.id);
                    const completedLessons = myEnroll?.completedLessons || [];
                    const lessons = activeStudyCourse.lessons || [];

                    let currentUncompletedIdx = 0;
                    for (let i = 0; i < lessons.length; i++) {
                      if (!completedLessons.includes(`lesson_${i}`)) {
                        currentUncompletedIdx = i;
                        break;
                      }
                      if (i === lessons.length - 1) {
                        currentUncompletedIdx = lessons.length;
                      }
                    }

                    return (
                      <>
                        {lessons.map((les, index) => {
                          const isCompleted = completedLessons.includes(`lesson_${index}`);
                          const isActive = activeLessonIndex === index;
                          const isUnlocked = index <= currentUncompletedIdx;

                          return (
                            <button
                              key={index}
                              type="button"
                              disabled={!isUnlocked}
                              onClick={() => setActiveLessonIndex(index)}
                              className={`w-full p-4 flex items-start gap-3 transition-colors text-left ${isActive
                                  ? "bg-white border-l-4 border-indigo-600 font-bold"
                                  : isUnlocked
                                    ? "hover:bg-slate-100/80"
                                    : "opacity-50 cursor-not-allowed"
                                }`}
                            >
                              {isCompleted ? (
                                <CheckCircle className="h-4.5 w-4.5 text-emerald-500 mt-0.5 shrink-0" />
                              ) : (
                                <div className="w-4.5 h-4.5 border-2 border-gray-300 rounded-full flex items-center justify-center text-[9px] font-mono text-gray-400 font-bold mt-0.5 shrink-0">
                                  {index + 1}
                                </div>
                              )}
                              <div className="text-xs">
                                <h6 className="text-slate-800 line-clamp-2">{les.title || `Bài học ${index + 1}`}</h6>
                                <p className="text-[10px] text-gray-400 mt-0.5 font-mono capitalize">
                                  {les.type === "youtube" ? "🎥 Video YouTube" : "📄 Tài liệu đọc"}
                                </p>
                              </div>
                            </button>
                          );
                        })}

                        {/* Quiz Item (if course has quizzes) */}
                        {activeStudyCourse.quizzes && activeStudyCourse.quizzes.length > 0 && (() => {
                          const isQuizUnlocked = currentUncompletedIdx === lessons.length;

                          return (
                            <button
                              type="button"
                              disabled={!isQuizUnlocked}
                              onClick={() => setActiveLessonIndex(lessons.length)}
                              className={`w-full p-4 flex items-start gap-3 transition-colors text-left ${activeLessonIndex === lessons.length
                                  ? "bg-white border-l-4 border-indigo-600 font-bold"
                                  : isQuizUnlocked
                                    ? "hover:bg-slate-100/80"
                                    : "opacity-50 cursor-not-allowed"
                                }`}
                            >
                              {myEnroll?.quizPassed ? (
                                <Award className="h-4.5 w-4.5 text-amber-500 mt-0.5 shrink-0" />
                              ) : (
                                <Activity className="h-4.5 w-4.5 text-gray-400 mt-0.5 shrink-0" />
                              )}
                              <div className="text-xs">
                                <h6 className="text-slate-800">Bài kiểm tra trắc nghiệm</h6>
                                <p className="text-[10px] text-gray-400 mt-0.5 font-medium">
                                  {activeStudyCourse.quizzes.length} câu hỏi trắc nghiệm
                                </p>
                              </div>
                            </button>
                          );
                        })()}
                      </>
                    );
                  })()}

                </div>
              </div>

              {/* Right Main Panel - Player Area */}
              <div className="flex-1 flex flex-col overflow-y-auto p-6 text-left">

                {/* 1. Intro Panel */}
                {activeLessonIndex === -1 && (
                  <div className="space-y-4 max-w-2xl">
                    <h3 className="text-lg font-bold text-slate-800">Chào mừng bạn đến với khóa học</h3>
                    <p className="text-xs text-slate-650 leading-relaxed whitespace-pre-wrap">
                      {activeStudyCourse.description || "Khóa học này hiện chưa cập nhật mô tả chi tiết."}
                    </p>
                    <div className="p-4 bg-indigo-50 border border-indigo-150 rounded-xl space-y-2 text-xs">
                      <h5 className="font-bold text-indigo-855 flex items-center gap-1.5">
                        <Award className="h-4 w-4 text-indigo-700 animate-pulse" />
                        Thông tin tổng quan:
                      </h5>
                      <ul className="space-y-1 text-slate-650 list-disc list-inside pl-1">
                        <li>Thời lượng ước tính: <strong className="text-slate-700">{activeStudyCourse.duration}</strong></li>
                        <li>Số bài học: <strong className="text-slate-700">{activeStudyCourse.lessons?.length ?? 0} bài học</strong></li>
                        <li>Mã môn học: <strong className="text-slate-700 font-mono">{activeStudyCourse.id}</strong></li>
                        <li>Giảng viên hướng dẫn: <strong className="text-slate-700">{activeStudyCourse.instructor}</strong></li>
                      </ul>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (activeStudyCourse.lessons && activeStudyCourse.lessons.length > 0) {
                          setActiveLessonIndex(0);
                        } else if (activeStudyCourse.quizzes && activeStudyCourse.quizzes.length > 0) {
                          setActiveLessonIndex(0);
                        } else {
                          handleCompleteCourseDirectly();
                        }
                      }}
                      className="px-5 py-2.5 bg-indigo-650 hover:bg-indigo-700 active:scale-95 text-white font-bold rounded-xl text-xs shadow-xs transition-all cursor-pointer"
                    >
                      Bắt đầu học ngay →
                    </button>
                  </div>
                )}

                {/* 2. Lesson Player Panel */}
                {activeLessonIndex >= 0 && activeLessonIndex < (activeStudyCourse.lessons?.length ?? 0) && (() => {
                  const les = activeStudyCourse.lessons?.[activeLessonIndex];
                  if (!les) return null;
                  const isCompleted = enrollments.find(e => e.courseId === activeStudyCourse.id)?.completedLessons?.includes(`lesson_${activeLessonIndex}`);

                  // Extract YouTube ID if valid
                  let youtubeId: string | null = null;
                  if (les.type === "youtube") {
                    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
                    const match = les.url.match(regExp);
                    if (match && match[2].length === 11) {
                      youtubeId = match[2];
                    }
                  }

                  return (
                    <div className="space-y-5 flex-1 flex flex-col">
                      <div className="flex justify-between items-center gap-4">
                        <h3 className="text-base font-bold text-slate-800">
                          Bài {activeLessonIndex + 1}: {les.title}
                        </h3>
                        {isCompleted && (
                          <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-[10px] font-bold flex items-center gap-1">
                            <CheckCircle className="h-3.5 w-3.5" />
                            Đã học xong
                          </span>
                        )}
                      </div>

                      {/* YouTube Player */}
                      {les.type === "youtube" && youtubeId && (
                        <div className="w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-md border border-gray-200">
                          <iframe
                            className="w-full h-full"
                            src={`https://www.youtube.com/embed/${youtubeId}?rel=0`}
                            title={les.title}
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowFullScreen
                          />
                        </div>
                      )}

                      {/* Document Viewer / External Link */}
                      {les.type === "document" && (
                        <div className="p-8 bg-slate-50 border-2 border-dashed border-gray-200 rounded-2xl text-center space-y-4 max-w-xl self-center w-full my-auto">
                          <div className="text-4xl">📄</div>
                          <div>
                            <h5 className="font-bold text-slate-700 text-xs">Tài liệu học tập đính kèm</h5>
                            <p className="text-[11px] text-gray-400 mt-1">Vui lòng nhấp vào nút bên dưới để mở tài liệu nghiên cứu chi tiết bài học này.</p>
                          </div>
                          <a
                            href={les.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs active:scale-95 transition-all"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Mở tài liệu đọc
                          </a>
                        </div>
                      )}

                      {/* Other URL */}
                      {les.type === "other" && (
                        <div className="p-8 bg-slate-50 border-2 border-dashed border-gray-200 rounded-2xl text-center space-y-4 max-w-xl self-center w-full my-auto">
                          <div className="text-4xl">🔗</div>
                          <div>
                            <h5 className="font-bold text-slate-700 text-xs">Liên kết học tập bên ngoài</h5>
                            <p className="text-[11px] text-gray-400 mt-1">Truy cập đường dẫn bên dưới để tìm hiểu và hoàn thành phần học này.</p>
                          </div>
                          <a
                            href={les.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs active:scale-95 transition-all"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Truy cập liên kết
                          </a>
                        </div>
                      )}

                      {/* Complete Lesson Action */}
                      <div className="pt-4 border-t border-gray-150 flex justify-between items-center mt-auto">
                        <button
                          type="button"
                          disabled={activeLessonIndex === 0}
                          onClick={() => setActiveLessonIndex(prev => prev - 1)}
                          className="px-4 py-2 border border-gray-200 text-slate-500 hover:text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-xs font-bold bg-white hover:bg-slate-50 transition-all cursor-pointer font-sans"
                        >
                          ← Bài trước
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMarkLessonComplete(les, activeLessonIndex)}
                          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-xl text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer font-sans"
                        >
                          <CheckCircle className="h-4 w-4" />
                          {activeLessonIndex === (activeStudyCourse.lessons?.length ?? 0) - 1 ? "Hoàn thành" : "Hoàn thành bài & Tiếp tục →"}
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* 3. Quiz Player Panel */}
                {activeLessonIndex === (activeStudyCourse.lessons?.length ?? 0) && activeStudyCourse.quizzes && activeStudyCourse.quizzes.length > 0 && (() => {
                  const enroll = enrollments.find(e => e.courseId === activeStudyCourse.id);
                  const isQuizPassed = enroll?.quizPassed;

                  return (
                    <div className="space-y-5 flex-1 flex flex-col">
                      <div className="flex justify-between items-center gap-4">
                        <h3 className="text-base font-bold text-slate-800">
                          Bài thi trắc nghiệm đánh giá năng lực
                        </h3>
                        {isQuizPassed && (
                          <span className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-[10px] font-bold flex items-center gap-1">
                            <Award className="h-3.5 w-3.5" />
                            Đã vượt qua bài thi
                          </span>
                        )}
                      </div>

                      {quizSubmitted && !isQuizPassed && !isQuizEvaluating && (
                        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold">
                          ⚠️ Rất tiếc, bạn đã chọn sai đáp án. Vui lòng kiểm tra lại các câu đánh dấu đỏ và làm lại bài thi.
                        </div>
                      )}

                      <div className="space-y-6 flex-1 pr-2">
                        {activeStudyCourse.quizzes.map((quiz, qIdx) => {
                          const selectedOpt = quizAnswers[qIdx];
                          const isCorrect = selectedOpt === quiz.correctOptionIndex;
                          const showErr = quizSubmitted && !isCorrect;

                          return (
                            <div key={qIdx} className={`p-4 rounded-xl border transition-all ${showErr ? "bg-rose-50/40 border-rose-200" : isQuizPassed ? "bg-emerald-50/10 border-emerald-150" : "bg-slate-50/50 border-gray-150"
                              }`}>
                              <h5 className="font-bold text-xs text-slate-800 flex items-start gap-1.5 leading-snug">
                                <span className="text-indigo-650 shrink-0 font-mono">Câu {qIdx + 1}:</span>
                                <span>{quiz.question}</span>
                              </h5>
                              <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                                {quiz.options.map((opt, oIdx) => {
                                  const isChecked = selectedOpt === oIdx;

                                  return (
                                    <label
                                      key={oIdx}
                                      className={`flex items-start gap-2.5 p-2.5 border rounded-xl cursor-pointer transition-all select-none hover:bg-white ${isChecked
                                          ? "border-indigo-500 bg-indigo-50/20 font-semibold text-indigo-750"
                                          : "border-gray-200 bg-white"
                                        }`}
                                    >
                                      <input
                                        type="radio"
                                        name={`quiz_q_${qIdx}`}
                                        disabled={isQuizPassed}
                                        checked={isChecked}
                                        onChange={() => {
                                          setQuizAnswers(prev => {
                                            const copy = [...prev];
                                            copy[qIdx] = oIdx;
                                            return copy;
                                          });
                                        }}
                                        className="mt-0.5 w-4.5 h-4.5 accent-indigo-650 cursor-pointer"
                                      />
                                      <div className="leading-snug">
                                        <span className="font-mono text-gray-400 font-bold mr-1">{String.fromCharCode(65 + oIdx)}.</span>
                                        <span>{opt}</span>
                                      </div>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Quiz Actions */}
                      <div className="pt-4 border-t border-gray-150 flex justify-between items-center mt-auto">
                        <button
                          type="button"
                          onClick={() => {
                            if (activeStudyCourse.lessons && activeStudyCourse.lessons.length > 0) {
                              setActiveLessonIndex(activeStudyCourse.lessons.length - 1);
                            } else {
                              setActiveLessonIndex(-1);
                            }
                          }}
                          className="px-4 py-2 border border-gray-200 text-slate-500 hover:text-slate-700 rounded-xl text-xs font-bold bg-white hover:bg-slate-50 transition-all cursor-pointer font-sans"
                        >
                          ← Bài trước
                        </button>

                        {!isQuizPassed ? (
                          <button
                            type="button"
                            disabled={isQuizEvaluating}
                            onClick={handleSubmitQuiz}
                            className="px-5 py-2.5 bg-indigo-650 hover:bg-indigo-700 active:scale-95 text-white font-bold rounded-xl text-xs shadow-xs transition-all cursor-pointer font-sans disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                          >
                            {isQuizEvaluating ? (
                              <>
                                <RefreshCw className="animate-spin h-3.5 w-3.5" />
                                Đang chấm bài...
                              </>
                            ) : (
                              "Nộp bài thi & Đánh giá →"
                            )}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={handleFinishCourse}
                            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-xl text-xs shadow-md transition-all cursor-pointer font-sans"
                          >
                            🎉 Hoàn thành & Nhận Tokens!
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}

              </div>
            </div>

          </div>
        </div>
      )}

      {/* Notion-style New Project Modal */}
      {isNewProjectModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-2xs flex items-center justify-center z-50 p-4">
          <form onSubmit={handleCreateProject} className="bg-white border border-gray-200 rounded-2xl shadow-xl w-full max-w-md p-6 relative text-left space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-gray-150">
              <h4 className="font-bold text-slate-800 text-sm font-sans uppercase flex items-center gap-2">
                <Target className="h-4 w-4 text-indigo-655" />
                Tạo Dự Án Mới
              </h4>
              <button
                type="button"
                onClick={() => setIsNewProjectModalOpen(false)}
                className="text-gray-400 hover:text-slate-800 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-500 mb-1.5 font-sans">Tên dự án *</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Thiết kế Landing Page"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 text-slate-800 placeholder-gray-300 hover:border-gray-300 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 rounded-xl font-sans"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-gray-150 flex justify-end gap-3 text-xs font-bold">
              <button
                type="button"
                onClick={() => setIsNewProjectModalOpen(false)}
                className="px-4 py-2 border border-gray-200 text-slate-500 hover:text-slate-800 rounded-xl bg-white hover:bg-slate-50 cursor-pointer transition-all active:scale-95 font-sans"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl cursor-pointer transition-all active:scale-95 font-sans"
              >
                Lưu dự án
              </button>
            </div>
          </form>
        </div>
      )}

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
    </div>
  );
}

// Kanban drag helper subcard
function KanbanCard({ task, onMove, onDelete, canDelete, onClick, projects }: { key?: any; task: HRTask; onMove: (status: "Not Started" | "In Progress" | "Review/Testing" | "Done" | "Archived") => void; onDelete: () => void; canDelete: boolean; onClick: () => void; projects: Project[] }) {
  const taskProj = projects.find(p => p.id === task.projectId);

  return (
    <div
      onClick={onClick}
      className="bg-white border text-left border-gray-200/80 p-4 rounded-2xl shadow-xs hover:shadow-md hover:border-slate-300 transition-all flex flex-col gap-3 relative group cursor-pointer select-none font-sans"
      id={`kanban_card_${task.id}`}
    >

      {/* Category and priority indicator tags */}
      <div className="flex justify-between items-center">
        <span className="px-2 py-0.5 bg-slate-50 border border-gray-200 rounded-md text-[9px] font-mono font-bold text-slate-500 uppercase tracking-wider">
          {task.category || "Onboarding"}
        </span>
        <span className={`px-2 py-0.5 rounded-md text-[9px] font-mono font-bold uppercase ${task.priority === "High" || task.priority === "Cao"
            ? "bg-rose-50 border border-rose-100 text-rose-700"
            : task.priority === "Medium" || task.priority === "Trung bình"
              ? "bg-amber-50 border border-amber-100 text-amber-700"
              : "bg-sky-50 border border-sky-100 text-sky-700"
          }`}>
          {task.priority || "Medium"}
        </span>
      </div>

      <div>
        <h5 className="font-semibold text-slate-800 leading-normal text-xs font-sans line-clamp-2">{task.title || "Không có tiêu đề"}</h5>
        {taskProj && (
          <span className="text-[10px] text-gray-400 font-semibold mt-1 block">
            @ {taskProj.name}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-gray-100 pt-2.5 text-[10px]">
        {/* Assignee profile avatar */}
        <div className="flex items-center gap-1.5">
          {renderAvatar(task.assigneeAvatar || "👨‍💻", "w-6 h-6", "text-xs")}
          <span className="text-slate-600 font-semibold">{task.assignee}</span>
        </div>

        {/* Due date */}
        <span className="text-gray-400 font-mono font-medium">Hạn: {task.dueDate}</span>
      </div>

      {/* Interactive transition buttons - visible on hover */}
      <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        {canDelete ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="text-rose-650 hover:text-rose-800 text-[10px] font-extrabold font-mono transition-colors cursor-pointer"
          >
            Xóa bỏ
          </button>
        ) : (
          <div />
        )}
        <div className="flex gap-2">
          {task.status !== "Not Started" && task.status !== "todo" && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                const currentStatus = task.status;
                let prevStatus: "Not Started" | "In Progress" | "Review/Testing" | "Done" = "Not Started";
                if (currentStatus === "In Progress" || currentStatus === "doing") prevStatus = "Not Started";
                else if (currentStatus === "Review/Testing") prevStatus = "In Progress";
                else if (currentStatus === "Done" || currentStatus === "done") prevStatus = "Review/Testing";
                onMove(prevStatus);
              }}
              className="px-2 py-0.5 bg-slate-50 hover:bg-slate-100 border border-gray-200 text-slate-600 hover:text-slate-800 rounded-lg text-[9px] font-bold cursor-pointer"
            >
              ←
            </button>
          )}
          {task.status !== "Done" && task.status !== "done" && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                const currentStatus = task.status;
                let nextStatus: "Not Started" | "In Progress" | "Review/Testing" | "Done" = "Done";
                if (currentStatus === "Not Started" || currentStatus === "todo") nextStatus = "In Progress";
                else if (currentStatus === "In Progress" || currentStatus === "doing") nextStatus = "Review/Testing";
                else if (currentStatus === "Review/Testing") nextStatus = "Done";
                onMove(nextStatus);
              }}
              className="px-2 py-0.5 bg-indigo-650 hover:bg-indigo-700 text-white rounded-lg text-[9px] font-bold cursor-pointer"
            >
              →
            </button>
          )}
        </div>
      </div>

    </div>
  );
}
