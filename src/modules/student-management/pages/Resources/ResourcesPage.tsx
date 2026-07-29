import React, { useState, useMemo } from 'react';
import { List, LayoutGrid, Warehouse } from 'lucide-react';
import { cn } from '../../lib/utils';
import { apiFetch } from '../../lib/api';
import { toast } from '../../../../pages/Toast';
import { useResources } from '../../hooks/useResources';
import { useResourceCategories } from '../../hooks/useResourceCategories';
import { ResourceItem } from '../../types';
import {
  ErpPageHeader, ErpPrimaryButton, ErpSearchBar, ErpFilterTab, ErpFilterRail,
  ErpEmptyState, ErpLoadingState, ErpCard
} from '../../components/Erp/ErpUI';
import { Pagination } from '../../components/ui/Pagination';

import { AddResourceModal } from './components/AddResourceModal';
import { BookingModal } from './components/BookingModal';
import { ManageCategoriesModal } from './components/ManageCategoriesModal';
import { ResourceCard } from './components/ResourceCard';
import { ResourceTable } from './components/ResourceTable';

export function ResourcesPage({ canManage = true }: { canManage?: boolean }) {
  const darkMode = false;

  const { resources, loading } = useResources();
  const { categories, loading: categoriesLoading } = useResourceCategories();

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
    const options = categories.map(c => c.name);
    for (const r of resources) {
      if (!options.includes(r.type)) options.push(r.type);
    }
    return options;
  }, [categories, resources]);

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
    const matchesType = typeFilter === 'all' || r.type === typeFilter;
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
    <div className="space-y-6 text-left">
      <ErpPageHeader
        title="Quản lý Thiết bị & Tài nguyên"
        action={canManage ? (
          <div className="flex gap-2">
            <button
              onClick={() => setShowCategoryModal(true)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all border cursor-pointer shrink-0",
                darkMode
                  ? "bg-slate-800 hover:bg-slate-750 text-slate-200 border-slate-700"
                  : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
              )}
            >
              Quản lý phân loại
            </button>
            <ErpPrimaryButton onClick={() => { setEditingResource(null); setShowAddModal(true); }}>
              Khai báo tài nguyên mới
            </ErpPrimaryButton>
          </div>
        ) : undefined}
      />

      {/* Controls */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <ErpSearchBar value={searchTerm} onChange={setSearchTerm} placeholder="Tìm tài nguyên bằng tên hoặc số nhận diện..." />
        <div className="flex flex-wrap items-center gap-4">
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

          <div className={cn("flex items-center border p-1 rounded-xl gap-0.5 shrink-0", darkMode ? "border-slate-800 bg-slate-900/50" : "border-slate-200 bg-slate-50")}>
            <button
              type="button"
              onClick={() => { setViewMode('list'); localStorage.setItem('erp_view_mode_resources', 'list'); }}
              className={cn(
                "p-1.5 rounded-lg active:scale-95 transition-all cursor-pointer",
                viewMode === 'list'
                  ? (darkMode ? "bg-slate-800 text-white" : "bg-white text-slate-855 shadow-sm")
                  : "text-slate-400 hover:text-slate-650"
              )}
              title="Hiển thị dạng danh sách"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => { setViewMode('grid'); localStorage.setItem('erp_view_mode_resources', 'grid'); }}
              className={cn(
                "p-1.5 rounded-lg active:scale-95 transition-all cursor-pointer",
                viewMode === 'grid'
                  ? (darkMode ? "bg-slate-800 text-white" : "bg-white text-slate-855 shadow-sm")
                  : "text-slate-400 hover:text-slate-600"
              )}
              title="Hiển thị dạng lưới"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Grid or List Content */}
      {loading && resources.length === 0 ? (
        <ErpCard><ErpLoadingState message="Đang tải danh sách tài nguyên..." /></ErpCard>
      ) : filteredResources.length === 0 ? (
        <ErpCard>
          <ErpEmptyState
            icon={Warehouse}
            title="Chưa có tài nguyên nào"
            subtitle="Bấm 'Khai báo tài nguyên mới' để thêm phòng học, thiết bị hoặc công cụ giảng dạy."
          />
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
