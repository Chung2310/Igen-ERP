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
} from "lucide-react";
import {
  UserProfile,
  Workflow,
  WorkflowStep,
  WorkflowParticipant,
} from "../../types";
import { getAccessToken } from "../../services/authService";
import { toast } from "../../pages/Toast";

interface WorkflowTabProps {
  userProfile: UserProfile | null;
  selectedCompanyCode: string;
  isManager: boolean;
  usersList: UserProfile[];
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

export default function WorkflowTab({
  userProfile,
  selectedCompanyCode,
  isManager,
  usersList,
}: WorkflowTabProps) {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<"list" | "detail">("list");
  const [wizardOpen, setWizardOpen] = useState(false);

  // ---- Trạng thái trang chi tiết ----
  const [activeId, setActiveId] = useState<string>("");
  const [wfName, setWfName] = useState("");
  const [wfCategory, setWfCategory] = useState("");
  const [wfDescription, setWfDescription] = useState("");
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [participants, setParticipants] = useState<WorkflowParticipant[]>([]);
  const [saving, setSaving] = useState(false);

  // Modal chỉnh sửa bước & thêm người
  const [stepDraft, setStepDraft] = useState<WorkflowStep | null>(null);
  const [partDraft, setPartDraft] = useState<{
    userUid: string;
    name: string;
    note: string;
  } | null>(null);

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

  // ---- Mở trang chi tiết (wf = null → tạo mới) ----
  const openDetail = (wf: Workflow | null) => {
    if (!wf) {
      setActiveId("");
      setWfName("Quy trình mới");
      setWfCategory("");
      setWfDescription("");
      setSteps([]);
      setParticipants([]);
    } else {
      setActiveId(wf.id);
      setWfName(wf.name);
      setWfCategory(wf.category || "");
      setWfDescription(wf.description || "");
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

  // ---- Tạo quy trình mới từ wizard, rồi mở luôn bảng theo dõi ----
  const createFromWizard = async (data: {
    name: string;
    category: string;
    description: string;
    steps: WorkflowStep[];
  }) => {
    try {
      const res = await fetch("/api/v1/crud/workflows", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAccessToken()}`,
        },
        body: JSON.stringify({
          name: data.name.trim(),
          category: data.category.trim(),
          description: data.description.trim(),
          steps: data.steps,
          participants: [],
          creatorUid: userProfile?.uid || "",
        }),
      });
      if (!res.ok) throw new Error("create failed");
      const json = await res.json();
      const wf: Workflow = { ...json.data, id: json.data._id };
      toast.success("Đã tạo quy trình mới.");
      setWizardOpen(false);
      await fetchWorkflows();
      openDetail(wf);
    } catch (err) {
      console.error("Lỗi tạo quy trình:", err);
      toast.error("Không thể tạo quy trình.");
    }
  };

  // ---- Lưu quy trình; trả về id đã lưu (hoặc "" nếu lỗi) ----
  const persist = useCallback(
    async (
      override?: Partial<{ steps: WorkflowStep[]; participants: WorkflowParticipant[] }>,
      opts?: { silent?: boolean }
    ): Promise<string> => {
      const payload = {
        name: wfName.trim() || "Quy trình mới",
        category: wfCategory.trim(),
        description: wfDescription.trim(),
        steps: override?.steps ?? steps,
        participants: override?.participants ?? participants,
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
    [wfName, wfCategory, wfDescription, steps, participants, activeId, userProfile]
  );

  // Tự lưu ngầm khi kéo người/di chuyển bước (chỉ khi đã có bản ghi)
  const autoPersist = useCallback(
    async (override: Partial<{ steps: WorkflowStep[]; participants: WorkflowParticipant[] }>) => {
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

  const saveStepDraft = () => {
    if (!stepDraft) return;
    if (!stepDraft.title.trim()) {
      toast.error("Vui lòng nhập tên bước.");
      return;
    }
    const exists = steps.some((s) => s.id === stepDraft.id);
    const next = exists
      ? steps.map((s) => (s.id === stepDraft.id ? stepDraft : s))
      : [...steps, stepDraft];
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

  // ---- Thao tác với người tham gia ----
  const openAddParticipant = () => {
    if (steps.length === 0) {
      toast.error("Hãy tạo ít nhất một bước trước khi thêm người theo dõi.");
      return;
    }
    setPartDraft({ userUid: "", name: "", note: "" });
  };

  const saveParticipantDraft = async () => {
    if (!partDraft) return;
    const name = partDraft.name.trim();
    if (!name) {
      toast.error("Vui lòng nhập tên người thực hiện.");
      return;
    }
    const u = usersList.find((x) => x.uid === partDraft.userUid);
    const newPart: WorkflowParticipant = {
      id: genId("part"),
      name,
      userUid: partDraft.userUid || "",
      avatar: avatarUrl(name, u?.photoURL),
      currentStepId: steps[0]?.id ?? DONE_COL,
      note: partDraft.note.trim(),
      startedAt: nowISO(),
      updatedAt: nowISO(),
    };
    const next = [...participants, newPart];
    setParticipants(next);
    setPartDraft(null);
    // Nếu chưa lưu lần đầu, lưu luôn để có activeId cho các lần kéo sau
    if (!activeId) {
      try {
        await persist({ participants: next }, { silent: true });
        await fetchWorkflows();
      } catch {
        toast.error("Không thể lưu người tham gia.");
      }
    } else {
      autoPersist({ participants: next });
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

  const removeParticipant = (pid: string) => {
    const next = participants.filter((p) => p.id !== pid);
    setParticipants(next);
    autoPersist({ participants: next });
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
              onClick={() => setWizardOpen(true)}
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
            onClose={() => setWizardOpen(false)}
            onSubmit={createFromWizard}
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
                      {wf.category && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                          {wf.category}
                        </span>
                      )}
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
            <Users className="h-3.5 w-3.5" /> Thêm người
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
          <Users className="h-3.5 w-3.5" /> {participants.length} người đang theo dõi
        </span>
        <span className="flex items-center gap-1 text-emerald-600">
          <CheckCircle2 className="h-3.5 w-3.5" /> {doneCount} đã hoàn thành
        </span>
      </div>

      {/* Bảng cột */}
      {steps.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <Layers className="h-8 w-8 text-slate-300" />
          <p className="mt-2 text-sm font-semibold text-slate-400">
            Chưa có bước nào trong quy trình
          </p>
          <p className="text-xs text-slate-400">
            Nhấn “Thêm bước” để tạo cột đầu tiên, rồi thêm người để theo dõi tiến độ.
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
                  {col.people.map((p) => (
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
                      {p.note && (
                        <p className="mt-1 line-clamp-2 rounded-md bg-slate-50 px-1.5 py-1 text-[10px] text-slate-500">
                          {p.note}
                        </p>
                      )}
                      {canEdit && (
                        <div className="mt-1.5 flex items-center gap-1">
                          <button
                            onClick={() => moveParticipant(p.id, -1)}
                            disabled={col.order === 1 && !col.isDone}
                            className="flex flex-1 items-center justify-center gap-0.5 rounded-md border border-gray-200 py-1 text-[10px] font-bold text-slate-500 hover:bg-gray-50 disabled:opacity-30"
                          >
                            <ChevronLeft className="h-3 w-3" /> Lùi
                          </button>
                          <button
                            onClick={() => moveParticipant(p.id, 1)}
                            disabled={col.isDone}
                            className="flex flex-1 items-center justify-center gap-0.5 rounded-md py-1 text-[10px] font-bold text-white disabled:opacity-30"
                            style={{ background: col.isDone ? "#94a3b8" : ACCENT }}
                          >
                            Tiếp <ChevronRight className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
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

      {/* Modal chỉnh sửa bước */}
      {stepDraft && (
        <StepEditorModal
          draft={stepDraft}
          usersList={usersList}
          canEdit={canEdit}
          onChange={setStepDraft}
          onClose={() => setStepDraft(null)}
          onSave={saveStepDraft}
        />
      )}

      {/* Modal thêm người tham gia */}
      {partDraft && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setPartDraft(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-800">
                  Thêm người vào quy trình
                </h3>
              </div>
              <button
                onClick={() => setPartDraft(null)}
                className="p-1 rounded hover:bg-gray-100 text-slate-400"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 p-4">
              <div>
                <label className="text-[11px] font-bold text-slate-500">
                  Chọn từ nhân sự (tùy chọn)
                </label>
                <select
                  value={partDraft.userUid}
                  onChange={(e) => {
                    const uid = e.target.value;
                    const u = usersList.find((x) => x.uid === uid);
                    setPartDraft({
                      ...partDraft,
                      userUid: uid,
                      name: u?.displayName || partDraft.name,
                    });
                  }}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                >
                  <option value="">— Nhập tên thủ công —</option>
                  {usersList.map((u) => (
                    <option key={u.uid} value={u.uid}>
                      {u.displayName}
                      {u.jobTitle ? ` (${u.jobTitle})` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500">
                  Tên người thực hiện
                </label>
                <input
                  value={partDraft.name}
                  onChange={(e) =>
                    setPartDraft({ ...partDraft, name: e.target.value })
                  }
                  placeholder="VD: Nguyễn Văn A"
                  className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500">Ghi chú</label>
                <textarea
                  value={partDraft.note}
                  onChange={(e) =>
                    setPartDraft({ ...partDraft, note: e.target.value })
                  }
                  rows={2}
                  placeholder="Thông tin thêm về người này…"
                  className="mt-1 w-full resize-none rounded-lg border border-gray-200 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-200 px-4 py-3">
              <button
                onClick={() => setPartDraft(null)}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-slate-655 hover:bg-gray-50"
              >
                Hủy
              </button>
              <button
                onClick={saveParticipantDraft}
                className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-500"
              >
                <Plus className="h-3.5 w-3.5" /> Thêm vào bước 1
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============ Modal chỉnh sửa chi tiết bước ============
function StepEditorModal({
  draft,
  usersList,
  canEdit,
  onChange,
  onClose,
  onSave,
}: {
  draft: WorkflowStep;
  usersList: UserProfile[];
  canEdit: boolean;
  onChange: (s: WorkflowStep) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const set = (patch: Partial<WorkflowStep>) => onChange({ ...draft, ...patch });
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-800">Chi tiết bước</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 text-slate-400"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-3.5 overflow-y-auto p-4">
          <div>
            <label className="flex items-center gap-1 text-[11px] font-bold text-slate-500">
              <FileText className="h-3.5 w-3.5" /> Tên bước
            </label>
            <input
              value={draft.title}
              onChange={(e) => set({ title: e.target.value })}
              disabled={!canEdit}
              placeholder="VD: Ký hợp đồng thử việc"
              className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          <div>
            <label className="flex items-center gap-1 text-[11px] font-bold text-slate-500">
              <Info className="h-3.5 w-3.5" /> Mô tả chi tiết
            </label>
            <textarea
              value={draft.description || ""}
              onChange={(e) => set({ description: e.target.value })}
              disabled={!canEdit}
              rows={4}
              placeholder="Nội dung công việc cần làm trong bước này…"
              className="mt-1 w-full resize-none rounded-lg border border-gray-200 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          <div>
            <label className="flex items-center gap-1 text-[11px] font-bold text-slate-500">
              <Target className="h-3.5 w-3.5" /> Kết quả / đầu ra mong đợi
            </label>
            <textarea
              value={draft.deliverable || ""}
              onChange={(e) => set({ deliverable: e.target.value })}
              disabled={!canEdit}
              rows={2}
              placeholder="Sản phẩm/tài liệu cần có sau khi hoàn thành bước…"
              className="mt-1 w-full resize-none rounded-lg border border-gray-200 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          <div>
            <label className="flex items-center gap-1 text-[11px] font-bold text-slate-500">
              <User className="h-3.5 w-3.5" /> Người phụ trách
            </label>
            <select
              value={draft.assigneeUid || ""}
              onChange={(e) => {
                const uid = e.target.value;
                const u = usersList.find((x) => x.uid === uid);
                set({ assigneeUid: uid, assignee: u?.displayName || "" });
              }}
              disabled={!canEdit}
              className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
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
            <label className="flex items-center gap-1 text-[11px] font-bold text-slate-500">
              <Clock className="h-3.5 w-3.5" /> Thời hạn (số ngày)
            </label>
            <input
              type="number"
              min={0}
              value={draft.estDays ?? ""}
              onChange={(e) =>
                set({
                  estDays: e.target.value === "" ? undefined : Number(e.target.value),
                })
              }
              disabled={!canEdit}
              placeholder="VD: 3"
              className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          <div>
            <label className="flex items-center gap-1 text-[11px] font-bold text-slate-500">
              <Info className="h-3.5 w-3.5" /> Lưu ý / điều kiện
            </label>
            <textarea
              value={draft.note || ""}
              onChange={(e) => set({ note: e.target.value })}
              disabled={!canEdit}
              rows={2}
              placeholder="Điều kiện tiên quyết, ghi chú, cảnh báo…"
              className="mt-1 w-full resize-none rounded-lg border border-gray-200 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-200 px-4 py-3">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-slate-650 hover:bg-gray-50"
          >
            Hủy
          </button>
          <button
            onClick={onSave}
            disabled={!canEdit}
            className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-500 disabled:opacity-40"
          >
            <Save className="h-3.5 w-3.5" /> Lưu bước
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ Wizard 2 bước tạo quy trình mới ============
function NewWorkflowWizard({
  usersList,
  onClose,
  onSubmit,
}: {
  usersList: UserProfile[];
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    category: string;
    description: string;
    steps: WorkflowStep[];
  }) => void | Promise<void>;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("Quy trình mới");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
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
  usersList,
  isDark,
  onClose,
  onSave,
}: {
  step: WorkflowStep;
  usersList: UserProfile[];
  isDark: boolean;
  onClose: () => void;
  onSave: (updatedStep: WorkflowStep) => void;
}) {
  const [title, setTitle] = useState(step.title);
  const [description, setDescription] = useState(step.description || "");
  const [assigneeUid, setAssigneeUid] = useState(step.assigneeUid || "");
  const [estDays, setEstDays] = useState<number | undefined>(step.estDays);

  const handleSave = () => {
    const u = usersList.find((x) => x.uid === assigneeUid);
    onSave({
      ...step,
      title: title.trim() || step.title,
      description,
      assigneeUid,
      assignee: u?.displayName || "",
      estDays,
    });
  };

  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-md rounded-3xl border shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 transition-colors ${
          isDark
            ? "bg-[#1c1c1c] text-zinc-150 border-zinc-800"
            : "bg-white text-slate-850 border-gray-200"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`flex items-center justify-between border-b px-5.5 py-4 transition-colors ${
            isDark ? "bg-[#1a1a1a] border-zinc-800/80" : "bg-slate-50 border-gray-205"
          }`}
        >
          <div className="flex items-center gap-2">
            <Pencil className="h-4 w-4 text-indigo-500" />
            <h4 className={`text-sm font-bold ${isDark ? "text-zinc-200" : "text-slate-800"}`}>Chi tiết giai đoạn</h4>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              isDark
                ? "hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
                : "hover:bg-gray-150 text-slate-400 hover:text-slate-655"
            }`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5.5 space-y-4">
          <div>
            <label
              className={`block text-[10px] uppercase tracking-wide font-extrabold mb-1.5 ${
                isDark ? "text-zinc-550" : "text-slate-455"
              }`}
            >
              Tên giai đoạn
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={`w-full px-3.5 py-2 rounded-xl text-xs focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 font-semibold transition-all ${
                isDark
                  ? "bg-[#242424] border border-zinc-750 text-zinc-200"
                  : "bg-white border border-gray-200 text-slate-800"
              }`}
            />
          </div>
          <div>
            <label
              className={`block text-[10px] uppercase tracking-wide font-extrabold mb-1.5 ${
                isDark ? "text-zinc-550" : "text-slate-455"
              }`}
            >
              Mô tả chi tiết
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className={`w-full px-3.5 py-2 rounded-xl text-xs focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 font-semibold resize-none transition-all ${
                isDark
                  ? "bg-[#242424] border border-zinc-750 text-zinc-200"
                  : "bg-white border border-gray-200 text-slate-800"
              }`}
            />
          </div>
          <div>
            <label
              className={`block text-[10px] uppercase tracking-wide font-extrabold mb-1.5 ${
                isDark ? "text-zinc-550" : "text-slate-455"
              }`}
            >
              Người phụ trách
            </label>
            <select
              value={assigneeUid}
              onChange={(e) => setAssigneeUid(e.target.value)}
              className={`w-full px-3.5 py-2 rounded-xl text-xs focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 font-semibold cursor-pointer transition-all ${
                isDark
                  ? "bg-[#242424] border border-zinc-750 text-zinc-200"
                  : "bg-white border border-gray-200 text-slate-800"
              }`}
            >
              <option value="">— Chưa gán —</option>
              {usersList.map((u) => (
                <option key={u.uid} value={u.uid}>
                  {u.displayName} {u.jobTitle ? `(${u.jobTitle})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              className={`block text-[10px] uppercase tracking-wide font-extrabold mb-1.5 ${
                isDark ? "text-zinc-550" : "text-slate-455"
              }`}
            >
              Thời gian hoàn thành (ngày)
            </label>
            <input
              type="number"
              min={0}
              value={estDays ?? ""}
              onChange={(e) => setEstDays(e.target.value === "" ? undefined : Number(e.target.value))}
              className={`w-full px-3.5 py-2 rounded-xl text-xs focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 font-semibold transition-all ${
                isDark
                  ? "bg-[#242424] border border-zinc-750 text-zinc-200"
                  : "bg-white border border-gray-200 text-slate-800"
              }`}
            />
          </div>
        </div>
        <div
          className={`border-t px-5.5 py-4 flex justify-end gap-2.5 transition-colors ${
            isDark ? "bg-[#1a1a1a] border-zinc-800/80" : "bg-slate-50 border-gray-205"
          }`}
        >
          <button
            onClick={onClose}
            className={`px-4.5 py-2 border rounded-xl text-xs font-bold transition-all cursor-pointer shadow-3xs ${
              isDark
                ? "border-zinc-700 text-zinc-450 hover:text-zinc-200 hover:bg-zinc-800"
                : "border-gray-250 text-slate-600 hover:bg-slate-100 hover:text-slate-800"
            }`}
          >
            Hủy
          </button>
          <button
            onClick={handleSave}
            className="px-5.5 py-2 bg-indigo-650 hover:bg-indigo-750 text-white rounded-xl text-xs font-extrabold transition-all cursor-pointer shadow-xs active:scale-98"
          >
            Đồng ý
          </button>
        </div>
      </div>
    </div>
  );
}
