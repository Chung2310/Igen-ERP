import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  MarkerType,
  Handle,
  Position,
  type Node,
  type Edge,
  type Connection,
  type NodeChange,
  type EdgeChange,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Plus,
  Save,
  Trash2,
  Play,
  X,
  Flag,
  CheckSquare,
  ClipboardCheck,
  Square,
  RefreshCw,
  ListChecks,
  Calendar,
  AlertTriangle,
} from "lucide-react";
import { UserProfile, Workflow, WorkflowStep, WorkflowEdge } from "../../types";
import { getAccessToken } from "../../services/authService";
import { toast } from "../../pages/Toast";

interface WorkflowTabProps {
  userProfile: UserProfile | null;
  selectedCompanyCode: string;
  isManager: boolean;
  usersList: UserProfile[];
}

type StepType = WorkflowStep["type"];

const STEP_META: Record<
  StepType,
  { label: string; color: string; icon: React.ReactNode }
> = {
  start: { label: "Bắt đầu", color: "#16a34a", icon: <Flag className="h-3.5 w-3.5" /> },
  task: { label: "Công việc", color: "#4f46e5", icon: <CheckSquare className="h-3.5 w-3.5" /> },
  approval: { label: "Phê duyệt", color: "#d97706", icon: <ClipboardCheck className="h-3.5 w-3.5" /> },
  end: { label: "Kết thúc", color: "#dc2626", icon: <Square className="h-3.5 w-3.5" /> },
};

type StepNodeData = {
  step: WorkflowStep;
};

// Custom node hiển thị hộp quy trình với 2 handle (vào/ra) để nối mũi tên
function StepNode({ data, selected }: NodeProps<Node<StepNodeData>>) {
  const step = data.step;
  const meta = STEP_META[step.type] || STEP_META.task;
  return (
    <div
      className="rounded-xl border bg-white shadow-sm min-w-[180px] max-w-[220px]"
      style={{
        borderColor: selected ? meta.color : "#e5e7eb",
        boxShadow: selected ? `0 0 0 2px ${meta.color}33` : undefined,
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: meta.color }} />
      <div
        className="flex items-center gap-1.5 rounded-t-xl px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-white"
        style={{ background: meta.color }}
      >
        {meta.icon}
        {meta.label}
      </div>
      <div className="px-3 py-2">
        <div className="text-sm font-bold text-slate-800 break-words">
          {step.title || "(Chưa đặt tên)"}
        </div>
        {step.assignee && (
          <div className="mt-1 text-[11px] font-semibold text-slate-500">
            👤 {step.assignee}
          </div>
        )}
        {typeof step.estDays === "number" && step.estDays > 0 && (
          <div className="mt-0.5 text-[11px] text-slate-400">⏱ {step.estDays} ngày</div>
        )}
      </div>
      <Handle type="source" position={Position.Right} style={{ background: meta.color }} />
    </div>
  );
}

let idCounter = 0;
const genId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}_${(idCounter++).toString(36)}`;

// Kết quả lập lịch cho 1 bước khi "chạy" quy trình
interface ScheduledStep {
  step: WorkflowStep;
  order: number; // thứ tự thực thi (1-based) theo mũi tên
  dueOffsetDays: number; // số ngày kể từ ngày bắt đầu tới hạn chót bước này
}

const durOf = (s: WorkflowStep) =>
  typeof s.estDays === "number" && s.estDays > 0 ? s.estDays : 1;

/**
 * Sắp xếp các bước theo thứ tự mũi tên (topological sort - Kahn) và tính
 * hạn chót lũy kế. Trả về { ordered, hasCycle }.
 * - earliestStart[node] = max(earliestStart[pred] + dur[pred]) trên mọi tiền bối.
 * - dueOffsetDays[node] = earliestStart[node] + dur[node].
 */
function scheduleWorkflow(
  steps: WorkflowStep[],
  edges: WorkflowEdge[]
): { ordered: ScheduledStep[]; hasCycle: boolean } {
  const byId = new Map(steps.map((s) => [s.id, s]));
  const indeg = new Map<string, number>();
  const adj = new Map<string, string[]>();
  steps.forEach((s) => {
    indeg.set(s.id, 0);
    adj.set(s.id, []);
  });
  edges.forEach((e) => {
    if (!byId.has(e.source) || !byId.has(e.target)) return;
    adj.get(e.source)!.push(e.target);
    indeg.set(e.target, (indeg.get(e.target) || 0) + 1);
  });

  const earliestStart = new Map<string, number>();
  steps.forEach((s) => earliestStart.set(s.id, 0));

  // Hàng đợi các bước không còn tiền bối; ưu tiên "start" trước cho trực quan
  const queue = steps
    .filter((s) => (indeg.get(s.id) || 0) === 0)
    .map((s) => s.id)
    .sort((a, b) => {
      const sa = byId.get(a)!;
      const sb = byId.get(b)!;
      if (sa.type === "start" && sb.type !== "start") return -1;
      if (sb.type === "start" && sa.type !== "start") return 1;
      return 0;
    });

  const ordered: ScheduledStep[] = [];
  let counter = 0;
  while (queue.length) {
    const id = queue.shift()!;
    const step = byId.get(id)!;
    const start = earliestStart.get(id) || 0;
    ordered.push({ step, order: ++counter, dueOffsetDays: start + durOf(step) });

    for (const next of adj.get(id)!) {
      earliestStart.set(
        next,
        Math.max(earliestStart.get(next) || 0, start + durOf(step))
      );
      indeg.set(next, (indeg.get(next) || 0) - 1);
      if ((indeg.get(next) || 0) === 0) queue.push(next);
    }
  }

  const hasCycle = ordered.length < steps.length;
  if (hasCycle) {
    // Có chu trình: bổ sung các bước còn lại theo thứ tự gốc để không mất dữ liệu
    const seen = new Set(ordered.map((o) => o.step.id));
    steps
      .filter((s) => !seen.has(s.id))
      .forEach((s) =>
        ordered.push({ step: s, order: ++counter, dueOffsetDays: durOf(s) })
      );
  }
  return { ordered, hasCycle };
}

const addDaysISO = (baseISO: string, days: number): string => {
  const d = new Date(baseISO);
  if (isNaN(d.getTime())) return baseISO;
  d.setDate(d.getDate() + days);
  return d.toISOString();
};

export default function WorkflowTab({
  userProfile,
  selectedCompanyCode,
  isManager,
  usersList,
}: WorkflowTabProps) {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [activeId, setActiveId] = useState<string>(""); // "" = quy trình mới chưa lưu
  const [wfName, setWfName] = useState("Quy trình mới");
  const [wfCategory, setWfCategory] = useState("");
  const [nodes, setNodes] = useState<Node<StepNodeData>[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Chạy quy trình → sinh task Kanban
  const [runOpen, setRunOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [runStartDate, setRunStartDate] = useState<string>(
    () => new Date().toISOString().slice(0, 10)
  );

  const nodeTypes = useMemo(() => ({ step: StepNode }), []);
  const wrapperRef = useRef<HTMLDivElement>(null);

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

  // ---- Chuyển đổi giữa model lưu trữ (steps/edges) và model React Flow (nodes/edges) ----
  const buildNodes = useCallback(
    (steps: WorkflowStep[]): Node<StepNodeData>[] =>
      steps.map((s) => ({
        id: s.id,
        type: "step",
        position: s.position || { x: 0, y: 0 },
        data: { step: s },
      })),
    []
  );

  const buildEdges = useCallback(
    (wfEdges: WorkflowEdge[]): Edge[] =>
      wfEdges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label || undefined,
        markerEnd: { type: MarkerType.ArrowClosed },
      })),
    []
  );

  const loadWorkflow = useCallback(
    (wf: Workflow | null) => {
      if (!wf) {
        setActiveId("");
        setWfName("Quy trình mới");
        setWfCategory("");
        setNodes([]);
        setEdges([]);
        setSelectedNodeId(null);
        return;
      }
      setActiveId(wf.id);
      setWfName(wf.name);
      setWfCategory(wf.category || "");
      setNodes(buildNodes(wf.steps || []));
      setEdges(buildEdges(wf.edges || []));
      setSelectedNodeId(null);
    },
    [buildNodes, buildEdges]
  );

  // ---- React Flow handlers ----
  const onNodesChange = useCallback(
    (changes: NodeChange[]) =>
      setNodes((nds) => applyNodeChanges(changes, nds) as Node<StepNodeData>[]),
    []
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );
  const onConnect = useCallback(
    (conn: Connection) =>
      setEdges((eds) =>
        addEdge(
          {
            ...conn,
            id: genId("edge"),
            markerEnd: { type: MarkerType.ArrowClosed },
          },
          eds
        )
      ),
    []
  );

  const addStep = (type: StepType) => {
    const id = genId("step");
    const offset = nodes.length * 40;
    const newStep: WorkflowStep = {
      id,
      title: STEP_META[type].label,
      description: "",
      assigneeUid: "",
      assignee: "",
      type,
      estDays: undefined,
      position: { x: 120 + offset, y: 120 + offset },
    };
    setNodes((nds) => [
      ...nds,
      { id, type: "step", position: newStep.position, data: { step: newStep } },
    ]);
    setSelectedNodeId(id);
  };

  const selectedStep: WorkflowStep | null = useMemo(() => {
    const n = nodes.find((x) => x.id === selectedNodeId);
    return n ? n.data.step : null;
  }, [nodes, selectedNodeId]);

  const updateSelectedStep = (patch: Partial<WorkflowStep>) => {
    if (!selectedNodeId) return;
    setNodes((nds) =>
      nds.map((n) =>
        n.id === selectedNodeId
          ? { ...n, data: { step: { ...n.data.step, ...patch } } }
          : n
      )
    );
  };

  const deleteSelectedStep = () => {
    if (!selectedNodeId) return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedNodeId));
    setEdges((eds) =>
      eds.filter((e) => e.source !== selectedNodeId && e.target !== selectedNodeId)
    );
    setSelectedNodeId(null);
  };

  // ---- Chạy quy trình → sinh task Kanban ----
  const avatarOf = useCallback(
    (uid?: string): string => {
      if (!uid) return "👨‍💻";
      const u = usersList.find((x) => x.uid === uid);
      if (!u) return "👨‍💻";
      if (u.photoURL && (u.photoURL.startsWith("http") || u.photoURL.startsWith("/"))) {
        return u.photoURL;
      }
      return `https://ui-avatars.com/api/?name=${encodeURIComponent(
        u.displayName || "NV"
      )}&background=random&color=fff`;
    },
    [usersList]
  );

  // Lập lịch từ trạng thái canvas hiện tại
  const schedule = useMemo(() => {
    const steps: WorkflowStep[] = nodes.map((n) => ({
      ...n.data.step,
      position: n.position,
    }));
    const wfEdges: WorkflowEdge[] = edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: typeof e.label === "string" ? e.label : "",
    }));
    return scheduleWorkflow(steps, wfEdges);
  }, [nodes, edges]);

  // Chỉ các bước công việc/phê duyệt mới sinh task (bỏ qua mốc start/end)
  const runnableSteps = useMemo(
    () => schedule.ordered.filter((o) => o.step.type === "task" || o.step.type === "approval"),
    [schedule]
  );

  const handleRunWorkflow = async () => {
    if (runnableSteps.length === 0) {
      toast.error("Không có bước công việc nào để tạo task.");
      return;
    }
    const compCode = selectedCompanyCode || userProfile?.companyCode || "SYSTEM";
    const creatorUid = userProfile?.uid || "";
    const startISO = new Date(runStartDate + "T00:00:00").toISOString();

    setRunning(true);
    let ok = 0;
    let fail = 0;
    try {
      for (const item of runnableSteps) {
        const s = item.step;
        const payload = {
          title: s.title || "(Chưa đặt tên)",
          description:
            (s.description || "") +
            (s.type === "approval" ? "\n[Bước phê duyệt]" : "") +
            `\n— Sinh từ quy trình: ${wfName}`,
          assigneeUid: s.assigneeUid || creatorUid,
          assignee: s.assignee || userProfile?.displayName || "Chưa phân công",
          assigneeAvatar: avatarOf(s.assigneeUid),
          dueDate: addDaysISO(startISO, item.dueOffsetDays),
          priority: "Medium",
          status: "Not Started",
          companyCode: compCode,
          creatorUid,
          createdAt: new Date().toISOString(),
          estTime: typeof s.estDays === "number" ? s.estDays * 8 : undefined,
          tags: ["Quy trình", wfName].filter(Boolean),
          category: wfCategory || undefined,
          history: [
            {
              time: new Date().toLocaleString("vi-VN"),
              user: userProfile?.displayName || "Hệ thống",
              action: `Tạo tự động từ quy trình "${wfName}" (bước ${item.order})`,
            },
          ],
        };
        try {
          const res = await fetch("/api/v1/crud/kanban-tasks", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${getAccessToken()}`,
            },
            body: JSON.stringify(payload),
          });
          if (!res.ok) throw new Error("create task failed");
          ok++;
        } catch (e) {
          console.error("Lỗi tạo task cho bước:", s.title, e);
          fail++;
        }
      }
      if (ok > 0) {
        toast.success(
          `Đã tạo ${ok} công việc vào Kanban${fail > 0 ? `, ${fail} lỗi` : ""}.`
        );
        setRunOpen(false);
      } else {
        toast.error("Không tạo được công việc nào.");
      }
    } finally {
      setRunning(false);
    }
  };

  // ---- Lưu quy trình (create/update qua CRUD generic) ----
  const handleSave = async () => {
    if (!wfName.trim()) {
      toast.error("Vui lòng nhập tên quy trình.");
      return;
    }
    // Gộp position mới nhất từ nodes vào steps trước khi lưu
    const steps: WorkflowStep[] = nodes.map((n) => ({
      ...n.data.step,
      position: n.position,
    }));
    const wfEdges: WorkflowEdge[] = edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: typeof e.label === "string" ? e.label : "",
    }));

    const payload = {
      name: wfName.trim(),
      category: wfCategory.trim(),
      steps,
      edges: wfEdges,
      creatorUid: userProfile?.uid || "",
    };

    setSaving(true);
    try {
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
      const saved: Workflow = { ...json.data, id: json.data._id };
      toast.success(activeId ? "Đã cập nhật quy trình." : "Đã tạo quy trình mới.");
      setActiveId(saved.id);
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
      loadWorkflow(null);
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
      loadWorkflow(null);
      await fetchWorkflows();
    } catch (err) {
      console.error("Lỗi xóa quy trình:", err);
      toast.error("Không thể xóa quy trình.");
    }
  };

  const canEdit = isManager;

  return (
    <div className="flex h-full min-h-0 flex-1 overflow-hidden" id="workflow_tab">
      {/* Sidebar: danh sách quy trình */}
      <aside className="w-56 shrink-0 border-r border-gray-200 bg-gray-50/60 flex flex-col">
        <div className="p-2 border-b border-gray-200 flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase text-slate-500">
            Quy trình
          </span>
          <button
            onClick={fetchWorkflows}
            className="p-1 rounded hover:bg-gray-200 text-slate-500"
            title="Tải lại"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
        <button
          onClick={() => loadWorkflow(null)}
          disabled={!canEdit}
          className="m-2 flex items-center justify-center gap-1 rounded-lg bg-slate-800 px-2 py-1.5 text-xs font-bold text-white hover:bg-slate-700 disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" /> Quy trình mới
        </button>
        <div className="flex-1 overflow-y-auto px-1 pb-2">
          {workflows.length === 0 && (
            <p className="px-2 py-4 text-center text-[11px] text-slate-400">
              Chưa có quy trình nào.
            </p>
          )}
          {workflows.map((wf) => (
            <button
              key={wf.id}
              onClick={() => loadWorkflow(wf)}
              className={`w-full text-left rounded-lg px-2 py-1.5 mb-1 text-xs font-semibold transition-colors ${
                activeId === wf.id
                  ? "bg-indigo-100 text-indigo-700"
                  : "text-slate-600 hover:bg-gray-100"
              }`}
            >
              <div className="truncate">{wf.name}</div>
              <div className="text-[10px] font-normal text-slate-400">
                {(wf.steps?.length || 0)} bước
                {wf.category ? ` · ${wf.category}` : ""}
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* Khu vực canvas + toolbar */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 bg-white px-3 py-2">
          <input
            value={wfName}
            onChange={(e) => setWfName(e.target.value)}
            disabled={!canEdit}
            placeholder="Tên quy trình"
            className="w-48 rounded-lg border border-gray-200 px-2 py-1 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-400 disabled:bg-gray-50"
          />
          <input
            value={wfCategory}
            onChange={(e) => setWfCategory(e.target.value)}
            disabled={!canEdit}
            placeholder="Nhóm (vd: Onboarding)"
            className="w-40 rounded-lg border border-gray-200 px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-indigo-400 disabled:bg-gray-50"
          />
          <div className="h-5 w-px bg-gray-200" />
          {(Object.keys(STEP_META) as StepType[]).map((t) => (
            <button
              key={t}
              onClick={() => addStep(t)}
              disabled={!canEdit}
              className="flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-semibold text-white disabled:opacity-40"
              style={{ background: STEP_META[t].color, borderColor: STEP_META[t].color }}
            >
              <Plus className="h-3 w-3" /> {STEP_META[t].label}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setRunOpen(true)}
              disabled={!canEdit || runnableSteps.length === 0}
              className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
              title="Sinh chuỗi công việc Kanban theo mũi tên"
            >
              <Play className="h-3.5 w-3.5" /> Chạy quy trình
            </button>
            <button
              onClick={handleSave}
              disabled={!canEdit || saving}
              className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" /> {saving ? "Đang lưu..." : "Lưu"}
            </button>
            <button
              onClick={handleDeleteWorkflow}
              disabled={!canEdit}
              className="flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Canvas React Flow */}
        <div ref={wrapperRef} className="relative flex-1 min-h-0">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, n) => setSelectedNodeId(n.id)}
            onPaneClick={() => setSelectedNodeId(null)}
            nodesDraggable={canEdit}
            nodesConnectable={canEdit}
            elementsSelectable={canEdit}
            fitView
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={16} />
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable />
          </ReactFlow>

          {nodes.length === 0 && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <Play className="h-8 w-8 text-slate-300" />
              <p className="mt-2 text-sm font-semibold text-slate-400">
                Thêm bước từ thanh công cụ để bắt đầu dựng quy trình
              </p>
              <p className="text-xs text-slate-400">
                Kéo từ mép phải của hộp sang hộp khác để tạo mũi tên nối bước kế tiếp
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Panel chi tiết bước */}
      {selectedStep && (
        <aside className="w-72 shrink-0 border-l border-gray-200 bg-white flex flex-col">
          <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2">
            <span className="text-[11px] font-bold uppercase text-slate-500">
              Chi tiết bước
            </span>
            <button
              onClick={() => setSelectedNodeId(null)}
              className="p-1 rounded hover:bg-gray-100 text-slate-400"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            <div>
              <label className="text-[11px] font-bold text-slate-500">Loại bước</label>
              <div className="mt-1 grid grid-cols-2 gap-1">
                {(Object.keys(STEP_META) as StepType[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => updateSelectedStep({ type: t })}
                    disabled={!canEdit}
                    className={`rounded-lg border px-2 py-1 text-[11px] font-semibold ${
                      selectedStep.type === t
                        ? "text-white"
                        : "text-slate-600 bg-white"
                    }`}
                    style={
                      selectedStep.type === t
                        ? { background: STEP_META[t].color, borderColor: STEP_META[t].color }
                        : { borderColor: "#e5e7eb" }
                    }
                  >
                    {STEP_META[t].label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-500">Tên bước</label>
              <input
                value={selectedStep.title}
                onChange={(e) => updateSelectedStep({ title: e.target.value })}
                disabled={!canEdit}
                className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-500">Mô tả</label>
              <textarea
                value={selectedStep.description || ""}
                onChange={(e) => updateSelectedStep({ description: e.target.value })}
                disabled={!canEdit}
                rows={3}
                className="mt-1 w-full resize-none rounded-lg border border-gray-200 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-500">Người phụ trách</label>
              <select
                value={selectedStep.assigneeUid || ""}
                onChange={(e) => {
                  const uid = e.target.value;
                  const u = usersList.find((x) => x.uid === uid);
                  updateSelectedStep({
                    assigneeUid: uid,
                    assignee: u?.displayName || "",
                  });
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
              <label className="text-[11px] font-bold text-slate-500">
                SLA (số ngày)
              </label>
              <input
                type="number"
                min={0}
                value={selectedStep.estDays ?? ""}
                onChange={(e) =>
                  updateSelectedStep({
                    estDays: e.target.value === "" ? undefined : Number(e.target.value),
                  })
                }
                disabled={!canEdit}
                className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          </div>
          <div className="border-t border-gray-200 p-3">
            <button
              onClick={deleteSelectedStep}
              disabled={!canEdit}
              className="flex w-full items-center justify-center gap-1 rounded-lg border border-red-200 px-2 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" /> Xóa bước này
            </button>
          </div>
        </aside>
      )}

      {/* Modal: xem trước & chạy quy trình */}
      {runOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !running && setRunOpen(false)}
        >
          <div
            className="w-full max-w-lg max-h-[85vh] overflow-hidden rounded-2xl bg-white shadow-xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <div className="flex items-center gap-2">
                <ListChecks className="h-5 w-5 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-800">
                  Chạy quy trình → tạo công việc Kanban
                </h3>
              </div>
              <button
                onClick={() => !running && setRunOpen(false)}
                className="p-1 rounded hover:bg-gray-100 text-slate-400"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 overflow-y-auto">
              {schedule.hasCycle && (
                <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-[11px] text-amber-700">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    Sơ đồ có vòng lặp — thứ tự một số bước có thể chưa chính xác.
                    Nên kiểm tra lại các mũi tên.
                  </span>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-slate-500" />
                <label className="text-xs font-semibold text-slate-600">
                  Ngày bắt đầu:
                </label>
                <input
                  type="date"
                  value={runStartDate}
                  onChange={(e) => setRunStartDate(e.target.value)}
                  className="rounded-lg border border-gray-200 px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>

              <p className="text-[11px] text-slate-500">
                Sẽ tạo <b>{runnableSteps.length}</b> công việc theo thứ tự mũi tên,
                hạn chót tính lũy kế theo SLA từng bước:
              </p>

              <ol className="space-y-1.5">
                {runnableSteps.map((item) => {
                  const s = item.step;
                  const meta = STEP_META[s.type];
                  const due = new Date(
                    addDaysISO(
                      new Date(runStartDate + "T00:00:00").toISOString(),
                      item.dueOffsetDays
                    )
                  );
                  return (
                    <li
                      key={s.id}
                      className="flex items-center gap-2 rounded-lg border border-gray-150 px-2.5 py-1.5 text-xs"
                    >
                      <span
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                        style={{ background: meta.color }}
                      >
                        {item.order}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold text-slate-700">
                          {s.title}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {s.assignee ? `👤 ${s.assignee}` : "⚠ chưa gán người"}
                          {" · "}
                          Hạn: {String(due.getDate()).padStart(2, "0")}/
                          {String(due.getMonth() + 1).padStart(2, "0")}/
                          {due.getFullYear()}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>

            <div className="flex justify-end gap-2 border-t border-gray-200 px-4 py-3">
              <button
                onClick={() => setRunOpen(false)}
                disabled={running}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-gray-50 disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                onClick={handleRunWorkflow}
                disabled={running}
                className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                <Play className="h-3.5 w-3.5" />
                {running ? "Đang tạo..." : `Tạo ${runnableSteps.length} công việc`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
