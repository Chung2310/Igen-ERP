import React, { useState, useMemo } from 'react';
import { List, LayoutGrid, School, Clock, Users, CalendarDays, ChevronDown, ChevronRight, Eye } from 'lucide-react';
import { cn } from '../../lib/utils';
import { apiFetch } from '../../lib/api';
import { toast } from '../../../../pages/Toast';
import { useResources } from '../../hooks/useResources';
import { useBatches } from '../../hooks/useBatches';
import { ResourceItem, Batch } from '../../types';
import {
  ErpPageHeader, ErpPrimaryButton, ErpSearchBar,
  ErpEmptyState, ErpLoadingState, ErpCard
} from '../../components/Erp/ErpUI';
import { Pagination } from '../../components/ui/Pagination';
import { AddResourceModal } from '../Resources/components/AddResourceModal';
import { ResourceTable } from '../Resources/components/ResourceTable';

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
}

function RoomScheduleCard({ room, batches, canManage, onEdit, onDelete }: RoomScheduleCardProps) {
  const [expanded, setExpanded] = useState(false);

  // Lớp đang sử dụng phòng này (chưa kết thúc)
  const activeBatches = useMemo(
    () => batches.filter(b => b.location === room.name && b.status !== 'Đã kết thúc'),
    [batches, room.name]
  );

  const allBatches = useMemo(
    () => batches.filter(b => b.location === room.name),
    [batches, room.name]
  );

  // Tổng hợp lịch học theo thứ
  const scheduleByDay = useMemo(() => {
    const map: Record<number, { batch: Batch; slot: string }[]> = {};
    for (let d = 0; d <= 6; d++) {
      map[d] = [];
    }
    for (const b of activeBatches) {
      for (const d of b.daysOfWeek) {
        map[d].push({ batch: b, slot: `${b.startTime} - ${b.endTime}` });
      }
    }
    return map;
  }, [activeBatches]);

  const hasConflict = useMemo(() => {
    for (let d = 0; d <= 6; d++) {
      if (scheduleByDay[d].length > 1) return true;
    }
    return false;
  }, [scheduleByDay]);

  return (
    <div className={cn(
      "rounded-2xl border bg-white overflow-hidden transition-all",
      hasConflict ? "border-red-300 shadow-red-100 shadow-md" : "border-slate-200 shadow-sm"
    )}>
      {/* Header */}
      <div className="px-5 py-4 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{room.identifier}</span>
            {hasConflict && (
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-100 text-red-600 border border-red-200">
                ⚠ Trùng lịch
              </span>
            )}
          </div>
          <h3 className="font-bold text-slate-800 text-base truncate">{room.name}</h3>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              Sức chứa: {room.capacity || '—'}
            </span>
            <span className="flex items-center gap-1">
              <CalendarDays className="w-3.5 h-3.5" />
              {activeBatches.length} lớp đang dùng
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {canManage && (
            <>
              <button
                onClick={() => onEdit(room)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
                title="Chỉnh sửa"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button
                onClick={() => onDelete(room)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all cursor-pointer"
                title="Xóa"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5" />
            Lịch
            {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Weekly schedule grid (always visible as mini-summary) */}
      <div className="px-5 pb-4">
        <div className="grid grid-cols-7 gap-1">
          {[0, 1, 2, 3, 4, 5, 6].map(day => {
            const slots = scheduleByDay[day];
            const isConflict = slots.length > 1;
            return (
              <div key={day} className="flex flex-col items-center gap-1">
                <span className="text-[10px] font-bold text-slate-400">{DAY_LABELS[day]}</span>
                {slots.length === 0 ? (
                  <div className="w-full h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center">
                    <span className="text-[9px] text-slate-300">—</span>
                  </div>
                ) : (
                  <div className={cn(
                    "w-full h-8 rounded-lg flex items-center justify-center text-[9px] font-black border",
                    isConflict
                      ? "bg-red-100 text-red-700 border-red-300"
                      : DAY_COLORS[day]
                  )}>
                    {isConflict ? `${slots.length}!` : '●'}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Expanded detail view */}
      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50">
          {/* Detailed day breakdown */}
          <div className="px-5 py-4 space-y-3">
            <p className="text-xs font-black uppercase tracking-wider text-slate-500">Chi tiết lịch sử dụng</p>
            {[0, 1, 2, 3, 4, 5, 6].map(day => {
              const slots = scheduleByDay[day];
              if (slots.length === 0) return null;
              const isConflict = slots.length > 1;
              return (
                <div key={day} className={cn(
                  "rounded-xl border p-3",
                  isConflict ? "bg-red-50 border-red-200" : "bg-white border-slate-200"
                )}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={cn(
                      "text-xs font-black px-2 py-0.5 rounded-full border",
                      isConflict ? "bg-red-100 text-red-700 border-red-200" : DAY_COLORS[day]
                    )}>
                      {DAY_LABELS[day]}
                    </span>
                    {isConflict && (
                      <span className="text-xs text-red-600 font-semibold">⚠ Phát hiện trùng lịch!</span>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    {slots.map(({ batch, slot }) => (
                      <div key={batch.id} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="font-semibold text-slate-700">{slot}</span>
                          <span className="text-slate-500">·</span>
                          <span className="font-bold text-slate-800">{batch.code}</span>
                          <span className="text-slate-500 truncate max-w-[120px]">{batch.courseTitle}</span>
                        </div>
                        <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0", STATUS_COLORS[batch.status])}>
                          {batch.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {activeBatches.length === 0 && (
              <div className="text-center py-4 text-xs text-slate-400">
                Phòng học hiện chưa có lịch học nào.
              </div>
            )}
          </div>

          {/* Historical batches (ended) */}
          {allBatches.filter(b => b.status === 'Đã kết thúc').length > 0 && (
            <div className="px-5 pb-4 border-t border-slate-100 pt-3">
              <p className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2">Lịch sử lớp đã kết thúc</p>
              <div className="space-y-1">
                {allBatches.filter(b => b.status === 'Đã kết thúc').map(b => (
                  <div key={b.id} className="flex items-center justify-between text-xs text-slate-400">
                    <span className="font-semibold">{b.code}</span>
                    <span>{b.startDate} → {b.endDate}</span>
                    <span>{b.startTime} – {b.endTime}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ClassroomsPage({ canManage = true }: { canManage?: boolean }) {
  const { resources, loading } = useResources();
  const { batches } = useBatches();

  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingResource, setEditingResource] = useState<ResourceItem | null>(null);
  const [viewMode, setViewMode] = useState<'schedule' | 'list'>(() => {
    return (localStorage.getItem('erp_view_mode_classrooms') as 'schedule' | 'list') || 'schedule';
  });
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = viewMode === 'list' ? 8 : 6;

  const handleDelete = async (resource: ResourceItem) => {
    if (!window.confirm(`Xóa phòng học "${resource.name}"?`)) return;
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
      for (let d = 0; d <= 6; d++) {
        const slots = activeBatches.filter(b => b.daysOfWeek.includes(d));
        if (slots.length > 1) { count++; break; }
      }
    }
    return count;
  }, [classrooms, batches]);

  const filtered = useMemo(
    () => classrooms.filter(r =>
      r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.identifier.toLowerCase().includes(searchTerm.toLowerCase())
    ),
    [classrooms, searchTerm]
  );

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
        action={canManage ? (
          <ErpPrimaryButton onClick={() => { setEditingResource(null); setShowAddModal(true); }}>
            Khai báo phòng học mới
          </ErpPrimaryButton>
        ) : undefined}
      />

      {/* Controls */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <ErpSearchBar value={searchTerm} onChange={setSearchTerm} placeholder="Tìm phòng học bằng tên hoặc số phòng..." />
        <div className="flex items-center gap-2 ml-auto">
          {/* Stats badges */}
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 font-semibold">
              {classrooms.length} phòng
            </span>
            {conflictCount > 0 && (
              <span className="px-2.5 py-1 rounded-full bg-red-100 text-red-700 font-bold border border-red-200">
                ⚠ {conflictCount} trùng lịch
              </span>
            )}
          </div>
          {/* View mode toggle */}
          <div className="flex items-center border border-slate-200 bg-slate-50 p-1 rounded-xl gap-0.5 shrink-0">
            <button
              type="button"
              onClick={() => { setViewMode('schedule'); localStorage.setItem('erp_view_mode_classrooms', 'schedule'); }}
              className={cn(
                "p-1.5 rounded-lg active:scale-95 transition-all cursor-pointer",
                viewMode === 'schedule' ? "bg-white text-slate-800 shadow-sm" : "text-slate-400 hover:text-slate-600"
              )}
              title="Xem lịch"
            >
              <CalendarDays className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => { setViewMode('list'); localStorage.setItem('erp_view_mode_classrooms', 'list'); }}
              className={cn(
                "p-1.5 rounded-lg active:scale-95 transition-all cursor-pointer",
                viewMode === 'list' ? "bg-white text-slate-800 shadow-sm" : "text-slate-400 hover:text-slate-600"
              )}
              title="Danh sách"
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
          {/* Legend */}
          <div className="flex items-center gap-3 flex-wrap text-xs text-slate-500">
            <span className="font-semibold">Ghi chú:</span>
            <span className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded bg-green-100 border border-green-200 inline-block" />
              Đang có lớp học
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded bg-red-100 border border-red-300 inline-block" />
              Trùng lịch
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded bg-slate-50 border border-slate-100 inline-block" />
              Trống
            </span>
            <span className="ml-2 text-slate-400">Bấm "Lịch" để xem chi tiết từng phòng</span>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {paginated.map(room => (
              <RoomScheduleCard
                key={room.id}
                room={room}
                batches={batches}
                canManage={canManage}
                onEdit={setEditingResource}
                onDelete={handleDelete}
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
        <ResourceTable
          resources={paginated}
          canManage={canManage}
          onBook={() => {}}
          onEdit={setEditingResource}
          onToggleMaintenance={handleToggleMaintenance}
          onDelete={handleDelete}
          footer={
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              totalItems={filtered.length}
              pageSize={pageSize}
              itemName="phòng học"
            />
          }
        />
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
    </div>
  );
}
