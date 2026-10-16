import React from 'react';
import { Student } from '../../../types';
import { formatDisplayDate } from '../../../lib/utils';
import { CustomFieldDetails } from '../../../../shared/custom-fields/CustomFieldDetails';
import { useBatches } from '../../../hooks/useBatches';
import { apiFetch } from '../../../lib/api';
import { getRoadmaps, type LearningRoadmap } from '../../../api/learningRoadmap.api';

interface ProfileTabProps { student: Student; selectedCenter?: string; }
type Enrollment = { status?: string; retakeHistory?: Array<{ count: number; fee?: number; reason?: string; at: string }>; };
type RoadmapEntry = { roadmap: LearningRoadmap; batchCode: string; stepOrder: number; status: string };

export function ProfileTab({ student }: ProfileTabProps) {
  const { batches } = useBatches();
  const joinedBatches = React.useMemo(() => batches.filter((batch) => batch.learnerIds?.includes(student.id)), [batches, student.id]);
  const [retakeHistory, setRetakeHistory] = React.useState<Array<{ batchCode: string; count: number; fee: number; reason: string; at: string }>>([]);
  const [roadmapEntries, setRoadmapEntries] = React.useState<RoadmapEntry[]>([]);

  React.useEffect(() => {
    let active = true;
    Promise.all(joinedBatches.map(async (batch) => {
      const payload = await apiFetch<any>(`/batches/${batch.id}/enrollments`);
      const items = Array.isArray(payload?.data) ? payload.data : payload;
      const enrollment = (Array.isArray(items) ? items : []).find((item) => item.studentId === student.id) as Enrollment | undefined;
      return (enrollment?.retakeHistory ?? []).map((entry) => ({ batchCode: batch.code, count: entry.count, fee: entry.fee || 0, reason: entry.reason || '', at: entry.at }));
    })).then((rows) => { if (active) setRetakeHistory(rows.flat()); }).catch(() => { if (active) setRetakeHistory([]); });
    return () => { active = false; };
  }, [joinedBatches, student.id]);

  React.useEffect(() => {
    let active = true;
    const roadmapBatches = joinedBatches.filter((batch) => batch.roadmapId);
    if (roadmapBatches.length === 0) { setRoadmapEntries([]); return; }
    Promise.all([getRoadmaps(), ...roadmapBatches.map(async (batch) => {
      const payload = await apiFetch<any>(`/batches/${batch.id}/enrollments`);
      const items = Array.isArray(payload?.data) ? payload.data : payload;
      return { batch, enrollment: (Array.isArray(items) ? items : []).find((item) => item.studentId === student.id) as Enrollment | undefined };
    })]).then(([roadmaps, ...items]) => {
      if (!active) return;
      const roadmapMap = new Map((roadmaps as LearningRoadmap[]).map((roadmap) => [roadmap.id, roadmap]));
      setRoadmapEntries((items as Array<{ batch: typeof roadmapBatches[number]; enrollment?: Enrollment }>).flatMap(({ batch, enrollment }) => {
        const roadmap = roadmapMap.get(batch.roadmapId || '');
        if (!roadmap || !enrollment) return [];
        const step = roadmap.steps.find((item) => item.id === batch.roadmapStepId) || roadmap.steps.find((item) => item.courseId === batch.courseId);
        return [{ roadmap, batchCode: batch.code, stepOrder: step?.order || 0, status: enrollment.status || 'Đang học' }];
      }));
    }).catch(() => { if (active) setRoadmapEntries([]); });
    return () => { active = false; };
  }, [joinedBatches, student.id]);

  return <div className="space-y-3">
    <div className="grid grid-cols-1 gap-2.5 rounded-2xl border border-sky-100 bg-white p-3 shadow-sm sm:grid-cols-2 sm:p-4 lg:grid-cols-3">
      <FormField label="Họ và tên" value={student.fullName} /><FormField label="Ngày sinh" value={formatDisplayDate(student.birthday)} />
      <FormField label="Số điện thoại" value={student.phone} /><FormField label="Email" value={student.email || 'Chưa cập nhật'} />
      <FormField label="Người giới thiệu" value={student.referral || 'Trực tiếp'} /><FormField label="CCCD / CMND" value={student.idCard || 'Chưa cập nhật'} />
      <FormField label="Ngày đăng ký" value={formatDisplayDate(student.registrationDate)} /><FormField label="Ngày nhập học" value={formatDisplayDate(student.enrollmentDate || '') || 'Chưa cập nhật'} />
      <FormField label="Địa chỉ" value={student.address || 'Chưa cập nhật'} />
      <FormField label="Trạng thái" value={Array.isArray(student.status) ? student.status.join(', ') : student.status} />
      <FormField label="Người phụ trách" value={student.createdByName || 'Chưa xác định'} />
      <FormField label="Lớp đang tham gia" value={joinedBatches.length ? joinedBatches.map((batch) => [batch.code, batch.courseTitle].filter(Boolean).join(' — ')).join(' | ') : 'Chưa xếp lớp'} />
    </div>
    <section className="rounded-2xl border border-sky-100 bg-white p-4"><h3 className="mb-2 text-sm font-medium text-slate-800">Combo / lộ trình học</h3>{roadmapEntries.length === 0 ? <p className="text-sm text-slate-500">Học viên chưa được gắn vào combo hoặc lộ trình học.</p> : <div className="space-y-2">{roadmapEntries.map((entry, index) => <div key={`${entry.roadmap.id}-${entry.batchCode}-${index}`} className="rounded-xl border border-sky-100 bg-sky-50/40 p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-sm font-medium text-slate-800">{entry.roadmap.name}</p><p className="mt-1 text-xs text-slate-500">{entry.roadmap.code} · Chặng {entry.stepOrder || '—'} · Lớp {entry.batchCode}</p></div><span className={`rounded-full px-2 py-1 text-xs font-normal ${entry.status === 'Chờ xếp lớp tiếp theo' ? 'bg-violet-100 text-violet-700' : entry.status === 'Đang học' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{entry.status}</span></div></div>)}</div>}</section>
    <section className="rounded-2xl border border-sky-100 bg-white p-4"><h3 className="mb-2 text-sm font-medium text-slate-800">Lịch sử học lại</h3>{retakeHistory.length === 0 ? <p className="text-sm text-slate-500">Chưa có lịch sử học lại.</p> : <div className="space-y-2">{retakeHistory.map((entry, index) => <div key={`${entry.batchCode}-${entry.at}-${index}`} className="rounded-xl border border-sky-100 bg-sky-50/40 p-3 text-sm"><p className="font-medium text-brand-primary">Lần {entry.count} · Lớp {entry.batchCode}</p><p className="text-xs text-slate-600">{entry.reason || 'Không có lý do'} · {entry.fee > 0 ? `${entry.fee.toLocaleString('vi-VN')}đ` : 'Miễn phí'}</p></div>)}</div>}</section>
    <section className="rounded-2xl border border-sky-100 bg-white p-4"><CustomFieldDetails moduleKey="students" values={student.customFields ?? {}} /></section>
  </div>;
}

function FormField({ label, value }: { label: string; value: string }) { return <div className="min-w-0 rounded-xl border border-sky-100 bg-sky-50/30 px-3 py-2"><p className="text-xs font-normal text-slate-500">{label}</p><p className="mt-0.5 break-words text-sm font-normal leading-5 text-slate-800">{value || 'Chưa cập nhật'}</p></div>; }
