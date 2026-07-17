import React, { useState } from 'react';
import {
  School, Trash2, Pencil, Users, CalendarRange, GraduationCap, BarChart2
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { apiFetch } from '../../lib/api';
import { toast } from '../../../../pages/Toast';
import { useBatches } from '../../hooks/useBatches';
import { useCourses } from '../../hooks/useCourses';
import { authService } from '../../../../services/authService';
import { useAuth } from '../../../../context/AuthContext';
import { useStudents } from '../../hooks/useStudents';
import { Batch, BatchStatus } from '../../types';
import {
  ErpPageHeader, ErpPrimaryButton, ErpSearchBar, ErpFilterTab, ErpFilterRail,
  ErpEmptyState, ErpLoadingState, ErpCard, ErpConfirmModal, ErpTableHead
} from '../../components/Erp/ErpUI';
import { Pagination } from '../../components/ui/Pagination';
import { BatchFormModal } from '../../components/Batches/BatchFormModal';
import { ManageLearnersModal } from '../../components/Batches/ManageLearnersModal';
import { AttendanceModal } from '../../components/Batches/AttendanceModal';
import { AttendanceViewModal } from '../../components/Batches/AttendanceViewModal';

const BATCH_STATUSES: BatchStatus[] = ['Sắp khai giảng', 'Đang học', 'Đã kết thúc'];

// Thứ trong tuần theo giá trị getDay(): 0 = CN ... 6 = T7, hiển thị theo thứ tự T2 → CN
const DAY_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: 'T2' },
  { value: 2, label: 'T3' },
  { value: 3, label: 'T4' },
  { value: 4, label: 'T5' },
  { value: 5, label: 'T6' },
  { value: 6, label: 'T7' },
  { value: 0, label: 'CN' },
];

const formatDays = (days: number[]) =>
  DAY_OPTIONS.filter(d => (days || []).includes(d.value)).map(d => d.label).join(', ');

const formatDate = (d: string) => (d ? d.split('-').reverse().join('/') : '');

const statusStyle = (status: BatchStatus) => {
  if (status === 'Đang học') return "bg-emerald-500/10 text-emerald-400 border-emerald-500/15";
  if (status === 'Sắp khai giảng') return "bg-sky-500/10 text-sky-400 border-sky-500/15";
  return "bg-slate-500/10 text-slate-400 border-slate-500/15";
};

/** Bắn sự kiện để các hook liên quan tự refetch (lớp, khóa học, giảng viên, lịch) */
const notifyBatchMutation = () => {
  window.dispatchEvent(new Event('batch-mutation'));
  window.dispatchEvent(new Event('course-mutation'));
  window.dispatchEvent(new Event('user-mutation'));
};

export function BatchesPage({ selectedCenter }: { selectedCenter?: string }) {
  const darkMode = false;
  const { userProfile: user } = useAuth();
  const isManager = user?.role === 'admin' || user?.role === 'superadmin';

  const resolvedCenter = selectedCenter === 'all' ? undefined : selectedCenter;
  const { batches, loading, refetch } = useBatches(resolvedCenter);
  const { courses } = useCourses(resolvedCenter);
  const [users, setUsers] = useState<any[]>([]);
  React.useEffect(() => {
    const fetchUsers = async () => {
      try {
        let data;
        if (selectedCenter && selectedCenter !== 'all') {
          data = await authService.getUsersByCompany(selectedCenter);
        } else {
          data = await authService.getAllUsers();
        }
        setUsers(data || []);
      } catch (err) {
        console.error("Failed to fetch users:", err);
      }
    };
    fetchUsers();
  }, [selectedCenter]);
  const instructors = users.filter(u => u.role === 'user');
  const { students } = useStudents(resolvedCenter);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [manageLearnersId, setManageLearnersId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string; code: string }>({
    isOpen: false,
    id: '',
    code: '',
  });

  const [attendanceBatchId, setAttendanceBatchId] = useState<string | null>(null);
  const [viewAttendanceBatchId, setViewAttendanceBatchId] = useState<string | null>(null);

  // Lấy bản mới nhất từ danh sách để modal học viên không bị dữ liệu cũ sau refetch
  const manageBatch = manageLearnersId ? batches.find(b => b.id === manageLearnersId) : undefined;
  const attendanceBatch = attendanceBatchId ? batches.find(b => b.id === attendanceBatchId) : undefined;

  const openCreateModal = () => {
    setEditingId(null);
    setShowFormModal(true);
  };

  const openEditModal = (batch: Batch) => {
    setEditingId(batch.id);
    setShowFormModal(true);
  };

  const handleChangeStatus = async (batch: Batch, status: BatchStatus) => {
    try {
      await apiFetch(`/batches/${batch.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      notifyBatchMutation();
      toast.success(`Lớp ${batch.code} đã chuyển sang "${status}".`);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Có lỗi xảy ra khi cập nhật trạng thái.';
      toast.error(msg);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm.id) return;
    try {
      await apiFetch(`/batches/${deleteConfirm.id}`, { method: 'DELETE' });
      notifyBatchMutation();
      toast.success(`Đã xóa lớp ${deleteConfirm.code}.`);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Có lỗi xảy ra khi xóa lớp.';
      toast.error(msg);
    } finally {
      setDeleteConfirm({ isOpen: false, id: '', code: '' });
    }
  };

  const handleMutationSuccess = () => {
    notifyBatchMutation();
    refetch();
  };

  const filteredBatches = batches.filter(b => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = (b.code || '').toLowerCase().includes(term) ||
                          (b.courseTitle || '').toLowerCase().includes(term) ||
                          (b.instructorName || '').toLowerCase().includes(term);
    const matchesStatus = statusFilter === 'all' || b.status === statusFilter;
    return matchesSearch && matchesStatus;
  });
  const totalPages = Math.ceil(filteredBatches.length / pageSize);
  const paginatedBatches = filteredBatches.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1);
    }, 0);
    return () => clearTimeout(timer);
  }, [searchTerm, statusFilter]);

  return (
    <div className="space-y-6 text-left">
      <ErpPageHeader
        title="Lớp & Khai giảng"
        subtitle="Mở lớp theo khóa học, xếp lịch định kỳ, gán giảng viên & học viên"
        action={
          <ErpPrimaryButton onClick={openCreateModal}>
            Mở lớp mới
          </ErpPrimaryButton>
        }
      />

      {/* Controls */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <ErpSearchBar value={searchTerm} onChange={setSearchTerm} placeholder="Tìm theo mã lớp, khóa học, giảng viên..." />
        <ErpFilterRail>
          <ErpFilterTab active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>
            Tất cả
          </ErpFilterTab>
          {BATCH_STATUSES.map((st) => (
            <ErpFilterTab key={st} active={statusFilter === st} onClick={() => setStatusFilter(st)}>
              {st}
            </ErpFilterTab>
          ))}
        </ErpFilterRail>
      </div>

      {/* Batch table */}
      {loading && batches.length === 0 ? (
        <ErpCard><ErpLoadingState message="Đang tải danh sách lớp..." /></ErpCard>
      ) : filteredBatches.length === 0 ? (
        <ErpCard>
          <ErpEmptyState
            icon={School}
            title="Chưa có lớp nào"
            subtitle="Bấm 'Mở lớp mới' để khai giảng lớp đầu tiên cho một khóa học."
          />
        </ErpCard>
      ) : (
        <ErpCard className="rounded-[2.5rem] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <ErpTableHead columns={['Mã lớp', 'Khóa học', 'Giảng viên', 'Lịch học', 'Thời gian', 'Sĩ số', 'Trạng thái', 'Thao tác']} />
              <tbody className={cn("divide-y", darkMode ? "divide-slate-800/30" : "divide-slate-100")}>
                {paginatedBatches.map((b) => (
                  <tr key={b.id} className={cn("transition-colors", darkMode ? "text-slate-350 hover:bg-slate-800/10" : "text-slate-600 hover:bg-slate-50/40")}>
                    <td className="py-4 px-6 font-black text-sm">{b.code}</td>
                    <td className="py-4 px-6">
                      <p className="font-bold">{b.courseTitle}</p>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{b.courseCode}</p>
                    </td>
                    <td className="py-4 px-6 font-bold">
                      {b.instructorName ? (
                        <span className="flex items-center gap-1.5">
                          <GraduationCap className="w-3.5 h-3.5 text-slate-400" /> {b.instructorName}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Chưa gán</span>
                      )}
                    </td>
                    <td className="py-4 px-6 font-bold">
                      <p>{formatDays(b.daysOfWeek)}</p>
                      <p className="text-[10px] text-slate-400">{b.startTime} - {b.endTime}{b.location ? ` • ${b.location}` : ''}</p>
                    </td>
                    <td className="py-4 px-6 font-bold whitespace-nowrap">
                      {formatDate(b.startDate)} → {formatDate(b.endDate)}
                    </td>
                    <td className="py-4 px-6">
                      <button
                        onClick={() => setManageLearnersId(b.id)}
                        title="Quản lý học viên trong lớp"
                        className={cn(
                          "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-black transition-all border cursor-pointer shadow-sm",
                          darkMode ? "bg-slate-800 hover:bg-slate-700 text-slate-300 border-transparent" : "bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200/60"
                        )}
                      >
                        <Users className="w-3 h-3 text-brand-primary" />
                        {b.learnerIds.length}{b.maxLearners ? `/${b.maxLearners}` : ''} HV
                      </button>
                    </td>
                    <td className="py-4 px-6">
                      <select
                        value={b.status}
                        onChange={(e) => handleChangeStatus(b, e.target.value as BatchStatus)}
                        className={cn(
                          "px-2 py-1 rounded-lg text-[9px] font-black uppercase border outline-none cursor-pointer",
                          statusStyle(b.status),
                          darkMode ? "bg-slate-900" : "bg-white"
                        )}
                      >
                        {BATCH_STATUSES.map(st => <option key={st} value={st}>{st}</option>)}
                      </select>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setAttendanceBatchId(b.id)}
                          title="Điểm danh lớp"
                          className={cn(
                            "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-black border transition-all cursor-pointer shadow-sm",
                            darkMode
                              ? "bg-slate-800 hover:bg-brand-primary/20 text-brand-primary border-transparent"
                              : "bg-brand-primary/10 hover:bg-brand-primary/15 text-brand-primary border-brand-primary/15"
                          )}
                        >
                          <CalendarRange className="w-3.5 h-3.5" /> Điểm danh
                        </button>
                        {isManager && (
                          <button
                            onClick={() => setViewAttendanceBatchId(b.id)}
                            title="Xem thống kê điểm danh"
                            className={cn(
                              "p-1.5 rounded-lg transition-all border cursor-pointer shadow-sm",
                              darkMode
                                ? "bg-slate-800 hover:bg-sky-900/30 text-slate-450 hover:text-sky-400 border-transparent"
                                : "bg-slate-50 hover:bg-sky-50 text-slate-450 hover:text-sky-600 border-slate-200/60"
                            )}
                          >
                            <BarChart2 className="w-3 h-3" />
                          </button>
                        )}
                        <button
                          onClick={() => openEditModal(b)}
                          title="Chỉnh sửa lớp"
                          className={cn(
                            "p-1.5 rounded-lg transition-all border cursor-pointer shadow-sm",
                            darkMode ? "bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border-transparent" : "bg-slate-50 hover:bg-slate-100 text-slate-450 hover:text-slate-700 border-slate-200/60"
                          )}
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm({ isOpen: true, id: b.id, code: b.code })}
                          title="Xóa lớp"
                          className={cn(
                            "p-1.5 rounded-lg transition-all border cursor-pointer shadow-sm",
                            darkMode ? "bg-slate-800 hover:bg-rose-900/40 text-slate-450 hover:text-rose-450 border-transparent" : "bg-slate-50 hover:bg-rose-50 text-slate-450 hover:text-rose-550 border-slate-200/60"
                          )}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            totalItems={filteredBatches.length}
            pageSize={pageSize}
            itemName="lớp học"
          />
        </ErpCard>
      )}

      {/* Create / Edit Batch Modal */}
      <BatchFormModal
        isOpen={showFormModal}
        editingId={editingId}
        batchToEdit={batches.find(b => b.id === editingId)}
        onClose={() => setShowFormModal(false)}
        courses={courses}
        instructors={instructors}
        onSuccess={handleMutationSuccess}
      />

      {/* Manage Learners Modal */}
      {manageBatch && (
        <ManageLearnersModal
          isOpen={!!manageBatch}
          batch={manageBatch}
          onClose={() => setManageLearnersId(null)}
          students={students}
          onSuccess={handleMutationSuccess}
        />
      )}

      {/* Attendance Modal */}
      {attendanceBatch && (
        <AttendanceModal
          isOpen={!!attendanceBatch}
          batch={attendanceBatch}
          onClose={() => setAttendanceBatchId(null)}
          students={students}
          onSuccess={handleMutationSuccess}
        />
      )}

      {/* Attendance View Modal (admin/superadmin only) */}
      {isManager && viewAttendanceBatchId && (() => {
        const viewBatch = batches.find(b => b.id === viewAttendanceBatchId);
        return viewBatch ? (
          <AttendanceViewModal
            isOpen
            batch={viewBatch}
            onClose={() => setViewAttendanceBatchId(null)}
            students={students}
          />
        ) : null;
      })()}

      {/* Confirm Delete Modal */}
      <ErpConfirmModal
        isOpen={deleteConfirm.isOpen}
        title="Xóa lớp học"
        message={`Bạn có chắc chắn muốn xóa lớp "${deleteConfirm.code}" không? Danh sách học viên trong lớp sẽ bị gỡ liên kết. Hành động này không thể hoàn tác.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm({ isOpen: false, id: '', code: '' })}
        confirmText="Xác nhận xóa"
        cancelText="Hủy bỏ"
      />
    </div>
  );
}
