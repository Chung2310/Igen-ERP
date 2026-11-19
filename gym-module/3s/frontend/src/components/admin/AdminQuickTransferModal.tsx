import { useState } from 'react';
import { ArrowRightLeft, RefreshCw, X } from 'lucide-react';
import { api } from '../../services/api';
import { useToast } from '../ui/ToastProvider';
import { errorMessage } from '../../types';
import type { CustomerAdminRecord, PtOption } from './AdminCustomersView';

interface AdminQuickTransferModalProps {
  customer: CustomerAdminRecord;
  pts: PtOption[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function AdminQuickTransferModal({
  customer,
  pts,
  onClose,
  onSuccess,
}: AdminQuickTransferModalProps) {
  const toast = useToast();
  const [toPtId, setToPtId] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const getPtName = (c: CustomerAdminRecord) => {
    if (!c.assignedPtId) return 'Chưa gán PT';
    if (typeof c.assignedPtId === 'object') {
      return c.assignedPtId.fullName || c.assignedPtId.username || 'PT';
    }
    const found = pts.find((p) => p._id === c.assignedPtId);
    return found ? found.fullName || found.username : 'PT phụ trách';
  };

  const currentPtId = typeof customer.assignedPtId === 'object' ? customer.assignedPtId?._id : customer.assignedPtId;

  const handleSubmit = async () => {
    if (!toPtId) {
      toast.error('Vui lòng chọn PT nhận mới.');
      return;
    }
    if (!reason.trim()) {
      toast.error('Vui lòng nhập lý do điều chuyển.');
      return;
    }
    try {
      setSubmitting(true);
      await api.post('/api/transfers/admin-force', {
        customerId: customer._id,
        toPtId,
        reason: reason.trim(),
      });
      toast.success(`Đã điều chuyển học viên ${customer.fullName} thành công!`);
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
          maxWidth: '480px',
          width: '100%',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ArrowRightLeft size={18} color="#003b70" />
            <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 750, color: '#003b70' }}>
              Điều chuyển Huấn luyện viên
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ border: 0, background: 'transparent', color: '#94a3b8', cursor: 'pointer' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div
            style={{
              background: '#f0f9ff',
              border: '1px solid #bae6fd',
              borderRadius: '10px',
              padding: '12px 14px',
              fontSize: '0.82rem',
            }}
          >
            <div style={{ fontWeight: 750, color: '#003b70', marginBottom: '4px' }}>
              Học viên: {customer.fullName} ({customer.phone})
            </div>
            <div style={{ color: '#0369a1' }}>
              PT phụ trách hiện tại: <strong>{getPtName(customer)}</strong>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
              Chọn Huấn luyện viên nhận mới <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <select
              value={toPtId}
              onChange={(e) => setToPtId(e.target.value)}
              style={{
                width: '100%',
                height: '40px',
                padding: '0 12px',
                borderRadius: '8px',
                border: '1.5px solid #cbd5e1',
                fontSize: '0.84rem',
                outline: 'none',
                background: '#ffffff',
              }}
            >
              <option value="">-- Chọn PT nhận phụ trách --</option>
              {pts
                .filter((p) => p._id !== currentPtId)
                .map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.fullName || p.username} ({p.phone || 'Chưa có SĐT'})
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
              Lý do điều chuyển <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <textarea
              placeholder="Ví dụ: Đổi ca tập phù hợp lịch học viên, PT cũ nghỉ phép, điều phối khối lượng việc..."
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1.5px solid #cbd5e1',
                fontSize: '0.82rem',
                outline: 'none',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
              }}
            />
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 18px',
            background: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '8px',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '7px 14px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#64748b',
              fontSize: '0.82rem',
              fontWeight: 650,
              cursor: 'pointer',
            }}
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              padding: '7px 16px',
              borderRadius: '8px',
              border: 0,
              background: '#003b70',
              color: '#ffffff',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {submitting && <RefreshCw size={13} className="animate-spin" />}
            <span>Xác nhận điều chuyển</span>
          </button>
        </div>
      </div>
    </div>
  );
}
