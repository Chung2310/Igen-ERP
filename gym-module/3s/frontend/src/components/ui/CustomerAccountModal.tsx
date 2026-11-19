import { useEffect, useMemo, useState, type FormEvent } from 'react';
import FormField from './FormField';
import FormModal from './FormModal';
import { useToast } from './ToastProvider';
import { api } from '../../services/api';
import {
  isValidPassword,
  PASSWORD_ERROR,
  PASSWORD_HINT,
} from '../../services/passwordValidation';
import { errorMessage } from '../../types';

interface CustomerSummary { _id?: string; fullName?: string; email?: string | null; [key: string]: unknown }
interface CustomerAccountModalProps { open: boolean; customer: CustomerSummary | null; onClose: () => void; onSaved: (data: unknown) => void }

export default function CustomerAccountModal({ open, customer, onClose, onSaved }: CustomerAccountModalProps) {
  const toast = useToast();
  const initial = useMemo(() => ({ username: '', password: '' }), []);
  const [form, setForm] = useState(initial);

  useEffect(() => {
    if (open) setForm(initial);
  }, [open, initial]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!customer?._id) return;
    if (!isValidPassword(form.password)) {
      toast.error(PASSWORD_ERROR);
      return;
    }
    try {
      const payload = { ...form, email: customer.email || '' };
      const result = await api.post(`/api/customers/${customer._id}/account`, payload);
      toast.success(result.message);
      onSaved(result.data);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  if (!customer) return null;

  return (
    <FormModal
      open={open}
      title={`Cấp tài khoản cho ${customer.fullName}`}
      description={customer.email ? `Tài khoản sẽ được liên kết với email: ${customer.email}` : 'Khách hàng có thể dùng tài khoản để theo dõi tiến độ tập luyện.'}
      dirty={JSON.stringify(form) !== JSON.stringify(initial)}
      onClose={onClose}
      onSubmit={submit}
      submitLabel="Cấp tài khoản"
    >
      <section className="profile-form-section">
        <div className="profile-form-grid">
          <FormField
            label="Tên đăng nhập"
            name="customerUsername"
            placeholder="Nhập tên đăng nhập (ví dụ: customer_an)..."
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            required
          />
          <FormField
            label="Mật khẩu ban đầu"
            name="customerPassword"
            type="password"
            minLength={8}
            
            inputMode="text"
            
            placeholder={PASSWORD_HINT}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />
        </div>
      </section>
    </FormModal>
  );
}
