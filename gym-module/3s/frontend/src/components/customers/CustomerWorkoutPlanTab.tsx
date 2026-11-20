import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, Dumbbell, History } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { errorMessage } from '../../types';
import type { CustomerWorkoutPlanSnapshot, CustomerWorkoutPlanState } from '../../types/workout';
import { useToast } from '../ui/ToastProvider';
import WorkoutTemplatePickerModal from './WorkoutTemplatePickerModal';

interface Props { customerId: string; customerName: string }

export default function CustomerWorkoutPlanTab({ customerId, customerName }: Props) {
  const navigate = useNavigate(); const toast = useToast();
  const [state, setState] = useState<CustomerWorkoutPlanState>({ active: null, history: [] });
  const [loading, setLoading] = useState(true); const [failed, setFailed] = useState(false); const [pickerOpen, setPickerOpen] = useState(false); const [saving, setSaving] = useState(false);
  const load = useCallback(async () => { setLoading(true); setFailed(false); try { const result = await api.get<CustomerWorkoutPlanState>(`/api/customers/${customerId}/workout-plans`); setState(result.data); } catch (error) { setFailed(true); toast.error(errorMessage(error)); } finally { setLoading(false); } }, [customerId, toast]);
  useEffect(() => { void load(); }, [load]);
  const assign = async (templateId: string) => { setSaving(true); try { const result = await api.post<CustomerWorkoutPlanSnapshot>(`/api/customers/${customerId}/workout-plans/assign`, { templateId }); setState((current) => ({ active: result.data, history: current.active ? [{ ...current.active, lifecycleStatus: 'ARCHIVED' }, ...current.history] : current.history })); setPickerOpen(false); toast.success(result.message); } catch (error) { toast.error(errorMessage(error)); } finally { setSaving(false); } };
  if (loading) return <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Đang tải giáo án...</div>;
  if (failed) return <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center"><p className="mb-3 text-sm text-red-700">Không thể tải giáo án của khách hàng.</p><button type="button" className="button button-secondary" onClick={() => void load()}>Thử lại</button></div>;
  return <div className="space-y-4">
    {state.active ? <section className="rounded-2xl border border-sky-200 bg-gradient-to-br from-white to-sky-50 p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="mb-1 text-xs font-bold uppercase tracking-wider text-secondary">Giáo án đang áp dụng</p><h3 className="font-oswald text-2xl font-bold uppercase text-primary">{state.active.title}</h3><p className="mt-1 text-sm text-slate-600">{state.active.level} · {state.active.durationDays} ngày</p><p className="mt-2 flex items-center gap-1 text-xs text-slate-500"><CalendarDays size={14} /> Gán cho {customerName}</p></div><div className="flex gap-2"><button type="button" className="button button-secondary" onClick={() => setPickerOpen(true)}>Thay giáo án</button><button type="button" className="button button-primary" onClick={() => navigate(`/pt/customers/${customerId}/workout-plans/${state.active?._id}/edit`)}>Mở Studio</button></div></div></section> : <section className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center"><Dumbbell className="mx-auto mb-3 text-slate-400" size={38} /><h3 className="font-semibold text-slate-900">Khách hàng chưa có giáo án</h3><p className="mb-4 mt-1 text-sm text-slate-500">Gán một giáo án mẫu để bắt đầu cá nhân hóa.</p><button type="button" className="button button-primary" onClick={() => setPickerOpen(true)}>Gán giáo án</button></section>}
    {state.history.length > 0 && <section className="rounded-xl border border-slate-200 bg-white p-4"><h3 className="mb-3 flex items-center gap-2 font-semibold text-primary"><History size={17} /> Lịch sử giáo án</h3><div className="space-y-2">{state.history.map((item) => <article key={item._id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2"><div><strong className="text-sm text-slate-800">{item.title}</strong><p className="text-xs text-slate-500">{item.durationDays} ngày · Đã lưu trữ</p></div><button type="button" className="text-button" onClick={() => navigate(`/pt/customers/${customerId}/workout-plans/${item._id}/edit?readonly=1`)}>Xem</button></article>)}</div></section>}
    <WorkoutTemplatePickerModal open={pickerOpen} saving={saving} onClose={() => setPickerOpen(false)} onConfirm={(id) => void assign(id)} />
  </div>;
}
