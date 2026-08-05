import React, { useState } from 'react';
import { Calendar, CalendarRange, Trash2, Sparkles } from 'lucide-react';
import { cn } from '../../lib/utils';
import { apiFetch } from '../../lib/api';
import { toast } from '../../../../pages/Toast';
import { QRAttendanceModal } from './QRAttendanceModal';
import { ErpModal, ErpField, ErpInput } from '../Erp/ErpUI';
import { Batch, Student } from '../../types';
import { useEntityLabel } from '../../hooks/useEntityLabel';
import { getBatchPageCopy } from '../../config/workerRecruitmentCopy';
import { WorkerTimekeepingPanel } from './WorkerTimekeepingPanel';
import { useBatchEnrollments } from '../../hooks/useBatchEnrollments';

interface AttendanceModalProps {
  isOpen: boolean;
  batch: Batch;
  onClose: () => void;
  students: Student[];
  onSuccess: () => void;
}

const DAY_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: 'T2' },
  { value: 2, label: 'T3' },
  { value: 3, label: 'T4' },
  { value: 4, label: 'T5' },
  { value: 5, label: 'T6' },
  { value: 6, label: 'T7' },
  { value: 0, label: 'CN' },
];

const formatDays = (days: number[]) =>
  DAY_OPTIONS.filter(d => (days || []).includes(d.value)).map(d => d.label).join(', ');

const formatDate = (d: string) => (d ? d.split('-').reverse().join('/') : '');

export function AttendanceModal({
  isOpen,
  batch,
  onClose,
  students = [],
  onSuccess,
}: AttendanceModalProps) {
  const entityLabel = useEntityLabel();
  const copy = getBatchPageCopy(entityLabel.preset);
  const [selectedSessionDate, setSelectedSessionDate] = useState<string | null>(null);
  const [showAddSession, setShowAddSession] = useState(false);
  const [newSessionDate, setNewSessionDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendanceRecords, setAttendanceRecords] = useState<Record<string, 'present' | 'absent' | 'excused' | 'late'>>({});
  const [sessionNote, setSessionNote] = useState('');
  const [bulkSelectStudents, setBulkSelectStudents] = useState<string[]>([]);
  const [showQrModal, setShowQrModal] = useState(false);
  // Phải gọi trước early return bên dưới để không vi phạm quy tắc hook
  const { byStudent, reload: reloadEnrollments } = useBatchEnrollments(isOpen ? batch?.id : null);

  if (!isOpen || !batch) return null;

  const getScheduledDates = (startDateStr: string, endDateStr: string, daysOfWeek: number[]) => {
    const dates: string[] = [];
    if (!startDateStr || !endDateStr || !daysOfWeek || daysOfWeek.length === 0) return dates;
    
    const [sy, sm, sd] = startDateStr.split('-').map(Number);
    const [ey, em, ed] = endDateStr.split('-').map(Number);
    const start = new Date(sy, sm - 1, sd);
    const end = new Date(ey, em - 1, ed);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return dates;
    
    const cursor = new Date(start);
    let limit = 0;
    while (cursor <= end && limit < 200) {
      if (daysOfWeek.includes(cursor.getDay())) {
        const y = cursor.getFullYear();
        const m = String(cursor.getMonth() + 1).padStart(2, '0');
        const d = String(cursor.getDate()).padStart(2, '0');
        dates.push(`${y}-${m}-${d}`);
      }
      cursor.setDate(cursor.getDate() + 1);
      limit++;
    }
    return dates;
  };

  const openSessionDetail = (date: string) => {
    setSelectedSessionDate(date);
    const session = batch.attendanceSessions?.find(s => s.date === date);
    setSessionNote(session?.note || '');
    const recs: Record<string, 'present' | 'absent' | 'excused' | 'late'> = {};
    (batch.learnerIds || []).forEach((studentId) => {
      const rec = session?.records?.find(r => r.studentId === studentId);
      recs[studentId] = rec ? rec.status : 'present';
    });
    setAttendanceRecords(recs);
    setBulkSelectStudents([]);
  };

  const handleAddCustomDate = () => {
    if (!newSessionDate) return;
    openSessionDetail(newSessionDate);
    setShowAddSession(false);
  };

  const handleUpdateAttendance = async () => {
    if (!selectedSessionDate) return;
    try {
      const recordsPayload = Object.keys(attendanceRecords).map(studentId => ({
        studentId,
        status: attendanceRecords[studentId]
      }));
      await apiFetch(`/batches/${batch.id}/attendance`, {
        method: 'PUT',
        body: JSON.stringify({ date: selectedSessionDate, records: recordsPayload, note: sessionNote }),
      });
      toast.success('Đã lưu thông tin điểm danh.');
      await reloadEnrollments();
      onSuccess();
      setSelectedSessionDate(null);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Có lỗi xảy ra khi lưu điểm danh.';
      toast.error(msg);
    }
  };

  const handleDeleteSession = async (date: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa dữ liệu điểm danh ngày ${formatDate(date)} không?`)) return;
    try {
      await apiFetch(`/batches/${batch.id}/attendance?date=${date}`, {
        method: 'DELETE',
      });
      toast.success('Đã xóa dữ liệu điểm danh.');
      await reloadEnrollments();
      onSuccess();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Có lỗi xảy ra khi xóa dữ liệu điểm danh.';
      toast.error(msg);
    }
  };

  const handleBulkChangeStatus = (status: 'present' | 'absent' | 'excused' | 'late') => {
    setAttendanceRecords(prev => {
      const updated = { ...prev };
      bulkSelectStudents.forEach(studentId => {
        updated[studentId] = status;
      });
      return updated;
    });
    setBulkSelectStudents([]);
  };

  // Preset lao động dùng chấm công vào/ra theo vị trí công trường thay cho mô
  // hình có mặt/vắng theo buổi của lớp học.
  if (entityLabel.preset === 'worker') {
    return (
      <ErpModal
        title={`Chấm công ${copy.entityNameLower} ${batch.code}`}
        onClose={onClose}
        maxWidth="max-w-3xl"
      >
        <WorkerTimekeepingPanel batch={batch} students={students} />
      </ErpModal>
    );
  }

  return (
    <ErpModal
      title={`Điểm danh ${copy.entityNameLower} ${batch.code}`}
      onClose={onClose}
      maxWidth="max-w-2xl"
    >
      {selectedSessionDate === null ? (
        // Session List View
        <div className="space-y-6 text-left">
          <div className="flex justify-between items-center">
            <div>
              <h4 className="text-xs font-bold text-slate-700">
                {batch.courseTitle}
              </h4>
              <p className="text-[10px] text-slate-400">
                {copy.capacityLabel}: {batch.learnerIds.length} {entityLabel.singular} • Lịch hoạt động: {formatDays(batch.daysOfWeek)} ({batch.startTime} - {batch.endTime})
              </p>
            </div>
            {!showAddSession && (
              <button
                type="button"
                onClick={() => {
                  setShowAddSession(true);
                  setNewSessionDate(new Date().toISOString().split('T')[0]);
                }}
                className="px-4 py-2 bg-cyan-50 text-cyan-700 border border-cyan-200 rounded-xl text-xs font-bold transition-all hover:bg-cyan-100 flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <CalendarRange className="w-4 h-4 text-cyan-600" /> Bổ sung ngày học khác
              </button>
            )}
          </div>

          {batch.learnerIds.length === 0 && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-700 font-medium">
              ⚠️ {copy.entityName} này hiện chưa có {entityLabel.singular} nào. Hãy bấm <strong>Quản lý {entityLabel.singular} (👥)</strong> để thêm {entityLabel.singular} vào {copy.entityNameLower} trước khi điểm danh.
            </div>
          )}

          {showAddSession && (
            <div className="p-4 border border-cyan-100 rounded-2xl bg-cyan-50/40 space-y-4">
              <h5 className="text-xs font-bold text-cyan-900">Thêm ngày học bổ sung (ngoài lịch cố định)</h5>
              <div className="grid grid-cols-2 gap-4 text-left">
                <ErpField label="Ngày học bổ sung">
                  <ErpInput
                    type="date"
                    value={newSessionDate}
                    onChange={(e) => setNewSessionDate(e.target.value)}
                  />
                </ErpField>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddSession(false)}
                  className="px-3 py-1.5 bg-slate-200 text-slate-650 rounded-lg text-xs font-semibold hover:bg-slate-300 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleAddCustomDate}
                  className="px-3 py-1.5 bg-cyan-500 text-white rounded-lg text-xs font-bold hover:bg-cyan-600 shadow-sm shadow-cyan-500/20 cursor-pointer border border-cyan-400"
                >
                  Xác nhận và Điểm danh
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <h5 className="text-xs font-black uppercase tracking-wider text-slate-500">
              Danh sách buổi học theo lịch trình
            </h5>
            {(() => {
              const sDates = getScheduledDates(batch.startDate, batch.endDate, batch.daysOfWeek);
              const exDates = (batch.attendanceSessions || []).map(s => s.date).filter(d => !sDates.includes(d));
              const allDates = [...sDates, ...exDates].sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

              if (allDates.length === 0) {
                return (
                  <div className="text-center py-6 border border-dashed border-slate-200 rounded-2xl">
                    <p className="text-xs text-slate-400">Không có ngày học nào trong lịch trình đã chọn.</p>
                  </div>
                );
              }

              return (
                <div className="border border-cyan-100 rounded-2xl p-2 divide-y divide-cyan-50/60 max-h-72 overflow-y-auto bg-white">
                  {allDates.map((date) => {
                    const session = batch.attendanceSessions?.find(s => s.date === date);
                    const isTaken = !!session;
                    const presentCount = session ? session.records.filter(r => r.status === 'present').length : 0;
                    const learnerCount = batch.learnerIds.length;
                    const totalRecords = session && session.records.length > 0 ? session.records.length : learnerCount;

                    return (
                      <div key={date} className="flex items-center justify-between py-3 px-3 hover:bg-cyan-50/40 transition-all">
                        <div className="cursor-pointer flex-1" onClick={() => openSessionDetail(date)}>
                          <p className="text-xs font-bold text-slate-700 flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5 text-cyan-500" />
                            {formatDate(date)}
                            {!sDates.includes(date) && (
                              <span className="text-[9px] bg-amber-500/10 text-amber-600 border border-amber-500/15 px-1.5 py-0.2 rounded-full font-bold">
                                Bổ sung
                              </span>
                            )}
                          </p>
                          {session?.note && (
                            <p className="text-[10px] text-slate-400 mt-0.5">{session.note}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-4">
                          {isTaken ? (
                            totalRecords === 0 ? (
                              <span className="text-[11px] font-bold text-amber-600 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/15">
                                Chưa có {entityLabel.singular}
                              </span>
                            ) : (
                              <span className="text-[11px] font-bold text-cyan-700 bg-cyan-50 px-2.5 py-0.5 rounded-full border border-cyan-200">
                                Có mặt: {presentCount}/{totalRecords}
                              </span>
                            )
                          ) : (
                            <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 px-2.5 py-0.5 rounded-full">
                              Chưa điểm danh
                            </span>
                          )}
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openSessionDetail(date)}
                              className={cn(
                                "px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-all",
                                isTaken 
                                  ? "bg-slate-100 text-slate-650 hover:bg-slate-200" 
                                  : "bg-cyan-500 text-white hover:bg-cyan-600 shadow-sm shadow-cyan-500/20 border border-cyan-400"
                              )}
                            >
                              {isTaken ? 'Chỉnh sửa' : 'Điểm danh'}
                            </button>
                            {isTaken && (
                              <button
                                type="button"
                                onClick={() => handleDeleteSession(date)}
                                className="p-1 text-slate-450 hover:text-rose-650 rounded-lg cursor-pointer"
                                title="Xóa dữ liệu điểm danh"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      ) : (
        // Take Attendance Detail View
        <div className="space-y-6 text-left">
          <div className="flex justify-between items-center border-b border-cyan-100 pb-4">
            <div>
              <button
                type="button"
                onClick={() => setSelectedSessionDate(null)}
                className="text-xs text-cyan-600 hover:text-cyan-700 font-bold hover:underline mb-1 flex items-center gap-1 cursor-pointer"
              >
                ← Quay lại danh sách buổi
              </button>
              <h4 className="text-sm font-black text-slate-800">
                Điểm danh buổi ngày {formatDate(selectedSessionDate)}
              </h4>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSelectedSessionDate(null)}
                className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-200 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => setShowQrModal(true)}
                className="px-4 py-2 bg-cyan-50 text-cyan-700 border border-cyan-200 rounded-xl text-xs font-bold transition-all hover:bg-cyan-100 flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Sparkles className="w-4 h-4 text-cyan-600" /> Điểm danh QR
              </button>
              <button
                type="button"
                onClick={handleUpdateAttendance}
                className="px-4 py-2 bg-cyan-500 text-white rounded-xl text-xs font-bold hover:bg-cyan-600 shadow-md shadow-cyan-500/20 cursor-pointer border border-cyan-400"
              >
                Lưu điểm danh
              </button>
            </div>
          </div>

          {/* Note field */}
          <ErpField label="Ghi chú buổi học">
            <ErpInput
              type="text"
              placeholder="Ghi chú nội dung học, nhận xét chung..."
              value={sessionNote}
              onChange={(e) => setSessionNote(e.target.value)}
            />
          </ErpField>

          {/* Bulk actions */}
          <div className="flex items-center justify-between p-3 bg-cyan-50/50 border border-cyan-100 rounded-2xl">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={bulkSelectStudents.length === batch.learnerIds.length && batch.learnerIds.length > 0}
                onChange={(e) => {
                  if (e.target.checked) {
                    setBulkSelectStudents([...batch.learnerIds]);
                  } else {
                    setBulkSelectStudents([]);
                  }
                }}
                className="h-3.5 w-3.5 rounded border-cyan-300 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
              />
              <span className="text-[11px] font-bold text-slate-600">
                Đã chọn {bulkSelectStudents.length}/{batch.learnerIds.length} {entityLabel.singular}
              </span>
            </div>
            {bulkSelectStudents.length > 0 && (
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => handleBulkChangeStatus('present')}
                  className="px-2 py-1 bg-cyan-500 hover:bg-cyan-600 text-white border border-cyan-400 rounded-lg text-[10px] font-black cursor-pointer shadow-sm"
                >
                  Có mặt
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkChangeStatus('late')}
                  className="px-2 py-1 bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200/50 rounded-lg text-[10px] font-black cursor-pointer"
                >
                  Muộn
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkChangeStatus('absent')}
                  className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/50 rounded-lg text-[10px] font-black cursor-pointer"
                >
                  Vắng
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkChangeStatus('excused')}
                  className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200/50 rounded-lg text-[10px] font-black cursor-pointer"
                >
                  Phép
                </button>
              </div>
            )}
          </div>

          {/* Student list */}
          <div className="border border-cyan-100 rounded-2xl divide-y divide-cyan-50/60 max-h-72 overflow-y-auto bg-white">
            {batch.learnerIds.length === 0 ? (
              <p className="text-center py-6 text-xs text-slate-400">{copy.entityName} hiện chưa có {entityLabel.singular} nào.</p>
            ) : (
              batch.learnerIds.map((studentId) => {
                const student = students.find(s => s.id === studentId);
                const status = attendanceRecords[studentId] || 'present';
                const isChecked = bulkSelectStudents.includes(studentId);
                const enrollment = byStudent.get(studentId);
                // Hết buổi thì không được ghi nhận có mặt/muộn nữa; server cũng chặn
                const outOfSessions =
                  !!enrollment && enrollment.allowedSessions > 0 && enrollment.remainingSessions <= 0;

                return (
                  <div key={studentId} className="flex items-center justify-between py-2.5 px-4 hover:bg-cyan-50/30 transition-all">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setBulkSelectStudents([...bulkSelectStudents, studentId]);
                          } else {
                            setBulkSelectStudents(bulkSelectStudents.filter(id => id !== studentId));
                          }
                        }}
                        className="h-3.5 w-3.5 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                      />
                      <div>
                        <p className="text-xs font-bold text-slate-700">{student?.fullName || `${entityLabel.titleCase} đã xóa`}</p>
                        <p className="text-[10px] text-slate-400">{student?.phone || ''}</p>
                        {enrollment && enrollment.allowedSessions > 0 && (
                          <p className={cn(
                            "text-[10px] font-bold",
                            outOfSessions ? "text-rose-500" : "text-slate-400"
                          )}>
                            {outOfSessions
                              ? `Đã dùng hết ${enrollment.allowedSessions} buổi`
                              : `Còn ${enrollment.remainingSessions}/${enrollment.allowedSessions} buổi`}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Status Select Buttons */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setAttendanceRecords(prev => ({ ...prev, [studentId]: 'present' }))}
                        disabled={outOfSessions && status !== 'present'}
                        title={outOfSessions ? 'Học viên đã dùng hết số buổi được học' : undefined}
                        className={cn(
                          "px-2.5 py-1.5 rounded-lg text-[10px] font-black border transition-all cursor-pointer",
                          "disabled:opacity-40 disabled:cursor-not-allowed",
                          status === 'present'
                            ? "bg-cyan-500 text-white border-cyan-500 shadow-sm shadow-cyan-500/20"
                            : "bg-white hover:bg-slate-50 text-slate-400 border-slate-200/60"
                        )}
                      >
                        Có mặt
                      </button>
                      <button
                        type="button"
                        onClick={() => setAttendanceRecords(prev => ({ ...prev, [studentId]: 'late' }))}
                        disabled={outOfSessions && status !== 'late'}
                        title={outOfSessions ? 'Học viên đã dùng hết số buổi được học' : undefined}
                        className={cn(
                          "px-2.5 py-1.5 rounded-lg text-[10px] font-black border transition-all cursor-pointer",
                          "disabled:opacity-40 disabled:cursor-not-allowed",
                          status === 'late'
                            ? "bg-orange-500 text-white border-orange-500 shadow-sm shadow-orange-500/20"
                            : "bg-white hover:bg-slate-50 text-slate-400 border-slate-200/60"
                        )}
                      >
                        Muộn
                      </button>
                      <button
                        type="button"
                        onClick={() => setAttendanceRecords(prev => ({ ...prev, [studentId]: 'absent' }))}
                        className={cn(
                          "px-2.5 py-1.5 rounded-lg text-[10px] font-black border transition-all cursor-pointer",
                          status === 'absent'
                            ? "bg-rose-500 text-white border-rose-500 shadow-sm shadow-rose-500/20"
                            : "bg-white hover:bg-slate-50 text-slate-400 border-slate-200/60"
                        )}
                      >
                        Vắng mặt
                      </button>
                      <button
                        type="button"
                        onClick={() => setAttendanceRecords(prev => ({ ...prev, [studentId]: 'excused' }))}
                        className={cn(
                          "px-2.5 py-1.5 rounded-lg text-[10px] font-black border transition-all cursor-pointer",
                          status === 'excused'
                            ? "bg-amber-500 text-white border-amber-500 shadow-sm shadow-amber-500/20"
                            : "bg-white hover:bg-slate-50 text-slate-400 border-slate-200/60"
                        )}
                      >
                        Vắng có phép
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {selectedSessionDate !== null && showQrModal && (
        <QRAttendanceModal
          isOpen={showQrModal}
          batch={{
            id: batch.id,
            code: batch.code,
            courseTitle: batch.courseTitle,
            learnerIds: batch.learnerIds
          }}
          date={selectedSessionDate}
          students={students}
          onClose={() => setShowQrModal(false)}
          onSuccess={() => {
            onSuccess();
            setSelectedSessionDate(null);
          }}
        />
      )}
    </ErpModal>
  );
}
