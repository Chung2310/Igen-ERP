import React, { useState } from 'react';
import { Check, Loader2, Pause, Play, Search, UserPlus, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { apiFetch } from '../../lib/api';
import { toast } from '../../../../pages/Toast';
import { ErpModal } from '../Erp/ErpUI';
import { Batch, Student } from '../../types';
import { useEntityLabel } from '../../hooks/useEntityLabel';
import { getBatchPageCopy } from '../../config/workerRecruitmentCopy';
import { useBatchEnrollments } from '../../hooks/useBatchEnrollments';

interface ManageLearnersModalProps {
  isOpen: boolean;
  batch: Batch;
  onClose: () => void;
  students: Student[];
  /** Kept for callers created before retake handling moved to exam results. */
  batches?: Batch[];
  onSuccess: () => void;
}

export function ManageLearnersModal({
  isOpen,
  batch,
  onClose,
  students,
  onSuccess,
}: ManageLearnersModalProps) {
  const darkMode = false;
  const entityLabel = useEntityLabel();
  const copy = getBatchPageCopy(entityLabel.preset);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [removingStudentId, setRemovingStudentId] = useState<string | null>(null);
  const [updatingEnrollmentId, setUpdatingEnrollmentId] = useState<string | null>(null);
  const [suspensionDraft, setSuspensionDraft] = useState<{ studentId: string; reason: string; expectedReturnAt: string } | null>(null);
  const { byStudent, reload: reloadEnrollments } = useBatchEnrollments(isOpen ? batch?.id : null);

  /** Sổ buổi của học viên: đã học / tổng được học */
  const renderSessionCounter = (studentId: string) => {
    const enrollment = byStudent.get(studentId);
    if (!enrollment) return null;
    const exhausted = enrollment.remainingSessions <= 0;
    const suspended = enrollment.status === "Bảo lưu";
    const retaking = enrollment.status === "Học lại";
    return (
      <div className="space-y-0.5">
        {enrollment.allowedSessions > 0 && (
          <p className={cn("text-[10px] font-bold", exhausted ? "text-rose-500" : "text-slate-400")}>
            {enrollment.attendedSessions}/{enrollment.allowedSessions} buổi
            {exhausted ? " — đã hết buổi" : ""}
          </p>
        )}
        <p className={cn("text-[10px] font-bold", suspended ? "text-amber-600" : "text-emerald-600")}>
          {suspended ? "Đang bảo lưu" : retaking ? "Đã chuyển sang học lại" : "Đang học"}
          {suspended && enrollment.expectedReturnAt ? ` • dự kiến ${enrollment.expectedReturnAt.split("-").reverse().join("/")}` : ""}
        </p>
      </div>
    );
  };

  const availableStudents = students.filter((s) => !batch.learnerIds.includes(s.id));
  const remainingSlots = batch.maxLearners > 0
    ? Math.max(batch.maxLearners - batch.learnerIds.length, 0)
    : Number.POSITIVE_INFINITY;
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase('vi');
  const filteredStudents = availableStudents.filter((student) => {
    if (!normalizedQuery) return true;
    return [student.fullName, student.phone, student.rank]
      .filter(Boolean)
      .some((value) => value!.toLocaleLowerCase('vi').includes(normalizedQuery));
  });
  const enrolledStudents = batch.learnerIds
    .map((id) => students.find((s) => s.id === id))
    .filter((s): s is NonNullable<typeof s> => !!s);

  const toggleStudent = (studentId: string) => {
    setSelectedStudentIds((current) => {
      if (current.includes(studentId)) return current.filter((id) => id !== studentId);
      if (current.length >= remainingSlots) {
        toast.error(`${copy.entityName} chỉ còn ${remainingSlots} chỗ trống.`);
        return current;
      }
      return [...current, studentId];
    });
  };

  const filteredStudentIds = filteredStudents.map((student) => student.id);
  const allFilteredSelected = filteredStudentIds.length > 0
    && filteredStudentIds.every((id) => selectedStudentIds.includes(id));

  const toggleAllFiltered = () => {
    setSelectedStudentIds((current) => {
      if (allFilteredSelected) {
        return current.filter((id) => !filteredStudentIds.includes(id));
      }
      const additions = filteredStudentIds.filter((id) => !current.includes(id));
      return [...current, ...additions].slice(0, remainingSlots);
    });
  };

  const handleAddLearners = async () => {
    if (selectedStudentIds.length === 0 || isAdding) return;
    setIsAdding(true);
    const addedIds: string[] = [];
    try {
      for (const studentId of selectedStudentIds) {
        await apiFetch(`/batches/${batch.id}/learners`, {
          method: 'POST',
          body: JSON.stringify({ studentId }),
        });
        addedIds.push(studentId);
      }
      setSelectedStudentIds([]);
      toast.success(`Đã thêm ${addedIds.length} ${entityLabel.singular} vào ${copy.entityNameLower}.`);
      onSuccess();
    } catch (error: unknown) {
      setSelectedStudentIds((current) => current.filter((id) => !addedIds.includes(id)));
      if (addedIds.length > 0) onSuccess();
      const msg = error instanceof Error ? error.message : `Có lỗi xảy ra khi thêm ${entityLabel.singular}.`;
      toast.error(addedIds.length > 0 ? `Đã thêm ${addedIds.length} ${entityLabel.singular}. ${msg}` : msg);
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveLearner = async (studentId: string) => {
    setRemovingStudentId(studentId);
    try {
      await apiFetch(`/batches/${batch.id}/learners/${studentId}`, { method: 'DELETE' });
      toast.success(`Đã bỏ ${entityLabel.singular} khỏi ${copy.entityNameLower}.`);
      onSuccess();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : `Có lỗi xảy ra khi bỏ ${entityLabel.singular}.`;
      toast.error(msg);
    } finally {
      setRemovingStudentId(null);
    }
  };

const handleToggleSuspension = async (studentId: string) => {
    const enrollment = byStudent.get(studentId);
    if (!enrollment || updatingEnrollmentId) return;
    if (enrollment.status !== "Bảo lưu") {
      setSuspensionDraft({ studentId, reason: "", expectedReturnAt: "" });
      return;
    }
    setUpdatingEnrollmentId(studentId);
    try {
      await apiFetch(`/batches/${batch.id}/learners/${studentId}/enrollment-status`, { method: "PATCH", body: JSON.stringify({ status: "Đang học" }) });
      await reloadEnrollments();
      toast.success("Học viên đã quay lại học.");
      onSuccess();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Không thể cập nhật trạng thái học viên.");
    } finally { setUpdatingEnrollmentId(null); }
  };

  const confirmSuspension = async () => {
    if (!suspensionDraft || !suspensionDraft.reason.trim()) { toast.error("Vui lòng nhập lý do bảo lưu."); return; }
    const { studentId, reason, expectedReturnAt } = suspensionDraft;
    setUpdatingEnrollmentId(studentId);
    try {
      await apiFetch(`/batches/${batch.id}/learners/${studentId}/enrollment-status`, { method: "PATCH", body: JSON.stringify({ status: "Bảo lưu", reason: reason.trim(), expectedReturnAt: expectedReturnAt.trim() || null }) });
      setSuspensionDraft(null);
      await reloadEnrollments();
      toast.success("Đã bảo lưu và đưa học viên ra khỏi danh sách lớp.");
      onSuccess();
    } catch (error: unknown) { toast.error(error instanceof Error ? error.message : "Không thể cập nhật trạng thái học viên."); }
    finally { setUpdatingEnrollmentId(null); }
  };
  if (!isOpen) return null;

  return (
    <>
    <ErpModal
      title={`${entityLabel.tabLabel} ${copy.entityNameLower} ${batch.code}`}
      onClose={onClose}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-6">
        <p className={cn("text-xs font-bold", darkMode ? "text-slate-400" : "text-slate-500")}>
          {batch.courseTitle} • {copy.capacityLabel}: {batch.learnerIds.length}
          {batch.maxLearners ? `/${batch.maxLearners}` : ''} {entityLabel.singular}
        </p>

        {/* Add learners */}
        <div className="space-y-3 text-left">
          <div className="flex items-center justify-between gap-3">
            <h5 className="text-xs font-black uppercase tracking-wider text-slate-500">
              Chọn {entityLabel.singular} để thêm
            </h5>
            <span className="text-[11px] font-bold text-brand-primary">
              Đã chọn {selectedStudentIds.length}
              {Number.isFinite(remainingSlots) ? `/${remainingSlots} chỗ trống` : ''}
            </span>
          </div>
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Tìm theo tên hoặc số điện thoại..."
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-xs font-semibold text-slate-800 outline-none transition-all focus:border-brand-primary focus:bg-white"
            />
          </div>

          {remainingSlots === 0 ? (
            <p className="py-6 text-center text-xs font-semibold text-slate-500">{copy.entityName} đã đủ {copy.capacityLabel.toLocaleLowerCase('vi')}.</p>
          ) : availableStudents.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-400">Không còn {entityLabel.singular} để thêm vào {copy.entityNameLower}.</p>
          ) : filteredStudents.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-400">Không tìm thấy {entityLabel.singular} phù hợp.</p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={toggleAllFiltered}
                disabled={isAdding || remainingSlots === 0}
                className="flex h-10 w-full items-center gap-3 border-b border-slate-200 bg-slate-50 px-4 text-left text-[11px] font-bold text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className={cn(
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                  allFilteredSelected ? "border-brand-primary bg-brand-primary text-white" : "border-slate-300 bg-white"
                )}>
                  {allFilteredSelected && <Check className="h-3 w-3" />}
                </span>
                Chọn tất cả kết quả ({filteredStudents.length})
              </button>
              <div className="max-h-60 divide-y divide-slate-100 overflow-y-auto">
                {filteredStudents.map((student) => {
                  const isSelected = selectedStudentIds.includes(student.id);
                  const isDisabled = isAdding || (!isSelected && selectedStudentIds.length >= remainingSlots);
                  return (
                    <label
                      key={student.id}
                      className={cn(
                        "flex min-h-12 items-center gap-3 px-4 py-2.5 transition-colors",
                        isSelected ? "bg-sky-50" : "bg-white hover:bg-slate-50",
                        isDisabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={isDisabled}
                        onChange={() => toggleStudent(student.id)}
                        className="h-4 w-4 shrink-0 accent-brand-primary"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-bold text-slate-700">{student.fullName}</span>
                        <span className="block truncate text-[10px] text-slate-400">
                          {student.phone}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleAddLearners}
              disabled={selectedStudentIds.length === 0 || isAdding}
              className="flex h-10 items-center gap-2 rounded-xl bg-brand-primary px-5 text-xs font-bold text-white transition-all hover:bg-brand-primary/95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              {isAdding ? `Đang thêm ${selectedStudentIds.length} ${entityLabel.singular}...` : `Xác nhận thêm (${selectedStudentIds.length})`}
            </button>
          </div>
        </div>

        {/* Enrolled learners */}
        <div className="space-y-2 text-left">
          <h5 className={cn("text-xs font-black uppercase tracking-wider", darkMode ? "text-slate-400" : "text-slate-500")}>
            Danh sách {entityLabel.singular} trong {copy.entityNameLower}
          </h5>
          {enrolledStudents.length === 0 ? (
            <p className="text-xs text-slate-400">{copy.entityName} chưa có {entityLabel.singular} nào.</p>
          ) : (
            <div className={cn("border rounded-2xl p-2 max-h-72 overflow-y-auto divide-y", darkMode ? "border-slate-800 divide-slate-800/40" : "border-slate-100 divide-slate-100/60")}>
              {enrolledStudents.map((s) => (
                <div key={s.id} className="grid grid-cols-[minmax(0,1fr)_minmax(9rem,1fr)_2.5rem] items-center gap-3 px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_minmax(14rem,1fr)_2.5rem]">
                  <div>
                    <p className={cn("text-xs font-bold", darkMode ? "text-slate-200" : "text-slate-700")}>{s.fullName}</p>
                    <p className="text-[10px] text-slate-400">{s.phone}</p>
                    {renderSessionCounter(s.id)}
                  </div>
                  <div className="flex min-w-0 justify-start">
                  {byStudent.get(s.id) && (
                    <>
                    <button
                      type="button"
                      onClick={() => handleToggleSuspension(s.id)}
                      disabled={updatingEnrollmentId !== null || removingStudentId !== null || isAdding}
                      title={byStudent.get(s.id)?.status === "Bảo lưu" ? "Tiếp tục học" : "Bảo lưu"}
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-lg border transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-50",
                        byStudent.get(s.id)?.status === "Bảo lưu"
                          ? "bg-amber-50 text-amber-600 border-amber-200"
                          : "bg-slate-50 text-slate-450 border-slate-200/60 hover:bg-amber-50 hover:text-amber-600"
                      )}
                    >
                      {updatingEnrollmentId === s.id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : byStudent.get(s.id)?.status === "Bảo lưu" ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                    </button>
                    </>
                  )}
                  </div>
                  <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleRemoveLearner(s.id)}
                    disabled={removingStudentId !== null || isAdding}
                    title={`Bỏ khỏi ${copy.entityNameLower}`}
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-lg border transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-50",
                      darkMode
                        ? "bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-400 border-transparent"
                        : "bg-slate-50 hover:bg-rose-50 text-slate-450 hover:text-rose-600 border-slate-200/60"
                    )}
                  >
                    {removingStudentId === s.id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <X className="h-3.5 w-3.5" />}
                  </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ErpModal>
      {suspensionDraft && (
        <ErpModal title="Xác nhận bảo lưu học viên" onClose={() => setSuspensionDraft(null)} maxWidth="max-w-md">
          <div className="space-y-4">
            <label className="block text-xs font-bold text-slate-600">Lý do bảo lưu<textarea value={suspensionDraft.reason} onChange={(e) => setSuspensionDraft({ ...suspensionDraft, reason: e.target.value })} rows={3} className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:ring-2 focus:ring-amber-500" placeholder="Nhập lý do..." /></label>
            <label className="block text-xs font-bold text-slate-600">Ngày dự kiến quay lại<input type="date" value={suspensionDraft.expectedReturnAt} onChange={(e) => setSuspensionDraft({ ...suspensionDraft, expectedReturnAt: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:ring-2 focus:ring-amber-500" /></label>
            <div className="flex justify-end gap-2"><button type="button" onClick={() => setSuspensionDraft(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600">Hủy</button><button type="button" onClick={confirmSuspension} className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-white">Xác nhận bảo lưu</button></div>
          </div>
        </ErpModal>
      )}
    </>
  );
}
