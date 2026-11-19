import { useEffect, useMemo, useState, type FormEvent } from 'react';
import FormField from './FormField';
import FormModal from './FormModal';
import CustomerSelect from './CustomerSelect';
import { useToast } from './ToastProvider';
import { api } from '../../services/api';
import { errorMessage } from '../../types';

interface Transfer { _id?: string; customerId?: string; toPtId?: string; reason?: string }
interface TransferFormModalProps { open: boolean; transfer?: Transfer | null; onClose: () => void; onSaved: (data: unknown) => void }

export default function TransferFormModal({ open, transfer, onClose, onSaved }: TransferFormModalProps) {
  const toast = useToast();
  const [form, setForm] = useState({ customerId: '', toPtId: '', reason: '' });
  const [initial, setInitial] = useState(form);
  const editing = Boolean(transfer?._id);
  useEffect(() => { if (open) { const next = { customerId: transfer?.customerId || '', toPtId: transfer?.toPtId || '', reason: transfer?.reason || '' }; setForm(next); setInitial(next); } }, [open, transfer]);
  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(initial), [form, initial]);
  const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); try { const body = editing ? { toPtId: form.toPtId, reason: form.reason } : form; const result = editing ? await api.patch(`/api/transfers/${transfer?._id}`, body) : await api.post('/api/transfers', body); toast.success(result.message); onSaved(result.data); } catch (error) { toast.error(errorMessage(error)); } };
  return <FormModal open={open} title={editing ? 'Sửa yêu cầu chuyển PT' : 'Tạo yêu cầu chuyển PT'} dirty={dirty} onClose={onClose} onSubmit={submit} submitLabel={editing ? 'Lưu thay đổi' : 'Gửi yêu cầu'}>
    <section className="profile-form-section">
      <div className="profile-form-grid">
        <div className="grid-full-width">
          <CustomerSelect
            label="Học viên / Khách hàng"
            name="transferCustomerId"
            value={form.customerId}
            onChange={(selectedId) => setForm({ ...form, customerId: selectedId })}
            readOnly={editing}
            required
            placeholder="Tìm và chọn học viên cần chuyển giao..."
          />
        </div>
        <FormField label="Mã PT nhận" name="transferToPtId" placeholder="Nhập mã PT tiếp nhận..." value={form.toPtId} onChange={(e) => setForm({ ...form, toPtId: e.target.value })} required />
        <div className="grid-full-width">
          <FormField label="Lý do chuyển" name="transferReason" placeholder="Nhập lý do chuyển giao khách hàng..." value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} required />
        </div>
      </div>
    </section>
  </FormModal>;
}
