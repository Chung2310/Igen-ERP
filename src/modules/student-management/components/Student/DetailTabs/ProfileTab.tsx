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

  return <div className="space-y-6">
    <div className="grid grid-cols-1 gap-x-8 gap-y-6 rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm shadow-slate-200/50 md:grid-cols-2 sm:p-8">
      <FormField label="HỌ VÀ TÊN*" value={student.fullName} /><FormField label="NGÀY SINH" value={formatDisplayDate(student.birthday)} />
      <FormField label="SỐ ĐIỆN THOẠI" value={student.phone} /><FormField label="EMAIL" value={student.email || 'Chưa cập nhật'} />
      <FormField label="NGƯỜI GIỚI THIỆU" value={student.referral || 'Trực tiếp'} /><FormField label="CCCD / CMND" value={student.idCard || 'Chưa cập nhật'} />
      <FormField label="NGÀY ĐĂNG KÝ" value={formatDisplayDate(student.registrationDate)} /><FormField label="NGÀY NHẬP HỌC" value={formatDisplayDate(student.enrollmentDate || '') || 'Chưa cập nhật'} />
      <div className="md:col-span-2"><FormField label="ĐỊA CHỈ" value={student.address || 'Chưa cập nhật'} /></div>
      <div className="md:col-span-2"><FormField label="TRẠNG THÁI" value={Array.isArray(student.status) ? student.status.join(', ') : student.status} /></div>
      <FormField label="NGƯỜI PHỤ TRÁCH" value={student.createdByName || 'Chưa xác định'} />
      <FormField label="LỚP ĐANG THAM GIA" value={joinedBatches.length ? joinedBatches.map((batch) => [batch.code, batch.courseTitle].filter(Boolean).join(' — ')).join(' | ') : 'Chưa xếp lớp'} />
    </div>
    <section className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm shadow-slate-200/50 sm:p-8"><h3 className="mb-4 text-xs font-black uppercase tracking-widest text-slate-500">Combo / lộ trình học</h3>{roadmapEntries.length === 0 ? <p className="text-sm text-slate-400">Học viên chưa được gắn vào combo hoặc lộ trình học.</p> : <div className="space-y-3">{roadmapEntries.map((entry, index) => <div key={`${entry.roadmap.id}-${entry.batchCode}-${index}`} className="rounded-xl border border-cyan-100 bg-cyan-50/40 p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-bold text-cyan-900">{entry.roadmap.name}</p><p className="mt-1 text-xs text-cyan-700">{entry.roadmap.code} · Chặng {entry.stepOrder || '—'} · Lớp {entry.batchCode}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${entry.status === 'Chờ xếp lớp tiếp theo' ? 'bg-violet-100 text-violet-700' : entry.status === 'Đang học' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{entry.status}</span></div></div>)}</div>}</section>
    <section className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm shadow-slate-200/50 sm:p-8"><h3 className="mb-4 text-xs font-black uppercase tracking-widest text-slate-500">Lịch sử học lại</h3>{retakeHistory.length === 0 ? <p className="text-sm text-slate-400">Chưa có lịch sử học lại.</p> : <div className="space-y-2">{retakeHistory.map((entry, index) => <div key={`${entry.batchCode}-${entry.at}-${index}`} className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 text-sm"><p className="font-bold text-indigo-700">Lần {entry.count} · Lớp {entry.batchCode}</p><p className="text-xs text-slate-600">{entry.reason || 'Không có lý do'} · {entry.fee > 0 ? `${entry.fee.toLocaleString('vi-VN')}đ` : 'Miễn phí'}</p></div>)}</div>}</section>
    <section className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm shadow-slate-200/50 sm:p-8"><CustomFieldDetails moduleKey="students" values={student.customFields ?? {}} /></section>
  </div>;
}

function FormField({ label, value }: { label: string; value: string }) { return <div className="space-y-2"><label className="text-[11px] font-bold uppercase tracking-widest text-slate-500">{label}</label><input type="text" value={value} readOnly className="w-full cursor-default rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800" /></div>; }
