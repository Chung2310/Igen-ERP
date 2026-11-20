import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  User as UserIcon,
  Camera,
  Trash2,
  Lock,
  Save,
  CheckCircle2,
  Eye,
  EyeOff,
  Briefcase,
  Shield,
  Sparkles,
} from 'lucide-react';
import { api } from '../../services/api';
import { useToast } from '../../components/ui/ToastProvider';
import { errorMessage, type User } from '../../types';
import { getSession, saveSession } from '../../services/session';
import { isValidPassword, PASSWORD_ERROR } from '../../services/passwordValidation';

interface PtProfilePageProps {
  user: User;
  onUserUpdated?: (user: User) => void;
}

interface FormState {
  avatarUrl: string;
  fullName: string;
  phone: string;
  email: string;
  dateOfBirth: string;
  gender: string;
  address: string;
  specialization: string;
  yearsOfExperience: number | string;
  certificates: string;
  bio: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

const emptyForm: FormState = {
  avatarUrl: '',
  fullName: '',
  phone: '',
  email: '',
  dateOfBirth: '',
  gender: 'OTHER',
  address: '',
  specialization: '',
  yearsOfExperience: 0,
  certificates: '',
  bio: '',
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};

export default function PtProfilePage({ user, onUserUpdated }: PtProfilePageProps) {
  const toast = useToast();
  const [form, setForm] = useState<FormState>({
    ...emptyForm,
    avatarUrl: user.avatarUrl || '',
    fullName: user.fullName || '',
    phone: user.phone || '',
    email: user.email || '',
    gender: user.gender || 'OTHER',
    address: user.address || '',
    specialization: user.specialization || '',
    yearsOfExperience: user.yearsOfExperience ?? 0,
    certificates: Array.isArray(user.certificates) ? user.certificates.join('\n') : '',
    bio: user.bio || '',
  });

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'security'>('profile');

  // Load fresh user data from /api/auth/me on mount
  useEffect(() => {
    let mounted = true;
    api.get<User>('/api/auth/me')
      .then((res) => {
        if (!mounted || !res.data) return;
        const u = res.data;
        setForm((prev) => ({
          ...prev,
          avatarUrl: u.avatarUrl || '',
          fullName: u.fullName || '',
          phone: u.phone || '',
          email: u.email || '',
          dateOfBirth: u.dateOfBirth ? String(u.dateOfBirth).slice(0, 10) : '',
          gender: u.gender || 'OTHER',
          address: u.address || '',
          specialization: u.specialization || '',
          yearsOfExperience: u.yearsOfExperience ?? 0,
          certificates: Array.isArray(u.certificates) ? u.certificates.join('\n') : '',
          bio: u.bio || '',
        }));
      })
      .catch(() => {
        // Fallback to initial prop
      });
    return () => {
      mounted = false;
    };
  }, []);

  const handleInputChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleAvatarUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Chỉ hỗ trợ file ảnh định dạng JPG, PNG hoặc WebP.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Dung lượng ảnh không được vượt quá 5MB.');
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('image', file);
      const res = await api.upload<{ url: string }>('/api/upload/image', formData);
      setForm((prev) => ({ ...prev, avatarUrl: res.data.url }));
      toast.success('Tải ảnh đại diện thành công!');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleRemoveAvatar = () => {
    setForm((prev) => ({ ...prev, avatarUrl: '' }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!form.fullName.trim()) {
      toast.error('Vui lòng nhập họ và tên.');
      return;
    }

    if (!form.phone.trim()) {
      toast.error('Vui lòng nhập số điện thoại.');
      return;
    }

    // Password validation if attempting to change
    if (form.newPassword || form.currentPassword || form.confirmPassword) {
      if (!form.currentPassword) {
        toast.error('Vui lòng nhập mật khẩu hiện tại để đổi mật khẩu.');
        return;
      }
      if (!isValidPassword(form.newPassword)) {
        toast.error(PASSWORD_ERROR);
        return;
      }
      if (form.newPassword !== form.confirmPassword) {
        toast.error('Mật khẩu mới và xác nhận mật khẩu không khớp.');
        return;
      }
    }

    const payload: Record<string, unknown> = {
      fullName: form.fullName.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || null,
      avatarUrl: form.avatarUrl.trim() || null,
      dateOfBirth: form.dateOfBirth || null,
      gender: form.gender || 'OTHER',
      address: form.address.trim() || '',
      specialization: form.specialization.trim() || '',
      yearsOfExperience: Number(form.yearsOfExperience || 0),
      certificates: form.certificates
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      bio: form.bio.trim() || '',
    };

    if (form.newPassword) {
      payload.currentPassword = form.currentPassword;
      payload.password = form.newPassword;
    }

    try {
      setLoading(true);
      const res = await api.patch<User>('/api/auth/me', payload);
      const updatedUser = res.data;

      // Update session in storage
      const currentSession = getSession();
      if (currentSession) {
        saveSession({
          token: currentSession.token,
          user: { ...currentSession.user, ...updatedUser },
        });
      }

      // Notify parent & global listeners
      if (onUserUpdated) {
        onUserUpdated(updatedUser);
      }
      window.dispatchEvent(
        new CustomEvent('3s:user-profile-updated', { detail: updatedUser })
      );

      // Clear password fields
      setForm((prev) => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      }));

      toast.success(res.message || 'Cập nhật thông tin tài khoản thành công!');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const initials = (form.fullName || user.username || 'PT')
    .trim()
    .split(/\s+/)
    .map((s) => s[0])
    .slice(-2)
    .join('')
    .toUpperCase();

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1200px', margin: '0 auto', fontFamily: "'Be Vietnam Pro', sans-serif" }}>
      {/* Top Page Header */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'linear-gradient(135deg, #003b70 0%, #00a4e4 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff' }}>
            <UserIcon size={22} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#003b70', margin: 0, letterSpacing: '-0.5px' }}>
              Hồ sơ Huấn luyện viên
            </h1>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '28px', alignItems: 'start' }}>
          {/* ======================================================= */}
          {/* LEFT COLUMN: HERO CARD & AVATAR                         */}
          {/* ======================================================= */}
          <div style={{ background: '#ffffff', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.04)', padding: '28px', textAlign: 'center' }}>
            {/* Avatar Circle Container */}
            <div style={{ position: 'relative', width: '130px', height: '130px', margin: '0 auto 18px' }}>
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  overflow: 'hidden',
                  background: 'linear-gradient(135deg, #003b70, #00a4e4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  fontSize: '2.5rem',
                  fontWeight: 800,
                  boxShadow: '0 8px 24px rgba(0, 59, 112, 0.2)',
                  border: '4px solid #ffffff',
                }}
              >
                {form.avatarUrl ? (
                  <img
                    src={form.avatarUrl}
                    alt={form.fullName || 'Avatar'}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <span>{initials}</span>
                )}
              </div>

              {/* Upload Overlay Button */}
              <label
                htmlFor="avatar-file-upload"
                title="Tải ảnh mới"
                style={{
                  position: 'absolute',
                  bottom: '2px',
                  right: '2px',
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  background: '#00a4e4',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: uploading ? 'wait' : 'pointer',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                  border: '2px solid #ffffff',
                  transition: 'all 0.2s',
                }}
              >
                <Camera size={18} />
                <input
                  id="avatar-file-upload"
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  onChange={handleAvatarUpload}
                  disabled={uploading}
                  style={{ display: 'none' }}
                />
              </label>
            </div>

            {/* Remove Avatar Button */}
            {form.avatarUrl && (
              <button
                type="button"
                onClick={handleRemoveAvatar}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'none',
                  border: 'none',
                  color: '#ef4444',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  marginBottom: '16px',
                  padding: '4px 8px',
                  borderRadius: '6px',
                }}
              >
                <Trash2 size={14} /> Xóa ảnh đại diện
              </button>
            )}

            {/* Name & Role */}
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#003b70', margin: '0 0 6px' }}>
              {form.fullName || 'Huấn luyện viên'}
            </h2>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#e0f2fe', color: '#0284c7', padding: '4px 12px', borderRadius: '30px', fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.5px', marginBottom: '8px' }}>
              <Shield size={13} /> HUẤN LUYỆN VIÊN 3S
            </div>
            <div style={{ color: '#64748b', fontSize: '0.82rem', marginBottom: '20px' }}>
              @{user.username}
            </div>

            {/* Account Meta Strip */}
            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '16px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#64748b' }}>
                <span>Trạng thái:</span>
                <span style={{ color: '#16a34a', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <CheckCircle2 size={14} /> Đang hoạt động
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#64748b' }}>
                <span>Kinh nghiệm:</span>
                <span style={{ color: '#003b70', fontWeight: 700 }}>
                  {form.yearsOfExperience ? `${form.yearsOfExperience} năm` : 'Chưa cập nhật'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#64748b' }}>
                <span>Chuyên môn:</span>
                <span style={{ color: '#003b70', fontWeight: 700, maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={form.specialization}>
                  {form.specialization || 'Chưa cập nhật'}
                </span>
              </div>
            </div>

          </div>

          {/* ======================================================= */}
          {/* RIGHT COLUMN: TABS & INPUT FIELDS                       */}
          {/* ======================================================= */}
          <div style={{ background: '#ffffff', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.04)', padding: '32px' }}>
            
            {/* Tab selector */}
            <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #e2e8f0', paddingBottom: '14px', marginBottom: '24px' }}>
              <button
                type="button"
                onClick={() => setActiveTab('profile')}
                style={{
                  padding: '8px 18px',
                  borderRadius: '10px',
                  border: 'none',
                  background: activeTab === 'profile' ? '#003b70' : '#f1f5f9',
                  color: activeTab === 'profile' ? '#ffffff' : '#475569',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s',
                }}
              >
                <UserIcon size={16} /> Thông tin hồ sơ & Chuyên môn
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('security')}
                style={{
                  padding: '8px 18px',
                  borderRadius: '10px',
                  border: 'none',
                  background: activeTab === 'security' ? '#003b70' : '#f1f5f9',
                  color: activeTab === 'security' ? '#ffffff' : '#475569',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s',
                }}
              >
                <Lock size={16} /> Bảo mật & Đổi mật khẩu
              </button>
            </div>

            {/* TAB 1: PROFILE DETAILS */}
            {activeTab === 'profile' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {/* Section A: Basic Info */}
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#003b70', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <UserIcon size={17} color="#00a4e4" /> THÔNG TIN CƠ BẢN
                  </h3>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#003b70', marginBottom: '6px' }}>
                        Họ và tên <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input
                        type="text"
                        name="fullName"
                        value={form.fullName}
                        onChange={handleInputChange}
                        placeholder="Nhập họ và tên..."
                        required
                        style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#003b70', marginBottom: '6px' }}>
                        Số điện thoại <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input
                        type="tel"
                        name="phone"
                        value={form.phone}
                        onChange={handleInputChange}
                        placeholder="0988..."
                        required
                        style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#003b70', marginBottom: '6px' }}>
                        Email liên hệ
                      </label>
                      <input
                        type="email"
                        name="email"
                        value={form.email}
                        onChange={handleInputChange}
                        placeholder="pt@3s.igentechnology.net"
                        style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#003b70', marginBottom: '6px' }}>
                        Ngày sinh
                      </label>
                      <input
                        type="date"
                        name="dateOfBirth"
                        value={form.dateOfBirth}
                        onChange={handleInputChange}
                        style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#003b70', marginBottom: '6px' }}>
                        Giới tính
                      </label>
                      <select
                        name="gender"
                        value={form.gender}
                        onChange={handleInputChange}
                        style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none', background: '#ffffff', boxSizing: 'border-box' }}
                      >
                        <option value="MALE">Nam</option>
                        <option value="FEMALE">Nữ</option>
                        <option value="OTHER">Khác</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#003b70', marginBottom: '6px' }}>
                        Địa chỉ cư trú
                      </label>
                      <input
                        type="text"
                        name="address"
                        value={form.address}
                        onChange={handleInputChange}
                        placeholder="Thành phố Bắc Ninh..."
                        style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Section B: PT Professional Info */}
                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '20px' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#003b70', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Briefcase size={17} color="#00a4e4" /> HỒ SƠ CHUYÊN MÔN HLV
                  </h3>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#003b70', marginBottom: '6px' }}>
                        Lĩnh vực chuyên môn
                      </label>
                      <input
                        type="text"
                        name="specialization"
                        value={form.specialization}
                        onChange={handleInputChange}
                        placeholder="Gym, Kickfit, Tăng cơ giảm mỡ..."
                        style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#003b70', marginBottom: '6px' }}>
                        Số năm kinh nghiệm
                      </label>
                      <input
                        type="number"
                        name="yearsOfExperience"
                        min="0"
                        max="60"
                        value={form.yearsOfExperience}
                        onChange={handleInputChange}
                        placeholder="Số năm kinh nghiệm..."
                        style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#003b70', marginBottom: '6px' }}>
                      Bằng cấp & Chứng chỉ
                    </label>
                    <textarea
                      name="certificates"
                      value={form.certificates}
                      onChange={handleInputChange}
                      rows={3}
                      placeholder="Chứng chỉ HLV Thể hình Quốc Gia&#10;Chứng chỉ Dinh Dưỡng Thể Thao ISSA..."
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box', resize: 'vertical' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#003b70', marginBottom: '6px' }}>
                      Giới thiệu bản thân
                    </label>
                    <textarea
                      name="bio"
                      value={form.bio}
                      onChange={handleInputChange}
                      rows={4}
                      placeholder="Giới thiệu đôi nét về bản thân và phương châm tập luyện..."
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box', resize: 'vertical' }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: SECURITY & PASSWORD */}
            {activeTab === 'security' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '460px' }}>
                <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '14px 16px', border: '1px solid #e2e8f0', fontSize: '0.85rem', color: '#475569' }}>
                  <div style={{ fontWeight: 700, color: '#003b70', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Lock size={15} color="#00a4e4" /> Quy tắc mật khẩu
                  </div>
                  Mật khẩu mới cần tối thiểu <strong>8 ký tự</strong>, có thể gồm chữ, số và ký tự đặc biệt.
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#003b70', marginBottom: '6px' }}>
                    Mật khẩu hiện tại
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      name="currentPassword"
                      value={form.currentPassword}
                      onChange={handleInputChange}
                      placeholder="Nhập mật khẩu hiện tại..."
                      
                      style={{ width: '100%', padding: '10px 42px 10px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
                    >
                      {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#003b70', marginBottom: '6px' }}>
                    Mật khẩu mới (8 ký tự trở lên)
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      name="newPassword"
                      value={form.newPassword}
                      onChange={handleInputChange}
                      placeholder="Nhập mật khẩu mới..."
                      
                      style={{ width: '100%', padding: '10px 42px 10px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
                    >
                      {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#003b70', marginBottom: '6px' }}>
                    Xác nhận mật khẩu mới
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      name="confirmPassword"
                      value={form.confirmPassword}
                      onChange={handleInputChange}
                      placeholder="Nhập lại mật khẩu mới..."
                      
                      style={{ width: '100%', padding: '10px 42px 10px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Bottom Actions */}
            <div style={{ marginTop: '28px', borderTop: '1px solid #e2e8f0', paddingTop: '20px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="submit"
                disabled={loading || uploading}
                style={{
                  background: 'linear-gradient(135deg, #003b70 0%, #00a4e4 100%)',
                  color: '#ffffff',
                  border: 'none',
                  padding: '12px 28px',
                  borderRadius: '10px',
                  fontWeight: 700,
                  fontSize: '0.92rem',
                  cursor: loading || uploading ? 'wait' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(0, 59, 112, 0.25)',
                  transition: 'all 0.2s',
                  opacity: loading || uploading ? 0.7 : 1,
                }}
              >
                <Save size={18} />
                <span>{loading ? 'Đang lưu...' : 'Lưu thay đổi'}</span>
              </button>
            </div>

          </div>
        </div>
      </form>
    </div>
  );
}
