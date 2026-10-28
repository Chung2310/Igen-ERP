import React, { useState, useMemo } from 'react';
import { List, LayoutGrid, Tags, Warehouse } from 'lucide-react';
import { cn } from '../../lib/utils';
import { apiFetch } from '../../lib/api';
import { toast } from '../../../../pages/Toast';
import { useResources } from '../../hooks/useResources';
import { StudentLoadState } from '../../components/StudentLoadState';
import { useResourceCategories } from '../../hooks/useResourceCategories';
import { ResourceItem } from '../../types';
import {
  ErpPageHeader, ErpPrimaryButton, ErpSearchBar, ErpFilterTab, ErpFilterRail,
  ErpLoadingState, ErpCard
} from '../../components/Erp/ErpUI';
import { Pagination } from '../../components/ui/Pagination';

import { AddResourceModal } from './components/AddResourceModal';
import { BookingModal } from './components/BookingModal';
import { ManageCategoriesModal } from './components/ManageCategoriesModal';
import { ResourceCard } from './components/ResourceCard';
import { ResourceTable } from './components/ResourceTable';

export function ResourcesPage({ canManage = true, forceType, excludeType }: { canManage?: boolean; forceType?: string; excludeType?: string }) {
  const { resources, loading, error: resourceLoadError, refetch: reloadResources } = useResources();
  const { categories, loading: categoriesLoading, error: categoryLoadError, refetch: reloadCategories } = useResourceCategories();

  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingResource, setEditingResource] = useState<ResourceItem | null>(null);
  const [bookingResource, setBookingResource] = useState<ResourceItem | null>(null);

  const [viewMode, setViewMode] = useState<'list' | 'grid'>(() => {
    return (localStorage.getItem('erp_view_mode_resources') as 'list' | 'grid') || 'grid';
  });
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = viewMode === 'grid' ? 6 : 8;

  // Tab lọc = phân loại đang quản lý + các phân loại cũ còn xuất hiện trong dữ liệu
  const typeOptions = useMemo(() => {
    let options = categories.map(c => c.name);
    for (const r of resources) {
      if (!options.includes(r.type)) options.push(r.type);
    }
    if (excludeType) {
      options = options.filter(o => o !== excludeType);
    }
    return options;
  }, [categories, resources, excludeType]);

  const handleCancelBooking = async (resource: ResourceItem, bookingId?: string) => {
    if (!bookingId) return;
    try {
      await apiFetch(`/student-resources/${resource.id}/bookings/${bookingId}`, { method: 'DELETE' });
      window.dispatchEvent(new Event('resource-mutation'));
      toast.success('Đã hủy lịch đặt.');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Có lỗi xảy ra khi hủy lịch.';
      toast.error(msg);
    }
  };

  const handleToggleMaintenance = async (resource: ResourceItem) => {
    const nextStatus = resource.status === 'MAINTENANCE' ? 'AVAILABLE' : 'MAINTENANCE';
    try {
      await apiFetch(`/student-resources/${resource.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      window.dispatchEvent(new Event('resource-mutation'));
      toast.success(nextStatus === 'MAINTENANCE'
        ? `${resource.name}: chuyển sang trạng thái bảo trì.`
        : `${resource.name}: đã sẵn sàng sử dụng trở lại.`);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Có lỗi xảy ra khi cập nhật trạng thái.';
      toast.error(msg);
    }
  };

  const handleDelete = async (resource: ResourceItem) => {
    try {
      await apiFetch(`/student-resources/${resource.id}`, { method: 'DELETE' });
      window.dispatchEvent(new Event('resource-mutation'));
      toast.success(`Đã xóa tài nguyên ${resource.name}.`);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Có lỗi xảy ra khi xóa tài nguyên.';
      toast.error(msg);
    }
  };

  const filteredResources = resources.filter(r => {
    const matchesSearch = r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.identifier.toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchesType = typeFilter === 'all' || r.type === typeFilter;
    if (forceType) {
      matchesType = r.type === forceType;
    } else if (excludeType) {
      matchesType = (typeFilter === 'all' ? r.type !== excludeType : r.type === typeFilter) && r.type !== excludeType;
    }
    return matchesSearch && matchesType;
  });
  const totalPages = Math.ceil(filteredResources.length / pageSize);
  const paginatedResources = filteredResources.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1);
    }, 0);
    return () => clearTimeout(timer);
  }, [searchTerm, typeFilter, viewMode]);

  const refreshResources = () => {
    window.dispatchEvent(new Event('resource-mutation'));
  };

  const refreshCategories = () => {
    window.dispatchEvent(new Event('resource-category-mutation'));
  };

  return (
    <div className="space-y-4 text-left">
      {(resourceLoadError || categoryLoadError) && <StudentLoadState error={resourceLoadError || categoryLoadError} onRetry={() => { void Promise.all([reloadResources(), reloadCategories()]); }} />}
      <ErpPageHeader
        title={forceType === 'Phòng học' ? "Quản lý phòng học" : "Quản lý thiết bị & tài nguyên"}
        subtitle={forceType === 'Phòng học' ? "Quản lý danh sách các phòng học của trung tâm." : "Bấm 'Khai báo tài nguyên mới' để thêm phòng học, thiết bị hoặc công cụ giảng dạy."}
        action={canManage ? (
          <div className="flex gap-2">
            {!forceType && (
              <button
                onClick={() => setShowCategoryModal(true)}
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-medium normal-case text-slate-700 transition-colors hover:border-sky-200 hover:bg-sky-50"
              >
                <Tags className="h-4 w-4 text-brand-primary" />
                Quản lý phân loại
              </button>
            )}
            <ErpPrimaryButton onClick={() => { setEditingResource(null); setShowAddModal(true); }}>
              {forceType === 'Phòng học' ? 'Khai báo phòng học mới' : 'Khai báo tài nguyên mới'}
            </ErpPrimaryButton>
          </div>
        ) : undefined}
      />

      {/* Controls */}
      <div className="flex flex-col items-stretch justify-between gap-3 md:flex-row md:items-center">
        <ErpSearchBar value={searchTerm} onChange={setSearchTerm} placeholder="Tìm tài nguyên bằng tên hoặc số nhận diện..." />
        <div className="flex flex-wrap items-center justify-between gap-3 md:justify-end">
          {!forceType && (
            <ErpFilterRail>
              <ErpFilterTab active={typeFilter === 'all'} onClick={() => setTypeFilter('all')}>
                Tất cả
              </ErpFilterTab>
              {typeOptions.map((type) => (
                <ErpFilterTab key={type} active={typeFilter === type} onClick={() => setTypeFilter(type)}>
                  {type}
                </ErpFilterTab>
              ))}
            </ErpFilterRail>
          )}

          <div className="flex shrink-0 items-center gap-1 rounded-xl border border-sky-100 bg-white p-1">
            <button
              type="button"
              onClick={() => { setViewMode('list'); localStorage.setItem('erp_view_mode_resources', 'list'); }}
              aria-label="Hiển thị dạng danh sách"
              aria-pressed={viewMode === 'list'}
              className={cn("inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors", viewMode === 'list' ? "bg-brand-primary text-white" : "text-slate-500 hover:bg-sky-50 hover:text-brand-primary")}
              title="Hiển thị dạng danh sách"
            >
              <List className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => { setViewMode('grid'); localStorage.setItem('erp_view_mode_resources', 'grid'); }}
              aria-label="Hiển thị dạng lưới"
              aria-pressed={viewMode === 'grid'}
              className={cn("inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors", viewMode === 'grid' ? "bg-brand-primary text-white" : "text-slate-500 hover:bg-sky-50 hover:text-brand-primary")}
              title="Hiển thị dạng lưới"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Grid or List Content */}
      {loading && resources.length === 0 ? (
        <ErpCard><ErpLoadingState message="Đang tải danh sách tài nguyên..." /></ErpCard>
      ) : filteredResources.length === 0 ? (
        <ErpCard className="overflow-hidden">
          <div className="flex min-h-[220px] flex-col items-center justify-center px-5 py-8 text-center">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-sky-50 text-brand-primary">
              <Warehouse className="h-5 w-5" />
            </div>
            <h2 className="text-base font-medium text-slate-800">Chưa có tài nguyên nào</h2>
            <p className="mt-1 max-w-lg text-sm font-normal text-slate-500">
              Bấm “Khai báo tài nguyên mới” để thêm phòng học, thiết bị hoặc công cụ giảng dạy.
            </p>
          </div>
        </ErpCard>
      ) : viewMode === 'grid' ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {paginatedResources.map((r) => (
              <ResourceCard
                key={r.id}
                resource={r}
                canManage={canManage}
                onBook={setBookingResource}
                onEdit={setEditingResource}
                onToggleMaintenance={handleToggleMaintenance}
                onDelete={handleDelete}
                onCancelBooking={handleCancelBooking}
              />
            ))}
          </div>
          <ErpCard className="overflow-hidden">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              totalItems={filteredResources.length}
              pageSize={pageSize}
              itemName="tài nguyên"
            />
          </ErpCard>
        </div>
      ) : (
        <ResourceTable
          resources={paginatedResources}
          canManage={canManage}
          onBook={setBookingResource}
          onEdit={setEditingResource}
          onToggleMaintenance={handleToggleMaintenance}
          onDelete={handleDelete}
          footer={
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              totalItems={filteredResources.length}
              pageSize={pageSize}
              itemName="tài nguyên"
            />
          }
        />
      )}

      {/* Add Resource Modal */}
      {canManage && <AddResourceModal
        isOpen={showAddModal || !!editingResource}
        onClose={() => { setShowAddModal(false); setEditingResource(null); }}
        categories={categories}
        onSuccess={refreshResources}
        resource={editingResource || undefined}
        forceType={forceType}
      />}

      {/* Booking Modal */}
      {canManage && <BookingModal
        bookingResource={bookingResource}
        onClose={() => setBookingResource(null)}
        onSuccess={refreshResources}
      />}

      {/* Manage Categories Modal */}
      <ManageCategoriesModal
        isOpen={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        categories={categories}
        categoriesLoading={categoriesLoading}
        onSuccess={refreshCategories}
      />
    </div>
  );
}
