import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Plus,
  Save,
  Trash2,
  X,
  RefreshCw,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Pencil,
  User,
  Clock,
  Target,
  Info,
  FileText,
  Users,
  CheckCircle2,
  Workflow as WorkflowIcon,
  Layers,
  Flag,
  GripVertical,
  ArrowDown,
  ArrowRight,
  AlertCircle,
  AlertTriangle,
  Zap,
  Smile,
  Paperclip,
  Mic,
  Circle,
  CloudUpload,
  Table2,
  Check,
  ExternalLink,
} from "lucide-react";
import {
  UserProfile,
  Workflow,
  WorkflowStep,
  WorkflowSubTask,
  WorkflowParticipant,
} from "../../types";
import { getAccessToken } from "../../services/authService";
import { socketService } from "../../services/socketService";
import { toast } from "../../pages/Toast";

interface WorkflowTabProps {
  userProfile: UserProfile | null;
  selectedCompanyCode: string;
  isManager: boolean;
  usersList: UserProfile[];
  /** Điều hướng sang tab Kanban và mở modal chi tiết của task được trỏ tới */
  onNavigateToKanban?: (taskId: string) => void;
}

const ACCENT = "#4f46e5";
const DONE_COL = "__done__";

let idCounter = 0;
const genId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}_${(idCounter++).toString(36)}`;

const avatarUrl = (name: string, photo?: string) => {
  if (photo && (photo.startsWith("http") || photo.startsWith("/"))) return photo;
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(
    name || "NV"
  )}&background=4f46e5&color=fff`;
};

const nowISO = () => new Date().toISOString();

const fmtDate = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${String(d.getDate()).padStart(2, "0")}/${String(
    d.getMonth() + 1
  ).padStart(2, "0")}`;
};

/** Thời lượng hiệu dụng của một bước (ngày) — cùng logic với server (workflow-link.service) */
const getStepDurationDays = (step: WorkflowStep): number | null => {
  if (step.estDays && step.estDays > 0) return step.estDays;
  switch (step.deadlineType) {
    case "same_day":
    case "custom_time":
      return 0;
    case "after_1":
      return 1;
    case "after_2":
      return 2;
    case "after_x":
      return step.deadlineDays || 3;
    default:
      return null;
  }
};

type StepSchedulePreview = {
  stepId: string;
  title: string;
  start: Date;
  due: Date | null;
  durationDays: number | null;
};

/**
 * Lịch trình dự kiến khi giao việc theo quy trình: các bước nối đuôi nhau từ ngày
 * bắt đầu — bước sau bắt đầu khi bước trước đến hạn. Hiển thị xem trước trong modal
 * giao việc; server tính lại cùng logic khi sinh task.
 */
const buildStepSchedulePreview = (steps: WorkflowStep[], startDate?: string): StepSchedulePreview[] => {
  let cursor =
    startDate && /^\d{4}-\d{2}-\d{2}/.test(startDate)
      ? new Date(`${startDate.slice(0, 10)}T08:00:00`)
      : new Date();
  if (isNaN(cursor.getTime())) cursor = new Date();

  return steps.map((step) => {
    const durationDays = getStepDurationDays(step);
    if (durationDays === null) {
      return { stepId: step.id, title: step.title, start: new Date(cursor), due: null, durationDays };
    }
    const due = new Date(cursor);
    due.setDate(due.getDate() + durationDays);
    if (step.deadlineTime && step.deadlineTime.includes(":")) {
      const [h, m] = step.deadlineTime.split(":");
      due.setHours(parseInt(h, 10), parseInt(m, 10), 0, 0);
    } else {
      due.setHours(18, 0, 0, 0);
    }
    if (due.getTime() < cursor.getTime()) due.setDate(due.getDate() + 1);
    const entry = { stepId: step.id, title: step.title, start: new Date(cursor), due, durationDays };
    cursor = new Date(due);
    return entry;
  });
};

const fmtScheduleDatetime = (d: Date) =>
  `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")} ${String(
    d.getHours()
  ).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

export default function WorkflowTab({
  userProfile,
  selectedCompanyCode,
  isManager,
  usersList,
  onNavigateToKanban,
}: WorkflowTabProps) {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<"list" | "detail">("list");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardData, setWizardData] = useState<Workflow | null>(null);
  const [projects, setProjects] = useState<any[]>([]);

  // Fetch projects list for selecting project/domain in case creation
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await fetch("/api/v1/crud/projects", {
          headers: {
            "Authorization": `Bearer ${getAccessToken()}`,
          },
        });
        if (res.ok) {
          const json = await res.json();
          const projData = (json.data || []).map((item: any) => ({
            ...item,
            id: item._id,
          }));
          setProjects(projData);
        }
      } catch (err) {
        console.error("Lỗi khi tải danh sách dự án:", err);
      }
    };
    fetchProjects();
  }, []);

  // ---- Theme & Task linkage states ----
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains("dark")
  );

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains("dark"));
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  const [wfTasks, setWfTasks] = useState<any[]>([]);
  const [selectedPartTasks, setSelectedPartTasks] = useState<{
    part: WorkflowParticipant;
    stepTitle: string;
    tasks: any[];
  } | null>(null);

  // ---- Trạng thái trang chi tiết ----
  const [activeId, setActiveId] = useState<string>("");
  const [wfName, setWfName] = useState("");
  const [wfCategory, setWfCategory] = useState("");
  const [wfDescription, setWfDescription] = useState("");
  const [wfAutoAdvance, setWfAutoAdvance] = useState(false);
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [participants, setParticipants] = useState<WorkflowParticipant[]>([]);
  const [saving, setSaving] = useState(false);

  const fetchWfTasks = useCallback(async () => {
    if (!activeId) return;
    try {
      const res = await fetch(`/api/v1/crud/kanban-tasks?workflowId=${activeId}`, {
        headers: { Authorization: `Bearer ${getAccessToken()}` },
      });
      if (res.ok) {
        const json = await res.json();
        setWfTasks(json.data || []);
      }
    } catch (err) {
      console.error("Lỗi tải danh sách công việc quy trình:", err);
    }
  }, [activeId]);

  useEffect(() => {
    if (activeId && view === "detail") {
      fetchWfTasks();
    }
  }, [activeId, view, fetchWfTasks]);

  // Realtime: nhận tín hiệu từ Kanban khi bước hoàn thành hết task / case tự chuyển bước
  useEffect(() => {
    if (!activeId || view !== "detail") return;

    const refreshParticipants = async () => {
      try {
        const res = await fetch(`/api/v1/crud/workflows/${activeId}`, {
          headers: { Authorization: `Bearer ${getAccessToken()}` },
        });
        if (res.ok) {
          const json = await res.json();
          if (json.data) setParticipants(json.data.participants || []);
        }
      } catch (err) {
        console.error("Lỗi đồng bộ participants qua socket:", err);
      }
    };

    const offReady = socketService.on("workflow:step-ready", (data: any) => {
      if (data?.workflowId !== activeId) return;
      fetchWfTasks();
      toast.success(
        `«${data.participantName}» đã hoàn thành mọi task ở bước «${data.stepTitle}» — sẵn sàng chuyển bước.`
      );
    });
    const offAdvanced = socketService.on("workflow:participant-advanced", (data: any) => {
      if (data?.workflowId !== activeId) return;
      refreshParticipants();
      fetchWfTasks();
      toast.success(`«${data.participantName}» đã tự động chuyển sang bước tiếp theo.`);
    });

    return () => {
      offReady();
      offAdvanced();
    };
  }, [activeId, view, fetchWfTasks]);

  // Modal chỉnh sửa bước & tạo công việc theo quy trình
  const [stepDraft, setStepDraft] = useState<WorkflowStep | null>(null);
  const [partDraft, setPartDraft] = useState<{
    name: string;
    userUid: string;
    description: string;
    note: string;
    relatedUids: string[];
    priority: NonNullable<WorkflowParticipant["priority"]>;
    startDate: string;
    dueDate: string;
    docLinks: string[];
    customSubTasks: WorkflowSubTask[];
    projectId: string;
  } | null>(null);
  const [newCaseSubTask, setNewCaseSubTask] = useState("");
  const [newCaseDocLink, setNewCaseDocLink] = useState("");
  // Menu "⋯" đang mở của card case nào (participant id)
  const [cardMenuFor, setCardMenuFor] = useState<string | null>(null);

  const canEdit = isManager;

  // ---- Nạp danh sách quy trình ----
  const fetchWorkflows = useCallback(async () => {
    if (!selectedCompanyCode) return;
    setLoading(true);
    try {
      const res = await fetch("/api/v1/crud/workflows", {
        headers: { Authorization: `Bearer ${getAccessToken()}` },
      });
      if (!res.ok) throw new Error("fetch failed");
      const json = await res.json();
      const list: Workflow[] = (json.data || []).map((it: any) => ({
        ...it,
        id: it._id,
      }));
      setWorkflows(list);
    } catch (err) {
      console.error("Lỗi tải danh sách quy trình:", err);
      toast.error("Không thể tải danh sách quy trình.");
    } finally {
      setLoading(false);
    }
  }, [selectedCompanyCode]);

  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  useEffect(() => {
    if (workflows.length > 0 && view === "list") {
      const targetWfId = sessionStorage.getItem("targetWorkflowId");
      if (targetWfId) {
        const targetWf = workflows.find((w) => w.id === targetWfId);
        if (targetWf) {
          openDetail(targetWf);
          sessionStorage.removeItem("targetWorkflowId");
        }
      }
    }
  }, [workflows, view]);

  // ---- Mở trang chi tiết (wf = null → tạo mới) ----
  const openDetail = (wf: Workflow | null) => {
    if (!wf) {
      setActiveId("");
      setWfName("Quy trình mới");
      setWfCategory("");
      setWfDescription("");
      setWfAutoAdvance(false);
      setSteps([]);
      setParticipants([]);
    } else {
      setActiveId(wf.id);
      setWfName(wf.name);
      setWfCategory(wf.category || "");
      setWfDescription(wf.description || "");
      setWfAutoAdvance(wf.autoAdvance === true);
      setSteps(wf.steps || []);
      setParticipants(wf.participants || []);
    }
    setStepDraft(null);
    setPartDraft(null);
    setView("detail");
  };

  const backToList = () => {
    setView("list");
    setStepDraft(null);
    setPartDraft(null);
    fetchWorkflows();
  };

  // ---- Tạo hoặc sửa quy trình từ wizard ----
  const handleWizardSubmit = async (data: {
    name: string;
    category: string;
    description: string;
    steps: WorkflowStep[];
  }) => {
    try {
      const isEdit = !!wizardData;
      const url = isEdit
        ? `/api/v1/crud/workflows/${wizardData.id}`
        : "/api/v1/crud/workflows";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAccessToken()}`,
        },
        body: JSON.stringify({
          name: data.name.trim(),
          category: data.category.trim(),
          description: data.description.trim(),
          steps: data.steps,
          ...(isEdit ? {} : { participants: [], creatorUid: userProfile?.uid || "" }),
        }),
      });
      if (!res.ok) throw new Error("wizard save failed");
      const json = await res.json();
      toast.success(isEdit ? "Đã cập nhật quy trình." : "Đã tạo quy trình mới.");
      setWizardOpen(false);
      setWizardData(null);
      await fetchWorkflows();

      // Mở detail nếu là quy trình tạo mới
      if (!isEdit) {
        const wf: Workflow = { ...json.data, id: json.data._id };
        openDetail(wf);
      }
    } catch (err) {
      console.error("Lỗi khi lưu quy trình từ wizard:", err);
      toast.error("Không thể lưu quy trình.");
    }
  };

  // ---- Lưu quy trình; trả về id đã lưu (hoặc "" nếu lỗi) ----
  const persist = useCallback(
    async (
      override?: Partial<{ steps: WorkflowStep[]; participants: WorkflowParticipant[]; autoAdvance: boolean }>,
      opts?: { silent?: boolean }
    ): Promise<string> => {
      const payload = {
        name: wfName.trim() || "Quy trình mới",
        category: wfCategory.trim(),
        description: wfDescription.trim(),
        steps: override?.steps ?? steps,
        participants: override?.participants ?? participants,
        autoAdvance: override?.autoAdvance ?? wfAutoAdvance,
        creatorUid: userProfile?.uid || "",
      };
      const url = activeId
        ? `/api/v1/crud/workflows/${activeId}`
        : "/api/v1/crud/workflows";
      const method = activeId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAccessToken()}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("save failed");
      const json = await res.json();
      const savedId = json.data?._id || activeId;
      if (savedId && savedId !== activeId) setActiveId(savedId);
      if (!opts?.silent)
        toast.success(activeId ? "Đã cập nhật quy trình." : "Đã tạo quy trình mới.");
      return savedId;
    },
    [wfName, wfCategory, wfDescription, wfAutoAdvance, steps, participants, activeId, userProfile]
  );

  // Tự lưu ngầm khi kéo người/di chuyển bước (chỉ khi đã có bản ghi)
  const autoPersist = useCallback(
    async (override: Partial<{ steps: WorkflowStep[]; participants: WorkflowParticipant[]; autoAdvance: boolean }>) => {
      if (!activeId) return; // chưa lưu lần đầu → chờ nút Lưu
      try {
        await persist(override, { silent: true });
      } catch {
        toast.error("Không thể đồng bộ thay đổi lên máy chủ.");
      }
    },
    [activeId, persist]
  );

  const handleSave = async () => {
    if (!wfName.trim()) {
      toast.error("Vui lòng nhập tên quy trình.");
      return;
    }
    setSaving(true);
    try {
      await persist();
      await fetchWorkflows();
    } catch (err) {
      console.error("Lỗi lưu quy trình:", err);
      toast.error("Không thể lưu quy trình.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteWorkflow = async () => {
    if (!activeId) {
      backToList();
      return;
    }
    if (!window.confirm("Xóa quy trình này?")) return;
    try {
      const res = await fetch(`/api/v1/crud/workflows/${activeId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getAccessToken()}` },
      });
      if (!res.ok) throw new Error("delete failed");
      toast.success("Đã xóa quy trình.");
      backToList();
    } catch (err) {
      console.error("Lỗi xóa quy trình:", err);
      toast.error("Không thể xóa quy trình.");
    }
  };

  // ---- Thao tác với bước ----
  const openNewStep = () => {
    setStepDraft({
      id: genId("step"),
      title: `Bước ${steps.length + 1}`,
      description: "",
      assigneeUid: "",
      assignee: "",
      estDays: undefined,
      deliverable: "",
      note: "",
    });
  };

  const saveStepDraft = (updated: WorkflowStep) => {
    if (!updated.title.trim()) {
      toast.error("Vui lòng nhập tên bước.");
      return;
    }
    const exists = steps.some((s) => s.id === updated.id);
    const next = exists
      ? steps.map((s) => (s.id === updated.id ? updated : s))
      : [...steps, updated];
    setSteps(next);
    setStepDraft(null);
    autoPersist({ steps: next });
  };

  const deleteStep = (id: string) => {
    if (!window.confirm("Xóa bước này? Người đang ở bước này sẽ chuyển về bước đầu."))
      return;
    const nextSteps = steps.filter((s) => s.id !== id);
    const firstId = nextSteps[0]?.id ?? DONE_COL;
    const nextParts = participants.map((p) =>
      p.currentStepId === id ? { ...p, currentStepId: firstId, updatedAt: nowISO() } : p
    );
    setSteps(nextSteps);
    setParticipants(nextParts);
    autoPersist({ steps: nextSteps, participants: nextParts });
  };

  const moveStep = (id: string, dir: -1 | 1) => {
    const idx = steps.findIndex((s) => s.id === id);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= steps.length) return;
    const next = [...steps];
    [next[idx], next[target]] = [next[target], next[idx]];
    setSteps(next);
    autoPersist({ steps: next });
  };

  // ---- Tạo công việc chạy theo quy trình (case) ----
  const openAddParticipant = () => {
    if (steps.length === 0) {
      toast.error("Hãy tạo ít nhất một bước trước khi tạo công việc.");
      return;
    }
    setPartDraft({
      name: "",
      userUid: "",
      description: "",
      note: "",
      relatedUids: [],
      priority: "normal",
      startDate: "",
      dueDate: "",
      docLinks: [],
      customSubTasks: [],
      projectId: "",
    });
    setNewCaseSubTask("");
    setNewCaseDocLink("");
  };

  const saveParticipantDraft = async () => {
    if (!partDraft) return;
    const name = partDraft.name.trim();
    if (!name) {
      toast.error("Vui lòng nhập tên công việc.");
      return;
    }
    const u = usersList.find((x) => x.uid === partDraft.userUid);
    try {
      // Lưu quy trình trước (tạo mới nếu chưa có activeId) để bước mới nhất có trên server
      const savedId = await persist(undefined, { silent: true });
      if (!activeId) await fetchWorkflows();

      const res = await fetch(`/api/v1/crud/workflows/${savedId}/participants`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAccessToken()}`,
        },
        body: JSON.stringify({
          name,
          userUid: partDraft.userUid || "",
          avatar: avatarUrl(name, u?.photoURL),
          note: partDraft.note.trim(),
          description: partDraft.description.trim(),
          relatedUids: partDraft.relatedUids,
          priority: partDraft.priority,
          startDate: partDraft.startDate,
          dueDate: partDraft.dueDate,
          docLinks: partDraft.docLinks.filter((l) => l.trim()),
          customSubTasks: partDraft.customSubTasks,
          projectId: partDraft.projectId,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.message || "Không thể tạo công việc.");
      }
      const json = await res.json();
      setPartDraft(null);
      if (json.data?.workflow?.participants) {
        setParticipants(json.data.workflow.participants);
      }
      toast.success(
        `Đã tạo công việc và ${json.data?.tasksCreated ?? 0} task Kanban cho bước đầu tiên.`
      );
      fetchWfTasks();
    } catch (err: any) {
      console.error("Lỗi tạo công việc:", err);
      toast.error(err?.message || "Không thể tạo công việc.");
    }
  };

  const moveParticipant = (pid: string, dir: -1 | 1) => {
    const orderIds = [...steps.map((s) => s.id), DONE_COL];
    const next = participants.map((p) => {
      if (p.id !== pid) return p;
      let idx = orderIds.indexOf(p.currentStepId);
      if (idx < 0) idx = 0;
      const target = Math.min(Math.max(idx + dir, 0), orderIds.length - 1);
      return { ...p, currentStepId: orderIds[target], updatedAt: nowISO() };
    });
    setParticipants(next);
    autoPersist({ participants: next });
  };

  const removeParticipant = async (pid: string) => {
    // Chưa lưu lên server → chỉ cần bỏ khỏi state cục bộ
    if (!activeId) {
      setParticipants(participants.filter((p) => p.id !== pid));
      return;
    }
    try {
      const res = await fetch(`/api/v1/crud/workflows/${activeId}/participants/${pid}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getAccessToken()}` },
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.message || "Không thể xóa công việc.");
      setParticipants((prev) => prev.filter((p) => p.id !== pid));
      const archived = json?.data?.tasksArchived ?? 0;
      toast.success(
        archived > 0
          ? `Đã xóa công việc và lưu trữ ${archived} task Kanban chưa hoàn thành.`
          : "Đã xóa công việc."
      );
      fetchWfTasks();
    } catch (err: any) {
      console.error("Lỗi xóa công việc:", err);
      toast.error(err?.message || "Không thể xóa công việc.");
    }
  };

  const advanceParticipantApi = async (pid: string, nextStepId: string, force = false) => {
    try {
      const res = await fetch(`/api/v1/crud/workflows/${activeId}/participants/${pid}/advance`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAccessToken()}`,
        },
        body: JSON.stringify({ nextStepId, force }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        // Server chặn vì còn task chưa xong → hỏi quản lý có muốn ép chuyển không
        if (res.status === 409 && !force) {
          const ok = window.confirm(
            `${j?.message || "Còn task Kanban chưa hoàn thành ở bước hiện tại."}\n\nVẫn chuyển bước? Các task chưa xong sẽ giữ nguyên trên bảng Kanban.`
          );
          if (ok) await advanceParticipantApi(pid, nextStepId, true);
          return;
        }
        throw new Error(j?.message || "Không thể chuyển bước.");
      }
      toast.success("Đã chuyển bước và khởi tạo công việc Kanban mới.");

      const wfRes = await fetch(`/api/v1/crud/workflows/${activeId}`, {
        headers: { Authorization: `Bearer ${getAccessToken()}` },
      });
      if (wfRes.ok) {
        const wfJson = await wfRes.json();
        if (wfJson.data) {
          setParticipants(wfJson.data.participants || []);
        }
      }
      fetchWfTasks();
    } catch (err: any) {
      console.error("Lỗi chuyển bước:", err);
      toast.error(err?.message || "Không thể chuyển bước.");
    }
  };

  // ---- Cột hiển thị: mỗi bước + cột Hoàn thành ----
  const columns = useMemo(() => {
    const stepIds = new Set(steps.map((s) => s.id));
    const colOf = (p: WorkflowParticipant) => {
      if (p.currentStepId === DONE_COL) return DONE_COL;
      if (stepIds.has(p.currentStepId)) return p.currentStepId;
      return steps[0]?.id ?? DONE_COL;
    };
    const cols = steps.map((s, i) => ({
      key: s.id,
      order: i + 1,
      step: s,
      isDone: false,
      people: participants.filter((p) => colOf(p) === s.id),
    }));
    cols.push({
      key: DONE_COL,
      order: steps.length + 1,
      step: null as any,
      isDone: true,
      people: participants.filter((p) => colOf(p) === DONE_COL),
    });
    return cols;
  }, [steps, participants]);

  const doneCount = participants.filter((p) => p.currentStepId === DONE_COL).length;

  // =================== VIEW: DANH SÁCH ===================
  if (view === "list") {
    return (
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden" id="workflow_tab">
        <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 bg-white px-4 py-3">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-indigo-600" />
            <h2 className="text-base font-bold text-slate-800">Quy trình</h2>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
              {workflows.length}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={fetchWorkflows}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-slate-500"
              title="Tải lại"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={() => {
                setWizardData(null);
                setWizardOpen(true);
              }}
              disabled={!canEdit}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-bold text-white hover:bg-indigo-500 disabled:opacity-40"
            >
              <Plus className="h-4 w-4" /> Quy trình mới
            </button>
          </div>
        </div>

        {wizardOpen && (
          <NewWorkflowWizard
            usersList={usersList}
            initialData={wizardData || undefined}
            onClose={() => {
              setWizardOpen(false);
              setWizardData(null);
            }}
            onSubmit={handleWizardSubmit}
          />
        )}

        <div className="flex-1 overflow-y-auto p-4">
          {workflows.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <WorkflowIcon className="h-10 w-10 text-slate-300" />
              <p className="mt-3 text-sm font-semibold text-slate-400">
                Chưa có quy trình nào
              </p>
              <p className="text-xs text-slate-400">
                Nhấn “Quy trình mới” để tạo quy trình và theo dõi tiến độ từng người.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {workflows.map((wf) => {
                const total = wf.steps?.length || 0;
                const people = wf.participants || [];
                const done = people.filter((p) => p.currentStepId === DONE_COL).length;
                return (
                  <button
                    key={wf.id}
                    onClick={() => openDetail(wf)}
                    className="group flex flex-col rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                        <WorkflowIcon className="h-5 w-5" />
                      </div>
                      <div className="flex items-center gap-1.5">
                        {wf.category && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                            {wf.category}
                          </span>
                        )}
                        {canEdit && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setWizardData(wf);
                              setWizardOpen(true);
                            }}
                            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-indigo-650 transition-colors"
                            title="Sửa quy trình"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    <h3 className="mt-3 line-clamp-2 text-sm font-bold text-slate-800 group-hover:text-indigo-700">
                      {wf.name}
                    </h3>
                    {wf.description && (
                      <p className="mt-1 line-clamp-2 text-[11px] text-slate-400">
                        {wf.description}
                      </p>
                    )}
                    <div className="mt-3 flex items-center gap-3 border-t border-gray-100 pt-3 text-[11px] font-semibold text-slate-500">
                      <span className="flex items-center gap-1">
                        <Layers className="h-3.5 w-3.5" /> {total} bước
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" /> {people.length} người
                      </span>
                      {people.length > 0 && (
                        <span className="ml-auto flex items-center gap-1 text-emerald-600">
                          <CheckCircle2 className="h-3.5 w-3.5" /> {done} xong
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // =================== VIEW: CHI TIẾT (BẢNG CỘT) ===================
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden" id="workflow_tab">
      {/* Thanh tiêu đề */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 bg-white px-3 py-2">
        <button
          onClick={backToList}
          className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-650 hover:bg-gray-100"
        >
          <ArrowLeft className="h-4 w-4" /> Danh sách
        </button>
        <div className="h-5 w-px bg-gray-200" />
        <input
          value={wfName}
          onChange={(e) => setWfName(e.target.value)}
          disabled={!canEdit}
          placeholder="Tên quy trình"
          className="w-52 rounded-lg border border-gray-205 px-2 py-1 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-400 disabled:bg-gray-50"
        />
        <input
          value={wfCategory}
          onChange={(e) => setWfCategory(e.target.value)}
          disabled={!canEdit}
          placeholder="Nhóm (vd: Onboarding)"
          className="w-40 rounded-lg border border-gray-205 px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-indigo-400 disabled:bg-gray-50"
        />
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={openAddParticipant}
            disabled={!canEdit}
            className="flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" /> Tạo công việc
          </button>
          <button
            onClick={openNewStep}
            disabled={!canEdit}
            className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40"
            style={{ background: ACCENT }}
          >
            <Plus className="h-3.5 w-3.5" /> Thêm bước
          </button>
          <button
            onClick={handleSave}
            disabled={!canEdit || saving}
            className="flex items-center gap-1 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-700 disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" /> {saving ? "Đang lưu..." : "Lưu"}
          </button>
          <button
            onClick={handleDeleteWorkflow}
            disabled={!canEdit}
            className="flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1.5 text-xs font-bold text-red-650 hover:bg-red-50 disabled:opacity-40"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Thanh thống kê nhỏ */}
      <div className="flex items-center gap-4 border-b border-gray-100 bg-slate-50/60 px-4 py-1.5 text-[11px] font-semibold text-slate-500">
        <span className="flex items-center gap-1">
          <Layers className="h-3.5 w-3.5" /> {steps.length} bước
        </span>
        <span className="flex items-center gap-1">
          <Users className="h-3.5 w-3.5" /> {participants.length} công việc đang chạy
        </span>
        <span className="flex items-center gap-1 text-emerald-600">
          <CheckCircle2 className="h-3.5 w-3.5" /> {doneCount} đã hoàn thành
        </span>
        <label
          className={`ml-auto flex items-center gap-1.5 ${canEdit ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}
          title="Khi mọi task Kanban của bước hiện tại hoàn thành, case tự chuyển sang bước kế tiếp"
        >
          <input
            type="checkbox"
            checked={wfAutoAdvance}
            disabled={!canEdit}
            onChange={(e) => {
              const v = e.target.checked;
              setWfAutoAdvance(v);
              autoPersist({ autoAdvance: v });
            }}
            className="h-3.5 w-3.5 accent-indigo-600"
          />
          <Zap className="h-3.5 w-3.5 text-indigo-500" /> Tự chuyển bước khi xong task
        </label>
      </div>

      {/* Bảng cột */}
      {steps.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <Layers className="h-8 w-8 text-slate-300" />
          <p className="mt-2 text-sm font-semibold text-slate-400">
            Chưa có bước nào trong quy trình
          </p>
          <p className="text-xs text-slate-400">
            Nhấn “Thêm bước” để tạo cột đầu tiên, rồi tạo công việc để chạy theo quy trình.
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto overflow-y-hidden">
          <style>{`
            @keyframes wfArrowSlide {
              0%, 100% { transform: translateX(-3px); opacity: 0.6; }
              50% { transform: translateX(3px); opacity: 1; }
            }
          `}</style>
          <div className="flex h-full min-h-0 items-stretch gap-3 p-4">
            {columns.map((col, ci) => (
              <React.Fragment key={col.key}>
                {/* Mũi tên giả định chiều di chuyển giữa các bước */}
                {ci > 0 && (
                  <div className="flex shrink-0 flex-col items-center justify-center self-center">
                    <ArrowRight
                      className="h-7 w-7"
                      strokeWidth={2.75}
                      style={{
                        color: col.isDone ? "#10b981" : ACCENT,
                        animation: "wfArrowSlide 1s ease-in-out infinite",
                      }}
                    />
                  </div>
                )}
              <div
                className="flex h-full w-72 shrink-0 flex-col rounded-2xl border border-gray-200 bg-gray-50/70"
              >
                {/* Header cột */}
                <div
                  className="flex items-start gap-2 rounded-t-2xl px-3 py-2"
                  style={{
                    background: col.isDone ? "#ecfdf5" : "#fff",
                    borderBottom: `2px solid ${col.isDone ? "#10b981" : ACCENT}`,
                  }}
                >
                  <span
                    className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                    style={{ background: col.isDone ? "#10b981" : ACCENT }}
                  >
                    {col.isDone ? <CheckCircle2 className="h-3 w-3" /> : col.order}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold text-slate-800">
                      {col.isDone ? "Hoàn thành" : col.step.title}
                    </div>
                    {!col.isDone && (
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[10px] font-semibold text-slate-400">
                        {col.step.assignee && <span>👤 {col.step.assignee}</span>}
                        {typeof col.step.estDays === "number" && col.step.estDays > 0 && (
                          <span>⏱ {col.step.estDays} ngày</span>
                        )}
                      </div>
                    )}
                  </div>
                  <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">
                    {col.people.length}
                  </span>
                  {!col.isDone && canEdit && (
                    <div className="flex flex-col gap-0.5">
                      <button
                        onClick={() => setStepDraft(col.step)}
                        className="rounded p-0.5 text-slate-450 hover:bg-gray-150 hover:text-indigo-650"
                        title="Sửa bước"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Nút sắp xếp / xóa bước */}
                {!col.isDone && canEdit && (
                  <div className="flex items-center gap-1 px-3 py-1">
                    <button
                      onClick={() => moveStep(col.step.id, -1)}
                      disabled={col.order === 1}
                      className="rounded p-0.5 text-slate-300 hover:bg-gray-100 hover:text-slate-600 disabled:opacity-30"
                      title="Chuyển sang trái"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => moveStep(col.step.id, 1)}
                      disabled={col.order === steps.length}
                      className="rounded p-0.5 text-slate-300 hover:bg-gray-100 hover:text-slate-600 disabled:opacity-30"
                      title="Chuyển sang phải"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => deleteStep(col.step.id)}
                      className="ml-auto rounded p-0.5 text-slate-300 hover:bg-red-50 hover:text-red-500"
                      title="Xóa bước"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                {/* Danh sách người trong cột */}
                <div className="flex-1 space-y-2 overflow-y-auto px-2 pb-2 pt-1">
                  {col.people.length === 0 && (
                    <p className="px-1 py-3 text-center text-[11px] text-slate-300">
                      Trống
                    </p>
                  )}
                  {col.people.map((p) => {
                    const pStepTasks = wfTasks.filter(
                      (t) => t.participantId === p.id && t.workflowStepId === p.currentStepId && t.status !== "Archived"
                    );
                    const doneTasks = pStepTasks.filter((t) => t.status === "Done" || t.status === "done").length;
                    const totalTasks = pStepTasks.length;
                    const progressPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 100;
                    const allTasksDone = pStepTasks.every((t) => t.status === "Done" || t.status === "done");

                    return (
                      <div
                        key={p.id}
                        className="rounded-xl border border-gray-200 bg-white p-2 shadow-sm"
                      >
                        <div className="flex items-center gap-2">
                          <img
                            src={p.avatar || avatarUrl(p.name)}
                            alt={p.name}
                            className="h-7 w-7 shrink-0 rounded-full object-cover"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-xs font-bold text-slate-700">
                              {p.name}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {col.isDone
                                ? `✓ Xong · ${fmtDate(p.updatedAt)}`
                                : `Bước ${col.order}/${steps.length} · ${fmtDate(
                                    p.updatedAt
                                  )}`}
                            </div>
                          </div>
                          {canEdit && (
                            <button
                              onClick={() => removeParticipant(p.id)}
                              className="rounded p-0.5 text-slate-300 hover:bg-red-50 hover:text-red-500"
                              title="Gỡ khỏi quy trình"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>

                        {/* Badge ưu tiên & hạn hoàn thành của công việc */}
                        {((p.priority && p.priority !== "normal") || p.dueDate) && (
                          <div className="mt-1.5 flex flex-wrap items-center gap-1">
                            {p.priority === "urgent_important" && (
                              <span className="rounded-full bg-red-50 px-1.5 py-0.5 text-[9px] font-extrabold text-red-600">
                                🔥 Gấp & Q.trọng
                              </span>
                            )}
                            {p.priority === "urgent" && (
                              <span className="rounded-full bg-orange-50 px-1.5 py-0.5 text-[9px] font-extrabold text-orange-600">
                                ⚡ Cần gấp
                              </span>
                            )}
                            {p.priority === "important" && (
                              <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-extrabold text-amber-600">
                                ★ Quan trọng
                              </span>
                            )}
                            {p.dueDate && (
                              <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-500">
                                ⏰ Hạn {fmtDate(p.dueDate)}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Kanban task progress */}
                        {!col.isDone && totalTasks > 0 && (
                          <div
                            className="mt-2 p-1.5 rounded-lg bg-slate-50 hover:bg-indigo-50 border border-slate-100 transition-all cursor-pointer"
                            onClick={() =>
                              setSelectedPartTasks({
                                part: p,
                                stepTitle: col.step.title,
                                tasks: pStepTasks,
                              })
                            }
                            title="Nhấp để xem chi tiết công việc Kanban"
                          >
                            <div className="flex items-center justify-between text-[9px] font-extrabold text-indigo-700 uppercase mb-1">
                              <span>Công việc ({doneTasks}/{totalTasks})</span>
                              <span>{progressPct}%</span>
                            </div>
                            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                              <div
                                className="bg-indigo-650 h-full rounded-full transition-all"
                                style={{ width: `${progressPct}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Bước đã xong hết task → badge bám trên card đến khi chuyển bước */}
                        {!col.isDone && totalTasks > 0 && allTasksDone && (
                          <div className="mt-1 flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-extrabold text-emerald-600">
                            <CheckCircle2 className="h-3 w-3" /> Sẵn sàng chuyển bước
                          </div>
                        )}

                        {p.note && (
                          <p className="mt-1 line-clamp-2 rounded-md bg-slate-50 px-1.5 py-1 text-[10px] text-slate-500">
                            {p.note}
                          </p>
                        )}
                        {canEdit && (
                          <div className="mt-1.5 flex items-center gap-1">
                            <button
                              onClick={() => {
                                if (col.isDone) return;
                                // Còn task chưa xong → mở drawer xem thay vì disabled im lặng
                                if (!allTasksDone) {
                                  setSelectedPartTasks({
                                    part: p,
                                    stepTitle: col.step.title,
                                    tasks: pStepTasks,
                                  });
                                  return;
                                }
                                const orderIds = [...steps.map((s) => s.id), DONE_COL];
                                const idx = orderIds.indexOf(p.currentStepId);
                                const nextStepId = orderIds[idx + 1];
                                if (nextStepId) {
                                  advanceParticipantApi(p.id, nextStepId);
                                }
                              }}
                              disabled={col.isDone}
                              className={`flex flex-1 items-center justify-center gap-0.5 rounded-md py-1 text-[10px] font-bold transition-all ${
                                col.isDone
                                  ? "bg-slate-300 text-white opacity-30 cursor-not-allowed"
                                  : !allTasksDone
                                  ? "border border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100"
                                  : "text-white"
                              }`}
                              style={!col.isDone && allTasksDone ? { background: ACCENT } : {}}
                              title={
                                !allTasksDone
                                  ? "Nhấp để xem các task còn lại của bước này"
                                  : "Chuyển sang bước tiếp theo"
                              }
                            >
                              {!col.isDone && !allTasksDone ? (
                                <>Còn {totalTasks - doneTasks}/{totalTasks} task</>
                              ) : (
                                <>Tiếp <ChevronRight className="h-3 w-3" /></>
                              )}
                            </button>
                            <div className="relative">
                              <button
                                onClick={() => setCardMenuFor(cardMenuFor === p.id ? null : p.id)}
                                className="rounded-md border border-gray-200 px-1.5 py-1 text-[10px] font-bold leading-none text-slate-500 hover:bg-gray-50"
                                title="Thao tác khác"
                              >
                                ⋯
                              </button>
                              {cardMenuFor === p.id && (
                                <>
                                  <div className="fixed inset-0 z-20" onClick={() => setCardMenuFor(null)} />
                                  <div className="absolute right-0 z-30 mt-1 w-44 rounded-lg border border-gray-200 bg-white py-1 text-[10px] font-semibold text-slate-600 shadow-xl">
                                    <button
                                      onClick={() => {
                                        setCardMenuFor(null);
                                        moveParticipant(p.id, -1);
                                      }}
                                      disabled={col.order === 1 && !col.isDone}
                                      className="flex w-full items-center gap-1 px-3 py-1.5 text-left hover:bg-slate-50 disabled:opacity-30"
                                    >
                                      <ChevronLeft className="h-3 w-3" /> Lùi một bước
                                    </button>
                                    {!col.isDone && (
                                      <>
                                        <div className="my-1 border-t border-gray-100" />
                                        <p className="px-3 py-0.5 text-[9px] font-extrabold uppercase text-slate-400">
                                          Chuyển đến bước
                                        </p>
                                        {steps
                                          .filter((s) => s.id !== p.currentStepId)
                                          .map((s) => (
                                            <button
                                              key={s.id}
                                              onClick={() => {
                                                setCardMenuFor(null);
                                                advanceParticipantApi(p.id, s.id);
                                              }}
                                              className="block w-full truncate px-3 py-1.5 text-left hover:bg-slate-50"
                                            >
                                              {steps.findIndex((x) => x.id === s.id) + 1}. {s.title}
                                            </button>
                                          ))}
                                        <button
                                          onClick={() => {
                                            setCardMenuFor(null);
                                            advanceParticipantApi(p.id, DONE_COL);
                                          }}
                                          className="block w-full px-3 py-1.5 text-left text-emerald-600 hover:bg-emerald-50"
                                        >
                                          ✓ Hoàn thành
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              </React.Fragment>
            ))}

            {/* Cột thêm bước nhanh */}
            {canEdit && (
              <button
                onClick={openNewStep}
                className="flex h-full w-56 shrink-0 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-200 text-slate-400 hover:border-indigo-300 hover:text-indigo-500"
              >
                <Plus className="h-6 w-6" />
                <span className="text-xs font-semibold">Thêm bước</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Modal chỉnh sửa bước — dùng chung editor với wizard tạo quy trình */}
      {stepDraft && (
        <WizardStepEditorModal
          step={stepDraft}
          steps={steps}
          stepIndex={(() => {
            const i = steps.findIndex((s) => s.id === stepDraft.id);
            return i >= 0 ? i : steps.length; // bước mới → coi như nằm cuối
          })()}
          usersList={usersList}
          isDark={isDark}
          onClose={() => setStepDraft(null)}
          onSave={saveStepDraft}
        />
      )}

      {/* Modal thêm người tham gia */}
      {partDraft && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
          onClick={() => setPartDraft(null)}
        >
          <div
            className={`flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border shadow-2xl ${
              isDark
                ? "bg-[#1c1c1c] text-zinc-150 border-zinc-800"
                : "bg-white text-slate-850 border-gray-200"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={`flex items-center justify-between border-b px-5 py-4 ${
                isDark ? "border-zinc-800 bg-[#181818]" : "border-gray-200 bg-white"
              }`}
            >
              <div className="flex items-center gap-2">
                <Target className={`h-5 w-5 ${isDark ? "text-indigo-400" : "text-indigo-600"}`} />
                <div>
                  <h3 className={`text-sm font-extrabold ${isDark ? "text-zinc-150" : "text-slate-800"}`}>
                    Tạo công việc theo quy trình
                  </h3>
                  <p className={`text-[11px] ${isDark ? "text-zinc-500" : "text-slate-400"}`}>
                    Công việc sẽ bắt đầu ở bước 1 · «{steps[0]?.title}» và tự sinh task Kanban
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPartDraft(null)}
                className={`p-1.5 rounded-xl ${
                  isDark ? "hover:bg-zinc-800 text-zinc-400" : "hover:bg-gray-100 text-slate-400"
                }`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              {/* Tên công việc */}
              <div>
                <label className={`text-[11px] font-extrabold uppercase tracking-wide ${isDark ? "text-zinc-500" : "text-slate-450"}`}>
                  Tên công việc <span className="text-red-500">*</span>
                </label>
                <input
                  value={partDraft.name}
                  onChange={(e) => setPartDraft({ ...partDraft, name: e.target.value })}
                  placeholder="VD: Onboarding Nguyễn Văn A, Xử lý hợp đồng #123…"
                  autoFocus
                  className={`mt-1.5 w-full rounded-xl border px-3 py-2 text-sm font-semibold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 ${
                    isDark ? "bg-[#242424] border-zinc-700 text-zinc-200" : "border-gray-200"
                  }`}
                />
              </div>

              {/* Dự án/ Lĩnh vực */}
              <div>
                <label className={`text-[11px] font-extrabold uppercase tracking-wide ${isDark ? "text-zinc-500" : "text-slate-450"}`}>
                  Dự án/ Lĩnh vực
                </label>
                <select
                  value={partDraft.projectId}
                  onChange={(e) => setPartDraft({ ...partDraft, projectId: e.target.value })}
                  className={`mt-1.5 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 ${
                    isDark ? "bg-[#242424] border-zinc-700 text-zinc-200" : "border-gray-200"
                  }`}
                >
                  <option value="">— Chưa chọn dự án —</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Phụ trách + Ưu tiên */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={`text-[11px] font-extrabold uppercase tracking-wide ${isDark ? "text-zinc-500" : "text-slate-450"}`}>
                    Người phụ trách chính
                  </label>
                  <select
                    value={partDraft.userUid}
                    onChange={(e) => setPartDraft({ ...partDraft, userUid: e.target.value })}
                    className={`mt-1.5 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 ${
                      isDark ? "bg-[#242424] border-zinc-700 text-zinc-200" : "border-gray-200"
                    }`}
                  >
                    <option value="">— Chưa gán —</option>
                    {usersList.map((u) => (
                      <option key={u.uid} value={u.uid}>
                        {u.displayName}
                        {u.jobTitle ? ` (${u.jobTitle})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={`text-[11px] font-extrabold uppercase tracking-wide ${isDark ? "text-zinc-500" : "text-slate-450"}`}>
                    Độ ưu tiên
                  </label>
                  <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                    {(
                      [
                        { key: "urgent_important", label: "Gấp & Q.trọng" },
                        { key: "urgent", label: "Cần gấp" },
                        { key: "important", label: "Quan trọng" },
                        { key: "normal", label: "Thoải mái" },
                      ] as const
                    ).map((pr) => (
                      <button
                        key={pr.key}
                        onClick={() => setPartDraft({ ...partDraft, priority: pr.key })}
                        className={`rounded-lg border px-2 py-1.5 text-[11px] font-bold transition-all ${
                          partDraft.priority === pr.key
                            ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                            : isDark
                            ? "border-zinc-700 text-zinc-400 hover:border-zinc-500"
                            : "border-gray-200 text-slate-500 hover:border-gray-300"
                        }`}
                      >
                        {pr.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Thời gian */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={`text-[11px] font-extrabold uppercase tracking-wide ${isDark ? "text-zinc-500" : "text-slate-450"}`}>
                    Ngày bắt đầu
                  </label>
                  <input
                    type="date"
                    value={partDraft.startDate}
                    onChange={(e) => setPartDraft({ ...partDraft, startDate: e.target.value })}
                    className={`mt-1.5 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 ${
                      isDark ? "bg-[#242424] border-zinc-700 text-zinc-200" : "border-gray-200"
                    }`}
                  />
                </div>
                <div>
                  <label className={`text-[11px] font-extrabold uppercase tracking-wide ${isDark ? "text-zinc-500" : "text-slate-450"}`}>
                    Hạn hoàn thành toàn quy trình
                  </label>
                  <input
                    type="date"
                    value={partDraft.dueDate}
                    onChange={(e) => setPartDraft({ ...partDraft, dueDate: e.target.value })}
                    className={`mt-1.5 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 ${
                      isDark ? "bg-[#242424] border-zinc-700 text-zinc-200" : "border-gray-200"
                    }`}
                  />
                </div>
              </div>

              {/* Lịch trình dự kiến — tự tính từ thông tin các bước, nối đuôi nhau */}
              {steps.length > 0 && (
                <div
                  className={`rounded-2xl border p-3 ${
                    isDark ? "border-zinc-800 bg-[#181818]" : "border-gray-200 bg-gray-50"
                  }`}
                >
                  <p className={`text-[11px] font-extrabold uppercase tracking-wide ${isDark ? "text-zinc-500" : "text-slate-450"}`}>
                    Lịch trình dự kiến theo các bước
                  </p>
                  <div className="mt-2 space-y-1.5">
                    {buildStepSchedulePreview(steps, partDraft.startDate).map((s, i) => (
                      <div key={s.stepId} className="flex items-center justify-between gap-3 text-[11px]">
                        <span className={`truncate font-semibold ${isDark ? "text-zinc-300" : "text-slate-600"}`}>
                          {i + 1}. {s.title}
                        </span>
                        <span className={`shrink-0 font-mono ${isDark ? "text-zinc-500" : "text-slate-450"}`}>
                          {s.due
                            ? `${fmtScheduleDatetime(s.start)} → ${fmtScheduleDatetime(s.due)}${
                                s.durationDays ? ` · ${s.durationDays} ngày` : ""
                              }`
                            : "Chưa có thời lượng"}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className={`mt-2 text-[10px] ${isDark ? "text-zinc-600" : "text-slate-400"}`}>
                    Công việc con trong mỗi bước dùng chung thời gian với bước cha. Bước chưa có
                    thời lượng (không ước lượng ngày, không deadline) sẽ không dịch lịch các bước sau.
                  </p>
                </div>
              )}

              {/* Mô tả */}
              <div>
                <label className={`text-[11px] font-extrabold uppercase tracking-wide ${isDark ? "text-zinc-500" : "text-slate-450"}`}>
                  Mô tả chi tiết
                </label>
                <textarea
                  value={partDraft.description}
                  onChange={(e) => setPartDraft({ ...partDraft, description: e.target.value })}
                  rows={3}
                  placeholder="Bối cảnh, yêu cầu, thông tin cần thiết cho công việc này…"
                  className={`mt-1.5 w-full resize-none rounded-xl border px-3 py-2 text-sm outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 ${
                    isDark ? "bg-[#242424] border-zinc-700 text-zinc-200" : "border-gray-200"
                  }`}
                />
              </div>

              {/* Người liên quan */}
              <div>
                <label className={`text-[11px] font-extrabold uppercase tracking-wide ${isDark ? "text-zinc-500" : "text-slate-450"}`}>
                  Người liên quan
                </label>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {usersList.map((u) => {
                    const selected = partDraft.relatedUids.includes(u.uid);
                    return (
                      <button
                        key={u.uid}
                        onClick={() =>
                          setPartDraft({
                            ...partDraft,
                            relatedUids: selected
                              ? partDraft.relatedUids.filter((x) => x !== u.uid)
                              : [...partDraft.relatedUids, u.uid],
                          })
                        }
                        className={`flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-bold transition-all ${
                          selected
                            ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                            : isDark
                            ? "border-zinc-700 text-zinc-400 hover:border-zinc-500"
                            : "border-gray-200 text-slate-500 hover:border-gray-300"
                        }`}
                      >
                        <img
                          src={avatarUrl(u.displayName, u.photoURL)}
                          alt={u.displayName}
                          className="h-4 w-4 rounded-full object-cover"
                        />
                        {u.displayName}
                        {selected && <Check className="h-3 w-3" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Công việc con bổ sung */}
              <div>
                <label className={`text-[11px] font-extrabold uppercase tracking-wide ${isDark ? "text-zinc-500" : "text-slate-450"}`}>
                  Công việc con bổ sung (ngoài subtasks của bước 1)
                </label>
                <div className="mt-1.5 space-y-1.5">
                  {partDraft.customSubTasks.map((st) => (
                    <div
                      key={st.id}
                      className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs ${
                        isDark ? "border-zinc-700 bg-[#242424]" : "border-gray-150 bg-slate-50"
                      }`}
                    >
                      <Circle className="h-3 w-3 shrink-0 text-indigo-400" />
                      <span className="flex-1 truncate font-semibold">{st.title}</span>
                      <button
                        onClick={() =>
                          setPartDraft({
                            ...partDraft,
                            customSubTasks: partDraft.customSubTasks.filter((x) => x.id !== st.id),
                          })
                        }
                        className="rounded p-0.5 text-slate-300 hover:bg-red-50 hover:text-red-500"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  <div className="flex gap-1.5">
                    <input
                      value={newCaseSubTask}
                      onChange={(e) => setNewCaseSubTask(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newCaseSubTask.trim()) {
                          setPartDraft({
                            ...partDraft,
                            customSubTasks: [
                              ...partDraft.customSubTasks,
                              { id: genId("cst"), title: newCaseSubTask.trim() },
                            ],
                          });
                          setNewCaseSubTask("");
                        }
                      }}
                      placeholder="Nhập tên công việc con rồi Enter…"
                      className={`flex-1 rounded-xl border px-3 py-1.5 text-xs outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 ${
                        isDark ? "bg-[#242424] border-zinc-700 text-zinc-200" : "border-gray-200"
                      }`}
                    />
                    <button
                      onClick={() => {
                        if (!newCaseSubTask.trim()) return;
                        setPartDraft({
                          ...partDraft,
                          customSubTasks: [
                            ...partDraft.customSubTasks,
                            { id: genId("cst"), title: newCaseSubTask.trim() },
                          ],
                        });
                        setNewCaseSubTask("");
                      }}
                      className="rounded-xl bg-indigo-600 px-3 text-white hover:bg-indigo-500"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Link tài liệu */}
              <div>
                <label className={`text-[11px] font-extrabold uppercase tracking-wide ${isDark ? "text-zinc-500" : "text-slate-450"}`}>
                  Link tài liệu / hồ sơ
                </label>
                <div className="mt-1.5 space-y-1.5">
                  {partDraft.docLinks.map((link, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs ${
                        isDark ? "border-zinc-700 bg-[#242424]" : "border-gray-150 bg-slate-50"
                      }`}
                    >
                      <Paperclip className="h-3 w-3 shrink-0 text-slate-400" />
                      <span className="flex-1 truncate text-indigo-600">{link}</span>
                      <button
                        onClick={() =>
                          setPartDraft({
                            ...partDraft,
                            docLinks: partDraft.docLinks.filter((_, j) => j !== i),
                          })
                        }
                        className="rounded p-0.5 text-slate-300 hover:bg-red-50 hover:text-red-500"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  <div className="flex gap-1.5">
                    <input
                      value={newCaseDocLink}
                      onChange={(e) => setNewCaseDocLink(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newCaseDocLink.trim()) {
                          setPartDraft({
                            ...partDraft,
                            docLinks: [...partDraft.docLinks, newCaseDocLink.trim()],
                          });
                          setNewCaseDocLink("");
                        }
                      }}
                      placeholder="https://… (Drive, Notion, hợp đồng…) rồi Enter"
                      className={`flex-1 rounded-xl border px-3 py-1.5 text-xs outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 ${
                        isDark ? "bg-[#242424] border-zinc-700 text-zinc-200" : "border-gray-200"
                      }`}
                    />
                    <button
                      onClick={() => {
                        if (!newCaseDocLink.trim()) return;
                        setPartDraft({
                          ...partDraft,
                          docLinks: [...partDraft.docLinks, newCaseDocLink.trim()],
                        });
                        setNewCaseDocLink("");
                      }}
                      className="rounded-xl bg-indigo-600 px-3 text-white hover:bg-indigo-500"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Ghi chú */}
              <div>
                <label className={`text-[11px] font-extrabold uppercase tracking-wide ${isDark ? "text-zinc-500" : "text-slate-450"}`}>
                  Ghi chú
                </label>
                <input
                  value={partDraft.note}
                  onChange={(e) => setPartDraft({ ...partDraft, note: e.target.value })}
                  placeholder="Lưu ý ngắn hiển thị trên thẻ công việc…"
                  className={`mt-1.5 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 ${
                    isDark ? "bg-[#242424] border-zinc-700 text-zinc-200" : "border-gray-200"
                  }`}
                />
              </div>
            </div>

            <div
              className={`flex items-center justify-between border-t px-5 py-3.5 ${
                isDark ? "border-zinc-800 bg-[#181818]" : "border-gray-200 bg-white"
              }`}
            >
              <p className={`text-[11px] ${isDark ? "text-zinc-500" : "text-slate-400"}`}>
                {(steps[0]?.subTasks?.length || 1) + partDraft.customSubTasks.length} task Kanban
                sẽ được tạo ở bước 1
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPartDraft(null)}
                  className={`rounded-xl border px-4 py-2 text-xs font-bold ${
                    isDark
                      ? "border-zinc-700 text-zinc-400 hover:bg-zinc-800"
                      : "border-gray-200 text-slate-650 hover:bg-gray-50"
                  }`}
                >
                  Hủy
                </button>
                <button
                  onClick={saveParticipantDraft}
                  className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-extrabold text-white hover:bg-indigo-500"
                >
                  <Plus className="h-3.5 w-3.5" /> Tạo công việc
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Drawer xem danh sách công việc Kanban của người tham gia */}
      {selectedPartTasks && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/40"
          onClick={() => setSelectedPartTasks(null)}
        >
          <div
            className={`w-full max-w-md h-full shadow-2xl flex flex-col p-5 animate-in slide-in-from-right duration-200 transition-colors ${
              isDark ? "bg-[#1c1c1c] text-zinc-150 border-l border-zinc-800" : "bg-white text-slate-800"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`flex items-center justify-between border-b pb-3 mb-4 ${isDark ? "border-zinc-800" : "border-gray-200"}`}>
              <div>
                <h3 className={`text-sm font-bold ${isDark ? "text-zinc-200" : "text-slate-800"}`}>
                  Công việc của: {selectedPartTasks.part.name}
                </h3>
                <p className={`text-xs ${isDark ? "text-zinc-500" : "text-slate-400"}`}>
                  Bước: {selectedPartTasks.stepTitle}
                </p>
              </div>
              <button
                onClick={() => setSelectedPartTasks(null)}
                className={`p-1.5 rounded-lg transition-colors ${
                  isDark ? "hover:bg-zinc-800 text-zinc-400 hover:text-zinc-250" : "hover:bg-gray-100 text-slate-400"
                }`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3">
              {selectedPartTasks.tasks.length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-6">
                  Không có công việc nào ở bước này.
                </p>
              ) : (
                selectedPartTasks.tasks.map((task) => (
                  <div
                    key={task.id || task._id}
                    className={`p-3 border rounded-xl transition-all ${
                      isDark
                        ? "bg-[#242424] border-zinc-850 hover:bg-[#282828] text-zinc-200"
                        : "bg-slate-50/50 border-gray-150 hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-bold">{task.title}</span>
                      <span className="flex items-center gap-1">
                      {onNavigateToKanban && (task._id || task.id) && (
                        <button
                          onClick={() => {
                            setSelectedPartTasks(null);
                            onNavigateToKanban(String(task._id || task.id));
                          }}
                          title="Mở trên bảng Kanban"
                          className={`p-1 rounded-md transition-colors ${
                            isDark
                              ? "text-zinc-500 hover:bg-zinc-800 hover:text-indigo-400"
                              : "text-slate-400 hover:bg-indigo-50 hover:text-indigo-600"
                          }`}
                        >
                          <ExternalLink className="h-3 w-3" />
                        </button>
                      )}
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border whitespace-nowrap ${
                        task.status === "Done" || task.status === "done"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-250"
                          : task.status === "In Progress" || task.status === "doing"
                          ? "bg-sky-50 text-sky-700 border-sky-200"
                          : "bg-slate-100 text-slate-500 border-gray-250"
                      }`}>
                        {task.status === "Done" || task.status === "done" ? "Đã xong" :
                         task.status === "In Progress" || task.status === "doing" ? "Đang làm" : "Chưa làm"}
                      </span>
                      </span>
                    </div>
                    <div className={`mt-2 flex items-center justify-between text-[10px] ${
                      isDark ? "text-zinc-550" : "text-slate-400"
                    }`}>
                      <span>👤 {task.assignee}</span>
                      {task.dueDate && <span>⏱ {task.dueDate}</span>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============ Wizard 2 bước tạo quy trình mới ============
function NewWorkflowWizard({
  usersList,
  initialData,
  onClose,
  onSubmit,
}: {
  usersList: UserProfile[];
  initialData?: {
    name: string;
    category: string;
    description: string;
    steps: WorkflowStep[];
  };
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    category: string;
    description: string;
    steps: WorkflowStep[];
  }) => void | Promise<void>;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState(initialData?.name || "Quy trình mới");
  const [category, setCategory] = useState(initialData?.category || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [steps, setSteps] = useState<WorkflowStep[]>(initialData?.steps || []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [editingStep, setEditingStep] = useState<WorkflowStep | null>(null);

  // Check if dark mode is active in the document element
  const [isDarkTheme, setIsDarkTheme] = useState(() =>
    document.documentElement.classList.contains("dark")
  );

  useEffect(() => {
    // Observe class changes on documentElement to dynamically toggle theme
    const observer = new MutationObserver(() => {
      setIsDarkTheme(document.documentElement.classList.contains("dark"));
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  const isDark = isDarkTheme;

  const addStage = () => {
    const s: WorkflowStep = {
      id: genId("step"),
      title: `Giai đoạn ${steps.length + 1}`,
      description: "",
      assigneeUid: "",
      assignee: "",
      estDays: undefined,
      deliverable: "",
      note: "",
    };
    setSteps((prev) => [...prev, s]);
    setSelectedId(s.id);
  };

  const deleteStep = (id: string) => {
    setSteps((prev) => prev.filter((s) => s.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const reorder = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    setSteps((prev) => {
      const arr = [...prev];
      const from = arr.findIndex((s) => s.id === dragId);
      const to = arr.findIndex((s) => s.id === targetId);
      if (from < 0 || to < 0) return prev;
      const [moved] = arr.splice(from, 1);
      arr.splice(to, 0, moved);
      return arr;
    });
    setDragId(null);
  };

  const goNext = () => {
    if (!name.trim()) {
      toast.error("Vui lòng nhập tên quy trình.");
      return;
    }
    setStep(2);
  };

  const handleFinish = async () => {
    if (steps.length === 0) {
      toast.error("Hãy thêm ít nhất một giai đoạn công việc.");
      return;
    }
    if (steps.some((s) => !s.title.trim())) {
      toast.error("Mỗi bước cần có tên.");
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({ name, category, description, steps });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className={`flex max-h-[90vh] w-full flex-col overflow-hidden rounded-3xl shadow-2xl transition-all duration-300 ${
          step === 2 ? "max-w-6xl" : "max-w-4xl"
        } ${
          isDark
            ? "bg-[#121212] border border-zinc-800 text-zinc-100"
            : "bg-white border border-gray-200 text-slate-850"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header + Title */}
        <div
          className={`flex items-center justify-between border-b px-6 py-4.5 transition-colors ${
            isDark ? "bg-[#181818] border-zinc-800" : "bg-white border-gray-250"
          }`}
        >
          <div className="flex items-center gap-2">
            <WorkflowIcon className={`h-5 w-5 ${isDark ? "text-indigo-400" : "text-indigo-650"}`} />
            <h3 className={`text-sm font-extrabold uppercase tracking-wide ${isDark ? "text-zinc-150" : "text-slate-800"}`}>
              {isDark ? (
                <>
                  Sửa các Giai đoạn cho Quy trình{" "}
                  <span className="text-indigo-400 font-black">
                    {name.trim() ? name.toUpperCase() : "QUY TRÌNH MỚI"}
                  </span>
                </>
              ) : (
                "Tạo quy trình mới"
              )}
            </h3>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
              isDark ? "hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200" : "hover:bg-gray-100 text-slate-405"
            }`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Step Indicator row (only on step 1) */}
        {!isDark && (
          <div className="flex items-center gap-2 border-b border-gray-150 bg-slate-50/60 px-6 py-3">
            {[
              { n: 1, label: "Thông tin quy trình" },
              { n: 2, label: "Thiết lập giai đoạn" },
            ].map((s, i) => (
              <React.Fragment key={s.n}>
                <div className="flex items-center gap-2">
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
                      step >= (s.n as 1 | 2) ? "bg-indigo-650 text-white" : "bg-gray-200 text-slate-500"
                    }`}
                  >
                    {s.n}
                  </span>
                  <span className={`text-xs font-bold ${step === s.n ? "text-indigo-700" : "text-slate-400"}`}>
                    {s.label}
                  </span>
                </div>
                {i === 0 && <div className="h-px w-8 bg-gray-300" />}
              </React.Fragment>
            ))}
          </div>
        )}

        {/* ---- BƯỚC 1: Thông tin ---- */}
        {step === 1 && (
          <div className="flex-1 space-y-4 overflow-y-auto p-6">
            <div>
              <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                <FileText className="h-4 w-4" /> Tên quy trình
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="VD: Onboarding nhân viên mới"
                className="mt-1.5 w-full rounded-2xl border border-gray-250 px-4 py-2.5 text-xs font-semibold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all shadow-2xs"
              />
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                <Layers className="h-4 w-4" /> Nhóm / phân loại
              </label>
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="VD: Nhân sự, Vận hành…"
                className="mt-1.5 w-full rounded-2xl border border-gray-250 px-4 py-2.5 text-xs font-semibold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all shadow-2xs"
              />
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                <Info className="h-4 w-4" /> Ghi chú / mô tả quy trình
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                placeholder="Mục tiêu, phạm vi áp dụng, lưu ý chung của quy trình…"
                className="mt-1.5 w-full resize-none rounded-2xl border border-gray-250 px-4 py-2.5 text-xs font-semibold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all shadow-2xs"
              />
            </div>
          </div>
        )}

        {/* ---- BƯỚC 2: Thiết lập giai đoạn theo snake layout ---- */}
        {step === 2 && (
          <div className="flex min-h-0 flex-1">
            {/* Flowchart workspace (Left Column) */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
              }}
              onDrop={(e) => {
                const data = e.dataTransfer.getData("text/plain");
                if (data === "new-step") {
                  addStage();
                }
              }}
              className={`flex-1 p-8 overflow-y-auto flex items-center justify-center min-h-[450px] relative border-r transition-colors ${
                isDark ? "bg-[#141414] border-zinc-800/80" : "bg-slate-50/50 border-gray-200"
              }`}
            >
              {/* Decorative top-left selection tool */}
              <button
                type="button"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/plain", "new-step");
                  e.dataTransfer.effectAllowed = "copy";
                }}
                className={`absolute top-4 left-4 p-2.5 border rounded-xl transition-all shadow-sm cursor-grab active:cursor-grabbing ${
                  isDark
                    ? "bg-[#1f1f1f] border-zinc-800 text-zinc-500 hover:text-zinc-300"
                    : "bg-white border-gray-200 text-slate-400 hover:text-slate-600"
                }`}
                title="Kéo thả vào vùng làm việc để tạo giai đoạn mới"
              >
                <div className={`w-4 h-4 border rounded ${isDark ? "border-zinc-500" : "border-gray-300"}`} />
              </button>

              {steps.length === 0 ? (
                <div className={`text-center transition-colors ${isDark ? "text-zinc-550" : "text-slate-400"}`}>
                  <WorkflowIcon className={`h-10 w-10 mx-auto mb-3 ${isDark ? "text-zinc-700" : "text-slate-300"}`} />
                  <p className="text-xs font-bold">Chưa có giai đoạn nào</p>
                  <p className={`text-[10px] mt-1 ${isDark ? "text-zinc-650" : "text-slate-400"}`}>
                    Hãy thêm giai đoạn ở danh sách bên phải.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-5 gap-y-16 gap-x-12 relative p-4 max-w-3xl w-full">
                  {(() => {
                    const rowsCount = Math.ceil(steps.length / 5);
                    const cellsCount = rowsCount * 5;
                    const gridCells = Array(cellsCount).fill(null);

                    steps.forEach((s, idx) => {
                      const r = Math.floor(idx / 5);
                      const c = idx % 5;
                      const c_pos = r % 2 === 0 ? c : 4 - c;
                      gridCells[r * 5 + c_pos] = { step: s, index: idx };
                    });

                    return gridCells.map((cell, gridIdx) => {
                      if (!cell) {
                        return <div key={`empty-${gridIdx}`} className="w-32 h-20" />;
                      }

                      const { step: s, index: idx } = cell;
                      const isSelected = selectedId === s.id;
                      const r = Math.floor(idx / 5);

                      let arrow = null;
                      if (idx < steps.length - 1) {
                        const nextIdx = idx + 1;
                        const r_next = Math.floor(nextIdx / 5);
                        if (r === r_next) {
                          if (r % 2 === 0) {
                            arrow = (
                              <div className="absolute top-1/2 -translate-y-1/2 -right-8 z-10 flex items-center justify-center">
                                <ArrowRight className={`h-4 w-4 animate-pulse ${isDark ? "text-zinc-550" : "text-slate-400"}`} />
                              </div>
                            );
                          } else {
                            arrow = (
                              <div className="absolute top-1/2 -translate-y-1/2 -left-8 z-10 flex items-center justify-center">
                                <ArrowLeft className={`h-4 w-4 animate-pulse ${isDark ? "text-zinc-550" : "text-slate-400"}`} />
                              </div>
                            );
                          }
                        } else {
                          arrow = (
                            <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 z-10 flex items-center justify-center">
                              <ArrowDown className={`h-4 w-4 animate-pulse ${isDark ? "text-zinc-550" : "text-slate-400"}`} />
                            </div>
                          );
                        }
                      }

                      return (
                        <div
                          key={s.id}
                          onClick={() => setSelectedId(s.id)}
                          className={`w-32 h-20 relative rounded-xl border flex flex-col justify-center items-center p-2.5 transition-all duration-300 cursor-pointer ${
                            isSelected
                              ? isDark
                                ? "border-indigo-500 bg-indigo-950/20 shadow-md shadow-indigo-500/10 scale-102"
                                : "border-indigo-500 bg-indigo-50 shadow-md shadow-indigo-500/10 scale-102"
                              : isDark
                              ? "border-zinc-700 bg-zinc-900/50 hover:bg-zinc-800/85 hover:border-zinc-500"
                              : "border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300"
                          }`}
                        >
                          <span
                            className={`absolute -top-3 left-3 text-[9px] font-bold px-1.5 py-0.5 rounded border shadow-sm transition-colors ${
                              isDark
                                ? "bg-zinc-800 text-zinc-400 border-zinc-700"
                                : "bg-white text-slate-550 border-gray-200"
                            }`}
                          >
                            {idx + 1}
                          </span>

                          <span
                            className={`text-[10px] font-extrabold uppercase text-center tracking-wide leading-tight px-1 line-clamp-3 transition-colors ${
                              isSelected
                                ? isDark
                                  ? "text-indigo-400"
                                  : "text-indigo-700"
                                : isDark
                                ? "text-zinc-100"
                                : "text-slate-700"
                            }`}
                          >
                            {s.title || "(CHƯA ĐẶT TÊN)"}
                          </span>

                          {idx === 0 && (
                            <div className="absolute -left-6 top-1/2 -translate-y-1/2 -rotate-90 bg-emerald-600/90 text-white font-extrabold text-[7px] uppercase tracking-wider px-1.5 py-0.5 rounded-t-md shadow-sm">
                              Bắt đầu
                            </div>
                          )}

                          {arrow}
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </div>

            {/* Sidebar list layout (Right Column) */}
            <div
              className={`w-80 flex flex-col border-l transition-colors duration-300 ${
                isDark ? "bg-[#1a1a1a] border-zinc-800" : "bg-white border-gray-200"
              }`}
            >
              <div
                className={`px-4 py-3 border-b flex flex-wrap items-center justify-between gap-2 shadow-2xs transition-colors duration-300 ${
                  isDark ? "bg-[#1d1d1d] border-zinc-800/85" : "bg-slate-50 border-gray-200"
                }`}
              >
                <button
                  type="button"
                  onClick={() => toast.info("Tính năng đang phát triển.")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 border text-[10px] font-extrabold rounded-xl transition-all cursor-pointer ${
                    isDark
                      ? "bg-zinc-850 border-zinc-750 text-zinc-350 hover:text-white hover:bg-zinc-800"
                      : "bg-white border-gray-200 text-slate-500 hover:text-slate-800 hover:bg-gray-50"
                  }`}
                >
                  <WorkflowIcon className="h-3.5 w-3.5 text-indigo-400" />
                  Thiết lập thông tin cho nhiều giai đoạn
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={addStage}
                    className="p-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all cursor-pointer shadow-xs active:scale-95"
                    title="Thêm giai đoạn"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                  <div
                    className={`flex gap-0.5 border rounded-lg p-0.5 transition-colors ${
                      isDark ? "border-zinc-800 bg-[#141414]" : "border-gray-200 bg-gray-50"
                    }`}
                  >
                    <button
                      className={`p-1 transition-colors ${
                        isDark ? "text-zinc-650 hover:text-zinc-400" : "text-slate-400 hover:text-slate-655"
                      }`}
                      title="Sắp xếp"
                    >
                      <ChevronLeft className="h-3.5 w-3.5 rotate-90" />
                    </button>
                    <button
                      className={`p-1 transition-colors ${
                        isDark ? "text-zinc-650 hover:text-zinc-400" : "text-slate-400 hover:text-slate-655"
                      }`}
                      title="Bố cục"
                    >
                      <ChevronRight className="h-3.5 w-3.5 rotate-90" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Sidebar scrollable list */}
              <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5">
                {steps.length === 0 ? (
                  <p className="text-center text-xs text-zinc-650 py-8 font-bold">Danh sách trống</p>
                ) : (
                  steps.map((s, i) => (
                    <div
                      key={s.id}
                      draggable
                      onDragStart={() => setDragId(s.id)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => reorder(s.id)}
                      className={`flex items-center gap-3 border p-2.5 rounded-xl transition-all cursor-pointer shadow-3xs ${
                        selectedId === s.id
                          ? isDark
                            ? "border-indigo-500/80 bg-indigo-950/10"
                            : "border-indigo-500/80 bg-indigo-50/50"
                          : isDark
                          ? "bg-[#242424] hover:bg-[#2e2e2e] border-zinc-800"
                          : "bg-white hover:bg-slate-50/80 border-gray-200"
                      }`}
                      onClick={() => setSelectedId(s.id)}
                    >
                      <GripVertical
                        className={`h-4 w-4 shrink-0 cursor-grab transition-colors ${
                          isDark ? "text-zinc-650 hover:text-zinc-450" : "text-slate-400 hover:text-slate-650"
                        }`}
                      />
                      <span
                        className={`font-extrabold text-xs px-2 py-0.5 rounded-lg shadow-3xs border transition-colors ${
                          isDark
                            ? "bg-zinc-800 text-zinc-350 border-zinc-700"
                            : "bg-gray-100 text-slate-500 border-gray-200"
                        }`}
                      >
                        {i + 1}
                      </span>
                      <span
                        className={`text-xs font-bold truncate flex-1 transition-colors ${
                          isDark ? "text-zinc-200" : "text-slate-750"
                        }`}
                      >
                        {s.title || "(Chưa đặt tên)"}
                      </span>
                      {i === 0 && (
                        <span className="bg-emerald-955 text-emerald-400 border border-emerald-900/40 text-[9px] px-1.5 py-0.5 rounded-md font-extrabold shadow-3xs">
                          Bắt đầu
                        </span>
                      )}
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedId(s.id);
                            setEditingStep(s);
                          }}
                          className={`p-1 rounded-md transition-colors cursor-pointer ${
                            isDark
                              ? "text-zinc-450 hover:bg-zinc-800 hover:text-indigo-400"
                              : "text-slate-400 hover:bg-slate-100 hover:text-indigo-650"
                          }`}
                          title="Sửa giai đoạn"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteStep(s.id);
                          }}
                          className={`p-1 rounded-md transition-colors cursor-pointer ${
                            isDark
                              ? "text-zinc-450 hover:bg-zinc-800 hover:text-rose-455"
                              : "text-slate-400 hover:bg-slate-100 hover:text-rose-650"
                          }`}
                          title="Xóa giai đoạn"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Footer controls */}
        <div
          className={`flex items-center justify-between border-t px-6 py-4.5 transition-colors ${
            isDark ? "bg-[#181818] border-zinc-800" : "bg-white border-gray-250"
          }`}
        >
          <div>
            {isDark && (
              <button
                onClick={() => setStep(1)}
                className="flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-[#1f1f1f] text-zinc-400 px-4.5 py-2 text-xs font-bold hover:bg-zinc-800 hover:text-zinc-200 transition-all cursor-pointer shadow-3xs"
              >
                <ArrowLeft className="h-4 w-4" /> Quay lại
              </button>
            )}
          </div>
          <div className="flex gap-3">
            {step === 1 ? (
              <>
                <button
                  onClick={onClose}
                  className="rounded-xl border border-gray-250 px-5 py-2 text-xs font-bold text-slate-650 hover:bg-slate-50 transition-all cursor-pointer shadow-3xs"
                >
                  Hủy
                </button>
                <button
                  onClick={goNext}
                  className="flex items-center gap-1.5 rounded-xl bg-indigo-650 px-5 py-2 text-xs font-bold text-white hover:bg-indigo-750 transition-all cursor-pointer shadow-sm shadow-indigo-500/10"
                >
                  Tiếp tục <ChevronRight className="h-4 w-4" />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={onClose}
                  className="rounded-xl border border-zinc-800 px-5 py-2 text-xs font-bold text-zinc-450 hover:text-zinc-200 hover:bg-zinc-800 transition-all cursor-pointer shadow-3xs"
                >
                  Hủy
                </button>
                <button
                  onClick={handleFinish}
                  disabled={submitting}
                  className="flex items-center gap-1.5 rounded-xl bg-indigo-655 hover:bg-indigo-750 text-white px-6 py-2 text-xs font-extrabold shadow-sm transition-all cursor-pointer disabled:opacity-50 active:scale-98"
                >
                  {submitting ? "Đang lưu..." : "Lưu"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Pop-up modal to edit stage details */}
      {editingStep && (
        <WizardStepEditorModal
          step={editingStep}
          steps={steps}
          stepIndex={steps.findIndex((s) => s.id === editingStep.id)}
          usersList={usersList}
          isDark={isDark}
          onClose={() => setEditingStep(null)}
          onSave={(updatedStep) => {
            setSteps((prev) => prev.map((s) => (s.id === updatedStep.id ? updatedStep : s)));
            setEditingStep(null);
          }}
        />
      )}
    </div>
  );
}

// ============ Modal chỉnh sửa thông tin giai đoạn trong Wizard ============
function WizardStepEditorModal({
  step,
  steps,
  stepIndex,
  usersList,
  isDark,
  onClose,
  onSave,
}: {
  step: WorkflowStep;
  steps: WorkflowStep[];
  stepIndex: number;
  usersList: UserProfile[];
  isDark: boolean;
  onClose: () => void;
  onSave: (updatedStep: WorkflowStep) => void;
}) {
  const [title, setTitle] = useState(step.title);
  const [description, setDescription] = useState(step.description || "");
  const [assigneeUids, setAssigneeUids] = useState<string[]>(step.assigneeUids || (step.assigneeUid ? [step.assigneeUid] : []));
  const [relatedUids, setRelatedUids] = useState<string[]>(step.relatedUids || []);
  const [domain, setDomain] = useState(step.domain || "");
  const [projects, setProjects] = useState<any[]>([]);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await fetch("/api/v1/crud/projects", {
          headers: {
            "Authorization": `Bearer ${getAccessToken()}`,
          },
        });
        if (res.ok) {
          const json = await res.json();
          const projData = (json.data || []).map((item: any) => ({
            ...item,
            id: item._id,
          }));
          setProjects(projData);
        }
      } catch (err) {
        console.error("Lỗi khi tải danh sách dự án:", err);
      }
    };
    fetchProjects();
  }, []);
  const [priority, setPriority] = useState<WorkflowStep["priority"]>(step.priority || "normal");
  const [deadlineType, setDeadlineType] = useState<WorkflowStep["deadlineType"]>(step.deadlineType || "none");
  const [deadlineDays, setDeadlineDays] = useState(step.deadlineDays ?? 3);
  const [deadlineTime, setDeadlineTime] = useState(step.deadlineTime || "");
  const [subTasks, setSubTasks] = useState<WorkflowSubTask[]>(step.subTasks || []);
  const [newSubTask, setNewSubTask] = useState("");

  const isFirstStep = stepIndex === 0;
  const nextStep = steps[stepIndex + 1] || null;

  const toggleAssignee = (uid: string) => {
    setAssigneeUids((prev) =>
      prev.includes(uid) ? prev.filter((x) => x !== uid) : [...prev, uid]
    );
  };

  const toggleRelated = (uid: string) => {
    setRelatedUids((prev) =>
      prev.includes(uid) ? prev.filter((x) => x !== uid) : [...prev, uid]
    );
  };

  const addSubTask = () => {
    if (!newSubTask.trim()) return;
    setSubTasks((prev) => [
      ...prev,
      { id: `st_${Date.now()}`, title: newSubTask.trim() },
    ]);
    setNewSubTask("");
  };

  const removeSubTask = (id: string) => {
    setSubTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const handleSave = () => {
    const primaryUid = assigneeUids[0] || "";
    const primaryUser = usersList.find((x) => x.uid === primaryUid);
    onSave({
      ...step,
      title: title.trim() || step.title,
      description,
      assigneeUid: primaryUid,
      assignee: primaryUser?.displayName || "",
      assigneeUids,
      relatedUids,
      domain,
      priority,
      deadlineType,
      deadlineDays,
      deadlineTime,
      subTasks,
    });
  };

  const avatarUrl = (u: UserProfile) =>
    u.photoURL && (u.photoURL.startsWith("http") || u.photoURL.startsWith("/"))
      ? u.photoURL
      : `https://ui-avatars.com/api/?name=${encodeURIComponent(u.displayName)}&background=4f46e5&color=fff`;

  const inp = `w-full px-3 py-2 rounded-xl text-xs focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 font-semibold transition-all ${
    isDark
      ? "bg-[#242424] border border-zinc-750 text-zinc-200"
      : "bg-white border border-gray-200 text-slate-800"
  }`;

  const lbl = `block text-[11px] uppercase tracking-wide font-extrabold mb-1.5 ${
    isDark ? "text-zinc-500" : "text-slate-450"
  }`;

  const PRIORITIES: { key: WorkflowStep["priority"]; label: string; color: string; icon: React.ReactNode }[] = [
    { key: "urgent_important", label: "Cần gặp và Q.trọng", color: "#06b6d4", icon: <Zap className="h-3 w-3" /> },
    { key: "urgent",           label: "Cần gặp",           color: "#f97316", icon: <AlertCircle className="h-3 w-3" /> },
    { key: "important",        label: "Quan trọng",        color: "#ef4444", icon: <AlertTriangle className="h-3 w-3" /> },
    { key: "normal",           label: "Thoải mái",          color: "#94a3b8", icon: <Smile className="h-3 w-3" /> },
  ];

  const DEADLINES: { key: WorkflowStep["deadlineType"]; label: string }[] = [
    { key: "same_day", label: "Cùng ngày" },
    { key: "after_1",  label: "Sau 1 ngày" },
    { key: "after_2",  label: "Sau 2 ngày" },
    { key: "after_x",  label: "Sau x ngày" },
    { key: "none",     label: "Không có" },
    { key: "custom_time", label: "..." },
  ];

  const row = `flex items-start gap-3 py-2.5 border-b transition-colors ${
    isDark ? "border-zinc-800/60" : "border-gray-100"
  }`;

  const rowLabel = `w-28 shrink-0 text-[11px] font-bold pt-0.5 ${
    isDark ? "text-zinc-500" : "text-slate-450"
  }`;

  const selectedProject = projects.find((p) => p.id === domain || p._id === domain);
  const displayDomain = selectedProject ? selectedProject.name : domain;

  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center bg-black/55 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-xl rounded-3xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-colors ${
          isDark
            ? "bg-[#1c1c1c] text-zinc-150 border-zinc-800"
            : "bg-white text-slate-850 border-gray-200"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between px-5 py-3.5 border-b flex-shrink-0 transition-colors ${
            isDark ? "bg-[#1a1a1a] border-zinc-800/80" : "bg-slate-50 border-gray-200"
          }`}
        >
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold ${isDark ? "text-zinc-500" : "text-slate-400"}`}>
              Giai đoạn
            </span>
            <span className="text-sm font-extrabold text-indigo-500">{title.toUpperCase() || "(CHƯA ĐẶT TÊN)"}</span>
            {isFirstStep && (
              <span className="ml-1 px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[9px] font-extrabold uppercase">
                Bắt đầu
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              isDark ? "hover:bg-zinc-800 text-zinc-450 hover:text-zinc-200" : "hover:bg-gray-100 text-slate-400"
            }`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto px-5 pt-3 pb-2 space-y-0.5">

          {/* Tên */}
          <div className={row}>
            <span className={rowLabel}>Tên *</span>
            <div className="flex flex-1 items-center gap-2">
              <input
                value={stepIndex + 1}
                disabled
                className={`w-10 text-center rounded-xl text-xs font-bold border transition-all ${
                  isDark ? "bg-zinc-800 border-zinc-700 text-zinc-400" : "bg-gray-100 border-gray-200 text-slate-500"
                } py-1.5`}
              />
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={`${inp} flex-1`}
                placeholder="Tên giai đoạn..."
              />
            </div>
          </div>

          {/* Người phụ trách */}
          <div className={row}>
            <span className={rowLabel}>Người phụ trách</span>
            <div className="flex-1">
              <div className="flex flex-wrap gap-1.5 mb-2">
                {assigneeUids.map((uid) => {
                  const u = usersList.find((x) => x.uid === uid);
                  if (!u) return null;
                  return (
                    <div
                      key={uid}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[11px] font-bold transition-colors ${
                        isDark ? "bg-zinc-800 border-zinc-700 text-zinc-200" : "bg-indigo-50 border-indigo-200 text-indigo-700"
                      }`}
                    >
                      <img src={avatarUrl(u)} className="h-4 w-4 rounded-full" alt="" />
                      {u.displayName}
                      <button onClick={() => toggleAssignee(uid)} className="hover:text-red-400">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
                {/* Unselected users to add */}
                <div className="relative group">
                  <button
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-bold transition-colors ${
                      isDark ? "bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200" : "bg-white border-gray-200 text-slate-400 hover:text-slate-700"
                    }`}
                  >
                    <Users className="h-3 w-3" /> Thêm
                  </button>
                  <div
                    className={`absolute left-0 top-8 z-10 w-52 rounded-2xl border shadow-xl overflow-auto max-h-48 hidden group-focus-within:block ${
                      isDark ? "bg-[#1e1e1e] border-zinc-700" : "bg-white border-gray-200"
                    }`}
                  >
                    {usersList
                      .filter((u) => !assigneeUids.includes(u.uid))
                      .map((u) => (
                        <button
                          key={u.uid}
                          onMouseDown={(e) => { e.preventDefault(); toggleAssignee(u.uid); }}
                          className={`flex w-full items-center gap-2 px-3 py-2 text-[11px] font-semibold transition-colors ${
                            isDark ? "hover:bg-zinc-800 text-zinc-300" : "hover:bg-slate-50 text-slate-700"
                          }`}
                        >
                          <img src={avatarUrl(u)} className="h-5 w-5 rounded-full" alt="" />
                          {u.displayName}
                        </button>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Người liên quan */}
          <div className={row}>
            <span className={rowLabel}>Người liên quan</span>
            <div className="flex-1">
              <div className="flex flex-wrap gap-1.5">
                {relatedUids.map((uid) => {
                  const u = usersList.find((x) => x.uid === uid);
                  if (!u) return null;
                  return (
                    <div
                      key={uid}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[11px] font-bold ${
                        isDark ? "bg-zinc-800 border-zinc-700 text-zinc-200" : "bg-slate-50 border-gray-200 text-slate-600"
                      }`}
                    >
                      <img src={avatarUrl(u)} className="h-4 w-4 rounded-full" alt="" />
                      {u.displayName}
                      <button onClick={() => toggleRelated(uid)} className="hover:text-red-400">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
                <div className="relative group">
                  <button
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-bold transition-colors ${
                      isDark ? "bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200" : "bg-white border-gray-200 text-slate-400 hover:text-slate-700"
                    }`}
                  >
                    <User className="h-3 w-3" /> Thêm
                  </button>
                  <div
                    className={`absolute left-0 top-8 z-10 w-52 rounded-2xl border shadow-xl overflow-auto max-h-48 hidden group-focus-within:block ${
                      isDark ? "bg-[#1e1e1e] border-zinc-700" : "bg-white border-gray-200"
                    }`}
                  >
                    {usersList
                      .filter((u) => !relatedUids.includes(u.uid))
                      .map((u) => (
                        <button
                          key={u.uid}
                          onMouseDown={(e) => { e.preventDefault(); toggleRelated(u.uid); }}
                          className={`flex w-full items-center gap-2 px-3 py-2 text-[11px] font-semibold transition-colors ${
                            isDark ? "hover:bg-zinc-800 text-zinc-300" : "hover:bg-slate-50 text-slate-700"
                          }`}
                        >
                          <img src={avatarUrl(u)} className="h-5 w-5 rounded-full" alt="" />
                          {u.displayName}
                        </button>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Lĩnh vực / dự án */}
          <div className={row}>
            <span className={rowLabel}>Lĩnh vực / dự án</span>
            <div className="flex-1 flex items-center gap-2">
              {domain && (
                <span
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                    isDark ? "bg-cyan-950/30 border-cyan-700 text-cyan-400" : "bg-cyan-50 border-cyan-200 text-cyan-700"
                  }`}
                >
                  {displayDomain}
                  <button onClick={() => setDomain("")} className="hover:text-red-400 ml-1">
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              )}
              <select
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                className={`${inp} flex-1 max-w-[220px]`}
              >
                <option value="">-- Chọn dự án --</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
                {domain && !projects.some((p) => p.id === domain || p._id === domain) && (
                  <option value={domain}>
                    {domain} (Cũ)
                  </option>
                )}
              </select>
            </div>
          </div>

          {/* Độ ưu tiên */}
          <div className={row}>
            <span className={rowLabel}>Độ ưu tiên</span>
            <div className="flex-1 flex flex-wrap gap-2">
              {PRIORITIES.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setPriority(p.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-extrabold transition-all ${
                    priority === p.key
                      ? "text-white shadow-sm"
                      : isDark
                      ? "bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200"
                      : "bg-white border-gray-200 text-slate-500 hover:text-slate-700"
                  }`}
                  style={priority === p.key ? { background: p.color, borderColor: p.color } : {}}
                >
                  {p.icon} {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Hạn chốt */}
          <div className={row}>
            <span className={rowLabel}>Hạn chốt</span>
            <div className="flex-1">
              <div className="flex flex-wrap gap-1.5">
                {DEADLINES.map((d) => (
                  <button
                    key={d.key}
                    onClick={() => setDeadlineType(d.key)}
                    className={`px-3 py-1.5 rounded-xl border text-[11px] font-extrabold transition-all ${
                      deadlineType === d.key
                        ? isDark
                          ? "bg-cyan-600 border-cyan-500 text-white"
                          : "bg-cyan-500 border-cyan-400 text-white"
                        : isDark
                        ? "bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200"
                        : "bg-white border-gray-200 text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
              {deadlineType === "after_x" && (
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    value={deadlineDays}
                    onChange={(e) => setDeadlineDays(Number(e.target.value))}
                    className={`${inp} w-20`}
                  />
                  <span className={`text-xs ${isDark ? "text-zinc-500" : "text-slate-400"}`}>ngày</span>
                </div>
              )}
              {/* Chọn giờ */}
              <div className="mt-2 flex items-center gap-2">
                <button
                  onClick={() => setDeadlineType(deadlineType === "custom_time" ? "none" : "custom_time")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-semibold transition-all ${
                    deadlineType === "custom_time"
                      ? isDark ? "bg-cyan-600 border-cyan-500 text-white" : "bg-cyan-500 border-cyan-400 text-white"
                      : isDark ? "bg-zinc-800 border-zinc-700 text-zinc-450" : "bg-white border-gray-200 text-slate-500"
                  }`}
                >
                  <Clock className="h-3 w-3" /> Chọn giờ
                </button>
                {deadlineType === "custom_time" && (
                  <input
                    type="time"
                    value={deadlineTime}
                    onChange={(e) => setDeadlineTime(e.target.value)}
                    className={`${inp} w-28`}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Mô tả */}
          <div className={row}>
            <span className={rowLabel}>Mô tả</span>
            <div className="flex-1 relative">
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Mô tả giai đoạn..."
                className={`${inp} pr-8`}
              />
              <Pencil className={`absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 ${
                isDark ? "text-zinc-600" : "text-slate-350"
              }`} />
            </div>
          </div>

          {/* Công việc con */}
          <div className={`py-2.5 border-b transition-colors ${
            isDark ? "border-zinc-800/60" : "border-gray-100"
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-[11px] font-extrabold uppercase tracking-wide ${
                isDark ? "text-cyan-400" : "text-cyan-600"
              }`}>
                Công việc con ({subTasks.length})
              </span>
            </div>
            <div className="space-y-1.5">
              {subTasks.map((t) => (
                <div
                  key={t.id}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition-colors ${
                    isDark ? "bg-zinc-800/60 border-zinc-700 text-zinc-200" : "bg-slate-50 border-gray-100 text-slate-700"
                  }`}
                >
                  <Check className="h-3 w-3 text-emerald-500 shrink-0" />
                  <span className="flex-1 uppercase tracking-wide">{t.title}</span>
                  <button onClick={() => removeSubTask(t.id)} className={`hover:text-red-400 ${
                    isDark ? "text-zinc-600" : "text-slate-350"
                  }`}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <div className="flex items-center gap-2 mt-1">
                <Plus className={`h-3.5 w-3.5 ${
                  isDark ? "text-zinc-550" : "text-slate-400"
                }`} />
                <input
                  value={newSubTask}
                  onChange={(e) => setNewSubTask(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") addSubTask(); }}
                  placeholder="Thêm công việc con..."
                  className={`flex-1 text-xs font-semibold outline-none bg-transparent transition-colors ${
                    isDark ? "text-zinc-300 placeholder-zinc-700" : "text-slate-700 placeholder-slate-350"
                  }`}
                />
                {newSubTask && (
                  <button
                    onClick={addSubTask}
                    className="text-[10px] font-bold text-indigo-500 hover:text-indigo-400"
                  >
                    Thêm
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* File đính kèm */}
          <div className={`py-2.5 border-b transition-colors ${
            isDark ? "border-zinc-800/60" : "border-gray-100"
          }`}>
            <span className={`text-[11px] font-extrabold uppercase tracking-wide mb-2 block ${
              isDark ? "text-cyan-400" : "text-cyan-600"
            }`}>
              File đính kèm
            </span>
            <div className="flex items-center gap-3">
              {[
                { icon: <Paperclip className="h-4 w-4" />, color: "text-slate-500", title: "Tập tin" },
                { icon: <span className="text-xs font-black" style={{color:"#f97316"}}>N</span>, color: "", title: "Notion" },
                { icon: <Mic className="h-4 w-4" />, color: "text-purple-500", title: "Ghi âm" },
                { icon: <Circle className="h-4 w-4 fill-red-500" />, color: "text-red-500", title: "Quay màn hình" },
                { icon: <CloudUpload className="h-4 w-4" />, color: "text-green-500", title: "Google Drive" },
                { icon: <Table2 className="h-4 w-4" />, color: "text-indigo-400", title: "Bảng" },
              ].map((a, i) => (
                <button
                  key={i}
                  title={a.title}
                  className={`p-1.5 rounded-lg transition-colors ${a.color} ${
                    isDark ? "hover:bg-zinc-800" : "hover:bg-slate-100"
                  }`}
                  onClick={() => toast.info("Tính năng đính kèm đang phát triển.")}
                >
                  {a.icon}
                </button>
              ))}
            </div>
          </div>

          {/* Giai đoạn tiếp theo */}
          {nextStep && (
            <div className={`py-2.5`}>
              <span className={`text-[11px] font-extrabold uppercase tracking-wide mb-2 block ${
                isDark ? "text-cyan-400" : "text-cyan-600"
              }`}>
                Giai đoạn tiếp theo
              </span>
              <div
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl border-2 border-dashed transition-colors ${
                  isDark ? "border-zinc-700 bg-zinc-800/30" : "border-gray-200 bg-slate-50/50"
                }`}
              >
                <ArrowRight className={`h-4 w-4 shrink-0 ${
                  isDark ? "text-zinc-600" : "text-slate-300"
                }`} />
                <div
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-extrabold uppercase tracking-wide ${
                    isDark ? "bg-zinc-800 border-zinc-700 text-zinc-200" : "bg-white border-gray-200 text-slate-700"
                  }`}
                >
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border mr-1 ${
                    isDark ? "bg-zinc-700 border-zinc-600 text-zinc-400" : "bg-gray-100 border-gray-200 text-slate-500"
                  }`}>
                    {steps.indexOf(nextStep) + 1}
                  </span>
                  {nextStep.title}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className={`flex justify-end gap-2.5 px-5 py-3.5 border-t flex-shrink-0 transition-colors ${
            isDark ? "bg-[#1a1a1a] border-zinc-800/80" : "bg-slate-50 border-gray-200"
          }`}
        >
          <button
            onClick={onClose}
            className={`px-4.5 py-2 border rounded-xl text-xs font-bold transition-all cursor-pointer ${
              isDark
                ? "border-zinc-700 text-zinc-450 hover:text-zinc-200 hover:bg-zinc-800"
                : "border-gray-250 text-slate-600 hover:bg-gray-100"
            }`}
          >
            Hủy
          </button>
          <button
            onClick={handleSave}
            className="px-5.5 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-xl text-xs font-extrabold transition-all cursor-pointer shadow-sm active:scale-98"
          >
            Ghi nhận
          </button>
        </div>
      </div>
    </div>
  );
}

