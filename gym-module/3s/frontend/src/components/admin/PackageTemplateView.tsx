import { useCallback, useEffect, useState } from 'react';
import { Layers, Package, Pencil, Plus, RefreshCw, RotateCcw, Trash2 } from 'lucide-react';
import DataList, { type DataColumn } from '../ui/DataList';
import FilterBar from '../ui/FilterBar';
import CustomSelect from '../ui/CustomSelect';
import Pagination from '../ui/Pagination';
import StatusBadge from '../ui/StatusBadge';
import ConfirmModal from '../ui/ConfirmModal';
import PackageTemplateModal, { type PackageTemplateRecord } from './PackageTemplateModal';
import { useToast } from '../ui/ToastProvider';
import { api } from '../../services/api';
import type { PaginationMeta } from '../../types';
import { errorMessage } from '../../types';

export default function PackageTemplateView() {
  const toast = useToast();
  const [templates, setTemplates] = useState<PackageTemplateRecord[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, totalPages: 0 });
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [editingTemplate, setEditingTemplate] = useState<PackageTemplateRecord | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PackageTemplateRecord | null>(null);
  const [loading, setLoading] = useState(false);

  const loadTemplates = useCallback(
    async (page = 1) => {
      try {
        setLoading(true);
        const params = new URLSearchParams({
          page: String(page),
          limit: '20',
        });
        if (keyword.trim()) params.set('keyword', keyword.trim());
        if (statusFilter) params.set('status', statusFilter);

        const result = await api.get<PackageTemplateRecord[]>(`/api/package-templates?${params.toString()}`);
        setTemplates(result.data || []);
        if (result.meta) setMeta(result.meta);
      } catch (error) {
        toast.error(errorMessage(error));
      } finally {
        setLoading(false);
      }
    },
    [keyword, statusFilter, toast]
  );

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const handleDelete = async () => {
    if (!deleteTarget?._id) return;
    try {
      const result = await api.delete(`/api/package-templates/${deleteTarget._id}`);
      toast.success(result.message || 'Xóa gói tập mẫu thành công');
      setDeleteTarget(null);
      loadTemplates(meta.page || 1);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const formatPrice = (price?: number | string) => {
    const num = Number(price || 0);
    if (num <= 0) return 'Chưa đặt giá';
    return `${num.toLocaleString('vi-VN')} đ`;
  };

  const formatDuration = (days?: number | string) => {
    const d = Number(days || 30);
    if (d % 30 === 0) {
      return `${d} ngày (~${d / 30} tháng)`;
    }
    return `${d} ngày`;
  };

  const columns: DataColumn<PackageTemplateRecord>[] = [
    {
      key: 'name',
      label: 'Tên gói tập mẫu',
      render: (item) => (
        <div>
          <strong style={{ color: '#003b70', fontSize: '0.92rem' }}>{item.name}</strong>
          {item.description && (
            <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px', maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {item.description}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'totalSessions',
      label: 'Số buổi',
      render: (item) => (
        <span style={{ fontWeight: 700, color: '#0284c7', fontSize: '0.92rem' }}>
          {item.totalSessions} buổi
        </span>
      ),
    },
    {
      key: 'durationDays',
      label: 'Thời hạn',
      render: (item) => formatDuration(item.durationDays),
    },
    {
      key: 'price',
      label: 'Giá niêm yết',
      render: (item) => (
        <strong style={{ color: '#16a34a' }}>
          {formatPrice(item.price)}
        </strong>
      ),
    },
    {
      key: 'status',
      label: 'Trạng thái',
      render: (item) => <StatusBadge status={item.status} />,
    },
  ];

  return (
    <div className="admin-view">
      <div className="panel" style={{ paddingTop: 0 }}>
        {/* Unified Filter & Action Bar */}
        <FilterBar
          ariaLabel="Tìm gói tập mẫu"
          keyword={keyword}
          onKeywordChange={setKeyword}
          placeholder="Tìm theo tên gói hoặc mô tả quyền lợi..."
        >
          <div style={{ width: '175px', flexShrink: 0 }}>
            <CustomSelect
              ariaLabel="Lọc theo trạng thái"
              value={statusFilter}
              onChange={(val) => setStatusFilter(val)}
              options={[
                { value: '', label: 'Tất cả trạng thái' },
                { value: 'ACTIVE', label: 'Đang kích hoạt' },
                { value: 'INACTIVE', label: 'Tạm ngưng' },
              ]}
            />
          </div>

          <button
            type="button"
            className="button button-secondary"
            onClick={() => loadTemplates(1)}
            disabled={loading}
          >
            <RefreshCw size={14} aria-hidden="true" className={loading ? 'animate-spin' : ''} /> Lọc
          </button>

          {(keyword || statusFilter) && (
            <button
              type="button"
              className="button-filter-reset"
              onClick={() => {
                setKeyword('');
                setStatusFilter('');
              }}
            >
              <RotateCcw size={13} aria-hidden="true" /> Xóa lọc
            </button>
          )}

          <button
            type="button"
            className="button button-primary"
            onClick={() => setIsCreateOpen(true)}
            style={{ marginLeft: 'auto', whiteSpace: 'nowrap' }}
          >
            <Plus size={15} aria-hidden="true" /> Tạo gói mẫu mới
          </button>
        </FilterBar>

        {/* Templates DataList */}
        <DataList<PackageTemplateRecord>
          items={templates}
          columns={columns}
          emptyKind={keyword || statusFilter ? 'search' : 'packages'}
          emptyMessage="Chưa có gói tập mẫu nào."
          renderActions={(item) => (
            <div className="inline-actions">
              <button
                type="button"
                className="text-button"
                onClick={() => setEditingTemplate(item)}
              >
                <Pencil size={15} /> Sửa
              </button>
              <button
                type="button"
                className="text-button text-danger"
                onClick={() => setDeleteTarget(item)}
              >
                <Trash2 size={15} /> Xóa
              </button>
            </div>
          )}
        />

        {/* Pagination */}
        <Pagination
          page={meta.page || 1}
          totalPages={meta.totalPages || 1}
          onPageChange={(p) => loadTemplates(p)}
        />
      </div>

      {/* Modal Tạo/Sửa Gói Mẫu */}
      <PackageTemplateModal
        open={isCreateOpen || Boolean(editingTemplate)}
        template={editingTemplate}
        onClose={() => {
          setIsCreateOpen(false);
          setEditingTemplate(null);
        }}
        onSaved={() => {
          setIsCreateOpen(false);
          setEditingTemplate(null);
          loadTemplates(meta.page || 1);
        }}
      />

      {/* Confirm Modal Xóa Gói Mẫu */}
      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Xóa gói tập mẫu?"
        description={`Bạn có chắc chắn muốn xóa gói tập mẫu "${deleteTarget?.name}"? Các học viên đã đăng ký gói này trước đó sẽ không bị ảnh hưởng.`}
        danger
        confirmLabel="Xóa gói mẫu"
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
