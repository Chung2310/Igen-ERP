import { useState } from 'react';
import { X } from 'lucide-react';
import { api } from '../../services/api';
import { useToast } from '../ui/ToastProvider';
import { errorMessage } from '../../types';
import type { CustomerAdminRecord, PtOption } from './AdminCustomersView';

interface AdminCustomerFormModalProps {
  customer: CustomerAdminRecord | null;
  pts: PtOption[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function AdminCustomerFormModal({
  customer,
  pts,
  onClose,
  onSuccess,
}: AdminCustomerFormModalProps) {
  const toast = useToast();

  const getPtId = (c: CustomerAdminRecord | null): string => {
    if (!c || !c.assignedPtId) return pts.length > 0 ? pts[0]._id : '';
    if (typeof c.assignedPtId === 'object') return c.assignedPtId._id;
    return String(c.assignedPtId);
  };

  const [formData, setFormData] = useState({
    fullName: customer?.fullName || '',
    phone: customer?.phone || '',
    email: customer?.email || '',
    gender: (customer?.gender || 'FEMALE') as 'MALE' | 'FEMALE' | 'OTHER',
    height: customer?.height ?? '',
    initialWeight: customer?.initialWeight ?? '',
    initialGoal: customer?.initialGoal || '',
    medicalNotes: customer?.medicalNotes || '',
    status: (customer?.status || 'ACTIVE') as 'ACTIVE' | 'INACTIVE' | 'LEAD',
    assignedPtId: getPtId(customer),
  });

  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName.trim() || !formData.phone.trim()) {
      toast.error('Vui lòng nhập họ tên và số điện thoại.');
      return;
    }
    if (!formData.assignedPtId) {
      toast.error('Vui lòng chọn PT phụ trách.');
      return;
    }

    try {
      setSubmitting(true);
      const { assignedPtId, ...profileFields } = formData;
      const payload = {
        ...profileFields,
        height: formData.height ? Number(formData.height) : undefined,
        initialWeight: formData.initialWeight ? Number(formData.initialWeight) : undefined,
      };

      if (customer) {
        await api.patch(`/api/customers/${customer._id}`, payload);
        toast.success('Cập nhật thông tin khách hàng thành công!');
      } else {
        await api.post('/api/customers', { ...payload, assignedPtId });
        toast.success('Thêm khách hàng mới thành công!');
      }
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10050,
        padding: '16px',
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '14px',
          maxWidth: '560px',
          width: '100%',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
          overflow: 'hidden',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            padding: '14px 18px',
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 750, color: '#003b70' }}>
            {customer ? 'Chỉnh sửa hồ sơ khách hàng' : 'Thêm khách hàng mới'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            style={{ border: 0, background: 'transparent', color: '#94a3b8', cursor: 'pointer' }}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto', padding: '16px 18px', gap: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                Họ và tên <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Nguyễn Văn A"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                style={{ width: '100%', height: '36px', padding: '0 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                Số điện thoại <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="text"
                required
                placeholder="0912345678"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                style={{ width: '100%', height: '36px', padding: '0 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                Email
              </label>
              <input
                type="email"
                placeholder="email@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                style={{ width: '100%', height: '36px', padding: '0 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                Huấn luyện viên phụ trách <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <select
                value={formData.assignedPtId}
                onChange={(e) => setFormData({ ...formData, assignedPtId: e.target.value })}
                required
                style={{ width: '100%', height: '36px', padding: '0 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem', background: '#fff', boxSizing: 'border-box' }}
              >
                <option value="">-- Chọn PT phụ trách --</option>
                {pts.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.fullName || p.username}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                Giới tính
              </label>
              <select
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value as any })}
                style={{ width: '100%', height: '36px', padding: '0 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem', background: '#fff', boxSizing: 'border-box' }}
              >
                <option value="FEMALE">Nữ</option>
                <option value="MALE">Nam</option>
                <option value="OTHER">Khác</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                Chiều cao (cm)
              </label>
              <input
                type="number"
                step="any"
                placeholder="165"
                value={formData.height}
                onChange={(e) => setFormData({ ...formData, height: e.target.value })}
                style={{ width: '100%', height: '36px', padding: '0 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                Cân nặng (kg)
              </label>
              <input
                type="number"
                step="any"
                placeholder="58"
                value={formData.initialWeight}
                onChange={(e) => setFormData({ ...formData, initialWeight: e.target.value })}
                style={{ width: '100%', height: '36px', padding: '0 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
              Mục tiêu ban đầu
            </label>
            <input
              type="text"
              placeholder="Giảm 3kg mỡ, săn chắc cơ đùi và eo..."
              value={formData.initialGoal}
              onChange={(e) => setFormData({ ...formData, initialGoal: e.target.value })}
              style={{ width: '100%', height: '36px', padding: '0 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
              Ghi chú y tế / Tiền sử chấn thương
            </label>
            <textarea
              placeholder="Đau khớp gối nhẹ khi squat sâu, tiền sử thoái hóa đốt sống L5..."
              rows={2}
              value={formData.medicalNotes}
              onChange={(e) => setFormData({ ...formData, medicalNotes: e.target.value })}
              style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box', fontFamily: 'inherit' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
              Trạng thái
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
              style={{ width: '100%', height: '36px', padding: '0 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem', background: '#fff', boxSizing: 'border-box' }}
            >
              <option value="ACTIVE">Đang hoạt động (ACTIVE)</option>
              <option value="INACTIVE">Tạm ngưng (INACTIVE)</option>
              <option value="LEAD">Tiềm năng (LEAD)</option>
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: '7px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#64748b', fontSize: '0.82rem', fontWeight: 650, cursor: 'pointer' }}
            >
              Đóng
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{ padding: '7px 16px', borderRadius: '8px', border: 0, background: '#003b70', color: '#ffffff', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}
            >
              {customer ? 'Lưu thay đổi' : 'Tạo khách hàng'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
