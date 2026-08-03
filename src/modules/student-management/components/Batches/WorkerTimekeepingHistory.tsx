import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarRange } from 'lucide-react';
import { cn } from '../../lib/utils';
import { apiFetch } from '../../lib/api';
import { toast } from '../../../../pages/Toast';
import { ErpField, ErpInput } from '../Erp/ErpUI';
import { Batch, Student } from '../../types';
import type { WorkerAttendanceLog, WorkerAttendanceStatus } from './WorkerTimekeepingPanel';

const STATUS_LABEL: Record<WorkerAttendanceStatus, string> = {
  present: 'Đủ công',
  late: 'Đi muộn',
  'left-early': 'Về sớm',
  'late-left-early': 'Muộn & về sớm',
  'missing-checkout': 'Thiếu giờ về',
};

const formatWorked = (minutes: number) => `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, '0')}`;
const formatDate = (d: string) => d.split('-').reverse().join('/');
const isoDaysAgo = (days: number) => new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

interface Props {
  batch: Batch;
  students: Student[];
}

/**
 * Tổng hợp công của một dự án trong khoảng ngày: mỗi lao động một dòng, kèm số
 * ngày công, tổng giờ và số lần đi muộn/về sớm/thiếu giờ về.
 */
export function WorkerTimekeepingHistory({ batch, students }: Props) {
  const [from, setFrom] = useState(isoDaysAgo(29));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [logs, setLogs] = useState<WorkerAttendanceLog[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ data: WorkerAttendanceLog[] }>('/attendance/worker', {
        params: { batchId: batch.id, from, to },
      });
      setLogs(res.data || []);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Không tải được lịch sử chấm công.');
    } finally {
      setLoading(false);
    }
  }, [batch.id, from, to]);

  useEffect(() => { load(); }, [load]);

  const summary = useMemo(() => {
    const byStudent = new Map<string, {
      days: number; minutes: number; late: number; leftEarly: number; missing: number;
    }>();
    logs.forEach((log) => {
      const row = byStudent.get(log.studentId) ?? { days: 0, minutes: 0, late: 0, leftEarly: 0, missing: 0 };
      row.days += 1;
      row.minutes += log.workedMinutes ?? 0;
      if (log.status === 'late' || log.status === 'late-left-early') row.late += 1;
      if (log.status === 'left-early' || log.status === 'late-left-early') row.leftEarly += 1;
      if (log.status === 'missing-checkout') row.missing += 1;
      byStudent.set(log.studentId, row);
    });
    return byStudent;
  }, [logs]);

  const roster = (batch.learnerIds || [])
    .map((id) => students.find((student) => student.id === id))
    .filter((student): student is Student => Boolean(student));

  return (
    <div className="space-y-4 text-left">
      <div className="flex flex-wrap items-end gap-2">
        <ErpField label="Từ ngày">
          <ErpInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </ErpField>
        <ErpField label="Đến ngày">
          <ErpInput type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </ErpField>
        <p className="text-[10px] text-slate-400 pb-2 flex items-center gap-1">
          <CalendarRange className="w-3 h-3" />
          {loading ? 'Đang tải...' : `${logs.length} ngày công trong khoảng ${formatDate(from)} - ${formatDate(to)}`}
        </p>
      </div>

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
                <th className="py-2 px-3">Ngày công</th>
                <th className="py-2 px-3">Tổng giờ</th>
                <th className="py-2 px-3">Đi muộn</th>
                <th className="py-2 px-3">Về sớm</th>
                <th className="py-2 px-3">{STATUS_LABEL['missing-checkout']}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {roster.map((student) => {
                const row = summary.get(student.id);
                return (
                  <tr key={student.id} className="text-slate-600">
                    <td className="py-2 px-3 font-bold">{student.fullName}</td>
                    <td className="py-2 px-3 font-bold">{row?.days ?? 0}</td>
                    <td className="py-2 px-3 font-bold">{formatWorked(row?.minutes ?? 0)}</td>
                    <td className={cn('py-2 px-3 font-bold', row?.late ? 'text-amber-600' : '')}>{row?.late ?? 0}</td>
                    <td className={cn('py-2 px-3 font-bold', row?.leftEarly ? 'text-amber-600' : '')}>{row?.leftEarly ?? 0}</td>
                    <td className={cn('py-2 px-3 font-bold', row?.missing ? 'text-rose-600' : '')}>{row?.missing ?? 0}</td>
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
