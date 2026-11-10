import React from "react";
import { ArrowUpRight, CheckCircle2, GraduationCap, Users } from "lucide-react";
import { toast } from "../../../../pages/Toast";
import { getApiErrorMessage } from "../../../../utils/errorMessage";
import { getBatchProgression, promoteBatchStudents, type BatchProgression } from "../../api/learningRoadmap.api";
import { apiFetch } from "../../lib/api";
import type { Batch, Course, ResourceItem } from "../../types";
import { ErpField, ErpInput, ErpModal } from "../Erp/ErpUI";
import { RoadmapPicker } from "../ui/RoadmapPicker";
import { VietnameseDatePicker } from "./VietnameseDatePicker";

const PROMOTABLE_STATUSES = new Set(["Đang học", "Chờ xếp lớp tiếp theo", "Hoàn thành khóa"]);
const MAX_PROMOTION_STUDENTS = 500;
const WEEKDAYS = [
  { value: 1, label: "T2" }, { value: 2, label: "T3" }, { value: 3, label: "T4" },
  { value: 4, label: "T5" }, { value: 5, label: "T6" }, { value: 6, label: "T7" }, { value: 0, label: "CN" },
];

type NewClassForm = {
  code: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  daysOfWeek: number[];
  location: string;
};

function normalizeCode(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleUpperCase("vi-VN");
}

function suggestedCode(batch: Batch, level: number, batches: Batch[]) {
  const stem = `${batch.code}-L${level}`.slice(0, 46);
  const existing = new Set(batches.map((item) => normalizeCode(item.code)));
  let code = stem;
  let suffix = 2;
  while (existing.has(normalizeCode(code))) {
    code = `${stem}-${suffix++}`.slice(0, 50);
  }
  return code;
}

function todayIsoDate() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

export function DirectLevelPromotionModal({
  batch,
  batches,
  courses,
  classrooms,
  onClose,
  onPromoted,
}: {
  batch: Batch;
  batches: Batch[];
  courses: Course[];
  classrooms: ResourceItem[];
  onClose: () => void;
  onPromoted: () => void;
}) {
  const [progression, setProgression] = React.useState<BatchProgression | null>(null);
  const [selectedRoadmapId, setSelectedRoadmapId] = React.useState(batch.roadmapId || "");
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [error, setError] = React.useState("");
  const [createdTarget, setCreatedTarget] = React.useState<{ id: string; code: string } | null>(null);
  const [newClass, setNewClass] = React.useState<NewClassForm>(() => ({
    code: "",
    startDate: todayIsoDate(),
    endDate: "",
    startTime: batch.startTime || "18:00",
    endTime: batch.endTime || "20:00",
    daysOfWeek: batch.daysOfWeek || [],
    location: batch.location || "",
  }));

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void getBatchProgression(batch.id, selectedRoadmapId)
      .then((data) => {
        if (!active) return;
        setProgression(data);
        if (data.selectedRoadmapId && data.selectedRoadmapId !== selectedRoadmapId) {
          setSelectedRoadmapId(data.selectedRoadmapId);
        }
        setSelectedIds((data.rows || []).filter((row) => PROMOTABLE_STATUSES.has(row.enrollmentStatus || "")).slice(0, MAX_PROMOTION_STUDENTS).map((row) => row.studentId));
        if (data.targetStep) {
          setNewClass((current) => ({ ...current, code: current.code || suggestedCode(batch, data.targetStep!.order, batches) }));
        }
      })
      .catch((requestError) => {
        if (active) setError(getApiErrorMessage(requestError, "Không thể tải level kế tiếp của lớp."));
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [batch.id, batch, batches, selectedRoadmapId]);

  const roadmaps = progression?.roadmaps || [];
  const availableRows = (progression?.rows || []).filter((row) => PROMOTABLE_STATUSES.has(row.enrollmentStatus || ""));
  const selectableRows = availableRows.slice(0, MAX_PROMOTION_STUDENTS);
  const allSelected = selectableRows.length > 0 && selectableRows.every((row) => selectedIds.includes(row.studentId));
  const targetStep = progression?.targetStep;
  const targetCourse = courses.find((course) => course.id === targetStep?.courseId);

  const createClassAndPromote = async () => {
    if (!progression?.selectedRoadmapId || !targetStep) return;
    if (!selectedIds.length) { setError("Chọn ít nhất một học viên cần chuyển."); return; }
    if (!newClass.code.trim() || !newClass.startDate || !newClass.endDate || !newClass.daysOfWeek.length) {
      setError("Nhập mã lớp, ngày bắt đầu/kết thúc và chọn ít nhất một ngày học.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newClass.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(newClass.endDate) || newClass.startDate > newClass.endDate) {
      setError("Ngày bắt đầu và kết thúc không hợp lệ.");
      return;
    }
    if (newClass.startTime >= newClass.endTime) { setError("Giờ bắt đầu phải trước giờ kết thúc."); return; }
    const code = normalizeCode(newClass.code);
    if (code.length < 2 || code.length > 50) { setError("Mã lớp cần từ 2 đến 50 ký tự."); return; }
    if (!createdTarget && batches.some((item) => normalizeCode(item.code) === code)) {
      setError(`Mã lớp “${code}” đã tồn tại. Hãy nhập mã khác.`);
      return;
    }
    if (targetStep.maxClassSize > 0 && selectedIds.length > targetStep.maxClassSize) {
      setError(`Level này giới hạn ${targetStep.maxClassSize} học viên mỗi lớp. Hãy giảm số học viên được chọn.`);
      return;
    }

    setSaving(true);
    setError("");
    try {
      let targetBatchId = createdTarget?.id;
      if (!targetBatchId) {
        const response = await apiFetch<{ success: boolean; data: { id?: string; _id?: string } }>("/batches", {
          method: "POST",
          body: JSON.stringify({
            code,
            courseId: targetStep.courseId,
            roadmapId: progression.selectedRoadmapId,
            roadmapStepId: targetStep.id,
            status: "Sắp khai giảng",
            quota: 0,
            daysOfWeek: newClass.daysOfWeek,
            startTime: newClass.startTime,
            endTime: newClass.endTime,
            startDate: newClass.startDate,
            endDate: newClass.endDate,
            location: newClass.location,
            instructorId: batch.instructorId || "",
            instructorText: batch.instructorText || "",
          }),
        });
        targetBatchId = response.data?.id || response.data?._id;
        if (!targetBatchId) throw new Error("Không nhận được mã của lớp vừa tạo.");
        setCreatedTarget({ id: targetBatchId, code });
      }

      await promoteBatchStudents(batch.id, progression.selectedRoadmapId, targetBatchId, selectedIds);
      toast.success(`Đã tạo lớp ${code} và chuyển ${selectedIds.length} học viên lên level ${targetStep.order}.`);
      onPromoted();
      onClose();
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, "Không thể tạo lớp và chuyển học viên."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ErpModal title="Mở lớp level tiếp theo" onClose={onClose} maxWidth="max-w-3xl">
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-xl border border-sky-100 bg-sky-50 p-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white text-sky-700"><GraduationCap className="size-5" /></span>
          <div>
            <p className="text-sm font-semibold text-slate-800">{batch.code} · {batch.courseTitle}</p>
            <p className="mt-1 text-xs leading-5 text-slate-600">Chọn học viên, nhập lịch lớp mới và chuyển thẳng lên level kế tiếp. Không cần tạo kết quả thi; chức năng thi vẫn giữ nguyên.</p>
          </div>
        </div>

        {loading ? <p className="py-8 text-center text-sm text-slate-500">Đang tải level kế tiếp...</p> : null}
        {!loading && error && !progression ? <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}

        {!loading && progression && roadmaps.length > 1 ? (
          <ErpField label="Lộ trình học">
          <RoadmapPicker value={selectedRoadmapId} disabled={Boolean(createdTarget)} onChange={setSelectedRoadmapId} placeholder="Chọn lộ trình" ariaLabel="Lộ trình học" options={roadmaps.map((roadmap) => ({ value: roadmap.id, label: `${roadmap.code} · ${roadmap.name}` }))} />
          </ErpField>
        ) : null}

        {!loading && progression && !progression.selectedRoadmapId && roadmaps.length === 0 ? (
          <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Chưa có lộ trình đang hoạt động chứa khóa học của lớp này. Hãy thêm khóa học vào lộ trình để hệ thống xác định level tiếp theo.</p>
        ) : null}

        {!loading && progression?.selectedRoadmapId && !targetStep ? (
          <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Lớp đang ở level cuối của lộ trình, chưa có level tiếp theo để mở.</p>
        ) : null}

        {!loading && targetStep ? <>
          <div className="rounded-lg border border-sky-100 bg-sky-50/60 px-3 py-2 text-sm text-slate-700">
            Level {targetStep.order}: <span className="font-semibold">{targetCourse?.title || "Khóa học kế tiếp"}</span>
            {targetStep.maxClassSize > 0 ? <span className="ml-2 text-xs text-slate-500">Tối đa {targetStep.maxClassSize} học viên</span> : null}
          </div>

          <section className="overflow-hidden rounded-xl border border-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2">
              <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700"><Users className="size-4" /> Chọn học viên ({selectedIds.length}/{availableRows.length})</span>
              <button type="button" disabled={!selectableRows.length} onClick={() => setSelectedIds(allSelected ? [] : selectableRows.map((row) => row.studentId))} className="text-xs font-semibold text-sky-700 hover:text-sky-900 disabled:opacity-50">
                {allSelected ? "Bỏ chọn tất cả" : "Chọn tất cả"}
              </button>
            </div>
            {availableRows.length > MAX_PROMOTION_STUDENTS ? <p className="border-b border-slate-100 px-3 py-2 text-xs text-amber-700">Mỗi lần chuyển tối đa {MAX_PROMOTION_STUDENTS} học viên.</p> : null}
            <div className="max-h-56 divide-y divide-slate-100 overflow-y-auto">
              {progression.rows.map((row) => {
                const canPromote = PROMOTABLE_STATUSES.has(row.enrollmentStatus || "");
                return (
                  <label key={row.studentId} className={`flex items-center gap-3 px-3 py-2.5 text-sm ${canPromote ? "cursor-pointer hover:bg-sky-50/60" : "bg-slate-50/70 text-slate-400"}`}>
                    <input type="checkbox" checked={selectedIds.includes(row.studentId)} disabled={!canPromote || (!selectedIds.includes(row.studentId) && selectedIds.length >= MAX_PROMOTION_STUDENTS)} onChange={(event) => {
                      if (event.target.checked && selectedIds.length >= MAX_PROMOTION_STUDENTS) { setError(`Mỗi lần chuyển tối đa ${MAX_PROMOTION_STUDENTS} học viên.`); return; }
                      setError("");
                      setSelectedIds((current) => event.target.checked ? [...current, row.studentId] : current.filter((id) => id !== row.studentId));
                    }} />
                    <span className="min-w-0 flex-1"><span className="block truncate font-medium text-slate-800">{row.studentName}</span><span className="text-xs text-slate-500">{row.studentPhone || "Chưa có số điện thoại"}</span></span>
                    {canPromote ? <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700"><CheckCircle2 className="size-3.5" /> Có thể chuyển</span> : <span className="text-xs">{row.enrollmentStatus || "Chưa có đăng ký lớp"}</span>}
                  </label>
                );
              })}
              {progression.rows.length === 0 ? <p className="p-5 text-center text-sm text-slate-500">Lớp chưa có dữ liệu đăng ký học viên.</p> : null}
            </div>
          </section>

          <section className="space-y-3 rounded-xl border border-slate-200 p-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Thông tin lớp mới</h3>
              <p className="mt-0.5 text-xs text-slate-500">Lớp sẽ được tạo ở trạng thái Sắp khai giảng rồi chuyển các học viên đã chọn sang.</p>
            </div>
            {createdTarget ? <p role="status" className="rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-800">Đã tạo lớp {createdTarget.code}. Nếu lần chuyển trước chưa hoàn tất, bấm lại để thử chuyển mà không tạo lớp trùng.</p> : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <ErpField label="Mã lớp mới *">
                <ErpInput value={newClass.code} disabled={Boolean(createdTarget)} onChange={(event) => setNewClass((current) => ({ ...current, code: event.target.value }))} placeholder="Ví dụ: K32-L2" />
              </ErpField>
              <ErpField label="Phòng học">
                <RoadmapPicker value={newClass.location} disabled={Boolean(createdTarget)} onChange={(location) => setNewClass((current) => ({ ...current, location }))} placeholder="Chọn phòng học" options={classrooms.map((room) => ({ value: room.name, label: room.identifier ? `${room.name} · ${room.identifier}` : room.name }))} portal />
              </ErpField>
              <ErpField label="Ngày khai giảng *">
                <VietnameseDatePicker ariaLabel="Ngày khai giảng lớp mới" value={newClass.startDate} disabled={Boolean(createdTarget)} onChange={(startDate) => setNewClass((current) => ({ ...current, startDate, endDate: current.endDate && current.endDate < startDate ? "" : current.endDate }))} selectionOnly variant="filter" />
              </ErpField>
              <ErpField label="Ngày bế giảng dự kiến *">
                <VietnameseDatePicker ariaLabel="Ngày bế giảng lớp mới" value={newClass.endDate} disabled={Boolean(createdTarget)} min={newClass.startDate || undefined} onChange={(endDate) => setNewClass((current) => ({ ...current, endDate }))} selectionOnly variant="filter" />
              </ErpField>
              <ErpField label="Giờ bắt đầu *">
                <ErpInput type="time" value={newClass.startTime} disabled={Boolean(createdTarget)} onChange={(event) => setNewClass((current) => ({ ...current, startTime: event.target.value }))} />
              </ErpField>
              <ErpField label="Giờ kết thúc *">
                <ErpInput type="time" value={newClass.endTime} disabled={Boolean(createdTarget)} onChange={(event) => setNewClass((current) => ({ ...current, endTime: event.target.value }))} />
              </ErpField>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-semibold text-slate-900">Lịch học trong tuần *</p>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map((day) => {
                  const selected = newClass.daysOfWeek.includes(day.value);
                  return <button key={day.value} type="button" aria-pressed={selected} disabled={Boolean(createdTarget)} onClick={() => setNewClass((current) => ({ ...current, daysOfWeek: selected ? current.daysOfWeek.filter((value) => value !== day.value) : [...current.daysOfWeek, day.value] }))} className={`h-9 min-w-10 rounded-md border px-2 text-xs font-semibold ${selected ? "border-primary bg-primary text-on-primary" : "border-outline-variant bg-surface-container-lowest text-on-surface hover:bg-surface-container"}`}>{day.label}</button>;
                })}
              </div>
            </div>
          </section>
        </> : null}

        {error && progression ? <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <button type="button" onClick={onClose} disabled={saving} className="h-10 rounded-md border border-outline-variant px-4 text-sm font-medium text-on-surface hover:bg-surface-container disabled:opacity-50">Đóng</button>
          {targetStep ? <button type="button" onClick={() => void createClassAndPromote()} disabled={loading || saving || !selectedIds.length || !progression?.selectedRoadmapId} className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-on-primary hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"><ArrowUpRight className="size-4" />{saving ? (createdTarget ? "Đang chuyển học viên..." : "Đang tạo lớp...") : createdTarget ? `Chuyển ${selectedIds.length} học viên` : `Tạo lớp và chuyển ${selectedIds.length} học viên`}</button> : null}
        </div>
      </div>
    </ErpModal>
  );
}
