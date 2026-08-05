import React from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  BarChart2,
  CalendarCheck,
  CalendarRange,
  Clock,
  LayoutGrid,
  MapPin,
  Pencil,
  Plus,
  Rows3,
  Search,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { toast } from "../../../pages/Toast";
import { useWorkerProjects } from "../hooks/useWorkerProjects";
import { useWorkers } from "../hooks/useWorkers";
import { WorkerTimekeepingPanel } from "../components/WorkerTimekeepingPanel";
import { WorkerQrAttendance } from "../components/WorkerQrAttendance";
import { WorkerTimekeepingHistory } from "../components/WorkerTimekeepingHistory";
import { workerAttendanceApi } from "../api/workerAttendance.api";
import type {
  Worker,
  WorkerAttendanceLog,
  WorkerProject,
  WorkerProjectInput,
  WorkerScope,
} from "../types";

type Props = {
  selectedCenter?: string;
  branchId?: string;
  canManage?: boolean;
};

type ProjectStatus = WorkerProject["status"];
type ViewMode = "table" | "card";

type FormState = {
  code: string;
  name: string;
  quota: string;
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  location: string;
  geoLat: number | "";
  geoLng: number | "";
  geoRadius: number | "";
  startDate: string;
  endDate: string;
  status: ProjectStatus;
  note: string;
  workerIds: string[];
};

const DEFAULT_PROJECT_RADIUS_METERS = 300;

const STATUS_OPTIONS: Array<{ value: ProjectStatus; label: string }> = [
  { value: "planned", label: "Sắp triển khai" },
  { value: "active", label: "Đang triển khai" },
  { value: "completed", label: "Đã kết thúc" },
];

const DAY_OPTIONS = [
  { value: 1, label: "T2" },
  { value: 2, label: "T3" },
  { value: 3, label: "T4" },
  { value: 4, label: "T5" },
  { value: 5, label: "T6" },
  { value: 6, label: "T7" },
  { value: 0, label: "CN" },
];

const EMPTY_FORM: FormState = {
  code: "",
  name: "",
  quota: "",
  daysOfWeek: [],
  startTime: "08:00",
  endTime: "17:00",
  location: "",
  geoLat: "",
  geoLng: "",
  geoRadius: "",
  startDate: "",
  endDate: "",
  status: "planned",
  note: "",
  workerIds: [],
};

const statusClass: Record<ProjectStatus, string> = {
  planned: "border-sky-200 bg-sky-50 text-sky-700",
  active: "border-emerald-200 bg-emerald-50 text-emerald-700",
  completed: "border-slate-200 bg-slate-100 text-slate-600",
};

function toForm(project: WorkerProject): FormState {
  return {
    code: project.code,
    name: project.name,
    quota: project.quota ? String(project.quota) : "",
    daysOfWeek: project.daysOfWeek || [],
    startTime: project.startTime || "08:00",
    endTime: project.endTime || "17:00",
    location: project.location || "",
    geoLat: project.geoLocation?.latitude ?? "",
    geoLng: project.geoLocation?.longitude ?? "",
    geoRadius: project.geoLocation?.radiusMeters ?? "",
    startDate: project.startDate || "",
    endDate: project.endDate || "",
    status: project.status,
    note: project.note || "",
    workerIds: project.workerIds || [],
  };
}

function toInput(form: FormState): WorkerProjectInput {
  return {
    code: form.code.trim().toUpperCase(),
    name: form.name.trim(),
    quota: form.quota === "" ? 0 : Number(form.quota),
    workerIds: form.workerIds,
    daysOfWeek: form.daysOfWeek,
    startTime: form.startTime,
    endTime: form.endTime,
    location: form.location.trim(),
    geoLocation:
      form.geoLat === "" || form.geoLng === ""
        ? null
        : {
            latitude: Number(form.geoLat),
            longitude: Number(form.geoLng),
            radiusMeters:
              form.geoRadius === ""
                ? DEFAULT_PROJECT_RADIUS_METERS
                : Number(form.geoRadius),
          },
    startDate: form.startDate,
    endDate: form.endDate,
    status: form.status,
    note: form.note.trim(),
  };
}

function projectInput(
  project: WorkerProject,
  changes: Partial<WorkerProjectInput>,
): WorkerProjectInput {
  return { ...toInput(toForm(project)), ...changes };
}

function formatDays(days: number[]) {
  return DAY_OPTIONS.filter((day) => days.includes(day.value))
    .map((day) => day.label)
    .join(", ");
}

function formatDate(value: string) {
  return value ? value.split("-").reverse().join("/") : "";
}

export function WorkerProjectsPage({
  selectedCenter,
  branchId,
  canManage = true,
}: Props) {
  const scope = React.useMemo<WorkerScope | undefined>(
    () =>
      selectedCenter && selectedCenter !== "all"
        ? {
            companyCode: selectedCenter,
            ...(branchId ? { branchId } : {}),
          }
        : undefined,
    [branchId, selectedCenter],
  );
  const {
    projects,
    loading,
    error,
    createProject,
    updateProject,
    deleteProject,
    addWorker,
    removeWorker,
  } = useWorkerProjects(scope);
  const { workers } = useWorkers(scope);
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState<ProjectStatus | "all">("all");
  const [viewMode, setViewMode] = React.useState<ViewMode>(() =>
    localStorage.getItem("worker-projects:viewMode") === "card"
      ? "card"
      : "table",
  );
  const [editing, setEditing] = React.useState<WorkerProject | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<WorkerProject | null>(
    null,
  );
  const [memberTargetId, setMemberTargetId] = React.useState<string | null>(
    null,
  );
  const memberTarget = memberTargetId
    ? projects.find((project) => project._id === memberTargetId) || null
    : null;
  const [workerId, setWorkerId] = React.useState("");
  const [attendanceProject, setAttendanceProject] = React.useState<WorkerProject | null>(null);
  const [viewAttendanceProject, setViewAttendanceProject] = React.useState<WorkerProject | null>(null);
  const [locating, setLocating] = React.useState(false);

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Trình duyệt không hỗ trợ định vị.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setForm((previous) => ({
          ...previous,
          geoLat: Number(position.coords.latitude.toFixed(6)),
          geoLng: Number(position.coords.longitude.toFixed(6)),
          geoRadius:
            previous.geoRadius === ""
              ? DEFAULT_PROJECT_RADIUS_METERS
              : previous.geoRadius,
        }));
        setLocating(false);
      },
      (error) => {
        setLocating(false);
        toast.error(
          error.code === error.PERMISSION_DENIED
            ? "Bạn đã chặn quyền vị trí cho trang này."
            : "Không lấy được vị trí hiện tại.",
        );
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const filtered = projects.filter((project) => {
    if (status !== "all" && project.status !== status) return false;
    return `${project.code} ${project.name} ${project.location || ""}`
      .toLowerCase()
      .includes(search.trim().toLowerCase());
  });

  const changeView = (next: ViewMode) => {
    setViewMode(next);
    localStorage.setItem("worker-projects:viewMode", next);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, daysOfWeek: [], workerIds: [] });
    setFormOpen(true);
  };

  const openEdit = (project: WorkerProject) => {
    setEditing(project);
    setForm(toForm(project));
    setFormOpen(true);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.code.trim() || !form.name.trim()) {
      toast.error("Vui lòng nhập mã và tên dự án.");
      return;
    }
    setSubmitting(true);
    try {
      const input = toInput(form);
      if (editing) {
        await updateProject(editing._id, input);
        toast.success(`Đã cập nhật dự án ${input.code}.`);
      } else {
        await createProject(input);
        toast.success(`Đã tạo dự án ${input.code}.`);
      }
      setFormOpen(false);
      setEditing(null);
    } catch (reason) {
      toast.error(
        reason instanceof Error ? reason.message : "Không thể lưu dự án.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const changeStatus = async (
    project: WorkerProject,
    nextStatus: ProjectStatus,
  ) => {
    try {
      await updateProject(
        project._id,
        projectInput(project, { status: nextStatus }),
      );
    } catch (reason) {
      toast.error(
        reason instanceof Error
          ? reason.message
          : "Không thể cập nhật trạng thái.",
      );
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteProject(deleteTarget._id);
      toast.success(`Đã xóa dự án ${deleteTarget.code}.`);
      setDeleteTarget(null);
    } catch (reason) {
      toast.error(
        reason instanceof Error ? reason.message : "Không thể xóa dự án.",
      );
    }
  };

  const availableWorkers = memberTarget
    ? workers.filter((worker) => !memberTarget.workerIds.includes(worker._id))
    : [];

  const addMember = async () => {
    if (!memberTarget || !workerId) return;
    try {
      await addWorker(memberTarget._id, workerId);
      setWorkerId("");
    } catch (reason) {
      toast.error(
        reason instanceof Error
          ? reason.message
          : "Không thể thêm lao động vào dự án.",
      );
    }
  };

  const removeMember = async (memberId: string) => {
    if (!memberTarget) return;
    try {
      await removeWorker(memberTarget._id, memberId);
    } catch (reason) {
      toast.error(
        reason instanceof Error
          ? reason.message
          : "Không thể gỡ lao động khỏi dự án.",
      );
    }
  };

  const actions = (project: WorkerProject) =>
    canManage ? (
      <div className="flex items-center gap-1.5">
        <ActionButton title="Điểm danh thủ công & QR" onClick={() => setAttendanceProject(project)}>
          <CalendarCheck className="h-3.5 w-3.5" />
        </ActionButton>
        <ActionButton title="Lịch sử & Thống kê điểm danh" onClick={() => setViewAttendanceProject(project)}>
          <BarChart2 className="h-3.5 w-3.5" />
        </ActionButton>
        <ActionButton
          title="Chỉnh sửa dự án"
          onClick={() => openEdit(project)}
        >
          <Pencil className="h-3.5 w-3.5" />
        </ActionButton>
        <ActionButton
          title="Xóa dự án"
          tone="danger"
          onClick={() => setDeleteTarget(project)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </ActionButton>
        <ActionButton
          title="Quản lý lao động"
          onClick={() => {
            setMemberTargetId(project._id);
            setWorkerId("");
          }}
        >
          <Users className="h-3.5 w-3.5" />
        </ActionButton>
      </div>
    ) : null;

  const statusSelect = (project: WorkerProject) => (
    <select
      aria-label={`Trạng thái ${project.code}`}
      value={project.status}
      disabled={!canManage}
      onChange={(event) =>
        void changeStatus(project, event.target.value as ProjectStatus)
      }
      className={`rounded-md border px-2 py-1 text-[10px] font-black uppercase outline-none ${statusClass[project.status]}`}
    >
      {STATUS_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );

  return (
    <div className="space-y-4 text-left">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-cyan-700">
            Dự án tuyển dụng
          </h1>
          <p className="mt-0.5 text-[11px] font-medium text-slate-400">
            {loading ? "..." : `${filtered.length} / ${projects.length}`} dự án
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={openCreate}
            className="flex items-center gap-1.5 rounded-lg bg-brand-primary px-3.5 py-1.5 text-[11px] font-bold text-white shadow-md shadow-cyan-100"
          >
            <Plus className="h-3.5 w-3.5" /> Thêm dự án
          </button>
        )}
      </div>

      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div className="relative w-full md:max-w-sm">
          <label htmlFor="worker-project-search" className="sr-only">
            Tìm kiếm dự án
          </label>
          <input
            id="worker-project-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm theo mã, tên, địa điểm..."
            className="h-9 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs outline-none focus:border-cyan-500"
          />
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <FilterButton active={status === "all"} onClick={() => setStatus("all")}>
              Tất cả
            </FilterButton>
            {STATUS_OPTIONS.map((option) => (
              <FilterButton
                key={option.value}
                active={status === option.value}
                onClick={() => setStatus(option.value)}
              >
                {option.label}
              </FilterButton>
            ))}
          </div>
          <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              title="Dạng bảng"
              onClick={() => changeView("table")}
              className={`rounded-lg p-1.5 ${viewMode === "table" ? "bg-brand-primary text-white" : "text-slate-400"}`}
            >
              <Rows3 className="h-4 w-4" />
            </button>
            <button
              type="button"
              title="Dạng thẻ"
              onClick={() => changeView("card")}
              className={`rounded-lg p-1.5 ${viewMode === "card" ? "bg-brand-primary text-white" : "text-slate-400"}`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {loading && !projects.length ? (
        <StatePanel>Đang tải danh sách dự án...</StatePanel>
      ) : error ? (
        <StatePanel error>{error}</StatePanel>
      ) : !filtered.length ? (
        <StatePanel>Chưa có dự án nào phù hợp.</StatePanel>
      ) : viewMode === "card" ? (
        <div className="project-cards grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((project) => (
            <article
              key={project._id}
              className="flex flex-col gap-3 rounded-xl border border-slate-100 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                    {project.code}
                  </p>
                  <h2 className="truncate text-sm font-bold text-slate-800">
                    {project.name}
                  </h2>
                </div>
                {statusSelect(project)}
              </div>
              <ProjectMeta project={project} />
              <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                <MemberCount project={project} />
                {actions(project)}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-[9px] font-black uppercase tracking-widest text-slate-400">
                  <th className="px-4 py-2">Mã dự án</th>
                  <th className="px-4 py-2">Tên dự án</th>
                  <th className="px-4 py-2">Lịch hoạt động</th>
                  <th className="px-4 py-2">Thời gian</th>
                  <th className="px-4 py-2">Chỉ tiêu</th>
                  <th className="px-4 py-2">Trạng thái</th>
                  <th className="px-4 py-2">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((project) => (
                  <tr key={project._id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-2 font-black text-slate-800">
                      {project.code}
                    </td>
                    <td className="px-4 py-2">
                      <p className="font-bold text-slate-700">{project.name}</p>
                      <p className="text-[10px] text-slate-400">
                        {project.location || "Chưa cập nhật địa điểm"}
                      </p>
                    </td>
                    <td className="px-4 py-2 font-medium text-slate-600">
                      {formatDays(project.daysOfWeek)}
                      <span className="block text-[10px] text-slate-400">
                        {project.startTime} - {project.endTime}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 font-medium text-slate-600">
                      {formatDate(project.startDate)} → {formatDate(project.endDate)}
                    </td>
                    <td className="px-4 py-2">
                      <MemberCount project={project} />
                    </td>
                    <td className="px-4 py-2">{statusSelect(project)}</td>
                    <td className="px-4 py-2">{actions(project)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {formOpen && (
        <Modal
          title={editing ? "Chỉnh sửa dự án" : "Thêm dự án"}
          onClose={() => setFormOpen(false)}
        >
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Mã dự án">
                <input
                  value={form.code}
                  onChange={(event) =>
                    setForm((value) => ({ ...value, code: event.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm transition-all focus:border-cyan-600 focus:outline-none"
                />
              </Field>
              <Field label="Tên dự án">
                <input
                  value={form.name}
                  onChange={(event) =>
                    setForm((value) => ({ ...value, name: event.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm transition-all focus:border-cyan-600 focus:outline-none"
                />
              </Field>
              <Field label="Chỉ tiêu">
                <input
                  type="number"
                  min="0"
                  value={form.quota}
                  onChange={(event) =>
                    setForm((value) => ({ ...value, quota: event.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm transition-all focus:border-cyan-600 focus:outline-none"
                />
              </Field>
              <Field label="Trạng thái">
                <select
                  value={form.status}
                  onChange={(event) =>
                    setForm((value) => ({
                      ...value,
                      status: event.target.value as ProjectStatus,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm transition-all focus:border-cyan-600 focus:outline-none"
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Ngày bắt đầu">
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(event) =>
                    setForm((value) => ({
                      ...value,
                      startDate: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm transition-all focus:border-cyan-600 focus:outline-none"
                />
              </Field>
              <Field label="Ngày kết thúc">
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(event) =>
                    setForm((value) => ({
                      ...value,
                      endDate: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm transition-all focus:border-cyan-600 focus:outline-none"
                />
              </Field>
              <Field label="Giờ bắt đầu">
                <input
                  type="time"
                  value={form.startTime}
                  onChange={(event) =>
                    setForm((value) => ({
                      ...value,
                      startTime: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm transition-all focus:border-cyan-600 focus:outline-none"
                />
              </Field>
              <Field label="Giờ kết thúc">
                <input
                  type="time"
                  value={form.endTime}
                  onChange={(event) =>
                    setForm((value) => ({
                      ...value,
                      endTime: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm transition-all focus:border-cyan-600 focus:outline-none"
                />
              </Field>
            </div>
            <Field label="Địa điểm">
              <input
                value={form.location}
                onChange={(event) =>
                  setForm((value) => ({
                    ...value,
                    location: event.target.value,
                  }))
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm transition-all focus:border-cyan-600 focus:outline-none"
              />
            </Field>
            <div className="space-y-1">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-800">
                Giới hạn điểm danh bằng GPS (tùy chọn)
              </span>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <div
                    className={`flex items-center gap-2 rounded-xl border border-dashed px-4 py-2.5 pr-28 text-xs font-semibold ${
                      form.geoLat !== "" && form.geoLng !== ""
                        ? "border-cyan-300 bg-cyan-50 text-cyan-700"
                        : "border-slate-200 bg-slate-50 text-slate-400"
                    }`}
                  >
                    <MapPin className="h-4 w-4 shrink-0" />
                    <span className="truncate">
                      {form.geoLat !== "" && form.geoLng !== ""
                        ? "Đã lưu tọa độ GPS"
                        : "Chưa thiết lập tọa độ"}
                    </span>
                  </div>
                  <div className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-1">
                    {form.geoLat !== "" && form.geoLng !== "" && (
                      <button
                        type="button"
                        title="Xóa tọa độ"
                        onClick={() =>
                          setForm((value) => ({
                            ...value,
                            geoLat: "",
                            geoLng: "",
                            geoRadius: "",
                          }))
                        }
                        className="flex h-7 w-7 items-center justify-center rounded-md text-rose-500 transition-colors hover:bg-rose-100"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={useCurrentLocation}
                      disabled={locating}
                      className="flex h-7 items-center gap-1 rounded-md bg-slate-800 px-2.5 text-[10px] font-black uppercase tracking-wide text-white transition-colors hover:bg-slate-700 disabled:opacity-50"
                    >
                      {locating ? "Đang lấy..." : "Lấy vị trí"}
                    </button>
                  </div>
                </div>
                {form.geoLat !== "" && form.geoLng !== "" && (
                  <div className="relative w-full shrink-0 sm:w-40">
                    <input
                      type="number"
                      min={10}
                      placeholder={`Bán kính (m), mặc định ${DEFAULT_PROJECT_RADIUS_METERS}`}
                      value={form.geoRadius}
                      onChange={(event) =>
                        setForm((value) => ({
                          ...value,
                          geoRadius:
                            event.target.value === ""
                              ? ""
                              : Number(event.target.value),
                        }))
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 pr-7 text-sm transition-all focus:border-cyan-600 focus:outline-none"
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                      m
                    </span>
                  </div>
                )}
              </div>
            </div>
            <fieldset>
              <legend className="mb-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500">
                Ngày hoạt động
              </legend>
              <div className="flex flex-wrap gap-1.5">
                {DAY_OPTIONS.map((day) => {
                  const selected = form.daysOfWeek.includes(day.value);
                  return (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() =>
                        setForm((value) => ({
                          ...value,
                          daysOfWeek: selected
                            ? value.daysOfWeek.filter(
                                (item) => item !== day.value,
                              )
                            : [...value.daysOfWeek, day.value],
                        }))
                      }
                      className={`rounded-lg border px-2.5 py-1 text-[10px] font-bold ${selected ? "border-cyan-600 bg-cyan-600 text-white" : "border-slate-200 text-slate-500"}`}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <Field label="Ghi chú">
              <textarea
                value={form.note}
                onChange={(event) =>
                  setForm((value) => ({ ...value, note: event.target.value }))
                }
                className="input min-h-20"
              />
            </Field>
            <div className="flex justify-end gap-4 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="text-xs font-bold text-slate-500 transition-colors hover:text-slate-800"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-xl bg-cyan-600 px-6 py-2.5 text-xs font-bold text-white shadow-lg shadow-cyan-100 transition-all hover:-translate-y-0.5 hover:bg-cyan-700 disabled:opacity-50"
              >
                {editing ? "Cập nhật dự án" : "Tạo dự án"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {deleteTarget && (
        <Modal title="Xóa dự án" onClose={() => setDeleteTarget(null)}>
          <p className="text-sm text-slate-600">
            Xóa dự án <strong>{deleteTarget.code}</strong>?
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              className="rounded-lg px-3 py-2 text-xs font-bold text-slate-500"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={() => void confirmDelete()}
              className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white"
            >
              Xóa
            </button>
          </div>
        </Modal>
      )}

      {attendanceProject && (
        <Modal title={`Điểm danh · ${attendanceProject.code}`} onClose={() => setAttendanceProject(null)}>
          <div className="space-y-4">
            <WorkerTimekeepingPanel projectId={attendanceProject._id} workers={workers.filter((worker) => attendanceProject.workerIds.includes(worker._id))} canManage={canManage} />
            <WorkerQrAttendance projectId={attendanceProject._id} date={new Date().toISOString().slice(0, 10)} />
          </div>
        </Modal>
      )}
      {viewAttendanceProject && (
        <Modal
          title={`Lịch sử chấm công · ${viewAttendanceProject.code}`}
          onClose={() => setViewAttendanceProject(null)}
        >
          <WorkerAttendanceHistory projectId={viewAttendanceProject._id} />
        </Modal>
      )}
      {memberTarget && (
        <Modal
          title={`Quản lý lao động · ${memberTarget.code}`}
          onClose={() => setMemberTargetId(null)}
        >
          <div className="flex gap-2">
            <label className="sr-only" htmlFor="worker-project-member">
              Thêm lao động
            </label>
            <select
              id="worker-project-member"
              value={workerId}
              onChange={(event) => setWorkerId(event.target.value)}
              className="w-full flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm transition-all focus:border-cyan-600 focus:outline-none"
            >
              <option value="">Chọn lao động...</option>
              {availableWorkers.map((worker) => (
                <option key={worker._id} value={worker._id}>
                  {worker.fullName}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!workerId}
              onClick={() => void addMember()}
              className="flex items-center gap-1 rounded-xl bg-cyan-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-cyan-100 transition-all hover:-translate-y-0.5 hover:bg-cyan-700 disabled:opacity-50"
            >
              <UserPlus className="h-3.5 w-3.5" /> Thêm vào dự án
            </button>
          </div>
          <div className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-100">
            {memberTarget.workerIds.length ? (
              memberTarget.workerIds.map((memberId) => {
                const worker = workers.find((item) => item._id === memberId);
                const label = worker?.fullName || memberId;
                return (
                  <div
                    key={memberId}
                    className="flex items-center justify-between px-3 py-2"
                  >
                    <span className="text-xs font-bold text-slate-700">
                      {label}
                    </span>
                    <button
                      type="button"
                      title={`Gỡ ${label} khỏi dự án`}
                      onClick={() => void removeMember(memberId)}
                      className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })
            ) : (
              <p className="px-3 py-5 text-center text-xs text-slate-400">
                Chưa có lao động trong dự án.
              </p>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

function ProjectMeta({ project }: { project: WorkerProject }) {
  return (
    <div className="space-y-1.5 text-xs font-medium text-slate-600">
      <p className="flex items-center gap-1.5">
        <Clock className="h-3.5 w-3.5 text-slate-400" />
        {formatDays(project.daysOfWeek)} · {project.startTime} - {project.endTime}
      </p>
      <p className="flex items-center gap-1.5">
        <CalendarRange className="h-3.5 w-3.5 text-slate-400" />
        {formatDate(project.startDate)} → {formatDate(project.endDate)}
      </p>
      {project.location && (
        <p className="flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-slate-400" />
          {project.location}
        </p>
      )}
    </div>
  );
}

function MemberCount({ project }: { project: WorkerProject }) {
  return (
    <span className="flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[9px] font-black text-slate-600">
      <Users className="h-3 w-3 text-cyan-600" />
      {project.workerIds.length}
      {project.quota ? `/${project.quota}` : ""} lao động
    </span>
  );
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function WorkerAttendanceHistory({ projectId }: { projectId: string }) {
  const [logs, setLogs] = React.useState<WorkerAttendanceLog[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [from, setFrom] = React.useState(todayIso());
  const [to, setTo] = React.useState(todayIso());

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    workerAttendanceApi
      .list(projectId, undefined, from || undefined, to || undefined)
      .then((data) => {
        if (!cancelled) setLogs(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Không thể tải lịch sử chấm công");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, from, to]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Từ ngày</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs focus:border-cyan-600 focus:outline-none"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Đến ngày</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs focus:border-cyan-600 focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={() => {
            setFrom(todayIso());
            setTo(todayIso());
          }}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
        >
          Hôm nay
        </button>
      </div>
      {loading ? (
        <p className="text-sm text-slate-400">Đang tải...</p>
      ) : error ? (
        <p role="alert" className="text-sm text-red-600">{error}</p>
      ) : (
        <WorkerTimekeepingHistory logs={logs} />
      )}
    </div>
  );
}

function ActionButton({
  title,
  tone = "neutral",
  onClick,
  children,
}: {
  title: string;
  tone?: "neutral" | "danger";
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`rounded-lg border border-slate-200 bg-slate-50 p-1 shadow-sm transition-colors ${tone === "danger" ? "text-slate-400 hover:bg-rose-50 hover:text-rose-600" : "text-slate-400 hover:bg-cyan-50 hover:text-cyan-600"}`}
    >
      {children}
    </button>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-[10px] font-bold ${active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-500"}`}
    >
      {children}
    </button>
  );
}

function StatePanel({
  children,
  error,
}: {
  children: React.ReactNode;
  error?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border border-slate-100 bg-white px-4 py-16 text-center text-xs italic shadow-sm ${error ? "text-rose-500" : "text-slate-400"}`}
    >
      {children}
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.button
          aria-label="Đóng"
          type="button"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 30 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="relative flex max-h-[95vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        >
          <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
            <h2 className="text-base font-bold text-slate-800">{title}</h2>
            <button
              type="button"
              aria-label="Đóng"
              onClick={onClose}
              className="rounded-full p-1.5 transition-colors hover:bg-slate-100"
            >
              <X className="h-4 w-4 text-slate-400" />
            </button>
          </div>
          <div className="space-y-4 overflow-y-auto p-6">{children}</div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactElement<{ id?: string }>;
}) {
  const id = `worker-project-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <label htmlFor={id} className="block space-y-1">
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-800">
        {label}
      </span>
      {React.cloneElement(children, { id })}
    </label>
  );
}

export default WorkerProjectsPage;
