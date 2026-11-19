import { useCallback, useEffect, useState } from 'react';
import { api } from '../../services/api';
import { useToast } from '../ui/ToastProvider';
import AdminTransferDirectForm from './AdminTransferDirectForm';
import AdminTransferHistoryTable from './AdminTransferHistoryTable';
import { errorMessage } from '../../types';
import type { PaginationMeta } from '../../types';
import { ArrowRightLeft, Users, UserCheck, Phone, Search } from 'lucide-react';

export interface TransferRecord {
  _id: string;
  customerId: {
    _id: string;
    fullName?: string;
    phone?: string;
  } | string;
  fromPtId: string;
  fromPtName: string;
  toPtId: string;
  toPtName: string;
  reason: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED' | 'ADMIN_FORCED';
  resolvedByName?: string;
  resolvedAt?: string;
  createdAt: string;
}

export interface CustomerOption {
  _id: string;
  fullName: string;
  phone: string;
  status?: string;
  assignedPtId?: {
    _id: string;
    fullName?: string;
    username?: string;
  } | string;
}

export interface PtOption {
  _id: string;
  fullName?: string;
  username: string;
  phone?: string;
}

export default function AdminTransfersView() {
  const toast = useToast();

  const [transfers, setTransfers] = useState<TransferRecord[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, totalPages: 0, total: 0 });
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');

  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [pts, setPts] = useState<PtOption[]>([]);
  const [preSelectedCustId, setPreSelectedCustId] = useState<string>('');
  const [activeTabSub, setActiveTabSub] = useState<'form' | 'customers' | 'history'>('form');

  const loadOptions = useCallback(async () => {
    try {
      const [cRes, pRes] = await Promise.all([
        api.get<CustomerOption[]>('/api/customers?limit=100'),
        api.get<PtOption[]>('/api/users?role=PT&limit=100'),
      ]);

      const custList = Array.isArray(cRes.data)
        ? cRes.data
        : (cRes.data as any)?.customers || [];
      const ptList = Array.isArray(pRes.data)
        ? pRes.data
        : (pRes.data as any)?.users || [];

      setCustomers(custList);
      setPts(ptList);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }, []);

  const loadTransfers = useCallback(
    async (page = 1, status = statusFilter) => {
      try {
        setLoading(true);
        const params = new URLSearchParams({ page: String(page), limit: '15' });
        if (status) params.set('status', status);

        const res = await api.get<TransferRecord[]>(`/api/transfers?${params.toString()}`);
        setTransfers(res.data || []);
        setMeta(res.meta || { page, totalPages: 1, total: (res.data || []).length });
      } catch (err) {
        toast.error(errorMessage(err));
      } finally {
        setLoading(false);
      }
    },
    [statusFilter]
  );

  useEffect(() => {
    void loadOptions();
    void loadTransfers(1);
  }, []);

  const handleSelectCustomerToTransfer = (cust: CustomerOption) => {
    setPreSelectedCustId(cust._id);
    setActiveTabSub('form');
    toast.info(`Đã chọn học viên: ${cust.fullName}. Vui lòng chọn PT tiếp nhận phía trên.`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#003b70', margin: 0 }}>
          Điều chuyển khách hàng
        </h2>

        {/* Tab Toggle */}
        <div style={{ display: 'flex', background: '#e2e8f0', borderRadius: '8px', padding: '3px', gap: '2px' }}>
          <button
            type="button"
            onClick={() => setActiveTabSub('form')}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              border: 0,
              background: activeTabSub === 'form' ? '#ffffff' : 'transparent',
              color: activeTabSub === 'form' ? '#003b70' : '#64748b',
              fontWeight: activeTabSub === 'form' ? 750 : 550,
              fontSize: '0.78rem',
              cursor: 'pointer',
              boxShadow: activeTabSub === 'form' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <ArrowRightLeft size={13} />
            <span>Tạo lệnh chuyển</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTabSub('customers')}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              border: 0,
              background: activeTabSub === 'customers' ? '#ffffff' : 'transparent',
              color: activeTabSub === 'customers' ? '#003b70' : '#64748b',
              fontWeight: activeTabSub === 'customers' ? 750 : 550,
              fontSize: '0.78rem',
              cursor: 'pointer',
              boxShadow: activeTabSub === 'customers' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Users size={13} />
            <span>Danh sách học viên ({customers.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTabSub('history')}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              border: 0,
              background: activeTabSub === 'history' ? '#ffffff' : 'transparent',
              color: activeTabSub === 'history' ? '#003b70' : '#64748b',
              fontWeight: activeTabSub === 'history' ? 750 : 550,
              fontSize: '0.78rem',
              cursor: 'pointer',
              boxShadow: activeTabSub === 'history' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            <span>Lịch sử ({meta.total || transfers.length})</span>
          </button>
        </div>
      </div>

      {/* Main Content theo Sub Tab */}
      {activeTabSub === 'form' && (
        <>
          <AdminTransferDirectForm
            customers={customers}
            pts={pts}
            preSelectedCustomerId={preSelectedCustId}
            onSuccess={() => {
              void loadOptions();
              void loadTransfers(1);
            }}
          />
          <AdminTransferHistoryTable
            transfers={transfers}
            meta={meta}
            loading={loading}
            statusFilter={statusFilter}
            onStatusFilterChange={(status) => {
              setStatusFilter(status);
              void loadTransfers(1, status);
            }}
            onRefresh={() => void loadTransfers(meta.page)}
            onPageChange={(page) => void loadTransfers(page)}
          />
        </>
      )}

      {activeTabSub === 'customers' && (
        <div
          style={{
            background: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 10px rgba(0, 59, 112, 0.04)',
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '14px 18px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 750, color: '#003b70' }}>
              Chọn nhanh học viên cần điều chuyển
            </h3>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '10px 14px', fontWeight: 750 }}>Học viên</th>
                  <th style={{ padding: '10px 14px', fontWeight: 750 }}>Số điện thoại</th>
                  <th style={{ padding: '10px 14px', fontWeight: 750 }}>PT Hiện Tại</th>
                  <th style={{ padding: '10px 14px', fontWeight: 750, textAlign: 'right' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {customers.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: '32px 14px', textAlign: 'center', color: '#64748b' }}>
                      Chưa có học viên nào trong hệ thống.
                    </td>
                  </tr>
                ) : (
                  customers.map((c) => {
                    const ptName =
                      typeof c.assignedPtId === 'object' && c.assignedPtId
                        ? c.assignedPtId.fullName || c.assignedPtId.username
                        : 'Chưa có PT';
                    return (
                      <tr key={c._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 14px', fontWeight: 750, color: '#003b70' }}>{c.fullName}</td>
                        <td style={{ padding: '10px 14px', color: '#475569' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <Phone size={11} color="#64748b" />
                            {c.phone}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              background: '#f0fdf4',
                              color: '#166534',
                              fontWeight: 700,
                              fontSize: '0.74rem',
                            }}
                          >
                            <UserCheck size={11} color="#16a34a" />
                            <span>{ptName}</span>
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                          <button
                            type="button"
                            onClick={() => handleSelectCustomerToTransfer(c)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '5px 12px',
                              borderRadius: '6px',
                              border: '1px solid #bae6fd',
                              background: '#f0f9ff',
                              color: '#0284c7',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            <ArrowRightLeft size={12} />
                            <span>Chọn chuyển PT</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTabSub === 'history' && (
        <AdminTransferHistoryTable
          transfers={transfers}
          meta={meta}
          loading={loading}
          statusFilter={statusFilter}
          onStatusFilterChange={(status) => {
            setStatusFilter(status);
            void loadTransfers(1, status);
          }}
          onRefresh={() => void loadTransfers(meta.page)}
          onPageChange={(page) => void loadTransfers(page)}
        />
      )}
    </div>
  );
}
