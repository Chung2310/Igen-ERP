import React, { useCallback, useEffect, useState } from 'react';
import { Clock, LogIn, LogOut, MapPin, Pencil, RefreshCw } from 'lucide-react';
import { cn } from '../../lib/utils';
import { apiFetch } from '../../lib/api';
import { toast } from '../../../../pages/Toast';
import { ErpField, ErpInput } from '../Erp/ErpUI';
import { Batch, Student } from '../../types';

export type WorkerAttendanceStatus =
  | 'present'
  | 'late'
  | 'left-early'
  | 'late-left-early'
  | 'missing-checkout';

interface WorkerAttendanceMark {
  time: string;
  latitude?: number;
  longitude?: number;
  distanceMeters?: number;
}

export interface WorkerAttendanceLog {
  _id: string;
  studentId: string;
  date: string;
  checkIn?: WorkerAttendanceMark | null;
  checkOut?: WorkerAttendanceMark | null;
  status: WorkerAttendanceStatus;
  workedMinutes?: number;
  note?: string;
}

const STATUS_LABEL: Record<WorkerAttendanceStatus, string> = {
  present: 'Đủ công',
  late: 'Đi muộn',
  'left-early': 'Về sớm',
  'late-left-early': 'Muộn & về sớm',
  'missing-checkout': 'Thiếu giờ về',
};

const STATUS_STYLE: Record<WorkerAttendanceStatus, string> = {
  present: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/15',
  late: 'bg-amber-500/10 text-amber-600 border-amber-500/15',
  'left-early': 'bg-amber-500/10 text-amber-600 border-amber-500/15',
  'late-left-early': 'bg-rose-500/10 text-rose-600 border-rose-500/15',
  'missing-checkout': 'bg-slate-500/10 text-slate-500 border-slate-500/15',
};

/** Giờ phút theo múi giờ máy đang xem; mốc lưu ở server là UTC. */
const formatTime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '—';

const formatWorked = (minutes?: number) => {
  if (minutes == null) return '—';
  const hours = Math.floor(minutes / 60);
  return `${hours}h${String(minutes % 60).padStart(2, '0')}`;
};

/** Chuyển mốc ISO sang giá trị cho input datetime-local (giờ địa phương). */
const toLocalInput = (iso?: string | null) => {
  if (!iso) return '';
  const date = new Date(iso);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const todayIso = () => new Date().toISOString().slice(0, 10);

interface Props {
  batch: Batch;
  students: Student[];
  canManage?: boolean;
}

/**
 * Bảng chấm công của một dự án lao động: giờ vào, giờ về, vị trí lúc bấm.
 * Thay hẳn mô hình có mặt/vắng của lớp học ở preset lao động.
 */
export function WorkerTimekeepingPanel({ batch, students, canManage = true }: Props) {
  const [date, setDate] = useState(todayIso());
  const [logs, setLogs] = useState<WorkerAttendanceLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyStudentId, setBusyStudentId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ checkInAt: '', checkOutAt: '', note: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ data: WorkerAttendanceLog[] }>('/attendance/worker', {
        params: { batchId: batch.id, date },
      });
      setLogs(res.data || []);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Không tải được bảng chấm công.');
    } finally {
      setLoading(false);
    }
  }, [batch.id, date]);

  useEffect(() => { load(); }, [load]);

  /** Lấy vị trí người bấm; dự án có đặt toạ độ thì server sẽ đối chiếu bán kính. */
  const currentPosition = () =>
    new Promise<{ latitude?: number; longitude?: number }>((resolve) => {
      if (!navigator.geolocation) return resolve({});
      navigator.geolocation.getCurrentPosition(
        (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
        () => resolve({}),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });

  const handleMark = async (studentId: string) => {
    setBusyStudentId(studentId);
    try {
      const position = await currentPosition();
      const res = await apiFetch<{ data: { kind: 'check-in' | 'check-out' } }>('/attendance/worker/mark', {
        method: 'POST',
        body: JSON.stringify({ batchId: batch.id, studentId, ...position }),
      });
      toast.success(res.data.kind === 'check-in' ? 'Đã chấm giờ vào.' : 'Đã chấm giờ về.');
      await load();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Không chấm công được.');
    } finally {
      setBusyStudentId(null);
    }
  };

  const startEdit = (log: WorkerAttendanceLog) => {
    setEditingId(log._id);
    setEditForm({
      checkInAt: toLocalInput(log.checkIn?.time),
      checkOutAt: toLocalInput(log.checkOut?.time),
      note: log.note || '',
    });
  };

  const handleSaveEdit = async (logId: string) => {
    try {
      await apiFetch(`/attendance/worker/${logId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          checkInAt: editForm.checkInAt ? new Date(editForm.checkInAt).toISOString() : null,
          checkOutAt: editForm.checkOutAt ? new Date(editForm.checkOutAt).toISOString() : null,
          note: editForm.note,
        }),
      });
      toast.success('Đã cập nhật chấm công.');
      setEditingId(null);
      await load();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Không lưu được thay đổi.');
    }
  };

  const logByStudent = new Map(logs.map((log) => [log.studentId, log]));
  const roster = (batch.learnerIds || [])
    .map((id) => students.find((student) => student.id === id))
    .filter((student): student is Student => Boolean(student));

  return (
    <div className="space-y-4 text-left">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h4 className="text-xs font-bold text-slate-700">{batch.name || batch.code}</h4>
          <p className="text-[10px] text-slate-400 flex items-center gap-1">
            <Clock className="w-3 h-3" /> Giờ chuẩn {batch.startTime} - {batch.endTime}
            {batch.geoLocation?.latitude != null && (
              <>
                <MapPin className="w-3 h-3 ml-1.5" />
                Chấm trong bán kính {batch.geoLocation.radiusMeters ?? 300}m
              </>
            )}
          </p>
        </div>
        <div className="flex items-end gap-2">
          <ErpField label="Ngày">
            <ErpInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </ErpField>
          <button
            type="button"
            onClick={load}
            className="px-2.5 py-2 rounded-xl border border-slate-200/60 bg-slate-50 text-slate-600 hover:bg-slate-100 cursor-pointer"
            title="Tải lại"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {batch.geoLocation?.latitude == null && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[11px] text-amber-700 font-medium">
          Dự án chưa đặt vị trí công trường nên chấm công không giới hạn nơi bấm. Mở sửa dự án để đặt vị trí.
        </div>
      )}

      {roster.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-slate-200 rounded-2xl">
          <p className="text-xs text-slate-400">Dự án chưa có lao động nào.</p>
        </div>
      ) : (
        <div className="border border-cyan-100 rounded-2xl overflow-hidden bg-white">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50/80 text-[9px] font-black uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-2 px-3">Lao động</th>
                <th className="py-2 px-3">Giờ vào</th>
                <th className="py-2 px-3">Giờ về</th>
                <th className="py-2 px-3">Công</th>
                <th className="py-2 px-3">Trạng thái</th>
                <th className="py-2 px-3">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {roster.map((student) => {
                const log = logByStudent.get(student.id);
                const isEditing = !!log && editingId === log._id;
                return (
                  <tr key={student.id} className="text-slate-600 align-middle">
                    <td className="py-2 px-3 font-bold">{student.fullName}</td>
                    {isEditing ? (
                      <>
                        <td className="py-2 px-3">
                          <input
                            aria-label="Giờ vào"
                            type="datetime-local"
                            value={editForm.checkInAt}
                            onChange={(e) => setEditForm({ ...editForm, checkInAt: e.target.value })}
                            className="rounded-lg border border-slate-200 px-2 py-1 text-[11px]"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            aria-label="Giờ về"
                            type="datetime-local"
                            value={editForm.checkOutAt}
                            onChange={(e) => setEditForm({ ...editForm, checkOutAt: e.target.value })}
                            className="rounded-lg border border-slate-200 px-2 py-1 text-[11px]"
                          />
                        </td>
                        <td className="py-2 px-3" colSpan={2}>
                          <input
                            aria-label="Ghi chú"
                            value={editForm.note}
                            onChange={(e) => setEditForm({ ...editForm, note: e.target.value })}
                            placeholder="Lý do sửa"
                            className="w-full rounded-lg border border-slate-200 px-2 py-1 text-[11px]"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-1.5">
                            <button type="button" onClick={() => handleSaveEdit(log!._id)} className="px-2 py-1 rounded-lg bg-slate-900 text-white text-[10px] font-bold cursor-pointer">Lưu</button>
                            <button type="button" onClick={() => setEditingId(null)} className="px-2 py-1 rounded-lg border border-slate-200 text-[10px] font-bold cursor-pointer">Hủy</button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="py-2 px-3 font-bold">
                          {formatTime(log?.checkIn?.time)}
                          {log?.checkIn?.distanceMeters != null && (
                            <span className="ml-1 text-[9px] text-slate-400">{Math.round(log.checkIn.distanceMeters)}m</span>
                          )}
                        </td>
                        <td className="py-2 px-3 font-bold">
                          {formatTime(log?.checkOut?.time)}
                          {log?.checkOut?.distanceMeters != null && (
                            <span className="ml-1 text-[9px] text-slate-400">{Math.round(log.checkOut.distanceMeters)}m</span>
                          )}
                        </td>
                        <td className="py-2 px-3 font-bold">{formatWorked(log?.workedMinutes)}</td>
                        <td className="py-2 px-3">
                          {log ? (
                            <span className={cn('px-1.5 py-0.5 rounded text-[9px] font-black uppercase border', STATUS_STYLE[log.status])}>
                              {STATUS_LABEL[log.status]}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">Chưa chấm</span>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          {canManage && (
                            <div className="flex items-center gap-1.5">
                              {!log?.checkOut && date === todayIso() && (
                                <button
                                  type="button"
                                  disabled={busyStudentId === student.id}
                                  onClick={() => handleMark(student.id)}
                                  className={cn(
                                    'flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black uppercase border cursor-pointer disabled:opacity-50',
                                    log?.checkIn
                                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  )}
                                >
                                  {log?.checkIn ? <LogOut className="w-3 h-3" /> : <LogIn className="w-3 h-3" />}
                                  {log?.checkIn ? 'Chấm về' : 'Chấm vào'}
                                </button>
                              )}
                              {log && (
                                <button
                                  type="button"
                                  onClick={() => startEdit(log)}
                                  title="Sửa giờ"
                                  className="p-1 rounded-lg border border-slate-200/60 bg-slate-50 text-slate-500 hover:text-slate-700 cursor-pointer"
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
