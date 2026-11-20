import { useState } from 'react';
import { ArrowRightLeft, RefreshCw, X, Users, AlertCircle } from 'lucide-react';
import { api } from '../../services/api';
import { useToast } from '../ui/ToastProvider';
import { errorMessage } from '../../types';
import type { CustomerAdminRecord, PtOption } from './AdminCustomersView';

interface AdminBulkTransferModalProps {
  selectedCustomers: CustomerAdminRecord[];
  pts: PtOption[];
  onClose: () => void;
  onRemoveCustomer?: (id: string) => void;
  onSuccess: () => void;
}

export default function AdminBulkTransferModal({
  selectedCustomers,
  pts,
  onClose,
  onRemoveCustomer,
  onSuccess,
}: AdminBulkTransferModalProps) {
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

  const handleSubmit = async () => {
    if (selectedCustomers.length === 0) {
      toast.error('Không còn khách hàng nào trong danh sách điều chuyển.');
      return;
    }
    if (!toPtId) {
      toast.error('Vui lòng chọn Huấn luyện viên nhận mới.');
      return;
    }
    if (!reason.trim()) {
      toast.error('Vui lòng nhập lý do điều chuyển.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.post<{ transferredCount: number; toPtName: string }>('/api/transfers/admin-force-batch', {
        customerIds: selectedCustomers.map((c) => c._id),
        toPtId,
        reason: reason.trim(),
      });

      const count = res.data?.transferredCount || selectedCustomers.length;
      const ptName = res.data?.toPtName || 'PT mới';
      toast.success(`Đã điều chuyển thành công ${count} khách hàng sang PT ${ptName}!`);
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
        background: 'rgba(15, 23, 42, 0.55)',
        backdropFilter: 'blur(4px)',
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
          borderRadius: '16px',
          maxWidth: '560px',
          width: '100%',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: '#e0f2fe',
                color: '#0284c7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ArrowRightLeft size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#003b70' }}>
                Điều chuyển hàng loạt ({selectedCustomers.length} khách hàng)
              </h3>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>
                Gán lại Huấn luyện viên phụ trách cho các khách hàng đã chọn
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng modal"
            style={{
              border: 0,
              background: 'transparent',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div
          style={{
            padding: '18px 20px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          {/* Selected Customers Preview List */}
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '8px',
              }}
            >
              <label
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 750,
                  color: '#334155',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Users size={14} color="#0284c7" />
                <span>Danh sách học viên được điều chuyển ({selectedCustomers.length})</span>
              </label>
            </div>

            <div
              style={{
                maxHeight: '160px',
                overflowY: 'auto',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              {selectedCustomers.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '16px', color: '#94a3b8', fontSize: '0.8rem' }}>
                  Không còn học viên nào được chọn.
                </div>
              ) : (
                selectedCustomers.map((c) => (
                  <div
                    key={c._id}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: 750, fontSize: '0.82rem', color: '#003b70' }}>
                          {c.fullName}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          ({c.phone})
                        </span>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                        PT hiện tại:{' '}
                        <strong style={{ color: '#0284c7' }}>{getPtName(c)}</strong>
                      </div>
                    </div>

                    {onRemoveCustomer && selectedCustomers.length > 1 && (
                      <button
                        type="button"
                        onClick={() => onRemoveCustomer(c._id)}
                        title="Loại khỏi danh sách chuyển lần này"
                        style={{
                          border: 0,
                          background: 'transparent',
                          color: '#94a3b8',
                          cursor: 'pointer',
                          padding: '4px',
                          borderRadius: '6px',
                        }}
                      >
                        <X size={15} />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Chọn PT nhận */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.78rem',
                fontWeight: 750,
                color: '#334155',
                marginBottom: '6px',
              }}
            >
              Chọn Huấn luyện viên tiếp nhận mới <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <select
              value={toPtId}
              onChange={(e) => setToPtId(e.target.value)}
              style={{
                width: '100%',
                height: '42px',
                padding: '0 12px',
                borderRadius: '8px',
                border: '1.5px solid #cbd5e1',
                fontSize: '0.84rem',
                outline: 'none',
                background: '#ffffff',
                color: '#1e293b',
              }}
            >
              <option value="">-- Chọn Huấn luyện viên (PT) tiếp nhận --</option>
              {pts.map((p) => (
                <option key={p._id} value={p._id}>
                  PT: {p.fullName || p.username} {p.phone ? `(${p.phone})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Lý do */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.78rem',
                fontWeight: 750,
                color: '#334155',
                marginBottom: '6px',
              }}
            >
              Lý do điều chuyển hàng loạt <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <textarea
              placeholder="Ví dụ: Phân bổ lại khối lượng công việc, thay đổi lịch làm việc hoặc bàn giao chi nhánh..."
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
                resize: 'vertical',
              }}
            />
          </div>

          {/* Alert Info */}
          <div
            style={{
              background: '#f0f9ff',
              border: '1px solid #bae6fd',
              borderRadius: '10px',
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              fontSize: '0.75rem',
              color: '#0369a1',
            }}
          >
            <AlertCircle size={16} className="shrink-0" style={{ marginTop: '1px' }} />
            <div>
              Hệ thống sẽ đồng thời cập nhật Huấn luyện viên phụ trách và chuyển giao toàn bộ các cảnh báo, công việc chăm sóc đang mở sang PT tiếp nhận mới.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 20px',
            background: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            style={{
              padding: '8px 16px',
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
            disabled={submitting || selectedCustomers.length === 0}
            style={{
              padding: '8px 20px',
              borderRadius: '8px',
              border: 0,
              background: '#003b70',
              color: '#ffffff',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 2px 8px rgba(0, 59, 112, 0.25)',
              opacity: selectedCustomers.length === 0 ? 0.6 : 1,
            }}
          >
            {submitting ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                <span>Đang điều chuyển...</span>
              </>
            ) : (
              <>
                <ArrowRightLeft size={14} />
                <span>Xác nhận chuyển ({selectedCustomers.length})</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
