import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import FormField from './FormField';
import ProfileFormModal from './ProfileFormModal';
import { useToast } from './ToastProvider';
import { api } from '../../services/api';
import { errorMessage } from '../../types';

interface CustomerFormState { fullName: string; dateOfBirth: string; gender: string; phone: string; email: string; height: string | number; initialWeight: string | number; medicalNotes: string; initialGoal: string; internalNotes: string; status: string }
interface CustomerRecord extends Partial<Omit<CustomerFormState, 'email'>> { _id?: string; email?: string | null; [key: string]: unknown }
interface CustomerFormModalProps { open: boolean; customer?: CustomerRecord | null; onClose: () => void; onSaved: (data: unknown) => void }

const emptyCustomerForm = {
  fullName: '',
  dateOfBirth: '',
  gender: 'OTHER',
  phone: '',
  email: '',
  height: '',
  initialWeight: '',
  medicalNotes: '',
  initialGoal: '',
  internalNotes: '',
  status: 'ACTIVE',
};

function formFromCustomer(customer?: CustomerRecord | null): CustomerFormState {
  if (!customer) return { ...emptyCustomerForm };
  return {
    ...emptyCustomerForm,
    ...customer,
    dateOfBirth: customer.dateOfBirth ? String(customer.dateOfBirth).slice(0, 10) : '',
    height: customer.height ?? '',
    initialWeight: customer.initialWeight ?? '',
    email: customer.email ?? '',
  };
}

function customerPayload(form: CustomerFormState) {
  return {
    fullName: form.fullName.trim(),
    dateOfBirth: form.dateOfBirth || null,
    gender: form.gender,
    phone: form.phone.trim(),
    email: form.email.trim() || null,
    height: form.height === '' ? null : Number(form.height),
    initialWeight: form.initialWeight === '' ? null : Number(form.initialWeight),
    medicalNotes: form.medicalNotes.trim(),
    initialGoal: form.initialGoal.trim(),
    internalNotes: form.internalNotes.trim(),
    status: form.status,
  };
}

export default function CustomerFormModal({ open, customer, onClose, onSaved }: CustomerFormModalProps) {
  const toast = useToast();
  const [form, setForm] = useState<CustomerFormState>(emptyCustomerForm);
  const [initial, setInitial] = useState<CustomerFormState>(emptyCustomerForm);
  const [loading, setLoading] = useState(false);
  const editing = Boolean(customer?._id);
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (!open) return;
    const next = formFromCustomer(customer);
    setForm(next);
    setInitial(next);
  }, [open, customer]);

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(initial), [form, initial]);
  const change = (field: keyof CustomerFormState) => (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((current) => ({ ...current, [field]: event.target.value }));

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setLoading(true);
      const payload = customerPayload(form);
      const result = editing
        ? await api.patch(`/api/customers/${customer?._id}`, payload)
        : await api.post('/api/customers', payload);
      toast.success(result.message);
      onSaved(result.data);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return <ProfileFormModal
    open={open}
    title={editing ? 'Sửa khách hàng' : 'Thêm khách hàng'}
    description=""
    dirty={dirty}
    loading={loading}
    submitLabel={editing ? 'Lưu thay đổi' : 'Tạo khách hàng'}
    onClose={onClose}
    onSubmit={submit}
  >
    <section className="profile-form-section">
      <h3>Thông tin cá nhân</h3>
      <div className="profile-form-grid">
        <FormField label="Họ tên" name="customerFullName" placeholder="Nhập họ và tên khách hàng..." value={form.fullName} onChange={change('fullName')} required />
        <FormField label="Ngày sinh" name="customerDateOfBirth" type="date" max={today} value={form.dateOfBirth} onChange={change('dateOfBirth')} />
        <FormField label="Giới tính" name="customerGender" as="select" value={form.gender} onChange={change('gender')}>
          <option value="OTHER">Khác</option><option value="MALE">Nam</option><option value="FEMALE">Nữ</option>
        </FormField>
      </div>
    </section>
    <section className="profile-form-section">
      <h3>Liên hệ</h3>
      <div className="profile-form-grid">
        <FormField label="Số điện thoại" name="customerPhone" placeholder="Nhập số điện thoại (ví dụ: 0912345678)..." value={form.phone} onChange={change('phone')} required />
        <FormField label="Email" name="customerEmail" type="email" placeholder="Nhập email (ví dụ: khachhang@example.com)..." value={form.email} onChange={change('email')} />
      </div>
    </section>
    <section className="profile-form-section">
      <h3>Chỉ số và sức khỏe</h3>
      <div className="profile-form-grid">
        <FormField label="Chiều cao (cm)" name="customerHeight" type="number" min="0" step="0.1" placeholder="Ví dụ: 172.5" value={form.height} onChange={change('height')} />
        <FormField label="Cân nặng ban đầu (kg)" name="customerInitialWeight" type="number" min="0" step="0.1" placeholder="Ví dụ: 68.0" value={form.initialWeight} onChange={change('initialWeight')} />
        <div className="grid-full-width">
          <FormField label="Lưu ý sức khỏe" name="customerMedicalNotes" as="textarea" rows={3} maxLength={2000} placeholder="Nhập tiền sử bệnh lý, chấn thương hoặc lưu ý sức khỏe đặc biệt..." value={form.medicalNotes} onChange={change('medicalNotes')} />
        </div>
      </div>
    </section>
    <section className="profile-form-section">
      <h3>Quản lý</h3>
      <div className="profile-form-grid">
        <div className="grid-full-width">
          <FormField label="Ghi chú nội bộ" name="customerInternalNotes" as="textarea" rows={3} maxLength={2000} placeholder="Nhập ghi chú nội bộ của PT dành cho học viên..." value={form.internalNotes} onChange={change('internalNotes')} />
        </div>
        <FormField label="Trạng thái" name="customerStatus" as="select" value={form.status} onChange={change('status')}>
          <option value="ACTIVE">Đang hoạt động</option><option value="INACTIVE">Ngừng hoạt động</option><option value="LEAD">Tiềm năng</option>
        </FormField>
      </div>
    </section>
  </ProfileFormModal>;
}
