import React, { useState } from 'react';
import { Calendar, UserX, CheckCircle2, XCircle, MinusCircle, ChevronRight, ShieldCheck } from 'lucide-react';
import { cn } from '../../lib/utils';
import { ErpModal } from '../Erp/ErpUI';
import { Batch, Student } from '../../types';
import { useEntityLabel } from '../../hooks/useEntityLabel';
import { AttendanceAttemptsModal } from './AttendanceAttemptsModal';

interface AttendanceViewModalProps {
  isOpen: boolean;
  batch: Batch;
  onClose: () => void;
  students: Student[];
}

const DAY_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: 'T2' }, { value: 2, label: 'T3' }, { value: 3, label: 'T4' },
  { value: 4, label: 'T5' }, { value: 5, label: 'T6' }, { value: 6, label: 'T7' }, { value: 0, label: 'CN' },
];

const getLocalDateStr = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const formatShortDate = (d: string): string => {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  const dateObj = new Date(parseInt(y), parseInt(m) - 1, parseInt(day));
  const dayName = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][dateObj.getDay()];
  return `${dayName}, ${day}/${m}/${y}`;
};

const formatDays = (days: number[]) =>
  DAY_OPTIONS.filter(d => (days || []).includes(d.value)).map(d => d.label).join(', ');

const getScheduledDates = (startDateStr: string, endDateStr: string, daysOfWeek: number[]): string[] => {
  const dates: string[] = [];
  if (!startDateStr || !endDateStr || !daysOfWeek?.length) return dates;
  const [sy, sm, sd] = startDateStr.split('-').map(Number);
  const [ey, em, ed] = endDateStr.split('-').map(Number);
  const start = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return dates;
  const cursor = new Date(start);
  let limit = 0;
  while (cursor <= end && limit < 200) {
    if (daysOfWeek.includes(cursor.getDay())) dates.push(getLocalDateStr(cursor));
    cursor.setDate(cursor.getDate() + 1);
    limit++;
  }
  return dates;
};

export function AttendanceViewModal({ isOpen, batch, onClose, students = [] }: AttendanceViewModalProps) {
  const entityLabel = useEntityLabel();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showAttempts, setShowAttempts] = useState(false);

  if (!isOpen || !batch) return null;

  const today = getLocalDateStr(new Date());
  const sDates = getScheduledDates(batch.startDate, batch.endDate, batch.daysOfWeek);
  const exDates = (batch.attendanceSessions || []).map(s => s.date).filter(d => !sDates.includes(d));
  const allDates = [...sDates, ...exDates].sort((a, b) => a.localeCompare(b));
  const relevantDates = allDates;
  const takenCount = allDates.filter(d => (batch.attendanceSessions || []).some(s => s.date === d && s.records && s.records.length > 0)).length;
  const missedCount = allDates.filter(d => d < today && !(batch.attendanceSessions || []).some(s => s.date === d && s.records && s.records.length > 0)).length;

  const selectedSession = selectedDate ? (batch.attendanceSessions || []).find(s => s.date === selectedDate) : null;

  // Tổng hợp vắng mặt
  const absentMap: Record<string, number> = {};
  (batch.attendanceSessions || []).forEach(session =>
    (session.records || []).forEach(r => {
      if (r.status === 'absent' || r.status === 'excused') {
        absentMap[r.studentId] = (absentMap[r.studentId] || 0) + 1;
      }
    })
  );
  const topAbsentees = Object.entries(absentMap).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <ErpModal
      title={`Điểm danh · Lớp ${batch.code}`}
      onClose={() => { setSelectedDate(null); onClose(); }}
      maxWidth="max-w-3xl"
    >
      <div className="space-y-4 text-left">

        {/* ── Tóm tắt gọn ── */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl bg-cyan-50/60 border border-cyan-100 p-3.5 text-center">
            <p className="text-xl font-black text-cyan-800">{takenCount}<span className="text-sm font-semibold text-cyan-600/60">/{allDates.length}</span></p>
            <p className="text-[10px] text-cyan-700 font-bold mt-0.5">Buổi đã điểm danh</p>
          </div>
          <div className={cn(
            'rounded-2xl border p-3.5 text-center',
            missedCount > 0 ? 'bg-amber-50 border-amber-100' : 'bg-slate-50 border-slate-100'
          )}>
            <p className={cn('text-xl font-black', missedCount > 0 ? 'text-amber-700' : 'text-slate-400')}>{missedCount}</p>
            <p className={cn('text-[10px] font-bold mt-0.5', missedCount > 0 ? 'text-amber-600' : 'text-slate-400')}>Buổi bỏ sót</p>
          </div>
          <div className={cn(
            'rounded-2xl border p-3.5 text-center',
            topAbsentees.length > 0 ? 'bg-rose-50 border-rose-100' : 'bg-slate-50 border-slate-100'
          )}>
            <p className={cn('text-xl font-black', topAbsentees.length > 0 ? 'text-rose-700' : 'text-slate-400')}>
              {Object.keys(absentMap).length}
            </p>
            <p className={cn('text-[10px] font-bold mt-0.5', topAbsentees.length > 0 ? 'text-rose-500' : 'text-slate-400')}>HV có vắng mặt</p>
          </div>
        </div>

        {/* ── Nội dung 2 cột ── */}
        <div className="grid grid-cols-2 gap-4">

          {/* Cột trái: Danh sách buổi */}
          <div className="flex flex-col gap-2">
            <p className="text-[10px] font-black uppercase tracking-wider text-cyan-700 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-cyan-500" /> Chọn buổi để xem chi tiết
            </p>

            {relevantDates.length === 0 ? (
              <div className="flex flex-col items-center justify-center flex-1 border border-dashed border-cyan-200 rounded-2xl py-8 gap-2">
                <p className="text-xs text-slate-400">Chưa có buổi học nào.</p>
              </div>
            ) : (
              <div className="space-y-1 max-h-72 overflow-y-auto">
                {relevantDates.map(date => {
                  const session = (batch.attendanceSessions || []).find(s => s.date === date);
                  const hasTaken = !!session && (session.records?.length || 0) > 0;
                  const isToday = date === today;
                  const isPast = date < today;
                  const isSelected = selectedDate === date;
                  const absentCount = session?.records ? session.records.filter(r => r.status !== 'present').length : 0;
                  const presentCount = session?.records ? session.records.filter(r => r.status === 'present').length : 0;

                  return (
                    <button
                      key={date}
                      type="button"
                      disabled={!hasTaken}
                      onClick={() => hasTaken && setSelectedDate(date === selectedDate ? null : date)}
                      className={cn(
                        'w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-left transition-all',
                        isSelected
                          ? 'bg-cyan-500 border-cyan-500 text-white shadow-md shadow-cyan-500/20'
                          : hasTaken
                            ? 'bg-white border-cyan-100 hover:border-cyan-300 hover:bg-cyan-50/50 cursor-pointer'
                            : 'bg-slate-50/60 border-slate-100 opacity-50 cursor-not-allowed'
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        {/* Status dot */}
                        <span className={cn(
                          'w-1.5 h-1.5 rounded-full flex-shrink-0',
                          hasTaken ? 'bg-cyan-400' : isPast ? 'bg-amber-400' : 'bg-slate-300'
                        )} />
                        <div>
                          <span className={cn(
                            'text-xs font-black',
                            isSelected ? 'text-white' : 'text-slate-700'
                          )}>
                            {formatShortDate(date)}
                          </span>
                          {isToday && !isSelected && (
                            <span className="ml-1.5 text-[9px] font-black bg-sky-500 text-white px-1.5 py-0.5 rounded-md">
                              Hôm nay
                            </span>
                          )}
                          {isToday && isSelected && (
                            <span className="ml-1.5 text-[9px] font-black bg-white/20 text-white px-1.5 py-0.5 rounded-md">
                              Hôm nay
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-bold flex-shrink-0">
                        {hasTaken ? (
                          <>
                            <span className={cn(isSelected ? 'text-emerald-300' : 'text-emerald-600')}>{presentCount} ✓</span>
                            {absentCount > 0 && <span className={cn(isSelected ? 'text-rose-300' : 'text-rose-600')}>{absentCount} ✗</span>}
                            <ChevronRight className={cn('w-3 h-3', isSelected ? 'text-white/50 rotate-90' : 'text-slate-300')} />
                          </>
                        ) : isPast || isToday ? (
                          <span className="text-[9px] text-amber-500 font-bold">Bỏ sót</span>
                        ) : (
                          <span className="text-[9px] text-slate-400">Sắp tới</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Cột phải: Chi tiết buổi / Top vắng */}
          <div className="flex flex-col gap-2">
            {selectedDate && selectedSession ? (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    {formatShortDate(selectedDate)}
                  </p>
                  <div className="flex gap-3 text-[10px] font-bold">
                    <span className="text-emerald-600">
                      {selectedSession.records.filter(r => r.status === 'present').length} có mặt
                    </span>
                    {selectedSession.records.filter(r => r.status !== 'present').length > 0 && (
                      <span className="text-rose-600">
                        {selectedSession.records.filter(r => r.status !== 'present').length} vắng
                      </span>
                    )}
                  </div>
                </div>

                {selectedSession.note && (
                  <p className="text-[11px] text-slate-500 italic bg-slate-50 border border-slate-100 px-3 py-2 rounded-xl">
                    💬 {selectedSession.note}
                  </p>
                )}

                <div className="space-y-1 max-h-[260px] overflow-y-auto">
                  {batch.learnerIds.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-8">Lớp chưa có {entityLabel.singular}.</p>
                  ) : (
                    batch.learnerIds.map(studentId => {
                      const student = (students || []).find(s => s.id === studentId || String(s.id) === String(studentId));
                      const records = selectedSession.records || [];
                      const rec = records.find(r => String(r.studentId) === String(studentId));
                      const status = rec ? rec.status : (records.length > 0 ? 'absent' : 'unmarked');

                      const cfg = {
                        present: { icon: <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />, badge: 'text-emerald-700 bg-emerald-50 border border-emerald-200', text: 'Có mặt', row: 'border-emerald-100 bg-emerald-50/20' },
                        absent: { icon: <XCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />, badge: 'text-rose-700 bg-rose-50 border border-rose-200', text: 'Vắng mặt', row: 'border-rose-100 bg-rose-50/20' },
                        excused: { icon: <MinusCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />, badge: 'text-amber-700 bg-amber-50 border border-amber-200', text: 'Vắng có phép', row: 'border-amber-100 bg-amber-50/20' },
                        unmarked: { icon: <MinusCircle className="w-4 h-4 text-slate-400 flex-shrink-0" />, badge: 'text-slate-600 bg-slate-100 border border-slate-200', text: 'Chưa điểm danh', row: 'border-slate-100 bg-slate-50/50' }
                      }[status] || { icon: <MinusCircle className="w-4 h-4 text-slate-400 flex-shrink-0" />, badge: 'text-slate-600 bg-slate-100 border border-slate-200', text: 'Chưa điểm danh', row: 'border-slate-100 bg-slate-50/50' };

                      return (
                        <div key={studentId} className={cn('flex items-center justify-between px-3 py-2 rounded-xl border', cfg.row)}>
                          <div className="flex items-center gap-2">
                            {cfg.icon}
                            <div>
                              <p className="text-xs font-bold text-slate-700">{student?.fullName || `${entityLabel.titleCase} đã xóa`}</p>
                              <p className="text-[10px] text-slate-400">{student?.phone || ''}</p>
                            </div>
                          </div>
                          <span className={cn('text-[9px] font-black px-2 py-0.5 rounded-full', cfg.badge)}>{cfg.text}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            ) : (
              <>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <UserX className="w-3.5 h-3.5" />
                  {topAbsentees.length > 0 ? 'Hay vắng mặt nhất' : 'Chưa có dữ liệu'}
                </p>

                {topAbsentees.length > 0 ? (
                  <div className="space-y-1.5">
                    {topAbsentees.map(([studentId, count], idx) => {
                      const student = students.find(s => s.id === studentId);
                      return (
                        <div key={studentId} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-slate-100 bg-white">
                          <span className={cn(
                            'w-5 h-5 rounded-lg text-[10px] font-black text-white flex items-center justify-center flex-shrink-0',
                            idx === 0 ? 'bg-rose-500' : idx === 1 ? 'bg-orange-400' : idx === 2 ? 'bg-amber-400' : 'bg-slate-300'
                          )}>
                            {idx + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-slate-700 truncate">{student?.fullName || `${entityLabel.titleCase} đã xóa`}</p>
                            <p className="text-[10px] text-slate-400">{student?.phone || ''}</p>
                          </div>
                          <span className="text-sm font-black text-rose-600 flex-shrink-0">
                            {count} <span className="text-[9px] font-semibold text-slate-400">buổi</span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center flex-1 gap-3 py-6">
                    <Calendar className="w-8 h-8 text-slate-200" />
                    <p className="text-xs text-slate-400 text-center">Chọn một buổi học bên trái<br />để xem danh sách điểm danh</p>
                  </div>
                )}

                {topAbsentees.length > 0 && (
                  <p className="text-center text-[10px] text-slate-400 pt-1">← Chọn buổi học để xem chi tiết</p>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <div className="flex items-center gap-4 text-[10px] font-semibold text-slate-400">
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" /> Đã điểm danh</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" /> Bỏ sót</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowAttempts(true)}
              className="flex items-center gap-1.5 text-[10px] font-black text-brand-primary hover:text-brand-primary/80 transition-colors cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5" /> Lịch sử xác thực khuôn mặt
            </button>
            <span className="text-[10px] font-bold text-slate-500">
              {formatDays(batch.daysOfWeek)} · {batch.startTime}–{batch.endTime}
            </span>
          </div>
        </div>
      </div>

      <AttendanceAttemptsModal
        isOpen={showAttempts}
        batchId={batch.id}
        batchCode={batch.code}
        onClose={() => setShowAttempts(false)}
      />
    </ErpModal>
  );
}
