import React, { useMemo } from 'react';
import { AlertTriangle, Clock, CheckCircle, Wrench, Trash2 } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { ResourceItem } from '../../../types';
import { ErpCard, ErpTableHead } from '../../../components/Erp/ErpUI';
import { todayStr, getTypeColor } from '../utils';

interface ResourceTableProps {
  resources: ResourceItem[];
  onBook: (r: ResourceItem) => void;
  onToggleMaintenance: (r: ResourceItem) => void;
  onDelete: (r: ResourceItem) => void;
  footer?: React.ReactNode;
}

export function ResourceTable({
  resources,
  onBook,
  onToggleMaintenance,
  onDelete,
  footer,
}: ResourceTableProps) {
  const darkMode = false;

  return (
    <ErpCard className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left border-collapse">
          <ErpTableHead columns={['Mã nhận diện', 'Tên tài nguyên', 'Phân loại', 'Khả năng đáp ứng', 'Hiện trạng', 'Thao tác']} />
          <tbody className={cn("divide-y", darkMode ? "divide-slate-800/30" : "divide-slate-100")}>
            {resources.map((resource) => (
              <ResourceTableRow
                key={resource.id}
                resource={resource}
                onBook={onBook}
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
  onBook: (r: ResourceItem) => void;
  onToggleMaintenance: (r: ResourceItem) => void;
  onDelete: (r: ResourceItem) => void;
}

function ResourceTableRow({
  resource,
  onBook,
  onToggleMaintenance,
  onDelete,
}: ResourceTableRowProps) {
  const darkMode = false;

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
    <tr className={cn("transition-colors", darkMode ? "text-slate-355 hover:bg-slate-800/10" : "text-slate-600 hover:bg-slate-50/40")}>
      <td className="py-2.5 px-4 font-black text-sm text-left">{resource.identifier}</td>
      <td className="py-2.5 px-4 font-bold text-left">{resource.name}</td>
      <td className="py-2.5 px-4 text-left">
        <span className={cn(
          "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider",
          getTypeColor(resource.type)
        )}>
          {resource.type}
        </span>
      </td>
      <td className="py-2.5 px-4 font-bold text-left">{resource.capacity}</td>
      <td className="py-2.5 px-4 space-y-1 text-left">
        {resource.status === 'MAINTENANCE' ? (
          <span className="inline-flex items-center gap-1 text-rose-500 font-bold text-[10px]">
            <AlertTriangle className="w-3.5 h-3.5" /> Bảo trì
          </span>
        ) : isOccupied && currentBooking ? (
          <div className="space-y-0.5">
            <span className="inline-flex items-center gap-1 text-brand-primary font-black text-[10px]">
              <Clock className="w-3 h-3" /> Đang bận ({currentBooking.startTime}-{currentBooking.endTime})
            </span>
            <div className="text-[9px] text-slate-400 font-bold truncate max-w-xs">{currentBooking.purpose} ({currentBooking.by})</div>
          </div>
        ) : (
          <span className="inline-flex items-center gap-1 text-emerald-500 font-bold text-[10px]">
            <CheckCircle className="w-3.5 h-3.5" /> Sẵn sàng
          </span>
        )}
        {upcomingBookings.length > 0 && (
          <div className="text-[8px] text-slate-400 font-bold">
            Lịch sắp tới: {upcomingBookings.map(b => `${b.startTime}-${b.endTime}`).join(', ')}
          </div>
        )}
      </td>
      <td className="py-2.5 px-4 text-left">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onToggleMaintenance(resource)}
            title={resource.status === 'MAINTENANCE' ? 'Kết thúc bảo trì' : 'Chuyển sang bảo trì'}
            className={cn(
              "p-1.5 rounded-lg transition-colors border cursor-pointer",
              darkMode ? "text-slate-400 hover:text-amber-400 bg-slate-800 hover:bg-slate-700 border-transparent" : "text-slate-500 hover:text-amber-500 bg-slate-50 hover:bg-slate-100 border-slate-200/60"
            )}
          >
            <Wrench className="w-3.5 h-3.5" />
          </button>
          <button
            disabled={resource.status === 'MAINTENANCE'}
            onClick={() => onBook(resource)}
            className={cn(
              "px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all border cursor-pointer",
              resource.status !== 'MAINTENANCE'
                ? "bg-brand-primary text-white border-transparent"
                : "bg-slate-100 text-slate-400 border-slate-200/50 cursor-not-allowed"
            )}
          >
            Đặt mượn
          </button>
          <button
            onClick={() => onDelete(resource)}
            title="Xóa tài nguyên"
            className={cn(
              "p-1.5 rounded-lg transition-colors border cursor-pointer",
              darkMode ? "text-slate-450 hover:text-rose-455 bg-slate-800 hover:bg-rose-900/40 border-transparent" : "text-slate-500 hover:text-rose-500 bg-slate-50 hover:bg-rose-550 border-slate-200/60"
            )}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}
