import React, { useMemo } from 'react';
import { AlertTriangle, Clock, CheckCircle, Wrench, Trash2, Pencil } from 'lucide-react';
import { ResourceItem } from '../../../types';
import { ErpCard, ErpTableHead } from '../../../components/Erp/ErpUI';
import { todayStr } from '../utils';

interface ResourceTableProps {
  resources: ResourceItem[];
  canManage?: boolean;
  onBook: (r: ResourceItem) => void;
  onEdit: (r: ResourceItem) => void;
  onToggleMaintenance: (r: ResourceItem) => void;
  onDelete: (r: ResourceItem) => void;
  footer?: React.ReactNode;
}

export function ResourceTable({
  resources,
  canManage = true,
  onBook,
  onEdit,
  onToggleMaintenance,
  onDelete,
  footer,
}: ResourceTableProps) {
  return (
    <ErpCard className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left border-collapse">
          <ErpTableHead columns={['Mã nhận diện', 'Tên tài nguyên', 'Phân loại', 'Khả năng đáp ứng', 'Hiện trạng', 'Thao tác']} />
          <tbody className="divide-y divide-outline-variant">
            {resources.map((resource) => (
              <ResourceTableRow
                key={resource.id}
                resource={resource}
                canManage={canManage}
                onBook={onBook}
                onEdit={onEdit}
                onToggleMaintenance={onToggleMaintenance}
                onDelete={onDelete}
              />
            ))}
          </tbody>
        </table>
      </div>
      {footer}
    </ErpCard>
  );
}

interface ResourceTableRowProps {
  key?: React.Key;
  resource: ResourceItem;
  canManage: boolean;
  onBook: (r: ResourceItem) => void;
  onEdit: (r: ResourceItem) => void;
  onToggleMaintenance: (r: ResourceItem) => void;
  onDelete: (r: ResourceItem) => void;
}

function ResourceTableRow({
  resource,
  canManage,
  onBook,
  onEdit,
  onToggleMaintenance,
  onDelete,
}: ResourceTableRowProps) {
  const currentBooking = useMemo(() => {
    const today = todayStr();
    const hhmm = new Date().toTimeString().slice(0, 5);
    return resource.bookings.find(b => b.date === today && b.startTime <= hhmm && b.endTime > hhmm);
  }, [resource.bookings]);

  const upcomingBookings = useMemo(() => {
    const today = todayStr();
    const hhmm = new Date().toTimeString().slice(0, 5);
    return resource.bookings
      .filter(b => {
        if (b.date < today) return false;
        if (b.date === today && b.startTime <= hhmm && b.endTime > hhmm) return false;
        return true;
      })
      .sort((a, b) => (a.date === b.date ? a.startTime.localeCompare(b.startTime) : a.date.localeCompare(b.date)))
      .slice(0, 2);
  }, [resource.bookings]);

  const isOccupied = !!currentBooking;

  return (
    <tr className="text-on-surface hover:bg-surface-container-low">
      <td className="py-2.5 px-4 text-left text-sm font-medium text-on-surface">{resource.identifier}</td>
      <td className="py-2.5 px-4 text-left text-sm font-medium text-on-surface">{resource.name}</td>
      <td className="py-2.5 px-4 text-left">
        <span className="rounded border border-outline-variant bg-surface-container-low px-2 py-0.5 text-xs font-medium text-on-surface-variant">
          {resource.type}
        </span>
      </td>
      <td className="py-2.5 px-4 text-left text-sm font-normal tabular-nums text-on-surface">{resource.capacity}</td>
      <td className="py-2.5 px-4 space-y-1 text-left">
        {resource.status === 'MAINTENANCE' ? (
          <span className="inline-flex items-center gap-1 text-rose-600 text-xs font-medium">
            <AlertTriangle className="w-3.5 h-3.5" /> Bảo trì
          </span>
        ) : isOccupied && currentBooking ? (
          <div className="space-y-0.5">
            <span className="inline-flex items-center gap-1 text-on-surface-variant text-xs font-medium">
              <Clock className="w-3 h-3" /> Đang bận ({currentBooking.startTime}-{currentBooking.endTime})
            </span>
            <div className="max-w-xs truncate text-xs text-on-surface-variant">{currentBooking.purpose} ({currentBooking.by})</div>
          </div>
        ) : (
          <span className="inline-flex items-center gap-1 text-emerald-700 text-xs font-medium">
            <CheckCircle className="w-3.5 h-3.5" /> Sẵn sàng
          </span>
        )}
        {upcomingBookings.length > 0 && (
          <div className="text-xs text-on-surface-variant">
            Lịch sắp tới: {upcomingBookings.map(b => `${b.startTime}-${b.endTime}`).join(', ')}
          </div>
        )}
      </td>
      <td className="py-2.5 px-4 text-left">
        {canManage && <div className="flex items-center gap-2">
          <button
            onClick={() => onEdit(resource)}
            title="Chỉnh sửa tài nguyên"
            aria-label="Chỉnh sửa tài nguyên"
            className="cursor-pointer rounded-md border border-outline-variant bg-surface-container-lowest p-1.5 text-on-surface-variant hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          >
            <Pencil className="size-3.5" aria-hidden="true" />
          </button>
          <button
            onClick={() => onToggleMaintenance(resource)}
            title={resource.status === 'MAINTENANCE' ? 'Kết thúc bảo trì' : 'Chuyển sang bảo trì'}
            aria-label={resource.status === 'MAINTENANCE' ? 'Kết thúc bảo trì' : 'Chuyển sang bảo trì'}
            className="cursor-pointer rounded-md border border-outline-variant bg-surface-container-lowest p-1.5 text-on-surface-variant hover:bg-surface-container-low focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          >
            <Wrench className="size-3.5" aria-hidden="true" />
          </button>
          <button
            disabled={resource.status === 'MAINTENANCE'}
            onClick={() => onBook(resource)}
            className="cursor-pointer rounded-md border border-primary bg-primary px-3 py-1.5 text-xs font-medium text-on-primary hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:border-outline-variant disabled:bg-surface-container-low disabled:text-on-surface-variant"
          >
            Đặt mượn
          </button>
          <button
            onClick={() => onDelete(resource)}
            title="Xóa tài nguyên"
            aria-label="Xóa tài nguyên"
            className="cursor-pointer rounded-md border border-outline-variant bg-surface-container-lowest p-1.5 text-on-surface-variant hover:text-rose-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
          </button>
        </div>}
      </td>
    </tr>
  );
}
