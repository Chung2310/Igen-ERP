import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { Upload, Trash2, User as UserIcon, Phone, Award, GraduationCap, ShieldCheck } from 'lucide-react';
import FormField from './FormField';
import ProfileFormModal from './ProfileFormModal';
import { useToast } from './ToastProvider';
import { api } from '../../services/api';
import {
  isValidPassword,
  PASSWORD_ERROR,
  PASSWORD_HINT,
} from '../../services/passwordValidation';
import { errorMessage, type UserRole } from '../../types';
import { creatableRoles } from '../../services/roles';

export interface UserFormState {
  avatarUrl: string;
  fullName: string;
  role: UserRole;
  dateOfBirth: string;
  gender: string;
  phone: string;
  email: string;
  address: string;
  specialization: string;
  yearsOfExperience: number | string;
  certificates: string;
  bio: string;
  username: string;
  password: string;
  status: string;
}

export interface UserRecord extends Partial<Omit<UserFormState, 'certificates'>> {
  _id?: string;
  id?: string;
  certificates?: string[] | string;
  [key: string]: unknown;
}

export interface UserFormModalProps {
  open: boolean;
  user?: UserRecord | null;
  defaultRole?: UserRole;
  actorRole?: UserRole;
  onClose: () => void;
  onSaved: (data: unknown) => void;
}

const emptyUserForm: UserFormState = {
  avatarUrl: '',
  fullName: '',
  role: 'PT',
  dateOfBirth: '',
  gender: 'OTHER',
  phone: '',
  email: '',
  address: '',
  specialization: '',
  yearsOfExperience: 0,
  certificates: '',
  bio: '',
  username: '',
  password: '',
  status: 'ACTIVE',
};

function formFromUser(user?: UserRecord | null, defaultRole: UserRole = 'PT'): UserFormState {
  if (!user) return { ...emptyUserForm, role: defaultRole };
  return {
    avatarUrl: (user.avatarUrl as string) || '',
    fullName: (user.fullName as string) || '',
    role: (user.role as UserRole) || defaultRole,
    dateOfBirth: user.dateOfBirth ? String(user.dateOfBirth).slice(0, 10) : '',
    gender: (user.gender as string) || 'OTHER',
    phone: (user.phone as string) || '',
    email: (user.email as string) || '',
    address: (user.address as string) || '',
    specialization: (user.specialization as string) || '',
    yearsOfExperience: user.yearsOfExperience != null ? user.yearsOfExperience : 0,
    certificates: Array.isArray(user.certificates) ? user.certificates.join('\n') : (user.certificates || ''),
    bio: (user.bio as string) || '',
    username: (user.username as string) || '',
    password: '',
    status: (user.status as string) || 'ACTIVE',
  };
}

export default function UserFormModal({
  open,
  user,
  defaultRole = 'PT',
  actorRole = 'ADMIN',
  onClose,
  onSaved,
}: UserFormModalProps) {
  const toast = useToast();
  const [form, setForm] = useState<UserFormState>(emptyUserForm);
  const [initial, setInitial] = useState<UserFormState>(emptyUserForm);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const editing = Boolean(user?._id || user?.id);
  const allowedCreateRoles = useMemo(() => creatableRoles(actorRole), [actorRole]);
  const safeDefaultRole = allowedCreateRoles.includes(defaultRole) ? defaultRole : allowedCreateRoles[0] || 'PT';

  const handleAvatarUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('image', file);

    try {
      setUploading(true);
      const result = await api.upload<{ url: string }>('/api/upload/image', formData);
      setForm((current) => ({ ...current, avatarUrl: result.data.url }));
      toast.success('Tải ảnh đại diện lên thành công!');
    } catch (error) {
      toast.error('Lỗi khi tải ảnh: ' + errorMessage(error));
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    const next = formFromUser(user, safeDefaultRole);
    setForm(next);
    setInitial(next);
  }, [open, user, safeDefaultRole]);

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(initial), [form, initial]);
  const change = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const userId = user?._id || user?.id;
    const payload: Record<string, any> = {
      fullName: form.fullName.trim(),
      phone: form.phone.trim(),
      email: form.email?.trim() || null,
      avatarUrl: form.avatarUrl?.trim() || null,
      dateOfBirth: form.dateOfBirth ? form.dateOfBirth : null,
      gender: form.gender || 'OTHER',
      address: form.address?.trim() || '',
      specialization: form.specialization?.trim() || '',
      yearsOfExperience: Number(form.yearsOfExperience || 0),
      certificates: form.certificates ? form.certificates.split('\n').map((value) => value.trim()).filter(Boolean) : [],
      bio: form.bio?.trim() || '',
      status: form.status || 'ACTIVE',
    };

    if (!editing) {
      payload.role = form.role;
      payload.username = form.username.trim();
    }
    const password = form.password || '';
    if ((!editing || password.length > 0) && !isValidPassword(password)) {
      toast.error(PASSWORD_ERROR);
      return;
    }
    if (password.length > 0) {
      payload.password = password;
    }

    try {
      setLoading(true);
      const result = editing
        ? await api.patch(`/api/users/${userId}`, payload)
        : await api.post('/api/users', payload);
      toast.success(result.message);
      onSaved(result.data);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const roleName =
    form.role === 'CUSTOMER'
      ? 'Hội viên'
      : form.role === 'PT'
        ? 'Huấn luyện viên'
        : 'Quản trị viên (Admin)';

  const modalTitle = editing ? `Sửa tài khoản ${roleName}` : `Tạo tài khoản ${roleName}`;

  return (
    <ProfileFormModal
      open={open}
      title={modalTitle}
      description=""
      dirty={dirty}
      loading={loading}
      submitLabel={editing ? 'Lưu thay đổi' : 'Tạo người dùng'}
      onClose={onClose}
      onSubmit={submit}
    >
      <section className="profile-form-section">
        <h3>
          <UserIcon size={16} /> Thông tin cá nhân
        </h3>
        <div className="profile-form-grid">
          <div className="field">
            <label>Ảnh đại diện</label>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginTop: '0.25rem' }}>
              <div
                style={{
                  position: 'relative',
                  width: '46px',
                  height: '46px',
                  borderRadius: '50%',
                  overflow: 'hidden',
                  backgroundColor: '#f1f5f9',
                  border: '1.5px solid #e2e8f0',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {form.avatarUrl ? (
                  <img
                    src={form.avatarUrl}
                    alt="Avatar preview"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <UserIcon size={20} color="#94a3b8" />
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <label
                  htmlFor="user-avatar-upload"
                  className="button button-secondary"
                  style={{ margin: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px', height: '32px', padding: '0 10px', fontSize: '0.8rem' }}
                >
                  <Upload size={13} />
                  {uploading ? 'Đang tải...' : 'Tải ảnh lên'}
                </label>
                <input
                  id="user-avatar-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  disabled={uploading}
                  style={{ display: 'none' }}
                />
                {form.avatarUrl && (
                  <button
                    type="button"
                    className="button button-secondary"
                    style={{ margin: 0, color: '#ef4444', height: '32px', padding: '0 8px', fontSize: '0.8rem' }}
                    onClick={() => setForm((c) => ({ ...c, avatarUrl: '' }))}
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          </div>

          <FormField
            label="Vai trò tài khoản"
            name="role"
            as="select"
            value={form.role}
            onChange={change}
            disabled={editing}
            required
          >
            {(editing ? [form.role] : allowedCreateRoles).map((role) => (
              <option key={role} value={role}>
                {role === 'SUPER_ADMIN' ? 'Quản trị cấp cao (SUPER_ADMIN)' : role === 'ADMIN' ? 'Quản trị viên (ADMIN)' : role === 'PT' ? 'Huấn luyện viên' : 'Khách hàng (CUSTOMER)'}
              </option>
            ))}
          </FormField>

          <FormField
            label="Họ tên"
            name="fullName"
            placeholder={
              form.role === 'CUSTOMER'
                ? 'Nhập họ và tên hội viên (VD: Nguyễn Văn A)...'
                : form.role === 'PT'
                  ? 'Nhập họ và tên HLV (VD: Trần Văn B)...'
                  : 'Nhập họ và tên quản trị viên...'
            }
            value={form.fullName}
            onChange={change}
            required
          />
          <FormField
            label="Ngày sinh"
            name="dateOfBirth"
            type="date"
            max={new Date().toISOString().slice(0, 10)}
            value={form.dateOfBirth}
            onChange={change}
          />
          <FormField label="Giới tính" name="gender" as="select" value={form.gender} onChange={change}>
            <option value="OTHER">Khác</option>
            <option value="MALE">Nam</option>
            <option value="FEMALE">Nữ</option>
          </FormField>
        </div>
      </section>

      <section className="profile-form-section">
        <h3>
          <Phone size={16} /> Liên hệ
        </h3>
        <div className="profile-form-grid">
          <FormField
            label="Số điện thoại"
            name="phone"
            placeholder="Nhập số điện thoại (VD: 0912345678)..."
            value={form.phone}
            onChange={change}
            required
          />
          <FormField
            label="Email"
            name="email"
            type="email"
            placeholder="Nhập email (VD: khachhang@example.com)..."
            value={form.email}
            onChange={change}
          />
          <div className="grid-full-width">
            <FormField
              label="Địa chỉ"
              name="address"
              placeholder="Nhập địa chỉ cư trú (VD: Số 123 Đường Cầu Giấy, Hà Nội)..."
              value={form.address}
              onChange={change}
            />
          </div>
        </div>
      </section>

      {form.role === 'PT' && (
        <section className="profile-form-section">
          <h3>
            <Award size={16} /> Chuyên môn PT
          </h3>
          <div className="profile-form-grid">
            <FormField
              label="Chuyên môn"
              name="specialization"
              placeholder="VD: Tăng cơ, Giảm mỡ, Phục hồi chức năng..."
              value={form.specialization}
              onChange={change}
            />
            <FormField
              label="Số năm kinh nghiệm"
              name="yearsOfExperience"
              type="number"
              min={0}
              max={80}
              step={1}
              placeholder="VD: 3"
              value={form.yearsOfExperience}
              onChange={change}
            />
            <div className="grid-full-width">
              <FormField
                label="Giới thiệu"
                name="bio"
                as="textarea"
                rows={3}
                maxLength={1000}
                placeholder="Mô tả kinh nghiệm, phương pháp huấn luyện và phong cách làm việc..."
                value={form.bio}
                onChange={change}
              />
            </div>
          </div>
        </section>
      )}

      <section className="profile-form-section">
        <h3>
          <GraduationCap size={16} /> Văn bằng & Chứng chỉ
        </h3>
        <div className="profile-form-grid">
          <div className="grid-full-width">
            <FormField
              label="Văn bằng & Chứng chỉ"
              name="certificates"
              as="textarea"
              rows={3}
              placeholder="Mỗi văn bằng hoặc chứng chỉ một dòng (VD: Cử nhân Thể dục Thể thao, NASM-CPT)..."
              value={form.certificates}
              onChange={change}
            />
          </div>
        </div>
      </section>

      <section className="profile-form-section">
        <h3>
          <ShieldCheck size={16} /> Tài khoản & Bảo mật
        </h3>
        <div className="profile-form-grid">
          <FormField
            label="Tên đăng nhập"
            name="username"
            placeholder="Nhập tên đăng nhập (VD: hoangtuananh123)..."
            value={form.username}
            onChange={change}
            readOnly={editing}
            required
          />
          <FormField
            label={editing ? 'Mật khẩu mới (bỏ trống nếu không đổi)' : 'Mật khẩu ban đầu'}
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
          <FormField label="Trạng thái" name="status" as="select" value={form.status} onChange={change} disabled={form.role === 'SUPER_ADMIN'}>
            <option value="ACTIVE">Hoạt động</option>
            {form.role !== 'SUPER_ADMIN' && <option value="LOCKED">Đã khóa</option>}
          </FormField>
        </div>
      </section>
    </ProfileFormModal>
  );
}
