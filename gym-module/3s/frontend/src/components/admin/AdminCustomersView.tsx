import { useCallback, useEffect, useState } from 'react';
import {
  Search,
  RotateCcw,
  RefreshCw,
  Plus,
  ArrowRightLeft,
} from 'lucide-react';
import { api } from '../../services/api';
import { useToast } from '../ui/ToastProvider';
import ConfirmModal from '../ui/ConfirmModal';
import CustomSelect from '../ui/CustomSelect';
import AdminCustomerTable from './AdminCustomerTable';
import AdminQuickTransferModal from './AdminQuickTransferModal';
import AdminBulkTransferModal from './AdminBulkTransferModal';
import AdminCustomerFormModal from './AdminCustomerFormModal';
import CustomerAccountModal from '../ui/CustomerAccountModal';
import { errorMessage } from '../../types';
import type { PaginationMeta } from '../../types';

export interface CustomerAdminRecord {
  _id: string;
  fullName: string;
  phone: string;
  email?: string | null;
  dateOfBirth?: string | null;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  height?: number | null;
  initialWeight?: number | null;
  initialGoal?: string;
  medicalNotes?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'LEAD';
  assignedPtId?: {
    _id: string;
    fullName?: string;
    username?: string;
    email?: string;
    phone?: string;
  } | string;
  userId?: {
    _id: string;
    username: string;
    email?: string;
    status: string;
  } | null;
  createdAt: string;
}

export interface PtOption {
  _id: string;
  fullName?: string;
  username: string;
  phone?: string;
}

export default function AdminCustomersView({ onOpenTransferTab }: { onOpenTransferTab?: () => void }) {
  const toast = useToast();

  const [customers, setCustomers] = useState<CustomerAdminRecord[]>([]);
  const [pts, setPts] = useState<PtOption[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, totalPages: 0, total: 0 });
  const [loading, setLoading] = useState(false);

  // Bulk selection
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [openBulkTransfer, setOpenBulkTransfer] = useState(false);

  // Filters
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [ptFilter, setPtFilter] = useState('');

  // Modals state
  const [transferCustomer, setTransferCustomer] = useState<CustomerAdminRecord | null>(null);
  const [formCustomer, setFormCustomer] = useState<CustomerAdminRecord | null | undefined>(undefined);
  const [deleteCustomer, setDeleteCustomer] = useState<CustomerAdminRecord | null>(null);
  const [accountCustomer, setAccountCustomer] = useState<CustomerAdminRecord | null>(null);

  const loadPts = useCallback(async () => {
    try {
      const res = await api.get<PtOption[]>('/api/users?role=PT&limit=100');
      setPts(res.data || []);
    } catch {
      // Ignored
    }
  }, []);

  const loadCustomers = useCallback(
    async (page = 1, kw = keyword, st = statusFilter, pt = ptFilter) => {
      try {
        setLoading(true);
        const params = new URLSearchParams({ page: String(page), limit: '15' });
        if (kw.trim()) params.set('keyword', kw.trim());
        if (st) params.set('status', st);
        if (pt) params.set('ptId', pt);

        const res = await api.get<{ customers: CustomerAdminRecord[]; meta: PaginationMeta }>(
          `/api/customers?${params.toString()}`
        );
        const data = res.data;
        if (Array.isArray(data)) {
          setCustomers(data);
          setMeta(res.meta || { page, totalPages: 1, total: data.length });
        } else if (data && Array.isArray(data.customers)) {
          setCustomers(data.customers);
          setMeta(data.meta || { page, totalPages: 1, total: data.customers.length });
        } else {
          setCustomers([]);
        }
      } catch (err) {
        toast.error(errorMessage(err));
      } finally {
        setLoading(false);
      }
    },
    [keyword, statusFilter, ptFilter, toast]
  );

  useEffect(() => {
    void loadPts();
    void loadCustomers(1, '', '', '');
  }, []);

  const handleApplyFilter = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    void loadCustomers(1, keyword, statusFilter, ptFilter);
  };

  const handlePtChange = (newPt: string) => {
    setPtFilter(newPt);
    void loadCustomers(1, keyword, statusFilter, newPt);
  };

  const handleStatusChange = (newStatus: string) => {
    setStatusFilter(newStatus);
    void loadCustomers(1, keyword, newStatus, ptFilter);
  };

  const handleResetFilter = () => {
    setKeyword('');
    setStatusFilter('');
    setPtFilter('');
    void loadCustomers(1, '', '', '');
  };

  const handleToggleSelect = (id: string) => {
    setSelectedCustomerIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    const pageIds = customers.map((c) => c._id);
    const isAllPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedCustomerIds.includes(id));

    if (isAllPageSelected) {
      setSelectedCustomerIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      setSelectedCustomerIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  const handleRemoveCustomerFromBulk = (id: string) => {
    setSelectedCustomerIds((prev) => prev.filter((item) => item !== id));
  };

  const handleDeleteCustomer = async () => {
    if (!deleteCustomer) return;
    try {
      await api.delete(`/api/customers/${deleteCustomer._id}`);
      toast.success('Đã xóa hồ sơ khách hàng.');
      setDeleteCustomer(null);
      setSelectedCustomerIds((prev) => prev.filter((id) => id !== deleteCustomer._id));
      void loadCustomers(meta.page, keyword, statusFilter, ptFilter);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const selectedCustomersForBulk = customers.filter((c) => selectedCustomerIds.includes(c._id));

  return (
    <div className="gym-customer-view">
      {/* Unified Compact Toolbar: Bộ lọc + Hành động trên 1 hàng */}
      <div className="gym-customer-toolbar">
        <form
          onSubmit={handleApplyFilter}
          className="gym-customer-filters"
        >
          <div className="gym-customer-search">
            <Search size={15} aria-hidden="true" />
            <input
              type="text"
              aria-label="Tìm khách hàng"
              placeholder="Tìm theo họ tên, SĐT, email..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </div>

          <div style={{ width: '210px', flex: '0 1 210px', minWidth: '170px' }}>
            <CustomSelect
              value={ptFilter}
              onChange={(val) => handlePtChange(val)}
              ariaLabel="Lọc theo huấn luyện viên"
              options={[
                { value: '', label: 'Tất cả Huấn luyện viên' },
                ...pts.map((p) => ({ value: p._id, label: `PT: ${p.fullName || p.username}` })),
              ]}
            />
          </div>

          <div style={{ width: '190px', flex: '0 1 190px', minWidth: '160px' }}>
            <CustomSelect
              value={statusFilter}
              onChange={(val) => handleStatusChange(val)}
              ariaLabel="Lọc theo trạng thái"
              options={[
                { value: '', label: 'Tất cả trạng thái' },
                { value: 'ACTIVE', label: 'Đang hoạt động' },
                { value: 'INACTIVE', label: 'Tạm ngưng' },
                { value: 'LEAD', label: 'Tiềm năng' },
              ]}
            />
          </div>

          <button
            type="submit"
            className="button button-secondary"
          >
            Tìm kiếm
          </button>

          {(Boolean(keyword.trim() || statusFilter || ptFilter)) && (
            <button
              type="button"
              onClick={handleResetFilter}
              className="button button-secondary"
            >
              <RotateCcw size={13} aria-hidden="true" />
              <span>Xóa lọc</span>
            </button>
          )}
        </form>

        <div className="module-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => void loadCustomers(meta.page, keyword, statusFilter, ptFilter)}
            disabled={loading}
            className="button button-secondary"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
            <span>Tải lại</span>
          </button>

          {onOpenTransferTab && (
            <button
              type="button"
              onClick={onOpenTransferTab}
              className="button button-secondary"
            >
              <ArrowRightLeft size={14} aria-hidden="true" />
              <span>Lịch sử điều chuyển</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setFormCustomer(null)}
            className="button button-primary"
          >
            <Plus size={15} aria-hidden="true" />
            <span>Thêm khách hàng</span>
          </button>
        </div>
      </div>

      {/* Bulk Action Bar khi có khách hàng được tick chọn */}
      {selectedCustomerIds.length > 0 && (
        <div className="gym-customer-selection">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                padding: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ArrowRightLeft size={16} />
            </div>
            <div>
              <span style={{ fontSize: '0.88rem', fontWeight: 750 }}>
                Đã chọn {selectedCustomerIds.length} khách hàng
              </span>
              <span style={{ fontSize: '0.75rem', opacity: 0.85, marginLeft: '8px' }}>
                (Sẵn sàng điều chuyển Huấn luyện viên)
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setOpenBulkTransfer(true)}
              className="button button-primary"
            >
              <ArrowRightLeft size={14} aria-hidden="true" />
              <span>Chuyển PT ({selectedCustomerIds.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedCustomerIds([])}
              className="button button-secondary"
            >
              Bỏ chọn
            </button>
          </div>
        </div>
      )}

      {/* Main Customers Table */}
      <AdminCustomerTable
        customers={customers}
        pts={pts}
        loading={loading}
        meta={meta}
        selectedCustomerIds={selectedCustomerIds}
        onToggleSelect={handleToggleSelect}
        onToggleSelectAll={handleToggleSelectAll}
        onPageChange={(page) => void loadCustomers(page, keyword, statusFilter, ptFilter)}
        onOpenTransfer={(c) => setTransferCustomer(c)}
        onOpenEdit={(c) => setFormCustomer(c)}
        onOpenDelete={(c) => setDeleteCustomer(c)}
        onOpenAccount={(c) => setAccountCustomer(c)}
      />

      <CustomerAccountModal
        open={Boolean(accountCustomer)}
        customer={accountCustomer}
        onClose={() => setAccountCustomer(null)}
        onSaved={() => {
          setAccountCustomer(null);
          void loadCustomers(meta.page, keyword, statusFilter, ptFilter);
        }}
      />

      {/* Modal Quick Transfer Đơn lẻ */}
      {transferCustomer && (
        <AdminQuickTransferModal
          customer={transferCustomer}
          pts={pts}
          onClose={() => setTransferCustomer(null)}
          onSuccess={() => void loadCustomers(meta.page, keyword, statusFilter, ptFilter)}
        />
      )}

      {/* Modal Bulk Transfer Hàng loạt */}
      {openBulkTransfer && (
        <AdminBulkTransferModal
          selectedCustomers={selectedCustomersForBulk}
          pts={pts}
          onClose={() => setOpenBulkTransfer(false)}
          onRemoveCustomer={handleRemoveCustomerFromBulk}
          onSuccess={() => {
            setSelectedCustomerIds([]);
            setOpenBulkTransfer(false);
            void loadCustomers(meta.page, keyword, statusFilter, ptFilter);
          }}
        />
      )}

      {/* Modal Form Create/Edit */}
      {formCustomer !== undefined && (
        <AdminCustomerFormModal
          customer={formCustomer}
          pts={pts}
          onClose={() => setFormCustomer(undefined)}
          onSuccess={() => void loadCustomers(meta.page, keyword, statusFilter, ptFilter)}
        />
      )}

      {/* Confirm Delete Modal */}
      <ConfirmModal
        open={Boolean(deleteCustomer)}
        title="Xác nhận xóa khách hàng"
        description={`Bạn có chắc chắn muốn xóa khách hàng "${deleteCustomer?.fullName}" khỏi hệ thống?`}
        confirmLabel="Xóa khách hàng"
        danger
        onConfirm={handleDeleteCustomer}
        onClose={() => setDeleteCustomer(null)}
      />
    </div>
  );
}
