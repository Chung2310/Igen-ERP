import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { ShieldCheck, UserRound } from 'lucide-react';
import { api } from '../../services/api';
import {
  isValidPassword,
  PASSWORD_ERROR,
  PASSWORD_HINT,
} from '../../services/passwordValidation';
import { errorMessage, type AdminAccount, type AdminAccountFormState } from '../../types';
import FormField from '../ui/FormField';
import ProfileFormModal from '../ui/ProfileFormModal';
import { useToast } from '../ui/ToastProvider';

export interface AdminAccountFormModalProps {
  open: boolean;
  account?: AdminAccount | null;
  onClose: () => void;
  onSaved: (account: unknown) => void;
}

const emptyForm: AdminAccountFormState = {
  username: '',
  password: '',
  fullName: '',
  phone: '',
  email: '',
  status: 'ACTIVE',
};

function formFromAccount(account?: AdminAccount | null): AdminAccountFormState {
  if (!account) return { ...emptyForm };
  return {
    username: account.username,
    password: '',
    fullName: account.fullName || '',
    phone: account.phone || '',
    email: account.email || '',
    status: account.status || 'ACTIVE',
  };
}

export default function AdminAccountFormModal({ open, account, onClose, onSaved }: AdminAccountFormModalProps) {
  const toast = useToast();
  const [form, setForm] = useState<AdminAccountFormState>(emptyForm);
  const [initial, setInitial] = useState<AdminAccountFormState>(emptyForm);
  const [loading, setLoading] = useState(false);
  const editing = Boolean(account?._id || account?.id);
  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(initial), [form, initial]);

  useEffect(() => {
    if (!open) return;
    const next = formFromAccount(account);
    setForm(next);
    setInitial(next);
  }, [account, open]);

  const change = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if ((!editing || form.password.length > 0) && !isValidPassword(form.password)) {
      toast.error(PASSWORD_ERROR);
      return;
    }

    const contact = {
      fullName: form.fullName.trim(),
      phone: form.phone.trim() || undefined,
      email: form.email.trim() || null,
      status: form.status,
    };
    const payload = editing
      ? { ...contact, ...(form.password ? { password: form.password } : {}) }
      : {
          ...contact,
          role: 'ADMIN' as const,
          username: form.username.trim(),
          password: form.password,
        };

    try {
      setLoading(true);
      const accountId = account?._id || account?.id;
      const result = editing
        ? await api.patch(`/api/users/${accountId}`, payload)
        : await api.post('/api/users', payload);
      toast.success(result.message || (editing ? 'Cập nhật Admin thành công.' : 'Tạo Admin thành công.'));
      onSaved(result.data);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProfileFormModal
      open={open}
      title={editing ? 'Cập nhật tài khoản Admin' : 'Thêm tài khoản Admin'}
      description="Tài khoản này có quyền vận hành hệ thống nhưng không thể quản lý các Admin khác."
      dirty={dirty}
      loading={loading}
      submitLabel={editing ? 'Lưu thay đổi' : 'Tạo Admin'}
      size="lg"
      onClose={onClose}
      onSubmit={submit}
    >
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-primary">
          <UserRound size={18} aria-hidden="true" />
          <h3 className="font-oswald text-lg font-bold uppercase tracking-wide">Thông tin Admin</h3>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            label="Họ tên"
            name="fullName"
            placeholder="Nhập họ tên Admin..."
            value={form.fullName}
            onChange={change}
            required
          />
          <FormField
            label="Số điện thoại"
            name="phone"
            type="tel"
            placeholder="Nhập số điện thoại..."
            value={form.phone}
            onChange={change}
          />
          <FormField
            label="Email"
            name="email"
            type="email"
            placeholder="Nhập email Admin..."
            value={form.email}
            onChange={change}
          />
          <FormField label="Trạng thái" name="status" as="select" value={form.status} onChange={change}>
            <option value="ACTIVE">Đang hoạt động</option>
            <option value="LOCKED">Đã khóa</option>
          </FormField>
        </div>
      </section>

      <section className="mt-6 space-y-4 border-t border-slate-200 pt-6">
        <div className="flex items-center gap-2 text-primary">
          <ShieldCheck size={18} aria-hidden="true" />
          <h3 className="font-oswald text-lg font-bold uppercase tracking-wide">Đăng nhập và bảo mật</h3>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            label="Tên đăng nhập"
            name="username"
            placeholder="Nhập tên đăng nhập Admin..."
            value={form.username}
            onChange={change}
            readOnly={editing}
            required
          />
          <FormField
            label={editing ? 'Mật khẩu mới' : 'Mật khẩu ban đầu'}
            name="password"
            type="password"
            minLength={8}
            
            inputMode="text"
            
            autoComplete="new-password"
            placeholder={editing ? 'Để trống nếu không đổi; nếu đổi, nhập đúng 8 ký tự trở lên' : PASSWORD_HINT}
            value={form.password}
            onChange={change}
            required={!editing}
          />
        </div>
      </section>
    </ProfileFormModal>
  );
}
