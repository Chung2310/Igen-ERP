import { useEffect, useMemo, useState, type FormEvent } from 'react';
import ProfileFormModal from './ProfileFormModal';
import { useToast } from './ToastProvider';
import { api } from '../../services/api';
import { errorMessage } from '../../types';

export interface FeatureFlagItem {
  key: string;
  name?: string;
  description?: string;
  enabled: boolean;
  roles: string[];
  pilotUserIds?: string[];
}

export interface FeatureFlagModalProps {
  open: boolean;
  feature?: FeatureFlagItem | null;
  onClose: () => void;
  onSaved: () => void;
}

const allRoles = [
  { id: 'ADMIN', label: 'Quản trị viên (ADMIN)' },
  { id: 'PT', label: 'Huấn luyện viên' },
  { id: 'CUSTOMER', label: 'Khách hàng (CUSTOMER)' },
];

export default function FeatureFlagModal({ open, feature, onClose, onSaved }: FeatureFlagModalProps) {
  const toast = useToast();
  const [enabled, setEnabled] = useState(false);
  const [roles, setRoles] = useState<string[]>([]);
  const [pilotUsersText, setPilotUsersText] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (feature && open) {
      setEnabled(feature.enabled);
      setRoles(feature.roles || []);
      setPilotUsersText((feature.pilotUserIds || []).join('\n'));
    }
  }, [feature, open]);

  const initial = useMemo(() => ({
    enabled: feature?.enabled || false,
    roles: feature?.roles || [],
    pilotUsersText: (feature?.pilotUserIds || []).join('\n'),
  }), [feature]);

  const dirty = useMemo(() => {
    return (
      enabled !== initial.enabled ||
      JSON.stringify([...roles].sort()) !== JSON.stringify([...initial.roles].sort()) ||
      pilotUsersText !== initial.pilotUsersText
    );
  }, [enabled, roles, pilotUsersText, initial]);

  const toggleRole = (roleId: string) => {
    setRoles((current) =>
      current.includes(roleId) ? current.filter((r) => r !== roleId) : [...current, roleId]
    );
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!feature) return;

    const pilotUserIds = pilotUsersText
      .split('\n')
      .map((id) => id.trim())
      .filter(Boolean);

    try {
      setLoading(true);
      const result = await api.patch(`/api/features/${feature.key}`, {
        enabled,
        roles,
        pilotUserIds,
      });
      toast.success(result.message || 'Cập nhật tính năng thành công');
      onSaved();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProfileFormModal
      open={open}
      title={`Cấu hình tính năng: ${feature?.key || ''}`}
      description={feature?.description || ''}
      dirty={dirty}
      loading={loading}
      submitLabel="Lưu cấu hình"
      onClose={onClose}
      onSubmit={submit}
    >
      <section className="profile-form-section">
        <h3>Trạng thái kích hoạt</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0' }}>
          <label className="toggle-switch">
            <input
              type="checkbox"
              aria-label="Kích hoạt tính năng"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            <span className="toggle-slider" />
          </label>
          <span style={{ fontWeight: 600, color: enabled ? '#166534' : '#64748b' }}>
            {enabled ? 'Tính năng ĐANG BẬT' : 'Tính năng ĐANG TẮT'}
          </span>
        </div>
      </section>

      <section className="profile-form-section">
        <h3>Vai trò được phép truy cập</h3>
        <div style={{ display: 'grid', gap: '10px', marginTop: '8px' }}>
          {allRoles.map(({ id, label }) => (
            <label
              key={id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 14px',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                backgroundColor: roles.includes(id) ? '#f0fdf4' : '#fff',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={roles.includes(id)}
                onChange={() => toggleRole(id)}
              />
              <span style={{ fontWeight: 600, color: '#1e293b' }}>{label}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="profile-form-section">
        <h3>Tài khoản Pilot (Trải nghiệm sớm)</h3>
        <div className="field">
          <label>Mã User ID (Mỗi ID một dòng)</label>
          <textarea
            rows={3}
            value={pilotUsersText}
            onChange={(e) => setPilotUsersText(e.target.value)}
            placeholder="507f1f77bcf86cd799439011&#10;507f191e810c19729de860ea"
            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontFamily: 'monospace' }}
          />
        </div>
      </section>
    </ProfileFormModal>
  );
}
