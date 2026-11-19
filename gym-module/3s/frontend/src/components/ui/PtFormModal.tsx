import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { User, Award, ShieldCheck, Upload } from 'lucide-react';
import FormField from './FormField';
import ProfileFormModal from './ProfileFormModal';
import { useToast } from './ToastProvider';
import { api } from '../../services/api';
import {
  isValidPassword,
  PASSWORD_ERROR,
  PASSWORD_HINT,
} from '../../services/passwordValidation';
import { errorMessage } from '../../types';

interface PtFormState {
  avatarUrl: string;
  fullName: string;
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

export interface PtRecord extends Partial<Omit<PtFormState, 'certificates' | 'dateOfBirth'>> {
  _id?: string;
  id?: string;
  certificates?: string[] | string;
  dateOfBirth?: string | Date | null;
  [key: string]: unknown;
}

interface PtFormModalProps {
  open: boolean;
  pt?: PtRecord | null;
  onClose: () => void;
  onSaved: (data: unknown) => void;
}

const emptyForm: PtFormState = {
  avatarUrl: '',
  fullName: '',
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

function formFromPt(pt?: PtRecord | null): PtFormState {
  if (!pt) return { ...emptyForm };
  return {
    avatarUrl: (pt.avatarUrl as string) || '',
    fullName: (pt.fullName as string) || '',
    dateOfBirth: pt.dateOfBirth ? String(pt.dateOfBirth).slice(0, 10) : '',
    gender: (pt.gender as string) || 'OTHER',
    phone: (pt.phone as string) || '',
    email: (pt.email as string) || '',
    address: (pt.address as string) || '',
    specialization: (pt.specialization as string) || '',
    yearsOfExperience: pt.yearsOfExperience != null ? pt.yearsOfExperience : 0,
    certificates: Array.isArray(pt.certificates) ? pt.certificates.join('\n') : typeof pt.certificates === 'string' ? pt.certificates : '',
    bio: (pt.bio as string) || '',
    username: (pt.username as string) || '',
    password: '',
    status: (pt.status as string) || 'ACTIVE',
  };
}

export default function PtFormModal({ open, pt, onClose, onSaved }: PtFormModalProps) {
  const toast = useToast();
  const [form, setForm] = useState<PtFormState>(emptyForm);
  const [initial, setInitial] = useState<PtFormState>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const editing = Boolean(pt?._id || pt?.id);

  const handleAvatarUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('image', file);

    try {
      setUploading(true);
      const result = await api.upload<{ url: string }>('/api/upload/image', formData);
      setForm((current) => ({ ...current, avatarUrl: result.data.url }));
      toast.success('Tải ảnh đại diện thành công!');
    } catch (error) {
      toast.error('Lỗi khi tải ảnh lên: ' + errorMessage(error));
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    const next = formFromPt(pt);
    setForm(next);
    setInitial(next);
  }, [open, pt]);

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(initial), [form, initial]);

  const change = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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
      certificates: form.certificates
        .split('\n')
        .map((value) => value.trim())
        .filter(Boolean),
      bio: form.bio?.trim() || '',
    };

    if (!editing) {
      if (!isValidPassword(form.password)) {
        toast.error(PASSWORD_ERROR);
        return;
      }
      payload.role = 'PT';
      payload.username = form.username.trim();
      payload.password = form.password;
      payload.status = form.status || 'ACTIVE';
    }

    try {
      setLoading(true);
      const targetId = pt?._id || pt?.id;
      const result = editing
        ? await api.patch(`/api/users/${targetId}`, payload)
        : await api.post('/api/users', payload);
      toast.success(result.message || (editing ? 'Cập nhật PT thành công' : 'Tạo PT mới thành công'));
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
      title={editing ? 'Cập nhật hồ sơ Huấn luyện viên' : 'Thêm Huấn luyện viên mới'}
      description=""
      dirty={dirty}
      loading={loading}
      submitLabel={editing ? 'Lưu thay đổi' : 'Tạo Huấn luyện viên'}
      onClose={onClose}
      onSubmit={submit}
    >
      {/* Section 1: Hồ sơ cá nhân & Ảnh */}
      <section className="profile-form-section">
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <User size={16} color="var(--secondary-color)" /> Thông tin cá nhân & Ảnh đại diện
        </h3>
        <div className="profile-form-grid">
          <div className="grid-full-width">
            <label style={{ fontSize: '0.78rem', fontWeight: 650, color: '#334155', display: 'block', marginBottom: '6px' }}>
              Ảnh đại diện Huấn luyện viên
            </label>
            <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
              <div
                style={{
                  position: 'relative',
                  width: '64px',
                  height: '64px',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  backgroundColor: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {form.avatarUrl ? (
                  <img src={form.avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <User size={28} color="#94a3b8" />
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <label
                    htmlFor="avatar-file-upload"
                    className="button button-secondary"
                    style={{
                      margin: 0,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      height: '34px',
                      padding: '0 12px',
                      fontSize: '0.82rem',
                    }}
                  >
                    <Upload size={14} /> {uploading ? 'Đang tải lên...' : 'Chọn ảnh tải lên'}
                  </label>
                  <input
                    id="avatar-file-upload"
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
                      onClick={() => setForm((c) => ({ ...c, avatarUrl: '' }))}
                      style={{
                        height: '34px',
                        padding: '0 10px',
                        color: '#dc2626',
                        borderColor: '#fca5a5',
                        fontSize: '0.82rem',
                      }}
                    >
                      Xóa ảnh
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <FormField
            label="Họ và tên"
            name="fullName"
            value={form.fullName}
            onChange={change}
            required
            placeholder="Ví dụ: Nguyễn Văn Tuấn"
          />
          <FormField
            label="Số điện thoại"
            name="phone"
            value={form.phone}
            onChange={change}
            required
            placeholder="0912 345 678"
          />
          <FormField
            label="Email đăng nhập ERP"
            name="email"
            type="email"
            value={form.email}
            onChange={change}
            required
            placeholder="coach@3s.igentechnology.net"
          />
          <FormField
            label="Ngày sinh"
            name="dateOfBirth"
            type="date"
            value={form.dateOfBirth}
            onChange={change}
          />
          <FormField
            label="Giới tính"
            name="gender"
            as="select"
            value={form.gender}
            onChange={change}
          >
            <option value="MALE">Nam</option>
            <option value="FEMALE">Nữ</option>
            <option value="OTHER">Khác</option>
          </FormField>
          <div className="grid-full-width">
            <FormField
              label="Địa chỉ"
              name="address"
              value={form.address}
              onChange={change}
              placeholder="Địa chỉ liên hệ..."
            />
          </div>
        </div>
      </section>

      {/* Section 2: Chuyên môn & Bằng cấp */}
      <section className="profile-form-section">
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Award size={16} color="var(--secondary-color)" /> Chuyên môn & Bằng cấp
        </h3>
        <div className="profile-form-grid">
          <FormField
            label="Chuyên môn huấn luyện"
            name="specialization"
            value={form.specialization}
            onChange={change}
            placeholder="Ví dụ: Tăng cơ, Giảm mỡ, Phục hồi chức năng, Boxing..."
          />
          <FormField
            label="Số năm kinh nghiệm"
            name="yearsOfExperience"
            type="number"
            min={0}
            max={80}
            step={1}
            value={form.yearsOfExperience}
            onChange={change}
          />
          <div className="grid-full-width">
            <FormField
              label="Chứng chỉ & Bằng cấp (mỗi dòng một chứng chỉ)"
              name="certificates"
              as="textarea"
              rows={3}
              placeholder="NASM-CPT Certified Personal Trainer&#10;ACE Fitness Nutrition Specialist&#10;Chứng chỉ Sơ cấp cứu CPR/AED"
              value={form.certificates}
              onChange={change}
            />
          </div>
          <div className="grid-full-width">
            <FormField
              label="Giới thiệu bản thân & Triết lý huấn luyện"
              name="bio"
              as="textarea"
              rows={3}
              maxLength={1000}
              placeholder="Tóm tắt kinh nghiệm, định hướng và cam kết đồng hành cùng học viên..."
              value={form.bio}
              onChange={change}
            />
          </div>
        </div>
      </section>

      {/* Section 3: Cấp tài khoản đăng nhập (Chỉ hiển thị khi thêm PT mới) */}
      {!editing && (
        <section className="profile-form-section">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ShieldCheck size={16} color="var(--secondary-color)" /> Cấp tài khoản đăng nhập
          </h3>
          <div className="profile-form-grid">
            <FormField
              label="Tên đăng nhập"
              name="username"
              value={form.username}
              onChange={change}
              required
              placeholder="pt_tuan"
            />
            <FormField
              label="Mật khẩu ban đầu"
              name="password"
              type="password"
              minLength={8}
              
              inputMode="text"
              
              autoComplete="new-password"
              value={form.password}
              onChange={change}
              required
              placeholder={PASSWORD_HINT}
            />
            <FormField label="Trạng thái tài khoản" name="status" as="select" value={form.status} onChange={change}>
              <option value="ACTIVE">Hoạt động (ACTIVE)</option>
              <option value="LOCKED">Tạm khóa (LOCKED)</option>
            </FormField>
          </div>
        </section>
      )}
    </ProfileFormModal>
  );
}
