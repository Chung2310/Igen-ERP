import { useRef, useState, type FormEvent } from 'react';
import { useToast } from '../ui/ToastProvider';
import CustomerSelect from '../ui/CustomerSelect';
import { api } from '../../services/api';
import { errorMessage } from '../../types';

interface WorkoutCheckInProps { onCompleted: () => void }
const createKey = () => globalThis.crypto?.randomUUID?.() ?? `checkin-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export default function WorkoutCheckIn({ onCompleted }: WorkoutCheckInProps) {
  const toast = useToast();
  const idempotencyKey = useRef(createKey());
  const submitting = useRef(false);
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(false);
  const [form, setForm] = useState({ customerId: '', templateId: '', sessionIndex: '0', performedAt: '', attendance: 'PRESENT', notes: '' });
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting.current) return;
    if (!form.customerId) {
      toast.error('Vui lòng chọn học viên / khách hàng.');
      return;
    }
    if (!form.templateId?.trim()) {
      toast.error('Vui lòng nhập mã giáo án.');
      return;
    }
    if (!form.performedAt) {
      toast.error('Vui lòng chọn ngày tập.');
      return;
    }
    submitting.current = true;
    setLoading(true);
    try {
      const result = await api.post('/api/workout-sessions', { ...form, sessionIndex: Number(form.sessionIndex), idempotencyKey: idempotencyKey.current });
      toast.success(result.message);
      setRetry(false);
      onCompleted();
    } catch (error) {
      setRetry(true);
      toast.error(errorMessage(error));
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  };
  const change = (field: keyof typeof form, value: string) => setForm((current) => ({ ...current, [field]: value }));
  return <form className="panel" noValidate onSubmit={submit}>
    <h2>Check-in buổi tập</h2>
    <div className="form-grid">
      <CustomerSelect
        label="Học viên / Khách hàng"
        name="customerId"
        value={form.customerId}
        onChange={(selectedId) => change('customerId', selectedId)}
        required
        placeholder="Tìm và chọn học viên check-in..."
      />
      <label className="field"><span>Mã giáo án</span><input aria-label="Mã giáo án" placeholder="Nhập mã giáo án..." value={form.templateId} onChange={(event) => change('templateId', event.target.value)} required /></label>
      <label className="field"><span>Buổi số</span><input aria-label="Chỉ số buổi tập" type="number" min="0" placeholder="0" value={form.sessionIndex} onChange={(event) => change('sessionIndex', event.target.value)} required /></label>
      <label className="field"><span>Ngày tập</span><input aria-label="Ngày tập" type="date" value={form.performedAt} onChange={(event) => change('performedAt', event.target.value)} required /></label>
      <label className="field"><span>Điểm danh</span><select aria-label="Điểm danh" value={form.attendance} onChange={(event) => change('attendance', event.target.value)}><option value="PRESENT">Có mặt</option><option value="LATE">Đi muộn</option><option value="ABSENT">Vắng</option></select></label>
      <label className="field"><span>Ghi chú</span><textarea aria-label="Ghi chú buổi tập" placeholder="Nhập ghi chú buổi tập..." value={form.notes} onChange={(event) => change('notes', event.target.value)} /></label>
    </div>
    <button className="button button-primary" type="submit" disabled={loading}>{loading ? 'Đang ghi nhận...' : retry ? 'Thử lại check-in' : 'Hoàn tất buổi tập'}</button>
  </form>;
}
