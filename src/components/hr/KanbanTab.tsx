import React, { useState, useEffect } from "react";
import {
  Briefcase,
  MapPin,
  Phone,
  Mail,
  Plus,
  Search,
  CheckCircle,
  Clock,
  ExternalLink,
  ChevronRight,
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
import { EmployeeNode, UserProfile, HRTask, Project, TaskHistoryEntry } from "../../types";
import { getAccessToken } from "../../services/authService";
import { socketService } from "../../services/socketService";
import { toast } from "../../pages/Toast";

interface KanbanTabProps {
  userProfile: any;
  selectedCompanyCode: string;
  employees: EmployeeNode[];
  isManager: boolean;
  usersList: UserProfile[];
  onNavigateToWorkflow?: (workflowId: string) => void;
}

const isUrl = (str?: string): boolean => {
  if (!str) return false;
  return str.startsWith("http://") || str.startsWith("https://") || str.startsWith("data:image/") || str.startsWith("/");
};

const getLocalDatetimeString = (date = new Date()) => {
  const tzOffset = date.getTimezoneOffset() * 60000; // in ms
  const localISOTime = (new Date(date.getTime() - tzOffset)).toISOString().slice(0, 16);
  return localISOTime;
};

/**
 * Các trường bắt buộc phải điền trước khi đánh dấu Hoàn thành —
 * đảm bảo task Done luôn đủ dữ liệu để tính KPI và truy vết.
 */
type DoneFieldKey = "description" | "dueDate" | "startTime" | "estTime";

const getMissingDoneFields = (info: {
  description?: string;
  dueDate?: string;
  startTime?: string;
  estTime?: number;
}): { key: DoneFieldKey; label: string }[] => {
  const missing: { key: DoneFieldKey; label: string }[] = [];
  if (!info.description || !info.description.trim()) missing.push({ key: "description", label: "Mô tả công việc" });
  const due = (info.dueDate || "").trim();
  if (!due || due === "Chưa cập nhật") missing.push({ key: "dueDate", label: "Hạn chót" });
  if (!info.startTime) missing.push({ key: "startTime", label: "Ngày giờ bắt đầu" });
  if (!info.estTime || info.estTime <= 0) missing.push({ key: "estTime", label: "Số giờ phải làm" });
  return missing;
};

const calculateKPI = (task: HRTask) => {
  if (!task.startTime || !task.endTime || !task.estTime) return null;
  const start = new Date(task.startTime).getTime();
  const end = new Date(task.endTime).getTime();
  if (isNaN(start) || isNaN(end) || end < start) return null;

  const actualHours = (end - start) / (1000 * 60 * 60);
  const estHours = task.estTime;

  if (actualHours <= estHours) {
    return {
      status: "ontime",
      text: "Đúng tiến độ (Đạt KPI)",
      diff: Number((estHours - actualHours).toFixed(1)),
    };
  } else {
    return {
      status: "late",
      text: `Trễ tiến độ (Trễ ${(actualHours - estHours).toFixed(1)}h)`,
      diff: Number((actualHours - estHours).toFixed(1)),
    };
  }
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

const formatDatetime = (dtStr?: string) => {
  if (!dtStr) return "-";
  try {
    const d = new Date(dtStr);
    if (isNaN(d.getTime())) return dtStr;
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${hours}:${minutes} ${day}/${month}/${year}`;
  } catch {
    return dtStr;
  }
};

function TaskTable({
  tasks,
  showProjectColumn = false,
  projects,
  onSelectTask
}: {
  tasks: HRTask[];
  showProjectColumn?: boolean;
  projects: Project[];
  onSelectTask: (task: HRTask) => void;
}) {
  return (
    <div className="overflow-x-auto border border-gray-200 rounded-2xl shadow-2xs bg-white">
      <table className="w-full text-left border-collapse text-xs min-w-[1200px]">
        <thead>
          <tr className="bg-slate-50 border-b border-gray-200 select-none font-bold text-gray-500 font-sans text-[10px] uppercase tracking-wider">
            <th className="px-4 py-3 w-[200px]">Công việc</th>
            {showProjectColumn && <th className="px-4 py-3 w-[120px]">Dự án</th>}
            <th className="px-4 py-3 w-[100px]">Phân loại</th>
            <th className="px-4 py-3 w-[80px]">Ưu tiên</th>
            <th className="px-4 py-3 w-[100px]">Trạng thái</th>
            <th className="px-4 py-3 w-[120px]">Giao cho</th>
            <th className="px-4 py-3 w-[100px]">Hạn chót</th>
            <th className="px-4 py-3 w-[120px]">Bắt đầu</th>
            <th className="px-4 py-3 w-[120px]">Kết thúc</th>
            <th className="px-4 py-3 w-[70px] text-center">Dự tính</th>
            <th className="px-4 py-3 w-[70px] text-center">Thực tế</th>
            <th className="px-4 py-3 w-[130px]">Đánh giá KPI</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {tasks.length === 0 ? (
            <tr>
              <td colSpan={showProjectColumn ? 12 : 11} className="text-center py-8 text-gray-450 italic bg-white">
                Không có công việc nào.
              </td>
            </tr>
          ) : (
            tasks.map((task) => {
              const kpi = calculateKPI(task);
              return (
                <tr
                  key={task.id}
                  onClick={() => onSelectTask(task)}
                  className="hover:bg-slate-50/70 cursor-pointer transition-colors bg-white"
                >
                  {/* Công việc */}
                  <td className="px-4 py-3 font-semibold text-slate-800">
                    <div className="flex items-start gap-2 max-w-[190px]">
                      <div className="mt-0.5 shrink-0">
                        {task.status === "Done" || task.status === "done" ? (
                          <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                        ) : (
                          <Clock className="h-3.5 w-3.5 text-slate-400" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-xs text-slate-850 truncate" title={task.title}>
                          {task.title}
                        </div>
                        <div className="text-[10px] text-gray-400 truncate mt-0.5" title={task.description}>
                          {task.description || "Không có mô tả chi tiết."}
                        </div>
                      </div>
                    </div>
                  </td>
                  
                  {/* Dự án (Optional) */}
                  {showProjectColumn && (
                    <td className="px-4 py-3 text-slate-500 truncate max-w-[110px]" title={projects.find(p => p.id === task.projectId)?.name || "Không có dự án"}>
                      {projects.find(p => p.id === task.projectId)?.name || "-"}
                    </td>
                  )}

                  {/* Phân loại */}
                  <td className="px-4 py-3 text-indigo-750 font-medium font-sans whitespace-nowrap">
                    {task.category || "Onboarding"}
                  </td>

                  {/* Ưu tiên */}
                  <td className="px-4 py-3 select-none">
                    <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold border uppercase tracking-wider font-mono whitespace-nowrap ${
                      task.priority === "High" ? "bg-rose-50 text-rose-700 border-rose-200" :
                      task.priority === "Low" ? "bg-slate-100 text-slate-500 border-gray-250" : "bg-amber-50 text-amber-700 border-amber-200"
                    }`}>
                      {task.priority === "High" ? "Cao" : task.priority === "Low" ? "Thấp" : "Trung bình"}
                    </span>
                  </td>

                  {/* Trạng thái */}
                  <td className="px-4 py-3 select-none">
                    <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold border whitespace-nowrap ${
                      task.status === "Done" || task.status === "done" ? "bg-emerald-50 text-emerald-700 border-emerald-250" :
                      task.status === "Review/Testing" ? "bg-indigo-50 text-indigo-700 border-indigo-200" :
                      task.status === "In Progress" || task.status === "doing" ? "bg-sky-50 text-sky-700 border-sky-200" : "bg-slate-100 text-slate-500 border-gray-250"
                    }`}>
                      {task.status === "Done" || task.status === "done" ? "Đã xong" :
                      task.status === "Review/Testing" ? "Kiểm tra" :
                      task.status === "In Progress" || task.status === "doing" ? "Đang làm" : "Chưa làm"}
                    </span>
                  </td>

                  {/* Giao cho */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 max-w-[110px]">
                      {renderAvatar(task.assigneeAvatar || "👨‍💻", "w-5 h-5", "text-[10px]")}
                      <span className="font-semibold text-slate-700 truncate" title={task.assignee}>{task.assignee}</span>
                    </div>
                  </td>

                  {/* Hạn chót */}
                  <td className="px-4 py-3 text-gray-650 font-mono text-[10px]">{formatDatetime(task.dueDate)}</td>

                  {/* Bắt đầu */}
                  <td className="px-4 py-3 text-gray-650 font-mono text-[10px]">{formatDatetime(task.startTime)}</td>

                  {/* Kết thúc */}
                  <td className="px-4 py-3 text-gray-650 font-mono text-[10px]">{formatDatetime(task.endTime)}</td>

                  {/* Dự tính */}
                  <td className="px-4 py-3 font-semibold text-slate-700 font-mono text-center">{task.estTime ?? 0}h</td>

                  {/* Thực tế */}
                  <td className="px-4 py-3 font-semibold text-slate-700 font-mono text-center">{task.actualTime ?? 0}h</td>

                  {/* Đánh giá KPI */}
                  <td className="px-4 py-3 select-none">
                    {!kpi ? (
                      <span className="text-gray-400 italic text-[10px]">-</span>
                    ) : kpi.status === "ontime" ? (
                      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold rounded text-[10px]" title={kpi.text}>
                        ✓ Đúng hạn
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded font-bold text-[10px]" title={kpi.text}>
                        ⚠️ Trễ {kpi.diff}h
                      </span>
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function KanbanTab({
  userProfile,
  selectedCompanyCode,
  employees,
  isManager,
  usersList,
  onNavigateToWorkflow
}: KanbanTabProps) {
  const [tasks, setTasks] = useState<HRTask[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [kanbanViewTab, setKanbanViewTab] = useState<"By project" | "Board" | "All tasks" | "By workflow">("By project");
  const [selectedKanbanTask, setSelectedKanbanTask] = useState<HRTask | null>(null);
  // Mở modal với trạng thái "Done" chọn sẵn (khi đổi trạng thái nhanh nhưng thiếu thông tin)
  const [presetDoneOnOpen, setPresetDoneOnOpen] = useState(false);
  // Popover "Hoàn thành nhanh": chỉ hỏi đúng các trường còn thiếu để đánh Done
  const [quickDone, setQuickDone] = useState<{
    task: HRTask;
    missing: { key: DoneFieldKey; label: string }[];
  } | null>(null);
  const [qdFields, setQdFields] = useState<{
    description: string;
    dueDate: string;
    startTime: string;
    estTime: number | "";
  }>({ description: "", dueDate: "", startTime: "", estTime: "" });
  const [selectedWorkflowFilter, setSelectedWorkflowFilter] = useState<string | null>(null);

  // Group tasks by workflow
  const workflowGroupedTasks = React.useMemo(() => {
    const groups: Record<string, typeof tasks> = {};
    tasks.forEach((t) => {
      if (t.isFromWorkflow && t.workflowId) {
        const wfName = t.tags?.[0] || "Quy trình liên kết";
        const key = `${t.workflowId}::${wfName}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(t);
      } else {
        if (!groups["other"]) groups["other"] = [];
        groups["other"].push(t);
      }
    });
    return groups;
  }, [tasks]);

  // Extract unique workflows from tasks
  const uniqueWorkflows = React.useMemo(() => {
    const wfs: { id: string; name: string }[] = [];
    const seen = new Set<string>();
    tasks.forEach((t) => {
      if (t.isFromWorkflow && t.workflowId) {
        if (!seen.has(t.workflowId)) {
          seen.add(t.workflowId);
          wfs.push({ id: t.workflowId, name: t.tags?.[0] || "Quy trình liên kết" });
        }
      }
    });
    return wfs;
  }, [tasks]);

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
  const [editCategory, setEditCategory] = useState<string>("Onboarding");

  const [kanbanFilter, setKanbanFilter] = useState<string | null>(null);

  const fetchTasks = async () => {
    if (!selectedCompanyCode) return;
    try {
      const res = await fetch("/api/v1/crud/kanban-tasks", {
        headers: {
          "Authorization": `Bearer ${getAccessToken()}`,
        },
      });
      if (!res.ok) {
        throw new Error("Không thể tải danh sách công việc");
      }
      const json = await res.json();
      const tasksData: HRTask[] = (json.data || []).map((item: any) => ({
        ...item,
        id: item._id,
      }));
      setTasks(tasksData);
    } catch (error) {
      console.error("Lỗi khi tải danh sách công việc:", error);
    }
  };

  const fetchProjects = async () => {
    if (!selectedCompanyCode) return;
    try {
      const res = await fetch("/api/v1/crud/projects", {
        headers: {
          "Authorization": `Bearer ${getAccessToken()}`,
        },
      });
      if (!res.ok) {
        throw new Error("Không thể tải danh sách dự án");
      }
      const json = await res.json();
      const projData: Project[] = (json.data || []).map((item: any) => ({
        ...item,
        id: item._id,
      }));
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

  useEffect(() => {
    if (selectedCompanyCode) {
      fetchTasks();
      fetchProjects();
    }
  }, [selectedCompanyCode]);

  // Realtime: quy trình vừa sinh task mới cho chính mình → tải lại và báo
  useEffect(() => {
    const off = socketService.on("kanban:task-created", (data: any) => {
      fetchTasks();
      toast.success(
        `Bạn có task mới từ quy trình «${data?.workflowName || ""}»: ${data?.title || ""}`
      );
    });
    return off;
  }, [selectedCompanyCode]);

  // Deep-link từ tab Quy trình: mở modal chi tiết đúng task được trỏ tới
  useEffect(() => {
    const targetId = sessionStorage.getItem("targetKanbanTaskId");
    if (targetId && tasks.length > 0) {
      const target = tasks.find((t) => t.id === targetId);
      if (target) {
        setSelectedKanbanTask(target);
        sessionStorage.removeItem("targetKanbanTaskId");
      }
    }
  }, [tasks]);

  useEffect(() => {
    if (selectedKanbanTask) {
      setEditTitle(selectedKanbanTask.title || "");
      setEditDescription(selectedKanbanTask.description || "");
      setEditAssigneeUid(selectedKanbanTask.assigneeUid || "");

      let initialStatus = selectedKanbanTask.status || "Not Started";
      if (initialStatus === "todo") initialStatus = "Not Started";
      else if (initialStatus === "doing") initialStatus = "In Progress";
      else if (initialStatus === "done") initialStatus = "Done";
      setEditStatus(initialStatus as any);

      let initialPriority = selectedKanbanTask.priority || "Medium";
      if (initialPriority === "Cao") initialPriority = "High";
      else if (initialPriority === "Trung bình") initialPriority = "Medium";
      else if (initialPriority === "Thấp") initialPriority = "Low";
      setEditPriority(initialPriority as any);

      setEditDueDate(selectedKanbanTask.dueDate || "");

      setEditProjectId(selectedKanbanTask.projectId || "");
      setEditStartTime(selectedKanbanTask.startTime || "");
      setEditEndTime(selectedKanbanTask.endTime || "");
      setEditEstTime(selectedKanbanTask.estTime ?? "");
      setEditActualTime(selectedKanbanTask.actualTime ?? "");
      setEditTags(selectedKanbanTask.tags ? selectedKanbanTask.tags.join(", ") : "");
      setEditLinkNote(selectedKanbanTask.linkNote || "");
      setTaskHistory(selectedKanbanTask.history || []);
      setEditCategory(selectedKanbanTask.category || "Onboarding");
      if (presetDoneOnOpen) {
        setEditStatus("Done");
        setPresetDoneOnOpen(false);
      }
    }
  }, [selectedKanbanTask]);

  // Tự động gán thời gian hoàn thành khi chuyển trạng thái sang Done
  useEffect(() => {
    if (editStatus === "Done" && editStartTime && !editEndTime) {
      setEditEndTime(getLocalDatetimeString());
    }
  }, [editStatus, editStartTime]);

  // Tự động ghi thời gian bắt đầu khi chuyển sang Đang làm (tự thu thập thay vì bắt điền tay)
  useEffect(() => {
    if (editStatus === "In Progress" && !editStartTime) {
      setEditStartTime(getLocalDatetimeString());
    }
  }, [editStatus]);

  // Tự động tính số giờ thực tế khi có ngày giờ Bắt đầu và Kết thúc
  useEffect(() => {
    if (editStartTime && editEndTime) {
      const start = new Date(editStartTime).getTime();
      const end = new Date(editEndTime).getTime();
      if (!isNaN(start) && !isNaN(end) && end >= start) {
        const diffHours = Number(((end - start) / (1000 * 60 * 60)).toFixed(1));
        setEditActualTime(diffHours);
      } else {
        setEditActualTime("");
      }
    }
  }, [editStartTime, editEndTime]);

  const getDynamicKPI = () => {
    if (!editStartTime || !editEndTime || !editEstTime) return null;
    const start = new Date(editStartTime).getTime();
    const end = new Date(editEndTime).getTime();
    if (isNaN(start) || isNaN(end) || end < start) return null;

    const actualHours = (end - start) / (1000 * 60 * 60);
    const estHours = Number(editEstTime);

    if (actualHours <= estHours) {
      return {
        status: "ontime",
        text: "Đúng tiến độ (Đạt KPI)",
        diff: Number((estHours - actualHours).toFixed(1)),
      };
    } else {
      return {
        status: "late",
        text: `Trễ tiến độ (Trễ ${(actualHours - estHours).toFixed(1)} giờ)`,
        diff: Number((actualHours - estHours).toFixed(1)),
      };
    }
  };

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

    // Đánh dấu Hoàn thành → bắt buộc điền đầy đủ thông tin
    if (editStatus === "Done") {
      const missing = getMissingDoneFields({
        description: editDescription,
        dueDate: editDueDate,
        startTime: editStartTime,
        estTime: editEstTime === "" ? 0 : Number(editEstTime),
      });
      if (missing.length > 0) {
        toast.warning(`Để đánh dấu Hoàn thành, vui lòng điền đầy đủ: ${missing.map((m) => m.label).join(", ")}.`);
        return;
      }
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

      let finalEndTime = editEndTime;
      let finalActualTime = actNum;
      if (editStatus === "Done" && editStartTime && !editEndTime) {
        finalEndTime = getLocalDatetimeString();
        const start = new Date(editStartTime).getTime();
        const end = new Date(finalEndTime).getTime();
        if (!isNaN(start) && !isNaN(end) && end >= start) {
          finalActualTime = Number(((end - start) / (1000 * 60 * 60)).toFixed(1));
        }
      }

      if (selectedKanbanTask.id === "new") {
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
          createdAt: new Date().toISOString(),

          projectId: editProjectId,
          startTime: editStartTime,
          endTime: finalEndTime,
          estTime: estNum,
          actualTime: finalActualTime,
          tags: parsedTags,
          linkNote: editLinkNote.trim(),
          history: initialHistory,
          category: editCategory
        };

        const res = await fetch("/api/v1/crud/kanban-tasks", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${getAccessToken()}`,
          },
          body: JSON.stringify(newTaskDoc),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || "Tạo công việc thất bại");
        }

        const json = await res.json();
        const createdTask = {
          ...newTaskDoc,
          id: json.data._id,
        };

        toast.success("Đã thêm công việc thành công!");
        setTasks(prev => [...prev, createdTask]);
      } else {
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
        if ((selectedKanbanTask.dueDate || "") !== editDueDate.trim()) {
          changes.push(`Sửa hạn chót: "${selectedKanbanTask.dueDate || 'Chưa thiết lập'}" → "${editDueDate.trim() || 'Chưa thiết lập'}"`);
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
          endTime: finalEndTime,
          estTime: estNum,
          actualTime: finalActualTime,
          tags: parsedTags,
          linkNote: editLinkNote.trim(),
          history: updatedHistory,
          category: editCategory
        };

        const res = await fetch(`/api/v1/crud/kanban-tasks/${selectedKanbanTask.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${getAccessToken()}`,
          },
          body: JSON.stringify(updatedFields),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || "Cập nhật công việc thất bại");
        }

        toast.success("Đã lưu thay đổi công việc!");
        setTasks(prev => prev.map(t => t.id === selectedKanbanTask.id ? { ...t, ...updatedFields } : t));
      }
      setSelectedKanbanTask(null);
    } catch (error) {
      console.error("Lỗi khi lưu công việc:", error);
      toast.error("Không thể lưu thay đổi. Vui lòng kiểm tra quyền hạn.");
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
      const newProj = {
        name: newProjectName.trim(),
        companyCode: compCode,
        creatorUid: userProfile?.uid || "",
        createdAt: new Date().toISOString()
      };

      const res = await fetch("/api/v1/crud/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${getAccessToken()}`,
        },
        body: JSON.stringify(newProj),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Tạo dự án thất bại");
      }

      const json = await res.json();
      const createdProj = {
        ...newProj,
        id: json.data._id,
      };

      toast.success("Đã tạo dự án mới thành công!");
      setProjects(prev => [...prev, createdProj]);
      setExpandedProjects(prev => ({ ...prev, [createdProj.id]: true }));
      setNewProjectName("");
      setIsNewProjectModalOpen(false);
    } catch (error) {
      console.error("Lỗi khi tạo dự án:", error);
      toast.error("Không thể tạo dự án. Vui lòng thử lại.");
    }
  };

  const moveTaskStatus = async (id: string, newStatus: "Not Started" | "In Progress" | "Review/Testing" | "Done" | "Archived") => {
    try {
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

      let endTimeUpdate = undefined;
      let actualTimeUpdate = undefined;
      let startTimeUpdate = undefined;

      // Bắt đầu làm → tự ghi thời gian bắt đầu (không bắt người dùng điền tay)
      if (newStatus === "In Progress" && taskObj && !taskObj.startTime) {
        startTimeUpdate = getLocalDatetimeString();
      }

      if (newStatus === "Done" && taskObj) {
        // Thiếu thông tin → mở popover hoàn thành nhanh, chỉ hỏi đúng trường còn thiếu
        const missing = getMissingDoneFields(taskObj);
        if (missing.length > 0) {
          setQdFields({
            description: "",
            dueDate: "",
            startTime: getLocalDatetimeString(),
            estTime: "",
          });
          setQuickDone({ task: taskObj, missing });
          return;
        }
        if (taskObj.startTime && !taskObj.endTime) {
          endTimeUpdate = getLocalDatetimeString();
          const start = new Date(taskObj.startTime).getTime();
          const end = new Date(endTimeUpdate).getTime();
          if (!isNaN(start) && !isNaN(end) && end >= start) {
            actualTimeUpdate = Number(((end - start) / (1000 * 60 * 60)).toFixed(1));
          }
        }
      }

      const updateData: any = {
        status: newStatus,
        history: updatedHistory
      };
      if (endTimeUpdate !== undefined) updateData.endTime = endTimeUpdate;
      if (actualTimeUpdate !== undefined) updateData.actualTime = actualTimeUpdate;
      if (startTimeUpdate !== undefined) updateData.startTime = startTimeUpdate;

      const res = await fetch(`/api/v1/crud/kanban-tasks/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${getAccessToken()}`,
        },
        body: JSON.stringify(updateData),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Cập nhật trạng thái thất bại");
      }

      setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updateData } : t));
      toast.success("Đã cập nhật trạng thái công việc!");
    } catch (error) {
      console.error("Lỗi khi cập nhật trạng thái công việc:", error);
      toast.error("Không thể cập nhật trạng thái. Vui lòng thử lại.");
    }
  };

  // Gộp giá trị đã có của task với phần vừa điền trong popover rồi đánh Done
  const submitQuickDone = async () => {
    if (!quickDone) return;
    const t = quickDone.task;
    const merged = {
      description: t.description && t.description.trim() ? t.description : qdFields.description.trim(),
      dueDate:
        (t.dueDate || "").trim() && (t.dueDate || "").trim() !== "Chưa cập nhật"
          ? t.dueDate
          : qdFields.dueDate,
      startTime: t.startTime || qdFields.startTime,
      estTime:
        t.estTime && t.estTime > 0
          ? t.estTime
          : qdFields.estTime === ""
            ? 0
            : Number(qdFields.estTime),
    };
    const stillMissing = getMissingDoneFields(merged);
    if (stillMissing.length > 0) {
      toast.warning(`Vui lòng điền: ${stillMissing.map((m) => m.label).join(", ")}.`);
      return;
    }

    try {
      const userName = userProfile?.displayName || userProfile?.email || "Thành viên";
      const endTime = t.endTime || getLocalDatetimeString();
      let actualTime = t.actualTime || 0;
      const start = new Date(merged.startTime).getTime();
      const end = new Date(endTime).getTime();
      if (!isNaN(start) && !isNaN(end) && end >= start) {
        actualTime = Number(((end - start) / (1000 * 60 * 60)).toFixed(1));
      }

      const updateData: any = {
        ...merged,
        status: "Done",
        endTime,
        actualTime,
        history: [
          ...(t.history || []),
          {
            time: new Date().toLocaleString("vi-VN"),
            user: userName,
            action: `Đổi trạng thái: "${t.status}" → "Done" (hoàn thành nhanh)`,
          },
        ],
      };

      const res = await fetch(`/api/v1/crud/kanban-tasks/${t.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${getAccessToken()}`,
        },
        body: JSON.stringify(updateData),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Cập nhật trạng thái thất bại");
      }

      setTasks(prev => prev.map(x => (x.id === t.id ? { ...x, ...updateData } : x)));
      setQuickDone(null);
      toast.success("Đã hoàn thành công việc!");
    } catch (error) {
      console.error("Lỗi khi hoàn thành nhanh:", error);
      toast.error("Không thể hoàn thành công việc. Vui lòng thử lại.");
    }
  };

  // Modal đang chọn status Done → tính live các trường còn thiếu để highlight
  const doneMissing =
    selectedKanbanTask && editStatus === "Done"
      ? getMissingDoneFields({
          description: editDescription,
          dueDate: editDueDate,
          startTime: editStartTime,
          estTime: editEstTime === "" ? 0 : Number(editEstTime),
        })
      : [];
  const missingKeySet = new Set(doneMissing.map((m) => m.key));
  const missingCls = (key: DoneFieldKey, base: string) =>
    missingKeySet.has(key) ? `${base} !border-rose-400 !bg-rose-50/60` : base;

  const deleteTask = async (id: string) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa công việc này?")) return false;
    try {
      const res = await fetch(`/api/v1/crud/kanban-tasks/${id}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${getAccessToken()}`,
        },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Xóa công việc thất bại");
      }

      setTasks(prev => prev.filter(t => t.id !== id));
      toast.success("Đã xóa công việc thành công!");
      return true;
    } catch (error) {
      console.error("Lỗi khi xóa công việc:", error);
      toast.error("Không thể xóa công việc. Chỉ quản lý mới có quyền.");
      return false;
    }
  };

  const visibleTasks = React.useMemo(() => {
    let list = tasks;
    if (kanbanFilter) {
      list = list.filter((t) => t.assignee.toLowerCase() === kanbanFilter.toLowerCase());
    }
    if (selectedWorkflowFilter) {
      list = list.filter((t) => t.isFromWorkflow && t.workflowId === selectedWorkflowFilter);
    }
    return list;
  }, [tasks, kanbanFilter, selectedWorkflowFilter]);

  return (
    <>
      <div className="flex-1 p-6 overflow-y-auto" id="hr_tab_content">
        <div className="bg-white text-slate-800 p-8 rounded-3xl border border-gray-200 shadow-xs space-y-6 text-left" id="job_delegation_kanban">
          {/* Header section */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 pb-4 border-b border-gray-200">
            <div className="flex items-center gap-4">
              <h2 className="text-2xl font-bold font-sans text-slate-800">Tasks</h2>

              {/* Tab buttons */}
              <div className="flex bg-gray-100 border border-gray-200 p-1 rounded-xl text-xs font-semibold gap-1 select-none">
                {(["By project", "Board", "All tasks", "By workflow"] as const).map((vt) => (
                  <button
                    key={vt}
                    onClick={() => setKanbanViewTab(vt)}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                      kanbanViewTab === vt ? "bg-white text-slate-850 shadow-xs" : "text-gray-500 hover:text-slate-700"
                    }`}
                  >
                    {vt === "By project" ? "Theo dự án" : 
                     vt === "Board" ? "Bảng Kanban" : 
                     vt === "By workflow" ? "Theo quy trình" : "Tất cả công việc"}
                  </button>
                ))}
              </div>
            </div>

            {/* Filter and Add Task controls */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <Filter className="h-4 w-4 text-gray-400" />
                <select
                  value={kanbanFilter || ""}
                  onChange={(e) => setKanbanFilter(e.target.value || null)}
                  className="border border-gray-200 p-1.5 rounded-xl text-xs bg-white outline-none cursor-pointer"
                >
                  <option value="">Lọc nhân sự</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.name}>
                      {emp.name}
                    </option>
                  ))}
                </select>
                <select
                  value={selectedWorkflowFilter || ""}
                  onChange={(e) => setSelectedWorkflowFilter(e.target.value || null)}
                  className="border border-gray-200 p-1.5 rounded-xl text-xs bg-white outline-none cursor-pointer ml-1"
                >
                  <option value="">Lọc quy trình</option>
                  {uniqueWorkflows.map(wf => (
                    <option key={wf.id} value={wf.id}>
                      {wf.name}
                    </option>
                  ))}
                </select>
              </div>

              {isManager && (
                <>
                  <button
                    type="button"
                    onClick={() => setIsNewProjectModalOpen(true)}
                    className="px-4 py-2 border border-gray-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
                  >
                    <Target className="h-4 w-4" />
                    Tạo Dự Án
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (employees.length === 0) {
                        toast.warning("Vui lòng thêm nhân viên trước khi giao việc!");
                        return;
                      }
                      setSelectedKanbanTask({
                        id: "new",
                        title: "",
                        description: "",
                        assigneeUid: employees[0]?.id || "",
                        assignee: employees[0]?.name || "",
                        assigneeAvatar: employees[0]?.avatar || "👨‍💻",
                        dueDate: "",
                        priority: "Medium",
                        status: "Not Started",
                        companyCode: selectedCompanyCode,
                        creatorUid: userProfile?.uid || "",
                        createdAt: new Date().toISOString(),
                        projectId: "",
                        tags: [],
                        linkNote: "",
                        history: [],
                        category: "Onboarding"
                      });
                    }}
                    className="px-4 py-2 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 active:scale-95 cursor-pointer"
                  >
                    <Plus className="h-4 w-4" />
                    Giao Việc Mới
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Tab 1: Project-grouped tasks list (Notion-style toggle) */}
          {kanbanViewTab === "By project" && (
            <div className="space-y-4">
              {projects.length === 0 && tasks.length === 0 ? (
                <div className="text-center py-12 text-gray-400 select-none">
                  <Briefcase className="h-12 w-12 mx-auto text-gray-200 mb-3" />
                  <p className="font-bold text-sm">Chưa có dự án và công việc nào</p>
                  {isManager && <p className="text-xs mt-1">Hãy nhấp nút "Tạo Dự Án" hoặc "Giao Việc Mới" phía trên</p>}
                </div>
              ) : (
                <>
                  {/* Collapsible Project items */}
                  {projects.map((proj) => {
                    const projTasks = visibleTasks.filter(t => t.projectId === proj.id);
                    const isExpanded = !!expandedProjects[proj.id];

                    return (
                      <div key={proj.id} className="border border-gray-200 rounded-2xl overflow-hidden shadow-2xs">
                        {/* Project Header toggle bar */}
                        <div
                          onClick={() => setExpandedProjects(p => ({ ...p, [proj.id]: !isExpanded }))}
                          className="bg-slate-50 px-5 py-3.5 flex items-center justify-between cursor-pointer select-none hover:bg-slate-100/80 transition-colors"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <ChevronRight className={`h-4.5 w-4.5 text-slate-550 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                            <Target className="h-4 w-4 text-indigo-600 shrink-0" />
                            <h3 className="font-bold text-slate-800 text-sm truncate">{proj.name}</h3>
                            <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-150 text-indigo-700 font-mono text-[9px] font-bold rounded-full">
                              {projTasks.length} việc
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-[10px] text-gray-400 font-medium">
                            <span>Tạo ngày: {new Date(proj.createdAt).toLocaleDateString("vi-VN")}</span>
                          </div>
                        </div>

                        {/* Project Tasks Body */}
                        {isExpanded && (
                          <div className="p-4 bg-white border-t border-gray-150 max-h-[400px] overflow-y-auto">
                            <TaskTable
                              tasks={projTasks}
                              showProjectColumn={false}
                              projects={projects}
                              onSelectTask={setSelectedKanbanTask}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Unassigned Projects block */}
                  <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-2xs">
                    <div
                      onClick={() => setExpandedProjects(p => ({ ...p, unassigned: !expandedProjects.unassigned }))}
                      className="bg-slate-50 px-5 py-3.5 flex items-center justify-between cursor-pointer select-none hover:bg-slate-100/80 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <ChevronRight className={`h-4.5 w-4.5 text-slate-550 transition-transform ${expandedProjects.unassigned ? "rotate-90" : ""}`} />
                        <Tag className="h-4 w-4 text-slate-500 shrink-0" />
                        <h3 className="font-bold text-slate-600 text-sm">Công việc không thuộc dự án</h3>
                        <span className="px-2 py-0.5 bg-slate-150 text-slate-600 font-mono text-[9px] font-bold rounded-full">
                          {visibleTasks.filter(t => !t.projectId).length} việc
                        </span>
                      </div>
                    </div>
                    {expandedProjects.unassigned && (
                      <div className="p-4 bg-white border-t border-gray-150 max-h-[400px] overflow-y-auto">
                        <TaskTable
                          tasks={visibleTasks.filter(t => !t.projectId)}
                          showProjectColumn={false}
                          projects={projects}
                          onSelectTask={setSelectedKanbanTask}
                        />
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Tab 2: Standard Kanban Board grid */}
          {kanbanViewTab === "Board" && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5 items-start min-h-[400px]" id="kanban_board_columns">
              {/* Column 1: Not Started */}
              <div className="bg-slate-50 p-4 border border-gray-200 rounded-2xl flex flex-col h-full min-h-[450px]">
                <div className="flex justify-between items-center mb-4 select-none">
                  <span className="text-xs font-bold text-slate-500 font-mono uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-gray-400" />
                    Chưa bắt đầu
                  </span>
                  <span className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded-full font-mono text-[9px] font-bold">
                    {visibleTasks.filter(t => t.status === "Not Started" || t.status === "todo").length}
                  </span>
                </div>
                <div className="space-y-3.5 flex-1 overflow-y-auto max-h-[50vh] pr-1">
                  {visibleTasks.filter(t => t.status === "Not Started" || t.status === "todo").map(task => (
                    <KanbanCard
                      key={task.id}
                      task={task}
                      onMove={(newSt) => moveTaskStatus(task.id, newSt)}
                      onDelete={() => deleteTask(task.id)}
                      canDelete={isManager || task.creatorUid === userProfile?.uid}
                      onClick={() => setSelectedKanbanTask(task)}
                      projects={projects}
                      onNavigateToWorkflow={onNavigateToWorkflow}
                    />
                  ))}
                </div>
              </div>

              {/* Column 2: In Progress */}
              <div className="bg-slate-50 p-4 border border-gray-200 rounded-2xl flex flex-col h-full min-h-[450px]">
                <div className="flex justify-between items-center mb-4 select-none">
                  <span className="text-xs font-bold text-indigo-650 font-mono uppercase tracking-wider flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 text-indigo-500 animate-spin" />
                    Đang thực hiện
                  </span>
                  <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full font-mono text-[9px] font-bold">
                    {visibleTasks.filter(t => t.status === "In Progress" || t.status === "doing").length}
                  </span>
                </div>
                <div className="space-y-3.5 flex-1 overflow-y-auto max-h-[50vh] pr-1">
                  {visibleTasks.filter(t => t.status === "In Progress" || t.status === "doing").map(task => (
                    <KanbanCard
                      key={task.id}
                      task={task}
                      onMove={(newSt) => moveTaskStatus(task.id, newSt)}
                      onDelete={() => deleteTask(task.id)}
                      canDelete={isManager || task.creatorUid === userProfile?.uid}
                      onClick={() => setSelectedKanbanTask(task)}
                      projects={projects}
                      onNavigateToWorkflow={onNavigateToWorkflow}
                    />
                  ))}
                </div>
              </div>

              {/* Column 3: Review / Testing */}
              <div className="bg-slate-50 p-4 border border-gray-200 rounded-2xl flex flex-col h-full min-h-[450px]">
                <div className="flex justify-between items-center mb-4 select-none">
                  <span className="text-xs font-bold text-amber-705 text-amber-700 font-mono uppercase tracking-wider flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                    Đang kiểm thử
                  </span>
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-mono text-[9px] font-bold">
                    {visibleTasks.filter(t => t.status === "Review/Testing").length}
                  </span>
                </div>
                <div className="space-y-3.5 flex-1 overflow-y-auto max-h-[50vh] pr-1">
                  {visibleTasks.filter(t => t.status === "Review/Testing").map(task => (
                    <KanbanCard
                      key={task.id}
                      task={task}
                      onMove={(newSt) => moveTaskStatus(task.id, newSt)}
                      onDelete={() => deleteTask(task.id)}
                      canDelete={isManager || task.creatorUid === userProfile?.uid}
                      onClick={() => setSelectedKanbanTask(task)}
                      projects={projects}
                      onNavigateToWorkflow={onNavigateToWorkflow}
                    />
                  ))}
                </div>
              </div>

              {/* Column 4: Done */}
              <div className="bg-slate-50 p-4 border border-gray-200 rounded-2xl flex flex-col h-full min-h-[450px]">
                <div className="flex justify-between items-center mb-4 select-none">
                  <span className="text-xs font-bold text-emerald-700 font-mono uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                    Đã hoàn thành
                  </span>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-705 text-emerald-700 rounded-full font-mono text-[9px] font-bold">
                    {visibleTasks.filter(t => t.status === "Done" || t.status === "done").length}
                  </span>
                </div>
                <div className="space-y-3.5 flex-1 overflow-y-auto max-h-[50vh] pr-1">
                  {visibleTasks.filter(t => t.status === "Done" || t.status === "done").map(task => (
                    <KanbanCard
                      key={task.id}
                      task={task}
                      onMove={(newSt) => moveTaskStatus(task.id, newSt)}
                      onDelete={() => deleteTask(task.id)}
                      canDelete={isManager || task.creatorUid === userProfile?.uid}
                      onClick={() => setSelectedKanbanTask(task)}
                      projects={projects}
                      onNavigateToWorkflow={onNavigateToWorkflow}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Detailed Tasks List View */}
          {kanbanViewTab === "All tasks" && (
            <TaskTable
              tasks={visibleTasks}
              showProjectColumn={true}
              projects={projects}
              onSelectTask={setSelectedKanbanTask}
            />
          )}

          {/* Tab 4: Workflow-grouped tasks list */}
          {kanbanViewTab === "By workflow" && (
            <div className="space-y-4">
              {Object.keys(workflowGroupedTasks).length === 0 || (Object.keys(workflowGroupedTasks).length === 1 && workflowGroupedTasks["other"]?.length === tasks.length) ? (
                <div className="text-center py-12 text-gray-400 select-none">
                  <Briefcase className="h-12 w-12 mx-auto text-gray-200 mb-3" />
                  <p className="font-bold text-sm">Chưa có công việc nào liên kết với Quy trình</p>
                </div>
              ) : (
                <>
                  {Object.entries(workflowGroupedTasks).map(([key, value]) => {
                    if (key === "other") return null;
                    const groupTasks = value as HRTask[];
                    const [wfId, wfName] = key.split("::");
                    const isExpanded = !!expandedProjects[wfId];

                    const filteredGroupTasks = groupTasks.filter(t => visibleTasks.some(vt => vt.id === t.id));

                    return (
                      <div key={wfId} className="border border-gray-200 rounded-2xl overflow-hidden shadow-2xs">
                        <div
                          onClick={() => setExpandedProjects(p => ({ ...p, [wfId]: !isExpanded }))}
                          className="bg-slate-50 px-5 py-3.5 flex items-center justify-between cursor-pointer select-none hover:bg-slate-100/80 transition-colors"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <ChevronRight className={`h-4.5 w-4.5 text-slate-555 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                            <span className="w-2.5 h-2.5 rounded-full bg-purple-500 shrink-0" />
                            <h3 className="font-bold text-slate-800 text-sm truncate">Quy trình: {wfName}</h3>
                            <span className="px-2 py-0.5 bg-purple-50 border border-purple-150 text-purple-700 font-mono text-[9px] font-bold rounded-full">
                              {filteredGroupTasks.length} việc
                            </span>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="p-4 bg-white border-t border-gray-150 max-h-[400px] overflow-y-auto">
                            <TaskTable
                              tasks={filteredGroupTasks}
                              showProjectColumn={true}
                              projects={projects}
                              onSelectTask={setSelectedKanbanTask}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Tasks not from any workflow */}
                  {workflowGroupedTasks["other"] && workflowGroupedTasks["other"].length > 0 && (
                    <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-2xs">
                      <div
                        onClick={() => setExpandedProjects(p => ({ ...p, other_wf: !expandedProjects.other_wf }))}
                        className="bg-slate-50 px-5 py-3.5 flex items-center justify-between cursor-pointer select-none hover:bg-slate-100/80 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <ChevronRight className={`h-4.5 w-4.5 text-slate-555 transition-transform ${expandedProjects.other_wf ? "rotate-90" : ""}`} />
                          <Tag className="h-4 w-4 text-slate-500 shrink-0" />
                          <h3 className="font-bold text-slate-600 text-sm">Công việc ngoài Quy trình</h3>
                          <span className="px-2 py-0.5 bg-slate-150 text-slate-600 font-mono text-[9px] font-bold rounded-full">
                            {workflowGroupedTasks["other"].filter(t => visibleTasks.some(vt => vt.id === t.id)).length} việc
                          </span>
                        </div>
                      </div>
                      {expandedProjects.other_wf && (
                        <div className="p-4 bg-white border-t border-gray-150 max-h-[400px] overflow-y-auto">
                          <TaskTable
                            tasks={workflowGroupedTasks["other"].filter(t => visibleTasks.some(vt => vt.id === t.id))}
                            showProjectColumn={true}
                            projects={projects}
                            onSelectTask={setSelectedKanbanTask}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* POPOVER HOÀN THÀNH NHANH — chỉ hỏi đúng các trường còn thiếu */}
      {quickDone && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-2xs flex items-center justify-center z-50 p-4"
          onClick={() => setQuickDone(null)}
        >
          <div
            className="bg-white border border-gray-200 text-slate-800 rounded-2xl shadow-2xl w-full max-w-sm p-6 text-left font-sans"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2 mb-1">
              <h3 className="text-sm font-bold text-slate-800">Hoàn thành công việc</h3>
              <button
                onClick={() => setQuickDone(null)}
                className="p-1 rounded-lg hover:bg-gray-100 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mb-4 line-clamp-1">{quickDone.task.title}</p>
            <p className="text-[11px] font-semibold text-slate-500 mb-3">
              Chỉ còn thiếu {quickDone.missing.length} thông tin để hoàn thành:
            </p>
            <div className="space-y-3 text-xs">
              {quickDone.missing.some((m) => m.key === "description") && (
                <div>
                  <label className="block text-gray-400 font-bold mb-1">Mô tả công việc</label>
                  <textarea
                    value={qdFields.description}
                    onChange={(e) => setQdFields((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Kết quả / nội dung đã thực hiện..."
                    className="w-full p-2 bg-slate-50 border border-gray-200 focus:bg-white focus:border-indigo-500 rounded-lg outline-none resize-none min-h-[64px]"
                    autoFocus
                  />
                </div>
              )}
              {quickDone.missing.some((m) => m.key === "dueDate") && (
                <div>
                  <label className="block text-gray-400 font-bold mb-1">Hạn chót</label>
                  <input
                    type="datetime-local"
                    value={qdFields.dueDate}
                    onChange={(e) => setQdFields((f) => ({ ...f, dueDate: e.target.value }))}
                    className="w-full p-2 bg-slate-50 border border-gray-200 focus:bg-white focus:border-indigo-500 rounded-lg outline-none"
                  />
                </div>
              )}
              {quickDone.missing.some((m) => m.key === "startTime") && (
                <div>
                  <label className="block text-gray-400 font-bold mb-1">Ngày giờ bắt đầu</label>
                  <input
                    type="datetime-local"
                    value={qdFields.startTime}
                    onChange={(e) => setQdFields((f) => ({ ...f, startTime: e.target.value }))}
                    className="w-full p-2 bg-slate-50 border border-gray-200 focus:bg-white focus:border-indigo-500 rounded-lg outline-none"
                  />
                </div>
              )}
              {quickDone.missing.some((m) => m.key === "estTime") && (
                <div>
                  <label className="block text-gray-400 font-bold mb-1">Số giờ phải làm (h)</label>
                  <input
                    type="number"
                    min={0.5}
                    step={0.5}
                    value={qdFields.estTime}
                    onChange={(e) =>
                      setQdFields((f) => ({
                        ...f,
                        estTime: e.target.value === "" ? "" : Number(e.target.value),
                      }))
                    }
                    placeholder="VD: 4"
                    className="w-full p-2 bg-slate-50 border border-gray-200 focus:bg-white focus:border-indigo-500 rounded-lg outline-none"
                  />
                </div>
              )}
            </div>
            <div className="mt-5 flex items-center justify-between gap-2 text-xs font-bold">
              <button
                onClick={() => {
                  const t = quickDone.task;
                  setQuickDone(null);
                  setPresetDoneOnOpen(true);
                  setSelectedKanbanTask(t);
                }}
                className="text-slate-400 hover:text-indigo-600 font-semibold"
              >
                Mở chi tiết đầy đủ…
              </button>
              <button
                onClick={submitQuickDone}
                className="px-4 py-2 rounded-xl text-white bg-emerald-600 hover:bg-emerald-700 transition-all active:scale-95 flex items-center gap-1.5"
              >
                <CheckCircle className="w-4 h-4" /> Hoàn thành
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NOTION TASK DETAIL MODAL */}
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
                className="text-gray-400 hover:text-slate-800 cursor-pointer"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            {/* Editable Title Input */}
            <div className="mb-5">
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Tiêu đề công việc..."
                className="w-full text-2xl font-bold text-slate-850 placeholder-gray-300 bg-transparent border-0 border-b border-transparent focus:border-gray-200 outline-none pb-1 font-sans focus:ring-0"
              />
            </div>

            {/* Notion properties matrix table */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-6 border-b border-gray-150 text-xs">
              <div className="space-y-3">
                <div className="flex items-center gap-4">
                  <span className="w-24 text-gray-400 font-semibold select-none flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Giao cho</span>
                  <select
                    value={editAssigneeUid}
                    onChange={(e) => setEditAssigneeUid(e.target.value)}
                    className="flex-1 p-1 bg-slate-50 border border-transparent hover:border-gray-200 rounded-lg outline-none cursor-pointer font-semibold"
                  >
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-4">
                  <span className="w-24 text-gray-400 font-semibold select-none flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Trạng thái</span>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as any)}
                    className="flex-1 p-1 bg-slate-50 border border-transparent hover:border-gray-200 rounded-lg outline-none cursor-pointer font-semibold"
                  >
                    <option value="Not Started">Chưa bắt đầu</option>
                    <option value="In Progress">Đang thực hiện</option>
                    <option value="Review/Testing">Đang kiểm thử</option>
                    <option value="Done">Đã hoàn thành</option>
                  </select>
                </div>

                <div className="flex items-center gap-4">
                  <span className="w-24 text-gray-400 font-semibold select-none flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5" /> Độ ưu tiên</span>
                  <select
                    value={editPriority}
                    onChange={(e) => setEditPriority(e.target.value as any)}
                    className="flex-1 p-1 bg-slate-50 border border-transparent hover:border-gray-200 rounded-lg outline-none cursor-pointer font-semibold"
                  >
                    <option value="High">Cao</option>
                    <option value="Medium">Trung bình</option>
                    <option value="Low">Thấp</option>
                  </select>
                </div>

                <div className="flex items-center gap-4">
                  <span className="w-24 text-gray-400 font-semibold select-none flex items-center gap-1.5"><Tag className="w-3.5 h-3.5" /> Phân loại</span>
                  <input
                    type="text"
                    list="task-category-options"
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    placeholder="Ví dụ: Onboarding, Marketing, Kỹ thuật..."
                    className="flex-1 p-1 px-2 bg-slate-50 border border-transparent hover:border-gray-200 focus:bg-white focus:border-indigo-500 rounded-lg outline-none font-semibold text-xs transition-all"
                  />
                  <datalist id="task-category-options">
                    <option value="Onboarding" />
                    <option value="Đào tạo" />
                    <option value="Tuyển dụng" />
                    <option value="Văn hóa" />
                  </datalist>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-4">
                  <span className="w-24 text-gray-400 font-semibold select-none flex items-center gap-1.5"><Target className="w-3.5 h-3.5" /> Thuộc dự án</span>
                  <select
                    value={editProjectId}
                    onChange={(e) => setEditProjectId(e.target.value)}
                    className="flex-1 p-1 bg-slate-50 border border-transparent hover:border-gray-200 rounded-lg outline-none cursor-pointer font-semibold"
                  >
                    <option value="">Không gán dự án</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-4">
                  <span className="w-24 text-gray-400 font-semibold select-none flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Hạn chót</span>
                  <input
                    type="datetime-local"
                    value={editDueDate}
                    onChange={(e) => setEditDueDate(e.target.value)}
                    className={missingCls("dueDate", "flex-1 p-1 bg-slate-50 border border-transparent hover:border-gray-200 rounded-lg outline-none text-[10px] font-semibold")}
                  />
                </div>

                <div className="flex items-center gap-4">
                  <span className="w-24 text-gray-400 font-semibold select-none flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Bắt đầu</span>
                  <input
                    type="datetime-local"
                    value={editStartTime}
                    onChange={(e) => setEditStartTime(e.target.value)}
                    className={missingCls("startTime", "flex-1 p-1 bg-slate-50 border border-transparent hover:border-gray-200 rounded-lg outline-none text-[10px] font-semibold")}
                  />
                </div>

                <div className="flex items-center gap-4">
                  <span className="w-24 text-gray-400 font-semibold select-none flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Kết thúc</span>
                  <input
                    type="datetime-local"
                    value={editEndTime}
                    onChange={(e) => setEditEndTime(e.target.value)}
                    className="flex-1 p-1 bg-slate-50 border border-transparent hover:border-gray-200 rounded-lg outline-none text-[10px] font-semibold"
                  />
                </div>

                <div className="flex items-center gap-4">
                  <span className="w-24 text-gray-400 font-semibold select-none flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Số giờ (h)</span>
                  <div className="flex-1 flex gap-2">
                    <input
                      type="number"
                      placeholder="Số giờ phải làm"
                      value={editEstTime}
                      onChange={(e) => setEditEstTime(e.target.value === "" ? "" : Number(e.target.value))}
                      className={missingCls("estTime", "w-1/2 p-1 bg-slate-50 border border-transparent hover:border-gray-200 rounded-lg outline-none text-[10px]")}
                    />
                    <input
                      type="number"
                      placeholder="Thực tế"
                      value={editActualTime}
                      onChange={(e) => setEditActualTime(e.target.value === "" ? "" : Number(e.target.value))}
                      className="w-1/2 p-1 bg-slate-50 border border-transparent hover:border-gray-200 rounded-lg outline-none text-[10px]"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <span className="w-24 text-gray-400 font-semibold select-none flex items-center gap-1.5"><Activity className="w-3.5 h-3.5" /> Đánh giá KPI</span>
                  <div className="flex-1">
                    {(() => {
                      const kpi = getDynamicKPI();
                      if (!kpi) return <span className="text-gray-450 italic text-[10px]">Chưa đủ dữ liệu tính KPI</span>;
                      return kpi.status === "ontime" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-250 font-bold rounded-lg text-[10px]">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                          {kpi.text}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-250 font-bold rounded-lg text-[10px]">
                          <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                          {kpi.text}
                        </span>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>

            {/* Additional meta fields (Tags & Link note) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 py-4 border-b text-xs">
              <div>
                <label className="block text-gray-400 font-bold mb-1 flex items-center gap-1 select-none"><Tag className="w-3.5 h-3.5" /> Nhãn (Tags, cách nhau bằng dấu phẩy)</label>
                <input
                  type="text"
                  placeholder="Ví dụ: backend, api, security"
                  value={editTags}
                  onChange={(e) => setEditTags(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-transparent hover:border-gray-250 focus:bg-white focus:border-indigo-500 rounded-lg outline-none"
                />
              </div>

              <div>
                <label className="block text-gray-400 font-bold mb-1 flex items-center gap-1 select-none"><ExternalLink className="w-3.5 h-3.5" /> Link ghi chú / Tài liệu đính kèm</label>
                <input
                  type="text"
                  placeholder="Ví dụ: http://notion.so/igen-plan"
                  value={editLinkNote}
                  onChange={(e) => setEditLinkNote(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-transparent hover:border-gray-250 focus:bg-white focus:border-indigo-500 rounded-lg outline-none"
                />
              </div>
            </div>

            {/* Description field */}
            <div className="py-5 flex-1 min-h-[140px] flex flex-col text-xs">
              <label className="block text-gray-400 font-bold mb-1.5 select-none">Mô tả công việc chi tiết</label>
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Nhập ghi chú chi tiết cho nhân viên thực hiện..."
                className={missingCls("description", "w-full flex-1 p-3 bg-slate-50 border border-transparent hover:border-gray-200 focus:bg-white focus:border-indigo-500 rounded-xl outline-none resize-none min-h-[120px]")}
              />
            </div>

            {/* Task history log */}
            {selectedKanbanTask.id !== "new" && taskHistory.length > 0 && (
              <div className="border-t pt-4 max-h-[150px] overflow-y-auto text-[10px]">
                <span className="block font-bold text-gray-400 mb-2 uppercase select-none tracking-wider">Nhật ký thay đổi ({taskHistory.length})</span>
                <div className="space-y-1.5 font-mono text-slate-500 text-left">
                  {taskHistory.slice().reverse().map((hist, hidx) => (
                    <div key={hidx} className="flex gap-2">
                      <span className="text-gray-400">[{hist.time}]</span>
                      <strong className="text-indigo-650 shrink-0">{hist.user}:</strong>
                      <span className="truncate">{hist.action}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Creator information */}
            {selectedKanbanTask.id !== "new" && (
              <div className="pt-3 text-[10px] text-gray-400 select-none text-right font-medium">
                Giao bởi:{" "}
                <strong>
                  {usersList.find(u => u.uid === selectedKanbanTask.creatorUid)?.displayName ||
                    usersList.find(u => u.uid === selectedKanbanTask.creatorUid)?.email ||
                    "Quản trị viên"}
                </strong>{" "}
                · Vào lúc: {new Date(selectedKanbanTask.createdAt || "").toLocaleString("vi-VN")}
              </div>
            )}

            {/* Cảnh báo cố định khi chọn Hoàn thành mà còn thiếu thông tin */}
            {doneMissing.length > 0 && (
              <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-semibold text-rose-600">
                Để đánh dấu Hoàn thành, cần điền: {doneMissing.map((m) => m.label).join(", ")}
              </div>
            )}

            {/* Action buttons */}
            <div className="pt-6 border-t flex justify-between items-center text-xs font-bold shrink-0">
              <div>
                {selectedKanbanTask.id !== "new" && (isManager || selectedKanbanTask.creatorUid === userProfile?.uid) && (
                  <button
                    type="button"
                    onClick={async () => {
                      const success = await deleteTask(selectedKanbanTask.id);
                      if (success) {
                        setSelectedKanbanTask(null);
                      }
                    }}
                    className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl cursor-pointer transition-all active:scale-95 flex items-center gap-1.5 font-sans"
                  >
                    <Trash2 className="w-4 h-4" />
                    Xóa công việc
                  </button>
                )}
              </div>
              <div className="flex gap-3">
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
        </div>
      )}

      {/* NEW PROJECT MODAL */}
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
    </>
  );
}

// Kanban Card sub-component
function KanbanCard({
  task,
  onMove,
  onDelete,
  canDelete,
  onClick,
  projects,
  onNavigateToWorkflow
}: {
  key?: any;
  task: HRTask;
  onMove: (status: "Not Started" | "In Progress" | "Review/Testing" | "Done" | "Archived") => void;
  onDelete: () => void;
  canDelete: boolean;
  onClick: () => void;
  projects: Project[];
  onNavigateToWorkflow?: (workflowId: string) => void;
}) {
  return (
    <div
      onClick={onClick}
      className="p-4 bg-white border border-gray-200 rounded-2xl shadow-2xs hover:shadow-md hover:border-indigo-300 transition-all duration-300 text-left cursor-pointer group space-y-3"
    >
      <div className="space-y-1.5">
        <div className="flex justify-between items-start gap-2 select-none">
          <span className={`px-2 py-0.5 rounded-md text-[8px] font-bold border uppercase tracking-wider font-mono ${
            task.priority === "High" ? "bg-rose-50 text-rose-700 border-rose-200" :
            task.priority === "Low" ? "bg-slate-100 text-slate-500 border-gray-250" : "bg-amber-50 text-amber-705 text-amber-700 border-amber-205 border-amber-200"
          }`}>
            {task.priority === "High" ? "Cao" : task.priority === "Low" ? "Thấp" : "Trung bình"}
          </span>
          <span className="text-[9px] font-bold text-indigo-750 font-mono uppercase tracking-wider bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded">
            {task.category || "Onboarding"}
          </span>
        </div>
        <h4 className="font-bold text-xs text-slate-800 leading-tight group-hover:text-indigo-650 transition-colors line-clamp-2">{task.title}</h4>
      </div>

      <div className="space-y-1.5 text-[9px] text-slate-500">
        <p className="line-clamp-2 leading-relaxed">{task.description || "Không có mô tả chi tiết."}</p>
        {task.projectId && (
          <div className="flex items-center gap-1 text-[9px] text-slate-650 font-semibold select-none">
            <Target className="w-3 h-3 text-indigo-500 shrink-0" />
            <span className="truncate">{projects.find(p => p.id === task.projectId)?.name || "Không có dự án"}</span>
          </div>
        )}
        {task.isFromWorkflow && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              onNavigateToWorkflow && onNavigateToWorkflow(task.workflowId || "");
            }}
            className="flex items-center gap-1 text-[9px] text-purple-655 font-extrabold select-none bg-purple-50/70 border border-purple-100/80 rounded-lg px-2 py-0.5 w-fit hover:bg-purple-100 transition-colors"
            title="Xem quy trình chi tiết"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0 animate-pulse" />
            <span className="truncate">Quy trình · {task.tags?.[0] || "Liên kết"}</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-gray-100 pt-2.5 text-[10px]">
        <div className="flex items-center gap-1.5">
          {renderAvatar(task.assigneeAvatar || "👨‍💻", "w-6 h-6", "text-xs")}
          <span className="text-slate-650 font-semibold">{task.assignee}</span>
        </div>
        <span className="text-gray-400 font-mono font-medium">Hạn: {formatDatetime(task.dueDate)}</span>
      </div>

      {/* Show KPI Badge on Card if available */}
      {(() => {
        const kpi = calculateKPI(task);
        if (!kpi) return null;
        return (
          <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-[10px]">
            <span className="text-gray-400 font-medium">Đánh giá KPI:</span>
            {kpi.status === "ontime" ? (
              <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-205 border-emerald-200 rounded font-bold text-[9px] flex items-center gap-0.5">
                ✓ Đúng hạn
              </span>
            ) : (
              <span className="px-1.5 py-0.5 bg-rose-50 text-rose-700 border border-rose-250 rounded font-bold text-[9px] flex items-center gap-0.5">
                ⚠️ Trễ {kpi.diff}h
              </span>
            )}
          </div>
        );
      })()}

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
              className="px-2 py-0.5 bg-slate-50 hover:bg-slate-100 border border-gray-200 text-slate-650 hover:text-slate-800 rounded-lg text-[9px] font-bold cursor-pointer"
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
