import { useEffect, useRef, useState } from 'react';
import {
  ArrowRightLeft,
  RefreshCw,
  Search,
  Check,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react';
import { api } from '../../services/api';
import { useToast } from '../ui/ToastProvider';
import { errorMessage } from '../../types';
import type { CustomerOption, PtOption } from './AdminTransfersView';

interface AdminTransferDirectFormProps {
  customers: CustomerOption[];
  pts: PtOption[];
  preSelectedCustomerId?: string;
  onSuccess: () => void;
}

const QUICK_REASONS = [
  'Đổi ca tập theo nguyện vọng học viên',
  'PT cũ nghỉ phép / chuyển cơ sở',
  'Điều phối lại khối lượng công việc giữa các PT',
  'Học viên yêu cầu đổi Huấn luyện viên mới',
];

export default function AdminTransferDirectForm({
  customers,
  pts,
  preSelectedCustomerId,
  onSuccess,
}: AdminTransferDirectFormProps) {
  const toast = useToast();
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>(
    preSelectedCustomerId ? [preSelectedCustomerId] : []
  );
  const [selectedToPtId, setSelectedToPtId] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [searchCustomerText, setSearchCustomerText] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (preSelectedCustomerId) {
      setSelectedCustomerIds((prev) =>
        prev.includes(preSelectedCustomerId) ? prev : [...prev, preSelectedCustomerId]
      );
    }
  }, [preSelectedCustomerId]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Lọc danh sách khách hàng theo ô tìm kiếm
  const filteredCustomers = customers.filter((c) => {
    if (!searchCustomerText.trim()) return true;
    const term = searchCustomerText.toLowerCase();
    return (
      c.fullName.toLowerCase().includes(term) ||
      (c.phone && c.phone.includes(term))
    );
  });

  const isAllSelected =
    filteredCustomers.length > 0 &&
    filteredCustomers.every((c) => selectedCustomerIds.includes(c._id));
  const isPartiallySelected =
    filteredCustomers.some((c) => selectedCustomerIds.includes(c._id)) && !isAllSelected;

  const handleToggleSelectAll = () => {
    const filteredIds = filteredCustomers.map((c) => c._id);
    if (isAllSelected) {
      setSelectedCustomerIds((prev) => prev.filter((id) => !filteredIds.includes(id)));
    } else {
      setSelectedCustomerIds((prev) => Array.from(new Set([...prev, ...filteredIds])));
    }
  };

  const handleToggleCustomer = (id: string) => {
    setSelectedCustomerIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const getDropdownLabel = () => {
    if (selectedCustomerIds.length === 0) {
      return `-- Bấm chọn khách hàng (${customers.length} khách) --`;
    }
    if (selectedCustomerIds.length === 1) {
      const single = customers.find((c) => c._id === selectedCustomerIds[0]);
      if (single) {
        const ptName =
          typeof single.assignedPtId === 'object' && single.assignedPtId
            ? single.assignedPtId.fullName || single.assignedPtId.username
            : 'Chưa có PT';
        return `${single.fullName} (${single.phone}) — [PT: ${ptName}]`;
      }
      return `Đã chọn 1 khách hàng`;
    }
    return `Đã chọn ${selectedCustomerIds.length} khách hàng điều chuyển`;
  };

  const handleDirectTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedCustomerIds.length === 0) {
      toast.error('Vui lòng chọn ít nhất một khách hàng cần điều chuyển.');
      return;
    }
    if (!selectedToPtId) {
      toast.error('Vui lòng chọn Huấn luyện viên tiếp nhận.');
      return;
    }
    if (!transferReason.trim()) {
      toast.error('Vui lòng nhập lý do điều chuyển.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.post<{ transferredCount?: number; toPtName?: string }>(
        '/api/transfers/admin-force-batch',
        {
          customerIds: selectedCustomerIds,
          toPtId: selectedToPtId,
          reason: transferReason.trim(),
        }
      );

      const count = res.data?.transferredCount || selectedCustomerIds.length;
      const ptName = res.data?.toPtName || 'PT mới';
      toast.success(`Đã điều chuyển thành công ${count} khách hàng sang PT ${ptName}!`);
      setSelectedCustomerIds([]);
      setSelectedToPtId('');
      setTransferReason('');
      setSearchCustomerText('');
      setIsDropdownOpen(false);
      onSuccess();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        background: '#ffffff',
        borderRadius: '14px',
        border: '1.5px solid #e2e8f0',
        boxShadow: '0 4px 16px rgba(0, 59, 112, 0.06)',
        padding: '20px 24px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: '#003b70',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <ArrowRightLeft size={18} />
        </div>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.02rem', fontWeight: 750, color: '#003b70' }}>
            Tạo lệnh điều chuyển trực tiếp (Admin Force)
          </h3>
          <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#64748b' }}>
            Chọn một hoặc tích chọn nhiều khách hàng trong menu để điều chuyển cùng lúc
          </p>
        </div>
      </div>

      <form onSubmit={handleDirectTransfer} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
          {/* 1. Chọn khách hàng (Dropdown gọn gàng có Search & Checkbox) */}
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '6px',
              }}
            >
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e293b' }}>
                1. Chọn Khách hàng cần chuyển <span style={{ color: '#dc2626' }}>*</span>
              </label>
              {selectedCustomerIds.length > 0 && (
                <span
                  style={{
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    color: '#0284c7',
                    background: '#e0f2fe',
                    padding: '1px 8px',
                    borderRadius: '12px',
                  }}
                >
                  Đã chọn: {selectedCustomerIds.length}
                </span>
              )}
            </div>

            {/* Dropdown Box Trigger */}
            <div ref={dropdownRef} style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setIsDropdownOpen((prev) => !prev)}
                style={{
                  width: '100%',
                  height: '42px',
                  padding: '0 12px',
                  borderRadius: '8px',
                  border: isDropdownOpen ? '1.5px solid #003b70' : '1.5px solid #cbd5e1',
                  fontSize: '0.84rem',
                  background: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  boxShadow: isDropdownOpen ? '0 0 0 3px rgba(0, 59, 112, 0.1)' : 'none',
                  transition: 'all 0.15s ease',
                  boxSizing: 'border-box',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                  }}
                >
                  {selectedCustomerIds.length > 1 && (
                    <span
                      style={{
                        background: '#003b70',
                        color: '#ffffff',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        padding: '1px 6px',
                        borderRadius: '10px',
                        flexShrink: 0,
                      }}
                    >
                      {selectedCustomerIds.length}
                    </span>
                  )}
                  <span
                    style={{
                      color: selectedCustomerIds.length > 0 ? '#003b70' : '#64748b',
                      fontWeight: selectedCustomerIds.length > 0 ? 650 : 400,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {getDropdownLabel()}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                  {selectedCustomerIds.length > 0 && (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedCustomerIds([]);
                      }}
                      title="Bỏ chọn tất cả"
                      style={{
                        color: '#94a3b8',
                        padding: '2px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      <X size={14} />
                    </span>
                  )}
                  {isDropdownOpen ? <ChevronUp size={16} color="#64748b" /> : <ChevronDown size={16} color="#64748b" />}
                </div>
              </button>

              {/* Popover Menu khi mở Dropdown */}
              {isDropdownOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 5px)',
                    left: 0,
                    right: 0,
                    background: '#ffffff',
                    borderRadius: '10px',
                    border: '1.5px solid #cbd5e1',
                    boxShadow: '0 12px 28px -4px rgba(0, 0, 0, 0.15), 0 4px 10px rgba(0, 0, 0, 0.05)',
                    zIndex: 50,
                    overflow: 'hidden',
                  }}
                >
                  {/* Ô tìm kiếm Search */}
                  <div style={{ padding: '8px 10px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                    <div style={{ position: 'relative' }}>
                      <Search
                        size={14}
                        style={{
                          position: 'absolute',
                          left: '10px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          color: '#94a3b8',
                        }}
                      />
                      <input
                        type="text"
                        placeholder="Tìm theo họ tên hoặc SĐT..."
                        value={searchCustomerText}
                        onChange={(e) => setSearchCustomerText(e.target.value)}
                        autoFocus
                        style={{
                          width: '100%',
                          height: '34px',
                          padding: '0 10px 0 32px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          fontSize: '0.78rem',
                          outline: 'none',
                          background: '#ffffff',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                  </div>

                  {/* Header "Chọn tất cả" */}
                  <div
                    onClick={handleToggleSelectAll}
                    style={{
                      padding: '8px 12px',
                      background: '#ffffff',
                      borderBottom: '1px solid #e2e8f0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      userSelect: 'none',
                    }}
                  >
                    <label
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '0.78rem',
                        fontWeight: 750,
                        color: '#003b70',
                        cursor: 'pointer',
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = isPartiallySelected;
                        }}
                        onChange={handleToggleSelectAll}
                        style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#003b70' }}
                      />
                      <span>Chọn tất cả ({filteredCustomers.length} khách)</span>
                    </label>

                    <span style={{ fontSize: '0.73rem', fontWeight: 650, color: '#0284c7' }}>
                      Đã chọn: {selectedCustomerIds.length}
                    </span>
                  </div>

                  {/* Danh sách cuộn từng khách hàng */}
                  <div
                    style={{
                      maxHeight: '220px',
                      overflowY: 'auto',
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    {filteredCustomers.length === 0 ? (
                      <div style={{ padding: '16px', textAlign: 'center', color: '#94a3b8', fontSize: '0.78rem' }}>
                        Không tìm thấy khách hàng nào phù hợp.
                      </div>
                    ) : (
                      filteredCustomers.map((c) => {
                        const isChecked = selectedCustomerIds.includes(c._id);
                        const ptName =
                          typeof c.assignedPtId === 'object' && c.assignedPtId
                            ? c.assignedPtId.fullName || c.assignedPtId.username
                            : 'Chưa có PT';

                        return (
                          <div
                            key={c._id}
                            onClick={() => handleToggleCustomer(c._id)}
                            style={{
                              padding: '8px 12px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              borderBottom: '1px solid #f1f5f9',
                              background: isChecked ? '#f0f9ff' : '#ffffff',
                              cursor: 'pointer',
                              transition: 'background 0.12s ease',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleCustomer(c._id)}
                              onClick={(e) => e.stopPropagation()}
                              style={{ width: '15px', height: '15px', cursor: 'pointer', accentColor: '#003b70', flexShrink: 0 }}
                            />
                            <div style={{ minWidth: 0, flex: 1, fontSize: '0.78rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                <strong style={{ color: isChecked ? '#003b70' : '#1e293b' }}>
                                  {c.fullName}
                                </strong>
                                <span style={{ color: '#64748b', fontSize: '0.74rem' }}>
                                  ({c.phone})
                                </span>
                              </div>
                              <div style={{ fontSize: '0.71rem', color: '#64748b', marginTop: '1px' }}>
                                PT hiện tại: <span style={{ color: '#0369a1', fontWeight: 600 }}>{ptName}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Footer nhỏ của dropdown */}
                  <div
                    style={{
                      padding: '8px 12px',
                      background: '#f8fafc',
                      borderTop: '1px solid #e2e8f0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                      Đã chọn <strong>{selectedCustomerIds.length}</strong> / {customers.length} khách
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsDropdownOpen(false)}
                      style={{
                        padding: '3px 10px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        background: '#ffffff',
                        color: '#003b70',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Đóng
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 2. Chọn PT nhận mới */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#1e293b', marginBottom: '6px' }}>
              2. Chọn Huấn luyện viên tiếp nhận <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <select
              value={selectedToPtId}
              onChange={(e) => setSelectedToPtId(e.target.value)}
              required
              style={{
                width: '100%',
                height: '42px',
                padding: '0 12px',
                borderRadius: '8px',
                border: '1.5px solid #cbd5e1',
                fontSize: '0.84rem',
                background: '#ffffff',
                outline: 'none',
                cursor: 'pointer',
                boxSizing: 'border-box',
              }}
            >
              <option value="">-- Chọn PT nhận bàn giao ({pts.length} PT) --</option>
              {pts.map((p) => (
                <option key={p._id} value={p._id}>
                  PT: {p.fullName || p.username} ({p.phone || 'Chưa có SĐT'})
                </option>
              ))}
            </select>

            {pts.length <= 1 && (
              <div
                style={{
                  marginTop: '8px',
                  padding: '8px 12px',
                  background: '#fffbeb',
                  border: '1px solid #fef3c7',
                  borderRadius: '8px',
                  fontSize: '0.76rem',
                  color: '#b45309',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <AlertCircle size={14} />
                <span>Hệ thống cần ít nhất 2 Huấn luyện viên để thực hiện điều chuyển.</span>
              </div>
            )}
          </div>
        </div>

        {/* 3. Lý do điều chuyển */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e293b' }}>
              3. Lý do điều chuyển khách hàng <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Chọn mẫu hoặc tự nhập</span>
          </div>

          {/* Gợi ý lý do nhanh */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
            {QUICK_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setTransferReason(r)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: transferReason === r ? '1px solid #003b70' : '1px solid #e2e8f0',
                  background: transferReason === r ? '#f0f9ff' : '#f8fafc',
                  color: transferReason === r ? '#003b70' : '#475569',
                  fontSize: '0.73rem',
                  fontWeight: transferReason === r ? 700 : 500,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                {transferReason === r && <Check size={11} />}
                <span>{r}</span>
              </button>
            ))}
          </div>

          <input
            type="text"
            required
            placeholder="Nhập lý do điều chuyển học viên..."
            value={transferReason}
            onChange={(e) => setTransferReason(e.target.value)}
            style={{
              width: '100%',
              height: '40px',
              padding: '0 12px',
              borderRadius: '8px',
              border: '1.5px solid #cbd5e1',
              fontSize: '0.82rem',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Submit Action */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '6px', borderTop: '1px solid #f1f5f9' }}>
          <button
            type="submit"
            disabled={submitting || selectedCustomerIds.length === 0 || !selectedToPtId || !transferReason.trim()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 24px',
              borderRadius: '8px',
              border: 0,
              background:
                selectedCustomerIds.length === 0 || !selectedToPtId || !transferReason.trim()
                  ? '#94a3b8'
                  : '#003b70',
              color: '#ffffff',
              fontSize: '0.85rem',
              fontWeight: 750,
              cursor:
                selectedCustomerIds.length === 0 || !selectedToPtId || !transferReason.trim()
                  ? 'not-allowed'
                  : 'pointer',
              boxShadow: '0 2px 8px rgba(0, 59, 112, 0.25)',
              transition: 'all 0.15s ease',
            }}
          >
            {submitting ? (
              <>
                <RefreshCw size={15} className="animate-spin" />
                <span>Đang điều chuyển...</span>
              </>
            ) : (
              <>
                <ArrowRightLeft size={15} />
                <span>
                  {selectedCustomerIds.length > 1
                    ? `Xác nhận điều chuyển (${selectedCustomerIds.length} khách)`
                    : 'Xác nhận điều chuyển ngay'}
                </span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
