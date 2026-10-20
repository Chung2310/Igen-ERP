import React from "react";
import { PauseCircle, Pencil, RotateCcw, Save, Users } from "lucide-react";
import { apiFetch } from "../../lib/api";
import { useBatches } from "../../hooks/useBatches";
import { useStudents } from "../../hooks/useStudents";
import { ErpCard, ErpModal } from "../../components/Erp/ErpUI";
import { toast } from "../../../../pages/Toast";
import { getRoadmaps, type LearningRoadmap } from "../../api/learningRoadmap.api";
import { PartnerFormDropdown } from "../Partners/components/PartnerFormDropdown";
import { VietnameseDatePicker } from "../../components/Batches/VietnameseDatePicker";

const TABS = [
  { value: "Bảo lưu", label: "Bảo lưu", icon: PauseCircle, activeClass: "bg-[#00ADFC] text-white" },
  { value: "Chờ xếp học lại", label: "Chờ xếp học lại", icon: RotateCcw, activeClass: "bg-[#00ADFC] text-white" },
] as const;
type LifecycleStatus = (typeof TABS)[number]["value"];
const formatDate = (value?: string | Date | null) => value ? new Intl.DateTimeFormat("vi-VN").format(new Date(value)) : "Chưa xác định";
const toDateInputValue = (value?: string | Date | null) => {
  if (!value) return "";
  const raw = value instanceof Date ? "" : String(value);
  const isoDate = /^(\d{4}-\d{2}-\d{2})/.exec(raw)?.[1];
  if (isoDate) return isoDate;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

export function EnrollmentLifecyclePage() {
  const { batches, loading: batchesLoading } = useBatches();
  const { students } = useStudents();
  const [status, setStatus] = React.useState<LifecycleStatus>("Bảo lưu");
  const [rows, setRows] = React.useState<any[]>([]);
  const [roadmaps, setRoadmaps] = React.useState<LearningRoadmap[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [retakeDraft, setRetakeDraft] = React.useState<{ row: any; targetBatchId: string; reason: string; fee: string } | null>(null);
  const [suspensionDraft, setSuspensionDraft] = React.useState<{ row: any; reason: string; expectedReturnAt: string } | null>(null);

  React.useEffect(() => { getRoadmaps().then(setRoadmaps).catch(() => setRoadmaps([])); }, []);
  React.useEffect(() => {
    let active = true; setLoading(true);
    Promise.all(batches.map(async (batch) => { const payload = await apiFetch<any>(`/batches/${batch.id}/enrollments`); const enrollments = Array.isArray(payload?.data) ? payload.data : payload; return (Array.isArray(enrollments) ? enrollments : []).filter((item) => item.status === status).map((item) => ({ ...item, batch })); }))
      .then((items) => { if (active) setRows(items.flat()); }).catch(() => { if (active) setRows([]); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [batches, status]);

  const studentsById = React.useMemo(() => new Map(students.map((student) => [student.id, student])), [students]);
  const roadmapsById = React.useMemo(() => new Map(roadmaps.map((roadmap) => [roadmap.id, roadmap])), [roadmaps]);
  const activeTab = TABS.find((tab) => tab.value === status)!;
  const ActiveIcon = activeTab.icon;
  const isRetakeQueue = status === "Chờ xếp học lại";
  const refresh = () => window.dispatchEvent(new Event("batch-mutation"));

  const saveSuspension = async () => {
    if (!suspensionDraft?.reason.trim()) { toast.error("Hãy nhập lý do bảo lưu."); return; }
    setSaving(true);
    try { await apiFetch(`/batches/${suspensionDraft.row.batch.id}/learners/${suspensionDraft.row.studentId}/enrollment-status`, { method: "PATCH", body: JSON.stringify({ status: "Bảo lưu", reason: suspensionDraft.reason.trim(), expectedReturnAt: suspensionDraft.expectedReturnAt || null }) }); setSuspensionDraft(null); refresh(); toast.success("Đã cập nhật thông tin bảo lưu."); }
    catch (error: unknown) { toast.error(error instanceof Error ? error.message : "Không thể cập nhật bảo lưu."); } finally { setSaving(false); }
  };
  const confirmRetake = async () => {
    if (!retakeDraft?.targetBatchId) { toast.error("Hãy chọn lớp học lại."); return; }
    setSaving(true);
    try { await apiFetch(`/batches/${retakeDraft.row.batch.id}/learners/${retakeDraft.row.studentId}/enrollment-status`, { method: "PATCH", body: JSON.stringify({ status: "Học lại", targetBatchId: retakeDraft.targetBatchId, reason: retakeDraft.reason.trim() || "Trượt kỳ thi", retakeFee: Number(retakeDraft.fee) || 0 }) }); setRetakeDraft(null); refresh(); toast.success("Đã xếp học viên vào lớp học lại."); }
    catch (error: unknown) { toast.error(error instanceof Error ? error.message : "Không thể xếp học lại."); } finally { setSaving(false); }
  };
  const learningLabel = (row: any) => { const roadmap = row.batch.roadmapId ? roadmapsById.get(row.batch.roadmapId) : undefined; const step = roadmap?.steps.find((item) => item.id === row.batch.roadmapStepId) || roadmap?.steps.find((item) => item.courseId === row.batch.courseId); return { course: row.batch.courseTitle || row.batch.courseCode || "Chưa xác định khóa học", roadmap: roadmap ? `${roadmap.name}${step ? ` · Chặng ${step.order}` : ""}` : "Học lẻ (không theo lộ trình)" }; };

  return (
    <div className="space-y-4 p-5 text-left">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
      <h1 className="text-xl font-medium tracking-tight text-slate-900">Bảo lưu & học lại</h1>
          <p className="mt-1 text-sm text-slate-500">Điều phối học viên theo khóa học hoặc combo/lộ trình đã đăng ký.</p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
          <Users className="h-4 w-4 text-sky-600" />
          {rows.length} học viên
        </span>
      </div>

      <div role="tablist" aria-label="Trạng thái học viên" className="flex w-fit max-w-full flex-wrap items-center gap-1 rounded-xl bg-slate-100/70 p-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = status === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setStatus(tab.value)}
              aria-selected={isActive}
              role="tab"
              className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${isActive ? tab.activeClass : "text-slate-600 hover:bg-white hover:text-slate-800"}`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <ErpCard className="overflow-hidden">
        {(loading || batchesLoading) ? (
          <div className="flex items-center gap-3 p-5 text-sm text-slate-600">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
            Đang tải danh sách học viên...
          </div>
        ) : rows.length === 0 ? (
          <div className="flex min-h-48 flex-col items-center justify-center p-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-50 text-sky-500">
              <ActiveIcon className="h-6 w-6" />
            </div>
            <p className="mt-3 text-sm font-medium text-slate-700">Không có học viên {isRetakeQueue ? "chờ xếp học lại" : "bảo lưu"}.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-left text-sm">
              <thead className="bg-sky-50/70 text-xs text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Học viên</th>
                  <th className="px-4 py-3 font-medium">Khóa học / lộ trình</th>
                  <th className="px-4 py-3 font-medium">Lớp hiện tại</th>
                  <th className="px-4 py-3 font-medium">Lý do</th>
                  <th className="px-4 py-3 font-medium">{isRetakeQueue ? "Xử lý" : "Dự kiến quay lại"}</th>
                  <th className="px-4 py-3 text-right font-medium">Buổi còn</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {rows.map((row, index) => {
                  const student = studentsById.get(row.studentId);
                  const learning = learningLabel(row);
                  const reason = isRetakeQueue ? (row.history?.at(-1)?.note || "Trượt kỳ thi") : row.suspensionReason;
                  return (
                    <tr key={`${row.batch.id}-${row.studentId}-${index}`} className="transition-colors hover:bg-sky-50/40">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{student?.fullName || "Học viên không còn hồ sơ"}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{student?.phone || row.studentId}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-700">{learning.course}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{learning.roadmap}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{row.batch.code}</td>
                      <td className="max-w-[220px] px-4 py-3 text-xs text-slate-600">{reason || "Chưa ghi nhận lý do"}</td>
                      <td className="px-4 py-3">
                        {isRetakeQueue ? (
                          <button
                            type="button"
                            onClick={() => setRetakeDraft({ row, targetBatchId: "", reason: "", fee: "" })}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-sky-100 bg-white px-3 py-2 text-xs font-medium text-sky-700 transition-colors hover:bg-sky-50"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            Tùy chỉnh & xếp lại
                          </button>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-600">{formatDate(row.expectedReturnAt)}</span>
                            <button
                              type="button"
                              title="Chỉnh sửa bảo lưu"
                              aria-label="Chỉnh sửa bảo lưu"
                              onClick={() => setSuspensionDraft({ row, reason: row.suspensionReason || "", expectedReturnAt: toDateInputValue(row.expectedReturnAt) })}
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-sky-100 text-slate-500 transition-colors hover:bg-sky-50 hover:text-sky-700"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-700">{row.remainingSessions ?? 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </ErpCard>

      {suspensionDraft && (
        <ErpModal title="Chỉnh sửa bảo lưu" titleClassName="font-medium" onClose={() => setSuspensionDraft(null)} maxWidth="max-w-md">
          <div className="space-y-4 text-left">
            <label className="block">
              <span className="mb-1.5 block text-xs text-slate-700">Lý do bảo lưu</span>
              <textarea
                value={suspensionDraft.reason}
                onChange={(event) => setSuspensionDraft({ ...suspensionDraft, reason: event.target.value })}
                rows={3}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs text-slate-700">Ngày dự kiến quay lại</span>
              <VietnameseDatePicker ariaLabel="Ngày dự kiến quay lại" value={suspensionDraft.expectedReturnAt} onChange={(expectedReturnAt) => setSuspensionDraft({ ...suspensionDraft, expectedReturnAt })} selectionOnly variant="filter" />
            </label>
            <div className="flex justify-end border-t border-slate-100 pt-3">
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveSuspension()}
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-primary text-white transition-colors hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
                title={saving ? "Đang lưu" : "Lưu thay đổi"}
                aria-label={saving ? "Đang lưu" : "Lưu thay đổi"}
              >
                <Save className="h-4 w-4" />
              </button>
            </div>
          </div>
        </ErpModal>
      )}

      {retakeDraft && (
        <ErpModal title="Tùy chỉnh & xếp học lại" titleClassName="font-medium" onClose={() => setRetakeDraft(null)} maxWidth="max-w-md">
          <div className="space-y-4 text-left">
            <p className="text-sm text-slate-600">Chọn lớp mới, ghi chú và lệ phí trước khi xếp học viên học lại.</p>
            <div>
              <label className="mb-1.5 block text-xs text-slate-700">Lớp học lại</label>
              <PartnerFormDropdown
                label="Chọn lớp học lại"
                value={retakeDraft.targetBatchId}
                onChange={(targetBatchId) => setRetakeDraft({ ...retakeDraft, targetBatchId })}
                triggerClassName="flex h-9 w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 text-left text-sm text-slate-700 transition-colors hover:bg-sky-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00adfc]"
                options={[
                  { value: "", label: "Chọn lớp" },
                  ...batches.filter((batch) => batch.id !== retakeDraft.row.batch.id && batch.status !== "Đã hủy").map((batch) => ({ value: batch.id, label: `${batch.code} — ${batch.courseTitle}` })),
                ]}
              />
            </div>
            <label className="block">
              <span className="mb-1.5 block text-xs text-slate-700">Ghi chú / lý do</span>
              <textarea
                value={retakeDraft.reason}
                onChange={(event) => setRetakeDraft({ ...retakeDraft, reason: event.target.value })}
                rows={2}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                placeholder="Mặc định: Trượt kỳ thi"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs text-slate-700">Lệ phí học lại (VNĐ)</span>
              <input
                type="number"
                min="0"
                value={retakeDraft.fee}
                onChange={(event) => setRetakeDraft({ ...retakeDraft, fee: event.target.value })}
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                placeholder="Miễn phí lần đầu"
              />
            </label>
            <div className="flex justify-end border-t border-slate-100 pt-3">
              <button
                type="button"
                disabled={saving}
                onClick={() => void confirmRetake()}
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-primary text-white transition-colors hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
                title={saving ? "Đang lưu" : "Xác nhận xếp học lại"}
                aria-label={saving ? "Đang lưu" : "Xác nhận xếp học lại"}
              >
                <Save className="h-4 w-4" />
              </button>
            </div>
          </div>
        </ErpModal>
      )}
    </div>
  );
}
