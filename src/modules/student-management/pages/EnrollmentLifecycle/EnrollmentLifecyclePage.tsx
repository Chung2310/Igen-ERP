import React from "react";
import { PauseCircle, Pencil, RotateCcw, Users } from "lucide-react";
import { apiFetch } from "../../lib/api";
import { useBatches } from "../../hooks/useBatches";
import { useStudents } from "../../hooks/useStudents";
import { ErpCard, ErpModal } from "../../components/Erp/ErpUI";
import { toast } from "../../../../pages/Toast";
import { getRoadmaps, type LearningRoadmap } from "../../api/learningRoadmap.api";

const TABS = [
  { value: "Bảo lưu", label: "Bảo lưu", icon: PauseCircle, activeClass: "bg-amber-500 text-white" },
  { value: "Chờ xếp học lại", label: "Chờ xếp học lại", icon: RotateCcw, activeClass: "bg-indigo-600 text-white" },
] as const;
type LifecycleStatus = (typeof TABS)[number]["value"];
const formatDate = (value?: string | Date | null) => value ? new Intl.DateTimeFormat("vi-VN").format(new Date(value)) : "Chưa xác định";

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

  return <div className="space-y-4 p-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-lg font-black text-slate-800">Bảo lưu & học lại</h2><p className="text-xs text-slate-500">Điều phối học viên theo khóa học hoặc combo/lộ trình đã đăng ký.</p></div><span className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600"><Users className="h-3.5 w-3.5" /> {rows.length} học viên</span></div>
    <div className="flex gap-2 border-b border-slate-200">{TABS.map((tab) => { const Icon = tab.icon; return <button key={tab.value} type="button" onClick={() => setStatus(tab.value)} className={`mb-[-1px] flex items-center gap-1.5 rounded-t-xl px-4 py-2.5 text-xs font-bold transition ${status === tab.value ? tab.activeClass : "border border-b-0 border-slate-200 bg-white text-slate-500 hover:bg-slate-50"}`}><Icon className="h-3.5 w-3.5" />{tab.label}</button>; })}</div>
    <ErpCard className="overflow-hidden">{(loading || batchesLoading) ? <p className="p-6 text-sm text-slate-400">Đang tải danh sách học viên...</p> : rows.length === 0 ? <div className="p-10 text-center"><ActiveIcon className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 text-sm font-semibold text-slate-500">Không có học viên {isRetakeQueue ? "chờ xếp học lại" : "bảo lưu"}.</p></div> : <div className="overflow-x-auto"><table className="w-full min-w-[1080px] text-left text-sm"><thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Học viên</th><th className="px-4 py-3">Khóa học / lộ trình</th><th className="px-4 py-3">Lớp hiện tại</th><th className="px-4 py-3">Lý do</th><th className="px-4 py-3">{isRetakeQueue ? "Xử lý" : "Dự kiến quay lại"}</th><th className="px-4 py-3 text-right">Buổi còn</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.map((row, index) => { const student = studentsById.get(row.studentId); const learning = learningLabel(row); const reason = isRetakeQueue ? (row.history?.at(-1)?.note || "Trượt kỳ thi") : row.suspensionReason; return <tr key={`${row.batch.id}-${row.studentId}-${index}`} className="hover:bg-slate-50/70"><td className="px-4 py-3"><p className="font-bold text-slate-800">{student?.fullName || "Học viên không còn hồ sơ"}</p><p className="mt-0.5 text-xs text-slate-500">{student?.phone || row.studentId}</p></td><td className="px-4 py-3"><p className="font-bold text-slate-700">{learning.course}</p><p className="mt-0.5 text-xs text-cyan-700">{learning.roadmap}</p></td><td className="px-4 py-3 font-bold text-slate-700">{row.batch.code}</td><td className="max-w-[220px] px-4 py-3 text-xs text-slate-600">{reason || "Chưa ghi nhận lý do"}</td><td className="px-4 py-3">{isRetakeQueue ? <button type="button" onClick={() => setRetakeDraft({ row, targetBatchId: "", reason: "", fee: "" })} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700">Tùy chỉnh & xếp lại</button> : <div className="flex items-center gap-2"><span className="text-xs text-slate-600">{formatDate(row.expectedReturnAt)}</span><button type="button" title="Chỉnh sửa bảo lưu" onClick={() => setSuspensionDraft({ row, reason: row.suspensionReason || "", expectedReturnAt: row.expectedReturnAt || "" })} className="rounded-lg border border-amber-200 bg-amber-50 p-1.5 text-amber-700 hover:bg-amber-100"><Pencil className="h-3.5 w-3.5" /></button></div>}</td><td className="px-4 py-3 text-right font-black text-slate-700">{row.remainingSessions ?? 0}</td></tr>; })}</tbody></table></div>}</ErpCard>
    {suspensionDraft && <ErpModal title="Chỉnh sửa bảo lưu" onClose={() => setSuspensionDraft(null)} maxWidth="max-w-md"><div className="space-y-4"><label className="block text-xs font-bold text-slate-600">Lý do bảo lưu<textarea value={suspensionDraft.reason} onChange={(event) => setSuspensionDraft({ ...suspensionDraft, reason: event.target.value })} rows={3} className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm" /></label><label className="block text-xs font-bold text-slate-600">Ngày dự kiến quay lại<input type="date" value={suspensionDraft.expectedReturnAt} onChange={(event) => setSuspensionDraft({ ...suspensionDraft, expectedReturnAt: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm" /></label><div className="flex justify-end gap-2"><button type="button" onClick={() => setSuspensionDraft(null)} className="rounded-xl border px-4 py-2 text-xs font-bold">Hủy</button><button type="button" disabled={saving} onClick={() => void saveSuspension()} className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{saving ? "Đang lưu..." : "Lưu thay đổi"}</button></div></div></ErpModal>}
    {retakeDraft && <ErpModal title="Tùy chỉnh & xếp học lại" onClose={() => setRetakeDraft(null)} maxWidth="max-w-md"><div className="space-y-4"><p className="text-sm text-slate-600">Chọn lớp mới, ghi chú và lệ phí trước khi xếp học viên học lại.</p><label className="block text-xs font-bold text-slate-600">Lớp học lại<select value={retakeDraft.targetBatchId} onChange={(event) => setRetakeDraft({ ...retakeDraft, targetBatchId: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm"><option value="">Chọn lớp</option>{batches.filter((batch) => batch.id !== retakeDraft.row.batch.id && batch.status !== "Đã hủy").map((batch) => <option key={batch.id} value={batch.id}>{batch.code} — {batch.courseTitle}</option>)}</select></label><label className="block text-xs font-bold text-slate-600">Ghi chú / lý do<textarea value={retakeDraft.reason} onChange={(event) => setRetakeDraft({ ...retakeDraft, reason: event.target.value })} rows={2} className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm" placeholder="Mặc định: Trượt kỳ thi" /></label><label className="block text-xs font-bold text-slate-600">Lệ phí học lại (VNĐ)<input type="number" min="0" value={retakeDraft.fee} onChange={(event) => setRetakeDraft({ ...retakeDraft, fee: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm" placeholder="Miễn phí lần đầu" /></label><div className="flex justify-end gap-2"><button type="button" onClick={() => setRetakeDraft(null)} className="rounded-xl border px-4 py-2 text-xs font-bold">Hủy</button><button type="button" disabled={saving} onClick={() => void confirmRetake()} className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{saving ? "Đang lưu..." : "Xác nhận xếp lại"}</button></div></div></ErpModal>}
  </div>;
}
