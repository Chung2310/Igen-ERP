import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Eye, Package, Pencil, Phone, Plus, RefreshCw, RotateCcw, Ruler, Salad, Send, Shield, Target, Trash2, UserPlus, Users, type LucideIcon } from 'lucide-react';
import ConfirmModal from '../ui/ConfirmModal';
import ContentFormModal from '../ui/ContentFormModal';
import CustomerAccountModal from '../ui/CustomerAccountModal';
import CustomerConsultationModal from '../ui/CustomerConsultationModal';
import CustomerDetailModal from '../ui/CustomerDetailModal';
import CustomerFormModal from '../ui/CustomerFormModal';
import CustomerPhotoModal from '../ui/CustomerPhotoModal';
import DataList from '../ui/DataList';
import type { DataColumn } from '../ui/DataList';
import FilterBar from '../ui/FilterBar';
import Pagination from '../ui/Pagination';
import PtPackageManagerModal from '../ui/PtPackageManagerModal';
import StatusBadge from '../ui/StatusBadge';
import CustomerSelect from '../ui/CustomerSelect';
import PtManagementView from '../admin/PtManagementView';
import { useToast } from '../ui/ToastProvider';
import { api } from '../../services/api';
import type { PaginationMeta } from '../../types';
import { errorMessage } from '../../types';
import type { ContentItem, Resource } from '../ui/ContentFormModal';

interface PortalItem { _id?: string; id?: string; title?: string; summary?: string; status?: string; customerId?: string; measurementDate?: string; weight?: number; targetCalories?: number; fullName?: string; username?: string; phone?: string; email?: string | null; initialGoal?: string; packages?: unknown; userId?: string | { _id?: string; id?: string; username?: string; email?: string | null; status?: string; role?: string; createdAt?: string } | null; [key: string]: unknown }
interface SectionHeaderProps { title: string; description: string; action?: ReactNode }
interface CustomerContent { inbody: PortalItem[]; goals: PortalItem[]; workoutPlans: PortalItem[]; nutritionPlans: PortalItem[]; progressReports: PortalItem[] }

function SectionHeader({ title, description, action }: SectionHeaderProps) {
  return <div className="section-header"><div><h1>{title}</h1>{description ? <p>{description}</p> : null}</div>{action}</div>;
}

export function AdminView() {
  return <PtManagementView />;
}

type PtTab = 'customers' | Resource;
interface PtTabItem { value: PtTab; label: string; icon: LucideIcon }

const ptTabs: PtTabItem[] = [
  { value: 'customers', label: 'Khách hàng', icon: Users },
  { value: 'goals', label: 'Mục tiêu', icon: Target },
];

export function PtView() {
  const toast = useToast();
  const [tab, setTab] = useState<PtTab>('customers');
  const [items, setItems] = useState<PortalItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, totalPages: 0 });
  const [keyword, setKeyword] = useState('');
  const [customerStatus, setCustomerStatus] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formItem, setFormItem] = useState<PortalItem | null>(null);
  const [customerForm, setCustomerForm] = useState<{ open: boolean; customer: PortalItem | null }>({ open: false, customer: null });
  const [confirm, setConfirm] = useState<PortalItem | null>(null);
  const [accountCustomer, setAccountCustomer] = useState<PortalItem | null>(null);
  const [packageCustomer, setPackageCustomer] = useState<PortalItem | null>(null);
  const [consultationCustomer, setConsultationCustomer] = useState<PortalItem | null>(null);
  const [photoCustomer, setPhotoCustomer] = useState<PortalItem | null>(null);
  const [detailCustomer, setDetailCustomer] = useState<PortalItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PortalItem | null>(null);

  const load = useCallback(async (page = 1) => {
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (tab === 'customers' && keyword) params.set('keyword', keyword);
      if (tab === 'customers' && customerStatus) params.set('status', customerStatus);
      if (tab !== 'customers' && statusFilter) params.set('status', statusFilter);
      if (tab !== 'customers' && customerFilter) params.set('customerId', customerFilter);
      const result = await api.get<PortalItem[]>(`/api/${tab}?${params}`);
      setItems(Array.isArray(result.data) ? result.data : []);
      if (result.meta) setMeta(result.meta);
    } catch (error) {
      toast.error(errorMessage(error));
      setItems([]);
    }
  }, [tab, keyword, customerStatus, statusFilter, customerFilter, toast]);
  useEffect(() => { load(); }, [load]);
  const publish = async () => { if (!confirm) return; try { const result = await api.patch(`/api/${tab}/${confirm._id}/${confirm.status === 'PUBLISHED' ? 'unpublish' : 'publish'}`); toast.success(result.message); setConfirm(null); load(); } catch (error) { toast.error(errorMessage(error)); } };
  const deleteSelectedItem = async () => {
    if (!deleteTarget) return;
    try { const path = tab === 'customers' ? `/api/customers/${deleteTarget._id}` : `/api/${tab}/${deleteTarget._id}`; const result = await api.delete(path); toast.success(result.message); setDeleteTarget(null); load(); }
    catch (error) { toast.error(errorMessage(error)); }
  };

  const renderCustomerCell = (item: PortalItem) => {
    const raw = item.customerId;
    if (raw && typeof raw === 'object' && 'fullName' in (raw as object)) {
      const c = raw as { _id?: string; fullName?: string; phone?: string };
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <strong style={{ color: '#0f172a', fontWeight: 600, fontSize: '0.88rem' }}>{c.fullName || '—'}</strong>
          {c.phone && (
            <span style={{ fontSize: '0.76rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Phone size={11} style={{ color: '#0284c7' }} />
              <span>{c.phone}</span>
            </span>
          )}
        </div>
      );
    }
    const idStr = String(raw || '—');
    return <span style={{ color: '#334155', fontWeight: 500 }}>{idStr}</span>;
  };

  const renderAccountCell = (item: PortalItem) => {
    const rawUser = item.userId;
    if (rawUser && typeof rawUser === 'object' && 'username' in (rawUser as object) && (rawUser as { username?: string }).username) {
      const u = rawUser as { username: string; status?: string };
      const isLocked = u.status === 'LOCKED';
      return (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '3px 8px',
              borderRadius: '6px',
              fontSize: '0.8rem',
              fontWeight: 600,
              background: isLocked ? '#fef2f2' : '#f0f9ff',
              color: isLocked ? '#b91c1c' : '#0369a1',
              border: `1px solid ${isLocked ? '#fecaca' : '#bae6fd'}`,
            }}
          >
            <Shield size={12} style={{ color: isLocked ? '#ef4444' : '#0284c7' }} />
            <span>@{u.username}</span>
          </span>
          {isLocked ? (
            <span style={{ fontSize: '0.72rem', color: '#ef4444', fontWeight: 600 }}>
              (Khóa)
            </span>
          ) : (
            <span style={{ fontSize: '0.72rem', color: '#16a34a', fontWeight: 600 }}>
              (Hoạt động)
            </span>
          )}
        </div>
      );
    }
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '3px 8px',
            borderRadius: '6px',
            fontSize: '0.76rem',
            fontWeight: 500,
            background: '#f8fafc',
            color: '#64748b',
            border: '1px solid #e2e8f0',
          }}
        >
          Chưa cấp
        </span>
      </div>
    );
  };

  const columns = useMemo<DataColumn<PortalItem>[]>(() => {
    if (tab === 'customers') return [
      { key: 'fullName', label: 'Họ tên' },
      { key: 'phone', label: 'Số điện thoại' },
      { key: 'email', label: 'Email' },
      { key: 'userId', label: 'Tài khoản', render: renderAccountCell },
      { key: 'status', label: 'Trạng thái', render: (item) => <StatusBadge status={item.status} /> }
    ];
    return [{ key: 'title', label: tab === 'inbody' ? 'Ngày đo' : 'Tên nội dung', render: (item) => item.title || (item.measurementDate ? new Date(item.measurementDate).toLocaleDateString('vi-VN') : '—') }, { key: 'customerId', label: 'Khách hàng', render: renderCustomerCell }, { key: 'status', label: 'Trạng thái', render: (item) => <StatusBadge status={item.status} /> }];
  }, [tab]);
  const openCreateForm = () => {
    if (tab === 'customers') setCustomerForm({ open: true, customer: null });
    else { setFormItem(null); setShowForm(true); }
  };
  const selectTab = (value: PtTab) => {
    setTab(value);
    setStatusFilter('');
    setCustomerFilter('');
    setShowForm(false);
    setCustomerForm({ open: false, customer: null });
  };
  return <>
    <SectionHeader title="Khách hàng của tôi" description="" action={<button className="button button-primary" onClick={openCreateForm}><Plus size={18} /> Tạo mới</button>} />
    <div className="customer-browser-tabs" role="tablist" aria-label="Nội dung khách hàng">{ptTabs.map(({ value, label, icon: Icon }) => <button id={`customer-tab-${value}`} type="button" role="tab" aria-selected={tab === value} aria-controls="customer-tab-panel" key={value} className={tab === value ? 'active' : ''} onClick={() => selectTab(value)}><Icon size={16} aria-hidden="true" /><span>{label}</span></button>)}</div>
    <ContentFormModal open={showForm && tab !== 'customers'} resource={tab as Resource} item={formItem as ContentItem | null} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />
    <CustomerAccountModal open={Boolean(accountCustomer)} customer={accountCustomer} onClose={() => setAccountCustomer(null)} onSaved={() => { setAccountCustomer(null); load(); }} />
    <PtPackageManagerModal open={Boolean(packageCustomer)} customer={packageCustomer} onClose={() => setPackageCustomer(null)} />
    <CustomerConsultationModal open={Boolean(consultationCustomer)} customer={consultationCustomer} onClose={() => setConsultationCustomer(null)} />
    <CustomerPhotoModal open={Boolean(photoCustomer)} customer={photoCustomer} onClose={() => setPhotoCustomer(null)} />
    <CustomerDetailModal
      open={Boolean(detailCustomer)}
      customer={detailCustomer}
      onClose={() => { setDetailCustomer(null); load(); }}
      onEditCustomer={(c) => setCustomerForm({ open: true, customer: c })}
      onGrantAccount={(c) => setAccountCustomer(c)}
    />
    <div id="customer-tab-panel" className="customer-tab-panel" role="tabpanel" aria-labelledby={`customer-tab-${tab}`}>
      <div className="panel">
        {tab === 'customers' ? (
          <FilterBar ariaLabel="Tìm khách hàng" keyword={keyword} onKeywordChange={setKeyword} placeholder="Tìm khách hàng theo tên, số điện thoại, mục tiêu...">
            <select aria-label="Lọc trạng thái khách hàng" className="filter-select" value={customerStatus} onChange={(event) => setCustomerStatus(event.target.value)}>
              <option value="">Tất cả trạng thái</option>
              <option value="ACTIVE">Đang hoạt động</option>
              <option value="INACTIVE">Ngừng hoạt động</option>
              <option value="LEAD">Tiềm năng</option>
            </select>
            <button className="button button-secondary" onClick={() => load()}>
              <RefreshCw size={15} /> Lọc
            </button>
            {(keyword || customerStatus) && (
              <button className="button-filter-reset" onClick={() => { setKeyword(''); setCustomerStatus(''); }}>
                <RotateCcw size={13} /> Xóa lọc
              </button>
            )}
          </FilterBar>
        ) : (
          <div className="filter-bar" style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ minWidth: '280px', flex: '1 1 280px' }}>
              <CustomerSelect
                label=""
                name="customerFilter"
                ariaLabel="Lọc theo mã khách hàng"
                value={customerFilter}
                onChange={(val) => setCustomerFilter(val)}
                placeholder="Lọc theo học viên (tên hoặc SĐT)..."
              />
            </div>
            <select aria-label="Lọc theo trạng thái" className="filter-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} style={{ minHeight: '44px' }}>
              <option value="">Tất cả trạng thái</option>
              <option value="DRAFT">Bản nháp</option>
              <option value="PUBLISHED">Đã công bố</option>
            </select>
            <button className="button button-secondary" onClick={() => load()} style={{ minHeight: '44px' }}>
              <RefreshCw size={15} /> Lọc
            </button>
            {(customerFilter || statusFilter) && (
              <button className="button-filter-reset" onClick={() => { setCustomerFilter(''); setStatusFilter(''); }} style={{ minHeight: '44px' }}>
                <RotateCcw size={13} /> Xóa lọc
              </button>
            )}
          </div>
        )}
        <DataList
          items={items}
          columns={columns}
          renderActions={(item) => (
            <div className="inline-actions">
              {tab === 'customers' ? (
                <>
                  <button
                    type="button"
                    className="action-icon-btn btn-primary-action"
                    title="Xem chi tiết hồ sơ"
                    aria-label="Chi tiết"
                    onClick={() => setDetailCustomer(item)}
                  >
                    <Eye size={16} />
                  </button>
                  <button
                    type="button"
                    className="action-icon-btn"
                    title="Quản lý gói PT"
                    aria-label="Gói PT"
                    onClick={() => setPackageCustomer(item)}
                  >
                    <Package size={16} />
                  </button>
                  <button
                    type="button"
                    className="action-icon-btn"
                    title="Chỉnh sửa thông tin"
                    aria-label="Sửa"
                    onClick={() => setCustomerForm({ open: true, customer: item })}
                  >
                    <Pencil size={16} />
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="action-icon-btn"
                  title="Chỉnh sửa"
                  aria-label="Sửa"
                  onClick={() => { setFormItem(item); setShowForm(true); }}
                >
                  <Pencil size={16} />
                </button>
              )}
              {tab !== 'customers' && (
                <button
                  type="button"
                  className="action-icon-btn"
                  title={item.status === 'PUBLISHED' ? 'Thu hồi nội dung' : 'Công bố nội dung'}
                  aria-label={item.status === 'PUBLISHED' ? 'Thu hồi' : 'Công bố'}
                  onClick={() => setConfirm(item)}
                >
                  <Send size={16} />
                </button>
              )}
              <button
                type="button"
                className="action-icon-btn text-danger"
                title="Xóa"
                aria-label="Xóa"
                onClick={() => setDeleteTarget(item)}
              >
                <Trash2 size={16} />
              </button>
            </div>
          )}
        />
        <Pagination page={meta.page || 1} totalPages={meta.totalPages || 0} onPageChange={load} />
      </div>
    </div>
    <CustomerFormModal open={customerForm.open} customer={customerForm.customer} onClose={() => setCustomerForm({ open: false, customer: null })} onSaved={() => { setCustomerForm({ open: false, customer: null }); load(meta.page || 1); }} />
    <ConfirmModal open={Boolean(confirm)} title={confirm?.status === 'PUBLISHED' ? 'Thu hồi nội dung?' : 'Công bố nội dung?'} description={confirm?.status === 'PUBLISHED' ? 'Khách hàng sẽ không còn nhìn thấy nội dung này.' : 'Khách hàng sẽ nhìn thấy nội dung sau khi công bố.'} onClose={() => setConfirm(null)} onConfirm={publish} />
    <ConfirmModal open={Boolean(deleteTarget)} title="Xóa vĩnh viễn?" description="Dữ liệu đã xóa không thể khôi phục." danger confirmLabel="Xóa vĩnh viễn" onClose={() => setDeleteTarget(null)} onConfirm={deleteSelectedItem} />
  </>;
}

export function CustomerView() {
  const toast = useToast();
  const [content, setContent] = useState<CustomerContent>({ inbody: [], goals: [], workoutPlans: [], nutritionPlans: [], progressReports: [] });
  useEffect(() => { api.get<CustomerContent>('/api/me/content').then((result) => setContent(result.data)).catch((error: unknown) => toast.error(errorMessage(error))); }, [toast]);
  const groups: Array<[keyof CustomerContent, string]> = [['inbody', 'Kết quả InBody'], ['goals', 'Mục tiêu'], ['workoutPlans', 'Giáo án'], ['nutritionPlans', 'Dinh dưỡng'], ['progressReports', 'Báo cáo tiến độ']];
  return <><SectionHeader title="Hành trình của tôi" description="" /><div className="customer-content-grid">{groups.map(([key, label]) => <section className="panel" key={key}><h2>{label}</h2>{content[key]?.length ? content[key].map((item) => <article className="published-card" key={item._id}><StatusBadge status={item.status} /><h3>{item.title || (item.measurementDate ? new Date(item.measurementDate).toLocaleDateString('vi-VN') : label)}</h3>{item.weight && <p>Cân nặng: <strong>{item.weight} kg</strong></p>}{item.targetCalories && <p>Calories mục tiêu: <strong>{item.targetCalories} kcal</strong></p>}</article>) : <div className="empty-state">PT chưa công bố nội dung.</div>}</section>)}</div></>;
}
