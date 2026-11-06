import React, { useMemo } from 'react';
import { CheckCircle, Clock, AlertTriangle, UserCheck, Trash2, Wrench, X, Pencil } from 'lucide-react';
import { ResourceItem } from '../../../types';
import { todayStr } from '../utils';
import { CustomFieldDetails } from '../../../../shared/custom-fields/CustomFieldDetails';
import { ErpCard } from '../../../components/Erp/ErpUI';

interface ResourceCardProps {
  key?: React.Key;
  resource: ResourceItem;
  canManage?: boolean;
  onBook: (r: ResourceItem) => void;
  onEdit: (r: ResourceItem) => void;
  onToggleMaintenance: (r: ResourceItem) => void;
  onDelete: (r: ResourceItem) => void;
  onCancelBooking: (r: ResourceItem, bookingId?: string) => void;
}

export function ResourceCard({
  resource,
  canManage = true,
  onBook,
  onEdit,
  onToggleMaintenance,
  onDelete,
  onCancelBooking,
}: ResourceCardProps) {
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
    <ErpCard className="group flex min-w-0 flex-col justify-between gap-3 p-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="min-w-0 truncate text-xs font-medium text-on-surface-variant">
            {resource.identifier}
          </span>
          <span className="ml-2 shrink-0 rounded border border-outline-variant bg-surface-container-low px-2 py-0.5 text-xs font-medium text-on-surface-variant">
            {resource.type}
          </span>
        </div>

        <h4 className="line-clamp-2 text-balance text-left text-base font-semibold text-on-surface">
          {resource.name}
        </h4>
        <p className="text-pretty text-left text-sm text-on-surface-variant">
          Khả năng đáp ứng: <span className="font-medium tabular-nums text-on-surface">{resource.capacity}</span>
        </p>

        {/* Status Section */}
        <div className="space-y-2 border-t border-outline-variant pt-3">
          {resource.status === 'MAINTENANCE' ? (
            <div className="flex items-center gap-1.5 text-left text-sm font-medium text-rose-600">
              <AlertTriangle className="size-3.5" aria-hidden="true" />
              <span>Đang bảo trì sửa chữa</span>
            </div>
          ) : isOccupied && currentBooking ? (
            <div className="space-y-1 rounded-md border border-outline-variant bg-surface-container-low p-2 text-left">
              <div className="flex items-center gap-1.5 text-xs font-medium text-on-surface-variant">
                <Clock className="size-3" aria-hidden="true" />
                <span>Đang bận: {currentBooking.startTime} - {currentBooking.endTime}</span>
              </div>
              <p className="truncate text-sm font-medium text-on-surface">
                {currentBooking.purpose}
              </p>
              <p className="text-pretty text-xs text-on-surface-variant">Đăng ký bởi: {currentBooking.by}</p>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-left text-sm font-medium text-emerald-700">
              <CheckCircle className="size-3.5" aria-hidden="true" />
              <span>Sẵn sàng sử dụng</span>
            </div>
          )}

          {/* Upcoming bookings */}
          {upcomingBookings.length > 0 && (
            <div className="space-y-1.5">
              {upcomingBookings.map((b) => (
                <div key={b.id} className="flex items-center justify-between gap-2 rounded-md border border-outline-variant bg-surface-container-low px-2.5 py-1.5 text-xs font-normal text-on-surface-variant">
                  <span className="truncate">
                    {b.date.split('-').reverse().join('/')} • {b.startTime}-{b.endTime} • {b.purpose} ({b.by})
                  </span>
                  {canManage && <button
                    onClick={() => onCancelBooking(resource, b.id)}
                    title="Hủy lịch đặt"
                    aria-label="Hủy lịch đặt"
                    className="flex-shrink-0 cursor-pointer text-on-surface-variant hover:text-rose-600 focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    <X className="size-3" aria-hidden="true" />
                  </button>}
                </div>
              ))}
            </div>
          )}

          <CustomFieldDetails moduleKey="resources" values={resource.customFields || {}} />
        </div>
      </div>

      {canManage && <div className="flex items-center justify-between border-t border-outline-variant pt-3">
        <div className="flex items-center gap-1">
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
            onClick={() => onDelete(resource)}
            title="Xóa tài nguyên"
            aria-label="Xóa tài nguyên"
            className="cursor-pointer rounded-md border border-outline-variant bg-surface-container-lowest p-1.5 text-on-surface-variant hover:text-rose-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
          </button>
        </div>
        <button
          disabled={resource.status === 'MAINTENANCE'}
          onClick={() => onBook(resource)}
          className="flex cursor-pointer items-center gap-1.5 rounded-md border border-primary bg-primary px-3 py-1.5 text-xs font-medium text-on-primary hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:border-outline-variant disabled:bg-surface-container-low disabled:text-on-surface-variant"
        >
          <UserCheck className="size-3.5" aria-hidden="true" />
          Đặt mượn
        </button>
      </div>}
    </ErpCard>
  );
}
