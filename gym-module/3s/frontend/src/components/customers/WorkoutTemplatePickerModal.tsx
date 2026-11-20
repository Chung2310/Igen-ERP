import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { api } from '../../services/api';
import { errorMessage } from '../../types';
import { useToast } from '../ui/ToastProvider';
import type { WorkoutTemplate } from '../workouts/WorkoutTemplateList';

interface Props { open: boolean; saving: boolean; onClose: () => void; onConfirm: (templateId: string) => void }

export default function WorkoutTemplatePickerModal({ open, saving, onClose, onConfirm }: Props) {
  const toast = useToast();
  const [items, setItems] = useState<WorkoutTemplate[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api.get<WorkoutTemplate[]>('/api/workout-templates?page=1&limit=100').then(({ data }) => setItems(data)).catch((error: unknown) => toast.error(errorMessage(error))).finally(() => setLoading(false));
  }, [open, toast]);
  if (!open) return null;
  return <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/55 p-4" role="dialog" aria-modal="true" aria-label="Chọn giáo án mẫu">
    <section className="w-full max-w-[560px] rounded-xl bg-white p-4 shadow-2xl sm:p-6">
      <header className="mb-4 flex items-center justify-between"><div><h3 className="font-oswald text-xl font-bold uppercase text-primary">Chọn giáo án mẫu</h3><p className="text-sm text-slate-500">Một bản sao riêng sẽ được tạo cho khách hàng.</p></div><button type="button" aria-label="Đóng" className="rounded-lg p-2 hover:bg-slate-100" onClick={onClose}><X size={20} /></button></header>
      <div className="max-h-[50vh] space-y-2 overflow-y-auto">
        {loading ? <p className="py-8 text-center text-sm text-slate-500">Đang tải giáo án...</p> : items.length ? items.map((item) => <button key={item._id} type="button" onClick={() => setSelectedId(item._id)} className={`flex w-full items-center justify-between rounded-lg border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary ${selectedId === item._id ? 'border-secondary bg-sky-50' : 'border-slate-200 hover:border-slate-300'}`}><span><strong className="block text-sm text-slate-900">{item.title}</strong><small className="text-slate-500">{item.goal} · {item.level}</small></span><span className="text-xs font-semibold text-primary">{item.durationDays || 1} ngày</span></button>) : <p className="py-8 text-center text-sm text-slate-500">PT chưa có giáo án mẫu.</p>}
      </div>
      <footer className="mt-5 flex justify-end gap-2"><button type="button" className="button button-secondary" onClick={onClose}>Hủy</button><button type="button" className="button button-primary" disabled={!selectedId || saving} onClick={() => onConfirm(selectedId)}>{saving ? 'Đang gán...' : 'Xác nhận gán'}</button></footer>
    </section>
  </div>;
}
