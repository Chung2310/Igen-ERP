import React, { useState, useMemo } from 'react';
import { List, School, Clock, CalendarDays, Pencil, Trash2, SlidersHorizontal, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { apiFetch } from '../../lib/api';
import { toast } from '../../../../pages/Toast';
import { useResources } from '../../hooks/useResources';
import { useBatches } from '../../hooks/useBatches';
import { ResourceItem, Batch } from '../../types';
import {
  ErpPageHeader, ErpPrimaryButton, ErpSearchBar,
  ErpEmptyState, ErpLoadingState, ErpCard, ErpModal
} from '../../components/Erp/ErpUI';
import { Pagination } from '../../components/ui/Pagination';
import { AddResourceModal } from '../Resources/components/AddResourceModal';
import { ResourceTable } from '../Resources/components/ResourceTable';
import { PartnerFormDropdown } from '../Partners/components/PartnerFormDropdown';
import { VietnameseDatePicker } from '../../components/Batches/VietnameseDatePicker';

const DAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const DAY_COLORS = [
  'bg-purple-100 text-purple-700 border-purple-200',
  'bg-blue-100 text-blue-700 border-blue-200',
  'bg-cyan-100 text-cyan-700 border-cyan-200',
  'bg-teal-100 text-teal-700 border-teal-200',
  'bg-green-100 text-green-700 border-green-200',
  'bg-amber-100 text-amber-700 border-amber-200',
  'bg-orange-100 text-orange-700 border-orange-200',
];

const STATUS_COLORS: Record<string, string> = {
  'Sắp khai giảng': 'bg-blue-50 text-blue-700 border border-blue-200',
  'Đang học':       'bg-green-50 text-green-700 border border-green-200',
  'Đã kết thúc':   'bg-slate-100 text-slate-500 border border-slate-200',
};

interface RoomScheduleCardProps {
  room: ResourceItem;
  batches: Batch[];
  canManage: boolean;
  onEdit: (r: ResourceItem) => void;
  onDelete: (r: ResourceItem) => void;
  onViewSchedule: (r: ResourceItem) => void;
}

function RoomScheduleCard({ room, batches, canManage, onEdit, onDelete, onViewSchedule }: RoomScheduleCardProps) {
  // Lớp đang sử dụng phòng này (chưa kết thúc)
  const activeBatches = useMemo(
    () => batches.filter(b => b.location === room.name && b.status !== 'Đã kết thúc'),
    [batches, room.name]
  );

  const hasConflict = useMemo(() => {
    for (let d = 0; d <= 6; d++) {
      const slots = activeBatches.filter(b => b.daysOfWeek.includes(d));
      for (let i = 0; i < slots.length; i++) {
        for (let j = i + 1; j < slots.length; j++) {
          const b1 = slots[i];
          const b2 = slots[j];
          const dateOverlap = b1.startDate <= b2.endDate && b2.startDate <= b1.endDate;
          const timeOverlap = b1.startTime < b2.endTime && b2.startTime < b1.endTime;
          if (dateOverlap && timeOverlap) return true;
        }
      }
    }
    return false;
  }, [activeBatches]);

  return (
    <div className={cn(
      "p-4 rounded-xl border flex flex-col justify-between transition-colors group bg-white",
      hasConflict
        ? "border-rose-200"
        : "border-slate-200 hover:border-sky-200"
    )}>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-500">
            {room.identifier}
          </span>
          <span className={cn(
            "px-2 py-0.5 rounded-full text-[11px] font-medium border",
            hasConflict ? "bg-red-100 text-red-700 border-red-200" : "bg-blue-50 text-blue-700 border-blue-200"
          )}>
            {hasConflict ? "⚠ Trùng lịch" : "Phòng học"}
          </span>
        </div>

        <h4 className="text-sm font-medium line-clamp-1 text-left text-slate-800">
          {room.name}
        </h4>

        <div className="flex flex-col gap-1 text-xs text-left text-slate-600">
          <p>
            Sức chứa: <span className="font-medium text-slate-700">{room.capacity || '—'}</span>
          </p>
          <p>
            Đang sử dụng: <span className="font-medium text-brand-primary">{activeBatches.length} lớp học</span>
          </p>
        </div>

        {/* Separator / Footer action area */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
          {/* Action buttons (Edit/Delete) */}
          <div className="flex items-center gap-1.5">
            {canManage && (
              <>
                <button
                  onClick={() => onEdit(room)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-sky-100 text-slate-500 transition-colors hover:bg-sky-50 hover:text-sky-700 cursor-pointer"
                  title="Chỉnh sửa"
                  aria-label="Chỉnh sửa phòng học"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onDelete(room)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-100 text-rose-500 transition-colors hover:bg-rose-50 hover:text-rose-700 cursor-pointer"
                  title="Xóa"
                  aria-label="Xóa phòng học"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
          
          {/* View schedule popup trigger */}
          <button
            onClick={() => onViewSchedule(room)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-sky-100 text-brand-primary transition-colors hover:bg-sky-50 cursor-pointer shrink-0"
            title="Lịch học"
            aria-label={`Xem lịch học phòng ${room.name}`}
          >
            <CalendarDays className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

interface RoomScheduleModalProps {
  room: ResourceItem;
  batches: Batch[];
  onClose: () => void;
}

function RoomScheduleModal({ room, batches, onClose }: RoomScheduleModalProps) {
  const [viewType, setViewType] = useState<'week' | 'date'>('week');
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });

  const activeBatches = useMemo(
    () => batches.filter(b => b.location === room.name && b.status !== 'Đã kết thúc'),
    [batches, room.name]
  );

  const allBatches = useMemo(
    () => batches.filter(b => b.location === room.name),
    [batches, room.name]
  );

  const dateOccupants = useMemo(() => {
    if (!selectedDate) return [];
    const [y, m, d] = selectedDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const dayOfWeek = dateObj.getDay();

    return activeBatches.filter(b => {
      const inRange = selectedDate >= b.startDate && selectedDate <= b.endDate;
      if (!inRange) return false;
      return b.daysOfWeek.includes(dayOfWeek);
    });
  }, [activeBatches, selectedDate]);

  const scheduleByDay = useMemo(() => {
    const map: Record<number, { batch: Batch; slot: string; hasConflict?: boolean }[]> = {};
    for (let d = 0; d <= 6; d++) {
      map[d] = [];
    }
    for (const b of activeBatches) {
      for (const d of b.daysOfWeek) {
        map[d].push({ batch: b, slot: `${b.startTime} - ${b.endTime}` });
      }
    }
    for (let d = 0; d <= 6; d++) {
      const slots = map[d];
      for (let i = 0; i < slots.length; i++) {
        for (let j = i + 1; j < slots.length; j++) {
          const b1 = slots[i].batch;
          const b2 = slots[j].batch;
          const dateOverlap = b1.startDate <= b2.endDate && b2.startDate <= b1.endDate;
          const timeOverlap = b1.startTime < b2.endTime && b2.startTime < b1.endTime;
          if (dateOverlap && timeOverlap) {
            slots[i].hasConflict = true;
            slots[j].hasConflict = true;
          }
        }
      }
    }
    return map;
  }, [activeBatches]);

  return (
    <ErpModal title={`Lịch phòng học: ${room.name} (${room.identifier})`} titleClassName="font-medium" onClose={onClose} maxWidth="max-w-3xl">
      <div className="space-y-3 text-left">
        {/* Toggle View Mode */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <span className="text-xs text-slate-600">Chế độ hiển thị</span>
          <div className="flex rounded-lg border border-sky-100 bg-white p-1 text-sm">
            <button
              type="button"
              onClick={() => setViewType('week')}
              className={cn(
                "rounded-md px-3 py-1.5 font-medium transition-colors cursor-pointer",
                viewType === 'week' ? "bg-brand-primary text-white" : "text-slate-600 hover:bg-sky-50 hover:text-sky-700"
              )}
            >
              Theo Thứ
            </button>
            <button
              type="button"
              onClick={() => setViewType('date')}
              className={cn(
                "rounded-md px-3 py-1.5 font-medium transition-colors cursor-pointer",
                viewType === 'date' ? "bg-brand-primary text-white" : "text-slate-600 hover:bg-sky-50 hover:text-sky-700"
              )}
            >
              Theo Ngày cụ thể
            </button>
          </div>
        </div>

        {viewType === 'week' ? (
          <div className="space-y-3">
            {/* Week mini overview */}
            <div className="grid grid-cols-7 gap-1.5">
              {[0, 1, 2, 3, 4, 5, 6].map(day => {
                const slots = scheduleByDay[day];
                const isConflict = slots.some(s => s.hasConflict);
                return (
                  <div key={day} className="flex flex-col items-center gap-1">
                    <span className="text-xs font-medium text-slate-500">{DAY_LABELS[day]}</span>
                    {slots.length === 0 ? (
                      <div className="w-full h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center">
                        <span className="text-[10px] text-slate-300">—</span>
                      </div>
                    ) : (
                      <div className={cn(
                        "w-full h-8 rounded-lg flex items-center justify-center text-xs font-medium border",
                        isConflict ? "bg-red-100 text-red-700 border-red-300" : DAY_COLORS[day]
                      )}>
                        {isConflict ? `${slots.filter(s => s.hasConflict).length}!` : '●'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Week detailed breakdown */}
            <div className="space-y-2 border-t border-slate-100 pt-3">
              <p className="text-sm font-medium text-slate-800">Chi tiết lịch học</p>
              {[0, 1, 2, 3, 4, 5, 6].map(day => {
                const slots = scheduleByDay[day];
                if (slots.length === 0) return null;
                const isConflict = slots.some(s => s.hasConflict);
                return (
                  <div key={day} className={cn(
                    "rounded-lg border px-3 py-2",
                    isConflict ? "bg-rose-50/60 border-rose-200" : "bg-white border-slate-200"
                  )}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={cn(
                        "text-xs font-medium px-2 py-0.5 rounded-full border",
                        isConflict ? "bg-red-100 text-red-700 border-red-200" : DAY_COLORS[day]
                      )}>
                        {DAY_LABELS[day]}
                      </span>
                      {isConflict && (
                        <span className="text-xs text-red-600 font-semibold">⚠ Phát hiện trùng lịch (nhiều lớp cùng giờ)!</span>
                      )}
                    </div>
                    <div className="divide-y divide-slate-100">
                      {slots.map(({ batch, slot }) => (
                        <div key={batch.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2 text-xs first:pt-0 last:pb-0">
                          <div className="flex items-center gap-2">
                            <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="font-medium text-slate-700">{slot}</span>
                            <span className="text-slate-400">·</span>
                            <span className="font-medium text-slate-800">{batch.code}</span>
                            <span className="text-slate-500">{batch.courseTitle}</span>
                          </div>
                          <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0", STATUS_COLORS[batch.status])}>
                            {batch.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {activeBatches.length === 0 && (
                <div className="text-center py-5 text-sm text-slate-500 bg-white rounded-lg border border-slate-200">
                  Phòng học hiện chưa có lịch học nào.
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Date Input */}
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
              <span className="text-sm text-slate-600">Chọn ngày</span>
              <div className="w-44">
                <VietnameseDatePicker ariaLabel="Ngày xem lịch phòng" value={selectedDate} onChange={setSelectedDate} selectionOnly variant="filter" />
              </div>
            </div>

            {/* Date breakdown list */}
            {dateOccupants.length === 0 ? (
              <div className="text-center py-6 text-sm text-slate-500 bg-white border border-slate-200 rounded-lg">
                Không có lớp học nào sử dụng phòng vào ngày này.
              </div>
            ) : (
              <div className="space-y-2">
                {dateOccupants.map(b => (
                  <div key={b.id} className="bg-white border-b border-slate-100 px-2 py-3 flex flex-wrap items-center justify-between gap-2 text-sm last:border-b-0">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="font-medium text-slate-800">{b.startTime} - {b.endTime}</span>
                      <span className="text-slate-400">·</span>
                      <span className="font-medium text-slate-700">{b.code}</span>
                      <span className="text-slate-500">{b.courseTitle}</span>
                    </div>
                    <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0", STATUS_COLORS[b.status])}>
                      {b.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Ended/Historical Classes section */}
        {allBatches.filter(b => b.status === 'Đã kết thúc').length > 0 && (
          <div className="border-t border-slate-100 pt-3">
            <p className="text-sm font-medium text-slate-700 mb-2">Lớp đã kết thúc</p>
            <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 px-3">
              {allBatches.filter(b => b.status === 'Đã kết thúc').map(b => (
                <div key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs text-slate-500">
                  <span className="font-medium">{b.code}</span>
                  <span>{b.startDate} → {b.endDate}</span>
                  <span>{b.startTime} – {b.endTime}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </ErpModal>
  );
}

export function ClassroomsPage({ canManage = true }: { canManage?: boolean }) {
  const { resources, loading } = useResources();
  const { batches } = useBatches();

  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingResource, setEditingResource] = useState<ResourceItem | null>(null);
  const [resourcePendingDeletion, setResourcePendingDeletion] = useState<ResourceItem | null>(null);
  const [viewMode, setViewMode] = useState<'schedule' | 'list'>(() => {
    return (localStorage.getItem('erp_view_mode_classrooms') as 'schedule' | 'list') || 'schedule';
  });
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = viewMode === 'list' ? 8 : 6;

  // State to hold room details for modal view
  const [activeScheduleRoom, setActiveScheduleRoom] = useState<ResourceItem | null>(null);

  // Filter states
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterDayOfWeek, setFilterDayOfWeek] = useState('');
  const [filterStartTime, setFilterStartTime] = useState('');
  const [filterEndTime, setFilterEndTime] = useState('');

  const [showFilters, setShowFilters] = useState(false);

  const activeFiltersCount = useMemo(() => {
    return [selectedBatchId, filterDate, filterDayOfWeek, filterStartTime, filterEndTime, searchTerm].filter(Boolean).length;
  }, [selectedBatchId, filterDate, filterDayOfWeek, filterStartTime, filterEndTime, searchTerm]);

  const handleDelete = (resource: ResourceItem) => {
    setResourcePendingDeletion(resource);
  };

  const confirmDelete = async () => {
    if (!resourcePendingDeletion) return;
    const resource = resourcePendingDeletion;
    setResourcePendingDeletion(null);
    try {
      await apiFetch(`/student-resources/${resource.id}`, { method: 'DELETE' });
      window.dispatchEvent(new Event('resource-mutation'));
      toast.success(`Đã xóa phòng học ${resource.name}.`);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Có lỗi xảy ra khi xóa phòng học.';
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
      toast.success(nextStatus === 'MAINTENANCE' ? `${resource.name}: chuyển sang bảo trì.` : `${resource.name}: sẵn sàng sử dụng.`);
    } catch (error: unknown) {
      toast.error('Có lỗi xảy ra khi cập nhật trạng thái.');
    }
  };

  const classrooms = useMemo(
    () => resources.filter(r => r.type === 'Phòng học'),
    [resources]
  );

  const conflictCount = useMemo(() => {
    let count = 0;
    for (const room of classrooms) {
      const activeBatches = batches.filter(b => b.location === room.name && b.status !== 'Đã kết thúc');
      let roomHasConflict = false;
      for (let d = 0; d <= 6; d++) {
        const slots = activeBatches.filter(b => b.daysOfWeek.includes(d));
        for (let i = 0; i < slots.length; i++) {
          for (let j = i + 1; j < slots.length; j++) {
            const b1 = slots[i];
            const b2 = slots[j];
            const dateOverlap = b1.startDate <= b2.endDate && b2.startDate <= b1.endDate;
            const timeOverlap = b1.startTime < b2.endTime && b2.startTime < b1.endTime;
            if (dateOverlap && timeOverlap) {
              roomHasConflict = true;
              break;
            }
          }
          if (roomHasConflict) break;
        }
        if (roomHasConflict) break;
      }
      if (roomHasConflict) count++;
    }
    return count;
  }, [classrooms, batches]);

  const filtered = useMemo(() => {
    return classrooms.filter(r => {
      // 1. Search text filter
      const matchesSearch = r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.identifier.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchesSearch) return false;

      // 2. Filter by Batch
      if (selectedBatchId) {
        const batch = batches.find(b => b.id === selectedBatchId);
        if (!batch || batch.location !== r.name) return false;
      }

      // 3. Filter by Date
      if (filterDate) {
        const [y, m, d] = filterDate.split('-').map(Number);
        const dateObj = new Date(y, m - 1, d);
        const dayOfWeek = dateObj.getDay();

        const hasActiveBatchOnDate = batches.some(b => {
          if (b.location !== r.name || b.status === 'Đã kết thúc') return false;
          const inRange = filterDate >= b.startDate && filterDate <= b.endDate;
          const onDay = b.daysOfWeek.includes(dayOfWeek);
          return inRange && onDay;
        });
        if (!hasActiveBatchOnDate) return false;
      }

      // 4. Filter by Day of Week
      if (filterDayOfWeek) {
        const targetDay = Number(filterDayOfWeek);
        const hasActiveBatchOnDay = batches.some(b => {
          if (b.location !== r.name || b.status === 'Đã kết thúc') return false;
          return b.daysOfWeek.includes(targetDay);
        });
        if (!hasActiveBatchOnDay) return false;
      }

      // 5. Filter by Time Range
      if (filterStartTime && filterEndTime) {
        const hasActiveBatchOnTime = batches.some(b => {
          if (b.location !== r.name || b.status === 'Đã kết thúc') return false;
          
          // Optionally constrain by date if filterDate is set
          if (filterDate) {
            const [y, m, d] = filterDate.split('-').map(Number);
            const dateObj = new Date(y, m - 1, d);
            const dayOfWeek = dateObj.getDay();
            const inRange = filterDate >= b.startDate && filterDate <= b.endDate;
            const onDay = b.daysOfWeek.includes(dayOfWeek);
            if (!inRange || !onDay) return false;
          }
          // Optionally constrain by day of week if filterDayOfWeek is set
          if (filterDayOfWeek) {
            const targetDay = Number(filterDayOfWeek);
            if (!b.daysOfWeek.includes(targetDay)) return false;
          }

          // Check if time ranges overlap
          return b.startTime < filterEndTime && filterStartTime < b.endTime;
        });
        if (!hasActiveBatchOnTime) return false;
      }

      return true;
    });
  }, [classrooms, searchTerm, selectedBatchId, filterDate, filterDayOfWeek, filterStartTime, filterEndTime, batches]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  React.useEffect(() => {
    const t = setTimeout(() => setCurrentPage(1), 0);
    return () => clearTimeout(t);
  }, [searchTerm, viewMode]);

  return (
    <div className="space-y-6 text-left">
      <ErpPageHeader
        title="Quản lý Phòng học"
        subtitle={
          conflictCount > 0
            ? `⚠ Có ${conflictCount} phòng học đang bị trùng lịch — kiểm tra ngay!`
            : "Danh sách phòng học và lịch sử dụng của từng phòng."
        }
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              aria-expanded={showFilters}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap",
                showFilters
                  ? "bg-sky-50 border-sky-200 text-sky-700"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-sky-50 hover:border-sky-200"
              )}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>{showFilters ? "Đóng bộ lọc" : "Bộ lọc"}</span>
              {activeFiltersCount > 0 && (
                <span className={cn(
                  "flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-medium",
                  "bg-brand-primary text-white"
                )}>
                  {activeFiltersCount}
                </span>
              )}
            </button>
            {canManage && (
              <ErpPrimaryButton onClick={() => { setEditingResource(null); setShowAddModal(true); }}>
                Khai báo phòng học mới
              </ErpPrimaryButton>
            )}
          </div>
        }
      />

      {/* Search & Advanced Filters Panel (Collapsible) */}
      {showFilters && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-left animate-fadeIn">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-12">
            {/* Search Input */}
            <div className="xl:col-span-3">
              <label className="mb-1.5 block text-xs font-medium text-slate-600">Tìm phòng</label>
              <ErpSearchBar value={searchTerm} onChange={setSearchTerm} placeholder="Tên hoặc mã số phòng..." />
            </div>

            {/* Filter by Batch */}
            <div className="xl:col-span-3">
              <label className="mb-1.5 block text-xs font-medium text-slate-600">Lớp học</label>
              <PartnerFormDropdown
                label="Lọc theo lớp học"
                value={selectedBatchId}
                onChange={setSelectedBatchId}
                triggerClassName="flex h-9 w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 text-left text-sm text-slate-700 transition-colors hover:bg-sky-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00adfc]"
                options={[
                  { value: '', label: 'Tất cả các lớp' },
                  ...batches.filter(b => b.status !== 'Đã kết thúc').map(b => ({ value: b.id, label: `${b.code} (${b.courseTitle})` })),
                ]}
              />
            </div>

            {/* Filter by Date */}
            <div className="xl:col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-slate-600">Ngày học</label>
              <VietnameseDatePicker ariaLabel="Ngày học" value={filterDate} onChange={setFilterDate} selectionOnly variant="filter" />
            </div>

            {/* Filter by Day of Week */}
            <div className="xl:col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-slate-600">Thứ trong tuần</label>
              <PartnerFormDropdown
                label="Lọc theo thứ"
                value={filterDayOfWeek}
                onChange={setFilterDayOfWeek}
                triggerClassName="flex h-9 w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 text-left text-sm text-slate-700 transition-colors hover:bg-sky-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00adfc]"
                options={[
                  { value: '', label: 'Tất cả các thứ' },
                  { value: '1', label: 'Thứ Hai' },
                  { value: '2', label: 'Thứ Ba' },
                  { value: '3', label: 'Thứ Tư' },
                  { value: '4', label: 'Thứ Năm' },
                  { value: '5', label: 'Thứ Sáu' },
                  { value: '6', label: 'Thứ Bảy' },
                  { value: '0', label: 'Chủ Nhật' },
                ]}
              />
            </div>

            {/* Filter by Time Range */}
            <div className="xl:col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-slate-600">Khung giờ</label>
              <div className="flex items-center gap-1">
                <input
                  type="time"
                  value={filterStartTime}
                  onChange={(e) => setFilterStartTime(e.target.value)}
                  className="h-9 min-w-0 w-1/2 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700 outline-none transition focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10 cursor-pointer"
                  title="Giờ bắt đầu"
                  aria-label="Giờ bắt đầu"
                />
                <span className="text-slate-400 text-xs">–</span>
                <input
                  type="time"
                  value={filterEndTime}
                  onChange={(e) => setFilterEndTime(e.target.value)}
                  className="h-9 min-w-0 w-1/2 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700 outline-none transition focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10 cursor-pointer"
                  title="Giờ kết thúc"
                  aria-label="Giờ kết thúc"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Info & View Switcher Bar (Always visible) */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-left">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2.5 py-1 rounded-full bg-slate-50 text-slate-600 text-xs">
            {classrooms.length} phòng tổng số
          </span>
          <span className="px-2.5 py-1 rounded-full bg-sky-50 text-brand-primary text-xs">
            Lọc được {filtered.length} phòng
          </span>
          {conflictCount > 0 && (
            <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-100 text-xs">
              ⚠ {conflictCount} phòng trùng lịch
            </span>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          {(selectedBatchId || filterDate || filterDayOfWeek || filterStartTime || filterEndTime || searchTerm) && (
            <button
              onClick={() => {
                setSelectedBatchId('');
                setFilterDate('');
                setFilterDayOfWeek('');
                setFilterStartTime('');
                setFilterEndTime('');
                setSearchTerm('');
              }}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-100 text-rose-500 transition-colors hover:bg-rose-50 hover:text-rose-700 cursor-pointer"
              title="Xóa bộ lọc"
              aria-label="Xóa bộ lọc"
            >
              <X className="h-4 w-4" />
            </button>
          )}

          {/* View Mode Switcher */}
          <div className="flex items-center border border-sky-100 bg-white p-1 rounded-lg gap-1 shrink-0">
            <button
              type="button"
              onClick={() => { setViewMode('schedule'); localStorage.setItem('erp_view_mode_classrooms', 'schedule'); }}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-md transition-colors cursor-pointer",
                viewMode === 'schedule' ? "bg-sky-50 text-sky-700" : "text-slate-500 hover:bg-slate-50"
              )}
              title="Xem lưới"
              aria-label="Xem dạng lịch"
            >
              <CalendarDays className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => { setViewMode('list'); localStorage.setItem('erp_view_mode_classrooms', 'list'); }}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-md transition-colors cursor-pointer",
                viewMode === 'list' ? "bg-sky-50 text-sky-700" : "text-slate-500 hover:bg-slate-50"
              )}
              title="Xem danh sách"
              aria-label="Xem dạng danh sách"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading && classrooms.length === 0 ? (
        <ErpCard><ErpLoadingState message="Đang tải danh sách phòng học..." /></ErpCard>
      ) : filtered.length === 0 ? (
        <ErpCard>
          <ErpEmptyState
            icon={School}
            title="Chưa có phòng học nào"
            subtitle="Bấm 'Khai báo phòng học mới' để thêm phòng học vào danh sách."
          />
        </ErpCard>
      ) : viewMode === 'schedule' ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {paginated.map(room => (
              <RoomScheduleCard
                key={room.id}
                room={room}
                batches={batches}
                canManage={canManage}
                onEdit={setEditingResource}
                onDelete={handleDelete}
                onViewSchedule={setActiveScheduleRoom}
              />
            ))}
          </div>
          <ErpCard className="overflow-hidden">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              totalItems={filtered.length}
              pageSize={pageSize}
              itemName="phòng học"
            />
          </ErpCard>
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-left">
            <thead className="bg-sky-50/70 text-xs font-medium text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Mã phòng</th>
                <th className="px-4 py-3 font-medium">Tên phòng học</th>
                <th className="px-4 py-3 font-medium">Sức chứa</th>
                <th className="px-4 py-3 font-medium">Số lớp đang sử dụng</th>
                <th className="px-4 py-3 text-right font-medium">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs text-slate-700 bg-white">
              {paginated.map(room => {
                const activeCount = batches.filter(b => b.location === room.name && b.status !== 'Đã kết thúc').length;
                return (
                  <tr key={room.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-normal text-slate-600">{room.identifier}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{room.name}</td>
                    <td className="px-4 py-3 text-slate-700">{room.capacity || '—'}</td>
                    <td className="px-4 py-3 text-brand-primary">{activeCount} lớp học</td>
                    <td className="px-4 py-3.5 text-right flex items-center justify-end gap-2">
                      <button
                        onClick={() => setActiveScheduleRoom(room)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-sky-100 text-brand-primary transition-colors hover:bg-sky-50 cursor-pointer"
                        title="Lịch học"
                        aria-label={`Xem lịch học phòng ${room.name}`}
                      >
                        <CalendarDays className="w-4 h-4" />
                      </button>
                      {canManage && (
                        <>
                          <button
                            onClick={() => setEditingResource(room)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-sky-100 text-slate-500 transition-colors hover:bg-sky-50 hover:text-sky-700 cursor-pointer"
                            title="Sửa"
                            aria-label="Sửa phòng học"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(room)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-100 text-rose-500 transition-colors hover:bg-rose-50 hover:text-rose-700 cursor-pointer"
                            title="Xóa"
                            aria-label="Xóa phòng học"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="p-3 border-t border-slate-100">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              totalItems={filtered.length}
              pageSize={pageSize}
              itemName="phòng học"
            />
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {canManage && (
        <AddResourceModal
          isOpen={showAddModal || !!editingResource}
          onClose={() => { setShowAddModal(false); setEditingResource(null); }}
          categories={[]}
          onSuccess={() => window.dispatchEvent(new Event('resource-mutation'))}
          resource={editingResource || undefined}
          forceType="Phòng học"
        />
      )}

      {resourcePendingDeletion && (
        <ErpModal
          title="Xóa phòng học"
          titleClassName="font-medium"
          onClose={() => setResourcePendingDeletion(null)}
          maxWidth="max-w-md"
        >
          <div className="space-y-4 text-left">
            <p className="text-sm text-slate-600">
              Bạn muốn xóa phòng học “{resourcePendingDeletion.name}”?
            </p>
            <div className="flex justify-end border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => void confirmDelete()}
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-500 text-white transition-colors hover:bg-rose-600"
                title="Xác nhận xóa phòng học"
                aria-label="Xác nhận xóa phòng học"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </ErpModal>
      )}

      {/* View Schedule Modal Popup */}
      {activeScheduleRoom && (
        <RoomScheduleModal
          room={activeScheduleRoom}
          batches={batches}
          onClose={() => setActiveScheduleRoom(null)}
        />
      )}
    </div>
  );
}
