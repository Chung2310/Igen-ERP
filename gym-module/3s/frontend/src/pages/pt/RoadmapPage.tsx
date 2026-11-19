import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Edit3,
  Eye,
  Filter,
  Plus,
  Search,
  Sparkles,
  Trash2,
  User,
  X,
} from 'lucide-react';
import ConfirmModal from '../../components/ui/ConfirmModal';
import CustomerSelect from '../../components/ui/CustomerSelect';
import CustomSelect from '../../components/ui/CustomSelect';
import Pagination from '../../components/ui/Pagination';
import StatusBadge from '../../components/ui/StatusBadge';
import { useToast } from '../../components/ui/ToastProvider';
import RoadmapDetailModal from '../../components/roadmap/RoadmapDetailModal';
import RoadmapForm from '../../components/roadmap/RoadmapForm';
import RoadmapTimeline from '../../components/roadmap/RoadmapTimeline';
import { api } from '../../services/api';
import type { Customer, PaginationMeta, Roadmap } from '../../types';
import { errorMessage } from '../../types';

export default function RoadmapPage() {
  const toast = useToast();
  const [items, setItems] = useState<Roadmap[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, limit: 6, total: 0, totalPages: 0 });
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customersLoaded, setCustomersLoaded] = useState(false);

  // Filter States
  const [filterCustomer, setFilterCustomer] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');

  // Modals & Forms
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<Roadmap | null>(null);
  const [viewingItem, setViewingItem] = useState<Roadmap | null>(null);
  const [publishing, setPublishing] = useState<Roadmap | null>(null);
  const [deleting, setDeleting] = useState<Roadmap | null>(null);
  const [loading, setLoading] = useState(false);

  // Load customer directory for quick name resolution
  useEffect(() => {
    let mounted = true;
    async function loadCustomers() {
      try {
        const res = await api.get<Customer[]>('/api/customers?limit=100');
        if (mounted && res.data) {
          setCustomers(res.data);
          setCustomersLoaded(true);
        }
      } catch {
        // Fallback silently if customer directory fetch fails
      }
    }
    void loadCustomers();
    return () => {
      mounted = false;
    };
  }, []);

  const customerMap = useMemo(() => {
    const map: Record<string, Customer> = {};
    customers.forEach((c) => {
      if (c._id) map[c._id] = c;
    });
    return map;
  }, [customers]);

  const load = useCallback(
    async (page = 1) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: '6',
        });
        if (filterCustomer.trim()) params.set('customerId', filterCustomer.trim());
        if (filterStatus) params.set('status', filterStatus);
        if (appliedSearch.trim()) params.set('search', appliedSearch.trim());

        const result = await api.get<Roadmap[]>(`/api/roadmaps?${params.toString()}`);
        setItems(result.data || []);
        if (result.meta) setMeta(result.meta);
      } catch (error) {
        toast.error(errorMessage(error));
      } finally {
        setLoading(false);
      }
    },
    [filterCustomer, filterStatus, appliedSearch, toast]
  );

  useEffect(() => {
    void load(1);
  }, [load]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedSearch(searchTerm);
  };

  const handleResetFilters = () => {
    setFilterCustomer('');
    setFilterStatus('');
    setSearchTerm('');
    setAppliedSearch('');
  };

  const hasActiveFilters = Boolean(filterCustomer || filterStatus || appliedSearch);

  const changePublication = async () => {
    if (!publishing) return;
    try {
      const action = publishing.status === 'PUBLISHED' ? 'unpublish' : 'publish';
      const result = await api.patch(`/api/roadmaps/${publishing._id}/${action}`);
      toast.success(result.message);
      setPublishing(null);
      await load(meta.page || 1);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      const result = await api.delete(`/api/roadmaps/${deleting._id}`);
      toast.success(result.message || 'Đã xóa roadmap.');
      setDeleting(null);
      await load(meta.page || 1);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <section style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}>
      {/* Header section */}
      <div className="section-header">
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
          <Sparkles size={24} color="var(--secondary-color)" /> Quản lý Lộ trình
        </h1>
        <button
          className="button button-primary"
          onClick={() => {
            setEditingItem(null);
            setShowForm(true);
          }}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Plus size={16} /> Tạo roadmap
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          padding: '16px 18px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          marginBottom: '20px',
          display: 'grid',
          gap: '12px',
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '0.9rem', color: '#1e293b' }}>
            <Filter size={16} color="var(--secondary-color)" /> Bộ lọc & Tìm kiếm lộ trình
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#64748b' }}>
            <span>
              Hiển thị <strong>{items.length}</strong> / <strong>{meta.total || items.length}</strong> lộ trình
            </span>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                style={{
                  background: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '3px 8px',
                  fontSize: '0.75rem',
                  color: '#475569',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <X size={12} /> Xóa bộ lọc
              </button>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: '12px', alignItems: 'end' }}>
          {/* Customer Filter */}
          <div>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
              Học viên
            </span>
            <CustomerSelect
              label="Lọc theo khách hàng"
              ariaLabel="Lọc theo khách hàng"
              name="filterCustomerId"
              value={filterCustomer}
              onChange={(cId) => setFilterCustomer(cId)}
              placeholder="Tất cả học viên..."
              customers={customersLoaded ? customers : undefined}
            />
          </div>

          {/* Status Filter */}
          <div>
            <CustomSelect
              label="Trạng thái"
              ariaLabel="Lọc theo trạng thái"
              value={filterStatus}
              onChange={(val) => setFilterStatus(val)}
              options={[
                { value: '', label: 'Tất cả trạng thái' },
                { value: 'DRAFT', label: 'Bản nháp (DRAFT)' },
                { value: 'PUBLISHED', label: 'Đã công bố (PUBLISHED)' },
              ]}
            />
          </div>

          {/* Keyword Search */}
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '6px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
              <input
                type="text"
                placeholder="Tìm tiêu đề lộ trình..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  paddingLeft: '36px',
                  paddingRight: '12px',
                  minHeight: '42px',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#334155',
                  boxShadow: 'none',
                }}
              />
            </div>
            <button
              type="submit"
              className="button button-secondary"
              style={{ minHeight: '42px', padding: '0 14px', whiteSpace: 'nowrap' }}
            >
              Tìm
            </button>
          </form>
        </div>
      </div>

      {/* Form modal/panel */}
      {(showForm || editingItem) && (
        <RoadmapForm
          initialData={editingItem}
          onCancel={() => {
            setShowForm(false);
            setEditingItem(null);
          }}
          onSaved={() => {
            setShowForm(false);
            setEditingItem(null);
            void load(meta.page || 1);
          }}
        />
      )}

      {/* Grid of Roadmap Cards */}
      <div
        className="roadmap-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))',
          gap: '16px',
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
          boxSizing: 'border-box',
        }}
      >
        {items.length > 0 ? (
          items.map((item) => {
            const customer = customerMap[item.customerId] || null;
            const customerDisplayName = customer?.fullName || 'Học viên';
            const customerPhone = customer?.phone || '';

            return (
              <article
                className="panel"
                key={item._id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  padding: '16px',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                  transition: 'all 0.2s ease',
                  background: '#ffffff',
                  width: '100%',
                  maxWidth: '100%',
                  minWidth: 0,
                  boxSizing: 'border-box',
                  overflow: 'hidden',
                }}
              >
                {/* Card Top Meta */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px', minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    <StatusBadge status={item.status} />
                  </div>

                  {/* Customer Badge */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '0.75rem',
                      background: '#f0fdf4',
                      color: '#166534',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontWeight: 600,
                      border: '1px solid #bbf7d0',
                      maxWidth: '180px',
                    }}
                    title={customerPhone ? `${customerDisplayName} (${customerPhone})` : customerDisplayName}
                  >
                    <User size={12} color="#16a34a" style={{ flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {customerDisplayName}
                    </span>
                  </div>
                </div>

                {/* Card Title */}
                <h2
                  style={{
                    margin: '2px 0 0',
                    fontSize: '0.98rem',
                    fontWeight: 700,
                    color: 'var(--primary-color)',
                    lineHeight: 1.4,
                  }}
                >
                  {item.title}
                </h2>

                {/* Compact Timeline Accordion */}
                <RoadmapTimeline roadmap={item} />

                {/* Card Actions Footer */}
                <div
                  style={{
                    marginTop: 'auto',
                    paddingTop: '10px',
                    borderTop: '1px solid #f1f5f9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '6px',
                  }}
                >
                  <button
                    type="button"
                    className={`button ${item.status === 'PUBLISHED' ? 'button-secondary' : 'button-primary'}`}
                    onClick={() => setPublishing(item)}
                    style={{ fontSize: '0.78rem', padding: '5px 10px', borderRadius: '6px' }}
                  >
                    {item.status === 'PUBLISHED' ? 'Gỡ công bố' : 'Công bố roadmap'}
                  </button>

                  <div style={{ display: 'flex', gap: '4px' }}>
                    {/* View Details Eye Button */}
                    <button
                      type="button"
                      className="button button-secondary"
                      onClick={() => setViewingItem(item)}
                      style={{ fontSize: '0.78rem', padding: '5px 8px', display: 'flex', alignItems: 'center', gap: '4px', borderRadius: '6px', color: '#0284c7', borderColor: '#bae6fd' }}
                      title="Xem chi tiết toàn bộ lộ trình"
                    >
                      <Eye size={13} /> Xem
                    </button>

                    <button
                      type="button"
                      className="button button-secondary"
                      onClick={() => {
                        setEditingItem(item);
                        setShowForm(false);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      style={{ fontSize: '0.78rem', padding: '5px 8px', display: 'flex', alignItems: 'center', gap: '4px', borderRadius: '6px' }}
                      title="Chỉnh sửa roadmap"
                    >
                      <Edit3 size={13} /> Sửa
                    </button>

                    {item.status !== 'PUBLISHED' && (
                      <button
                        type="button"
                        className="button button-secondary"
                        onClick={() => setDeleting(item)}
                        style={{ fontSize: '0.78rem', padding: '5px 8px', color: '#ef4444', borderColor: '#fca5a5', borderRadius: '6px' }}
                        title="Xóa roadmap"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })
        ) : (
          <div
            className="empty-state"
            style={{
              gridColumn: '1 / -1',
              padding: '40px 20px',
              textAlign: 'center',
              background: '#f8fafc',
              borderRadius: '12px',
              border: '1px dashed #cbd5e1',
            }}
          >
            {loading ? (
              <p>Đang tải danh sách lộ trình...</p>
            ) : hasActiveFilters ? (
              <div>
                <p style={{ margin: '0 0 8px', fontWeight: 600 }}>Không tìm thấy lộ trình phù hợp với bộ lọc hiện tại.</p>
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={handleResetFilters}
                  style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                >
                  Xóa bộ lọc & Xem tất cả
                </button>
              </div>
            ) : (
              <div>
                <p style={{ margin: '0 0 8px', fontWeight: 600 }}>Chưa có lộ trình nào được tạo.</p>
                <button
                  type="button"
                  className="button button-primary"
                  onClick={() => {
                    setEditingItem(null);
                    setShowForm(true);
                  }}
                  style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                >
                  <Plus size={14} /> Tạo roadmap ngay
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Pagination Bar */}
      <div style={{ marginTop: '20px' }}>
        <Pagination page={meta.page || 1} totalPages={meta.totalPages || 0} onPageChange={load} />
      </div>

      {/* Detail Modal */}
      <RoadmapDetailModal
        open={Boolean(viewingItem)}
        roadmap={viewingItem}
        customer={customerMap[viewingItem?.customerId || '']}
        onClose={() => setViewingItem(null)}
        onEdit={(item) => {
          setViewingItem(null);
          setEditingItem(item);
          setShowForm(false);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onTogglePublish={(item) => {
          setViewingItem(null);
          setPublishing(item);
        }}
      />

      {/* Confirmation Modals */}
      <ConfirmModal
        open={Boolean(publishing)}
        title={publishing?.status === 'PUBLISHED' ? 'Gỡ công bố roadmap?' : 'Công bố roadmap?'}
        description="Chỉ nội dung đã công bố mới được phép hiển thị cho học viên trên ứng dụng."
        onClose={() => setPublishing(null)}
        onConfirm={changePublication}
      />

      <ConfirmModal
        open={Boolean(deleting)}
        title="Xác nhận xóa roadmap?"
        description={`Bạn có chắc chắn muốn xóa "${deleting?.title}"? Thao tác này không thể hoàn tác.`}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
      />
    </section>
  );
}


