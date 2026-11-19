import {
  RefreshCw,
  ArrowRightLeft,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Clock,
  XCircle,
} from 'lucide-react';
import Pagination from '../ui/Pagination';
import type { PaginationMeta } from '../../types';
import type { TransferRecord } from './AdminTransfersView';

interface AdminTransferHistoryTableProps {
  transfers: TransferRecord[];
  meta: PaginationMeta;
  loading: boolean;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  onRefresh: () => void;
  onPageChange: (page: number) => void;
}

export default function AdminTransferHistoryTable({
  transfers,
  meta,
  loading,
  statusFilter,
  onStatusFilterChange,
  onRefresh,
  onPageChange,
}: AdminTransferHistoryTableProps) {
  const renderStatusBadge = (status: TransferRecord['status']) => {
    switch (status) {
      case 'ADMIN_FORCED':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontWeight: 750,
              background: '#ede9fe',
              color: '#6d28d9',
              border: '1px solid #ddd6fe',
              whiteSpace: 'nowrap',
            }}
          >
            <ShieldCheck size={13} />
            <span>Admin điều chuyển</span>
          </span>
        );
      case 'ACCEPTED':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontWeight: 750,
              background: '#dcfce7',
              color: '#15803d',
              border: '1px solid #bbf7d0',
              whiteSpace: 'nowrap',
            }}
          >
            <CheckCircle2 size={13} />
            <span>Đã tiếp nhận</span>
          </span>
        );
      case 'PENDING':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontWeight: 750,
              background: '#fef3c7',
              color: '#b45309',
              border: '1px solid #fde68a',
              whiteSpace: 'nowrap',
            }}
          >
            <Clock size={13} />
            <span>Chờ tiếp nhận</span>
          </span>
        );
      case 'REJECTED':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontWeight: 750,
              background: '#fee2e2',
              color: '#b91c1c',
              border: '1px solid #fecaca',
              whiteSpace: 'nowrap',
            }}
          >
            <XCircle size={13} />
            <span>Đã từ chối</span>
          </span>
        );
      default:
        return <span style={{ fontSize: '0.75rem', color: '#64748b', whiteSpace: 'nowrap' }}>{status}</span>;
    }
  };

  return (
    <div
      style={{
        background: '#ffffff',
        borderRadius: '14px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 2px 12px rgba(0, 59, 112, 0.05)',
        overflow: 'hidden',
      }}
    >
      {/* Toolbar Lịch Sử */}
      <div
        style={{
          padding: '14px 18px',
          background: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 750, color: '#003b70' }}>
            Lịch sử điều chuyển khách hàng
          </h3>
          <span style={{ fontSize: '0.76rem', color: '#64748b', fontWeight: 600 }}>
            (Tổng cộng: {meta.total || transfers.length} lượt)
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <select
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
            style={{
              height: '36px',
              padding: '0 12px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontSize: '0.8rem',
              background: '#ffffff',
              color: '#1e293b',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="ADMIN_FORCED">Admin điều chuyển</option>
            <option value="ACCEPTED">Đã tiếp nhận (ACCEPTED)</option>
            <option value="PENDING">Chờ tiếp nhận (PENDING)</option>
            <option value="REJECTED">Đã từ chối (REJECTED)</option>
          </select>

          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            style={{
              height: '36px',
              padding: '0 12px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#003b70',
              fontSize: '0.8rem',
              fontWeight: 650,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Tải lại</span>
          </button>
        </div>
      </div>

      {/* Table Content */}
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table style={{ width: '100%', minWidth: '780px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.84rem' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              <th style={{ padding: '12px 16px', fontWeight: 750, minWidth: '150px' }}>Học viên</th>
              <th style={{ padding: '12px 16px', fontWeight: 750, minWidth: '240px', whiteSpace: 'nowrap' }}>Lộ trình Chuyển giao</th>
              <th style={{ padding: '12px 16px', fontWeight: 750, minWidth: '220px' }}>Lý do chuyển</th>
              <th style={{ padding: '12px 16px', fontWeight: 750, minWidth: '160px', whiteSpace: 'nowrap' }}>Trạng thái</th>
              <th style={{ padding: '12px 16px', fontWeight: 750, minWidth: '160px', whiteSpace: 'nowrap' }}>Người xử lý / Thời gian</th>
            </tr>
          </thead>
          <tbody>
            {loading && transfers.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '40px 16px', textAlign: 'center', color: '#64748b' }}>
                  <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 8px', color: '#0284c7' }} />
                  <p style={{ margin: 0, fontSize: '0.84rem' }}>Đang tải lịch sử điều chuyển...</p>
                </td>
              </tr>
            ) : transfers.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '40px 16px', textAlign: 'center', color: '#64748b' }}>
                  <ArrowRightLeft size={32} style={{ color: '#cbd5e1', margin: '0 auto 8px' }} />
                  <p style={{ margin: 0, fontWeight: 700, color: '#1e293b' }}>Chưa có bản ghi điều chuyển nào</p>
                </td>
              </tr>
            ) : (
              transfers.map((t) => {
                const custName = typeof t.customerId === 'object' && t.customerId?.fullName ? t.customerId.fullName : 'Học viên';
                const custPhone = typeof t.customerId === 'object' && t.customerId?.phone ? t.customerId.phone : '';
                return (
                  <tr key={t._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 750, color: '#003b70', fontSize: '0.86rem' }}>{custName}</div>
                      {custPhone && <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '2px' }}>{custPhone}</div>}
                    </td>

                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem' }}>
                        <span style={{ color: '#475569', fontWeight: 650 }}>{t.fromPtName || 'PT cũ'}</span>
                        <ArrowRight size={14} color="#0284c7" />
                        <span style={{ color: '#166534', fontWeight: 750 }}>{t.toPtName || 'PT mới'}</span>
                      </div>
                    </td>

                    <td style={{ padding: '12px 16px', maxWidth: '300px' }}>
                      <div style={{ fontSize: '0.82rem', color: '#334155', lineHeight: 1.45, wordBreak: 'break-word' }}>
                        {t.reason || '—'}
                      </div>
                    </td>

                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                      {renderStatusBadge(t.status)}
                    </td>

                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                      <div style={{ fontSize: '0.78rem', color: '#1e293b', fontWeight: 650 }}>
                        {t.resolvedByName ? `Bởi: ${t.resolvedByName}` : '—'}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px' }}>
                        {new Date(t.createdAt).toLocaleDateString('vi-VN')} {new Date(t.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {meta.totalPages > 1 && (
        <div style={{ padding: '12px 16px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'center' }}>
          <Pagination
            page={meta.page}
            totalPages={meta.totalPages}
            onPageChange={onPageChange}
          />
        </div>
      )}
    </div>
  );
}
