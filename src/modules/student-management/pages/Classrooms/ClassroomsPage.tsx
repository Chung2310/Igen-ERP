import React, { useState, useMemo } from 'react';
import { List, LayoutGrid, School, CalendarCheck } from 'lucide-react';
import { cn } from '../../lib/utils';
import { apiFetch } from '../../lib/api';
import { toast } from '../../../../pages/Toast';
import { useResources } from '../../hooks/useResources';
import { ResourceItem } from '../../types';
import {
  ErpPageHeader, ErpPrimaryButton, ErpSearchBar,
  ErpEmptyState, ErpLoadingState, ErpCard
} from '../../components/Erp/ErpUI';
import { Pagination } from '../../components/ui/Pagination';

import { AddResourceModal } from '../Resources/components/AddResourceModal';
import { BookingModal } from '../Resources/components/BookingModal';
import { ResourceCard } from '../Resources/components/ResourceCard';
import { ResourceTable } from '../Resources/components/ResourceTable';

export function ClassroomsPage({ canManage = true }: { canManage?: boolean }) {
  const darkMode = false;

  const { resources, loading } = useResources();

  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingResource, setEditingResource] = useState<ResourceItem | null>(null);
  const [bookingResource, setBookingResource] = useState<ResourceItem | null>(null);

  const [viewMode, setViewMode] = useState<'list' | 'grid'>(() => {
    return (localStorage.getItem('erp_view_mode_classrooms') as 'list' | 'grid') || 'grid';
  });
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = viewMode === 'grid' ? 6 : 8;

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
      toast.success(`Đã xóa phòng học ${resource.name}.`);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Có lỗi xảy ra khi xóa phòng học.';
      toast.error(msg);
    }
  };

  const filteredResources = resources.filter(r => {
    const matchesSearch = r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.identifier.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = r.type === 'Phòng học';
    return matchesSearch && matchesType;
  });
  const totalPages = Math.ceil(filteredResources.length / pageSize);
  const paginatedResources = filteredResources.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1);
    }, 0);
    return () => clearTimeout(timer);
  }, [searchTerm, viewMode]);

  const refreshResources = () => {
    window.dispatchEvent(new Event('resource-mutation'));
  };

  return (
    <div className="space-y-6 text-left">
      <ErpPageHeader
        title="Quản lý Phòng học"
        subtitle="Danh sách các phòng học, giảng đường của trung tâm phục vụ công tác đào tạo."
        action={canManage ? (
          <ErpPrimaryButton onClick={() => { setEditingResource(null); setShowAddModal(true); }}>
            Khai báo phòng học mới
          </ErpPrimaryButton>
        ) : undefined}
      />

      {/* Controls */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <ErpSearchBar value={searchTerm} onChange={setSearchTerm} placeholder="Tìm phòng học bằng tên hoặc số phòng..." />
        <div className="flex items-center gap-4 ml-auto">
          <div className={cn("flex items-center border p-1 rounded-xl gap-0.5 shrink-0", darkMode ? "border-slate-800 bg-slate-900/50" : "border-slate-200 bg-slate-50")}>
            <button
              type="button"
              onClick={() => { setViewMode('list'); localStorage.setItem('erp_view_mode_classrooms', 'list'); }}
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
              onClick={() => { setViewMode('grid'); localStorage.setItem('erp_view_mode_classrooms', 'grid'); }}
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
        <ErpCard><ErpLoadingState message="Đang tải danh sách phòng học..." /></ErpCard>
      ) : filteredResources.length === 0 ? (
        <ErpCard>
          <ErpEmptyState
            icon={School}
            title="Chưa có phòng học nào"
            subtitle="Bấm 'Khai báo phòng học mới' để thêm phòng học vào danh sách."
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
              itemName="phòng học"
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
              itemName="phòng học"
            />
          }
        />
      )}

      {/* Add Resource Modal (Forced to ห้องเรียน / Phòng học) */}
      {canManage && <AddResourceModal
        isOpen={showAddModal || !!editingResource}
        onClose={() => { setShowAddModal(false); setEditingResource(null); }}
        categories={[]}
        onSuccess={refreshResources}
        resource={editingResource || undefined}
        forceType="Phòng học"
      />}

      {/* Booking Modal */}
      {canManage && <BookingModal
        bookingResource={bookingResource}
        onClose={() => setBookingResource(null)}
        onSuccess={refreshResources}
      />}
    </div>
  );
}
