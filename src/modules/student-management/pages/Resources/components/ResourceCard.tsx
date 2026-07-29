import React, { useMemo } from 'react';
import { CheckCircle, Clock, AlertTriangle, UserCheck, Trash2, Wrench, X, Pencil } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { ResourceItem } from '../../../types';
import { todayStr, getTypeColor } from '../utils';
import { CustomFieldDetails } from '../../../custom-fields/CustomFieldDetails';

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
    <div
      className={cn(
        "p-3 rounded-xl border flex flex-col justify-between transition-all duration-300 group",
        darkMode
          ? "bg-slate-900/60 border-slate-800/80 backdrop-blur-md hover:border-brand-primary/20"
          : "bg-white border-slate-200 hover:border-brand-primary/20 shadow-sm shadow-slate-100/50"
      )}
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className={cn("text-[9px] font-black uppercase tracking-widest", darkMode ? "text-slate-500" : "text-slate-400")}>
            {resource.identifier}
          </span>
          <span className={cn(
            "px-1.5 py-0.2 rounded text-[8px] font-black uppercase tracking-wider",
            getTypeColor(resource.type)
          )}>
            {resource.type}
          </span>
        </div>

        <h4 className={cn("text-xs font-black line-clamp-1 text-left mt-1", darkMode ? "text-slate-100" : "text-slate-800")}>
          {resource.name}
        </h4>
        <p className={cn("text-[9px] font-bold text-left", darkMode ? "text-slate-400" : "text-slate-550")}>
          Khả năng đáp ứng: <span className={cn("font-black", darkMode ? "text-slate-200" : "text-slate-705")}>{resource.capacity}</span>
        </p>

        {/* Status Section */}
        <div className={cn("pt-3 border-t space-y-2", darkMode ? "border-slate-800/30" : "border-slate-100")}>
          {resource.status === 'MAINTENANCE' ? (
            <div className="flex items-center gap-1.5 text-rose-500 text-xs font-bold text-left">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
              <span>Đang bảo trì sửa chữa</span>
            </div>
          ) : isOccupied && currentBooking ? (
            <div className={cn("p-2 border rounded-lg space-y-1 text-left", darkMode ? "bg-brand-primary/10 border-brand-primary/20" : "bg-cyan-50/50 border-cyan-100/60")}>
              <div className="flex items-center gap-1.5 text-brand-primary text-[9px] font-black uppercase">
                <Clock className="w-3 h-3" />
                <span>Đang bận: {currentBooking.startTime} - {currentBooking.endTime}</span>
              </div>
              <p className={cn("text-[9px] font-black truncate", darkMode ? "text-slate-200" : "text-slate-800")}>
                {currentBooking.purpose}
              </p>
              <p className="text-[8px] font-bold text-slate-500">Đăng ký bởi: {currentBooking.by}</p>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-emerald-500 text-xs font-bold text-left">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
              <span>Sẵn sàng sử dụng</span>
            </div>
          )}

          {/* Upcoming bookings */}
          {upcomingBookings.length > 0 && (
            <div className="space-y-1.5">
              {upcomingBookings.map((b) => (
                <div key={b.id} className={cn(
                  "flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border text-[9px] font-bold",
                  darkMode ? "bg-slate-800/40 border-slate-700/40 text-slate-355" : "bg-slate-50 border-slate-100 text-slate-655"
                )}>
                  <span className="truncate">
                    {b.date.split('-').reverse().join('/')} • {b.startTime}-{b.endTime} • {b.purpose} ({b.by})
                  </span>
                  {canManage && <button
                    onClick={() => onCancelBooking(resource, b.id)}
                    title="Hủy lịch đặt"
                    className="text-slate-400 hover:text-rose-500 transition-colors flex-shrink-0 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>}
                </div>
              ))}
            </div>
          )}

          <CustomFieldDetails moduleKey="resources" values={resource.customFields || {}} />
        </div>
      </div>

      {canManage && <div className={cn("flex items-center justify-between pt-2.5 mt-1.5 border-t", darkMode ? "border-slate-800/30" : "border-slate-100")}>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onEdit(resource)}
            title="Chỉnh sửa tài nguyên"
            className={cn(
              "p-1 rounded-md transition-colors border cursor-pointer",
              darkMode ? "text-slate-500 hover:text-cyan-400 bg-slate-800 hover:bg-slate-700 border-transparent" : "text-slate-400 hover:text-cyan-600 bg-slate-55 hover:bg-cyan-50 border-slate-205"
            )}
          >
            <Pencil className="w-3 h-3" />
          </button>
          <button
            onClick={() => onToggleMaintenance(resource)}
            title={resource.status === 'MAINTENANCE' ? 'Kết thúc bảo trì' : 'Chuyển sang bảo trì'}
            className={cn(
              "p-1 rounded-md transition-colors border cursor-pointer",
              darkMode ? "text-slate-500 hover:text-amber-400 bg-slate-800 hover:bg-slate-700 border-transparent" : "text-slate-400 hover:text-amber-500 bg-slate-55 hover:bg-slate-100 border-slate-205"
            )}
          >
            <Wrench className="w-3 h-3" />
          </button>
          <button
            onClick={() => onDelete(resource)}
            title="Xóa tài nguyên"
            className={cn(
              "p-1 rounded-md transition-colors border cursor-pointer",
              darkMode ? "text-slate-500 hover:text-rose-455 bg-slate-800 hover:bg-slate-750 border-transparent" : "text-slate-400 hover:text-rose-500 bg-slate-55 hover:bg-rose-50 border-slate-205"
            )}
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
        <button
          disabled={resource.status === 'MAINTENANCE'}
          onClick={() => onBook(resource)}
          className={cn(
            "flex items-center gap-1 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all border cursor-pointer",
            resource.status !== 'MAINTENANCE'
              ? "bg-brand-primary hover:bg-brand-primary/95 border-transparent text-white shadow-md active:scale-95"
              : (darkMode ? "bg-slate-800 text-slate-500 border-transparent cursor-not-allowed" : "bg-slate-100 text-slate-400 border-slate-200/50 cursor-not-allowed")
          )}
        >
          <UserCheck className="w-3 h-3" />
          Đặt mượn
        </button>
      </div>}
    </div>
  );
}
