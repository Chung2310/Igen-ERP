import React, { useState } from 'react';
import {
  School, Trash2, Pencil, Users, UserPlus, X, GraduationCap,
  Tag, BookOpen, Clock, Calendar, CalendarRange, MapPin, ClipboardList,
  CalendarCheck, BarChart2
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { apiFetch } from '../../lib/api';
import { toast } from '../../../../pages/Toast';
import { useBatches } from '../../hooks/useBatches';
import { useCourses } from '../../hooks/useCourses';
import { authService } from '../../../../services/authService';
import { useStudents } from '../../hooks/useStudents';
import { Batch, BatchStatus } from '../../types';
import {
  ErpPageHeader, ErpPrimaryButton, ErpSearchBar, ErpFilterTab, ErpFilterRail,
  ErpModal, ErpField, ErpInput, ErpSelect,
  ErpEmptyState, ErpLoadingState, ErpCard, ErpConfirmModal, ErpTableHead,
  erpInputClass
} from '../../components/Erp/ErpUI';
import { Pagination } from '../../components/ui/Pagination';
import { TimeInput24 } from '../../../../components/common/TimeInput24';
import { useAuth } from '../../../../context/AuthContext';
import { useBranch } from '../../../../context/BranchContext';
import { buildInstructorOptions } from './instructorRoster';
import { CustomFieldsSection } from '../../custom-fields/CustomFieldsSection';
import type { CustomFieldValues } from '../../custom-fields/types';
import { useStandardFields, getAdaptedFieldDefinition, type StandardFieldConfig } from '../../hooks/useStandardFields';
import { useEntityLabel } from '../../hooks/useEntityLabel';
import { getBatchPageCopy, getBatchStatusLabel } from '../../config/workerRecruitmentCopy';
import { CustomFieldEditorModal } from '../../custom-fields/CustomFieldEditorModal';
import { AssignmentModal } from '../../components/Batches/AssignmentModal';
import { AttendanceModal } from '../../components/Batches/AttendanceModal';
import { AttendanceViewModal } from '../../components/Batches/AttendanceViewModal';
import { canManageCustomFields } from '../../custom-fields/permissions';
import type { CreateFieldInput, FieldDefinition } from '../../custom-fields/types';

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

interface BatchForm {
  code: string;
  courseId: string;
  instructorId: string;
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  location: string;
  startDate: string;
  endDate: string;
  status: BatchStatus;
  customFields?: CustomFieldValues;
}

const EMPTY_FORM: BatchForm = {
  code: '',
  courseId: '',
  instructorId: '',
  daysOfWeek: [],
  startTime: '18:00',
  endTime: '20:00',
  location: '',
  startDate: '',
  endDate: '',
  status: 'Sắp khai giảng',
  customFields: {},
};

/** Bắn sự kiện để các hook liên quan tự refetch (lớp, khóa học, giảng viên, lịch) */
const notifyBatchMutation = () => {
  window.dispatchEvent(new Event('batch-mutation'));
  window.dispatchEvent(new Event('course-mutation'));
  window.dispatchEvent(new Event('user-mutation'));
};

export function BatchesPage({ selectedCenter, canManage = true }: { selectedCenter?: string; canManage?: boolean }) {
  const darkMode = false;
  const entityLabel = useEntityLabel();
  const copy = getBatchPageCopy(entityLabel.preset);
  const statusLabel = (status: BatchStatus) => getBatchStatusLabel(entityLabel.preset, status);
  const { userProfile: user } = useAuth();
  const { activeBranchId } = useBranch();
  const {
    fields: stdFields,
    activeFields: activeStdFields,
    archivedFields: archivedStdFields,
    updateField: updateStdField,
    archiveField: archiveStdField,
    restoreField: restoreStdField,
    deleteField: deleteStdField
  } = useStandardFields("batches");

  const manageable = canManageCustomFields(user?.permissions);
  const [stdEditorOpen, setStdEditorOpen] = useState(false);
  const [editingStdField, setEditingStdField] = useState<FieldDefinition | null>(null);
  const [isEditingFields, setIsEditingFields] = useState(false);

  const openEditStdField = (field: StandardFieldConfig) => {
    setEditingStdField(getAdaptedFieldDefinition(field, "batches"));
    setStdEditorOpen(true);
  };

  const handleStdFieldSubmit = (input: CreateFieldInput) => {
    if (editingStdField) {
      updateStdField(editingStdField.key, {
        label: input.label,
        placeholder: input.placeholder,
        isRequired: input.isRequired,
        isVisible: input.isVisible,
      });
    }
  };

  const archiveStd = (field: StandardFieldConfig) => {
    if (window.confirm(`Lưu trữ trường “${field.label}”?`)) {
      archiveStdField(field.key);
    }
  };

  const deleteStd = (field: StandardFieldConfig) => {
    if (window.confirm(`Xóa vĩnh viễn trường “${field.label}”?`)) {
      deleteStdField(field.key);
    }
  };

  const renderFieldActions = (fieldKey: string) => {
    if (!manageable || !isEditingFields) return null;
    const fieldConfig = stdFields.find(f => f.key === fieldKey);
    if (!fieldConfig) return null;
    return (
      <div className="absolute right-0 top-0 z-10 flex items-center gap-1.5 text-[10px] font-semibold text-slate-400 opacity-60 hover:opacity-100 transition-opacity">
        <button type="button" className="hover:text-cyan-600 transition-colors" onClick={() => openEditStdField(fieldConfig)}>Sửa</button>
        <span>|</span>
        <button type="button" className="hover:text-cyan-600 transition-colors" onClick={() => archiveStd(fieldConfig)}>Lưu trữ</button>
        <span>|</span>
        <button type="button" className="text-rose-500 hover:text-rose-600 transition-colors" onClick={() => deleteStd(fieldConfig)}>Xóa</button>
      </div>
    );
  };

  const isFieldVisible = (fieldKey: string) => {
    const fieldConfig = stdFields.find(f => f.key === fieldKey);
    return fieldConfig ? (fieldConfig.isVisible && !fieldConfig.isArchived) : true;
  };
  const getFieldLabel = (fieldKey: string, defaultLabel: string) => {
    const fieldConfig = stdFields.find(f => f.key === fieldKey);
    return fieldConfig ? fieldConfig.label : defaultLabel;
  };
  const getFieldPlaceholder = (fieldKey: string, defaultPlaceholder: string) => {
    const fieldConfig = stdFields.find(f => f.key === fieldKey);
    return fieldConfig ? fieldConfig.placeholder || defaultPlaceholder : defaultPlaceholder;
  };
  const isFieldRequired = (fieldKey: string, defaultRequired = false) => {
    const fieldConfig = stdFields.find(f => f.key === fieldKey);
    return fieldConfig ? fieldConfig.isRequired : defaultRequired;
  };

  const resolvedCenter = selectedCenter === 'all' ? undefined : selectedCenter;
  const { batches, loading } = useBatches(resolvedCenter);
  const { courses } = useCourses(resolvedCenter);
  const [users, setUsers] = useState<any[]>([]);
  React.useEffect(() => {
    const fetchUsers = async () => {
      const companyCode = selectedCenter && selectedCenter !== 'all' ? selectedCenter : user?.companyCode;
      if (!companyCode || !activeBranchId) {
        setUsers([]);
        return;
      }
      try {
        const data = await authService.getUsersByCompany(companyCode, activeBranchId);
        setUsers(data || []);
      } catch (err) {
        console.error("Failed to fetch users:", err);
        setUsers([]);
      }
    };
    void fetchUsers();
  }, [selectedCenter, user?.companyCode, activeBranchId]);
  const instructorOptions = buildInstructorOptions(users);
  const { students } = useStudents(resolvedCenter);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BatchForm>(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [manageLearnersId, setManageLearnersId] = useState<string | null>(null);
  const [assignmentBatchId, setAssignmentBatchId] = useState<string | null>(null);
  const [attendanceBatchId, setAttendanceBatchId] = useState<string | null>(null);
  const [viewAttendanceBatchId, setViewAttendanceBatchId] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string; code: string }>({
    isOpen: false,
    id: '',
    code: '',
  });

  // Lấy bản mới nhất từ danh sách để modal học viên không bị dữ liệu cũ sau refetch
  const manageBatch = manageLearnersId ? batches.find(b => b.id === manageLearnersId) : undefined;

  const openCreateModal = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, courseId: courses[0]?.id || '' });
    setShowFormModal(true);
  };

  const openEditModal = (batch: Batch) => {
    setEditingId(batch.id);
    setForm({
      code: batch.code,
      courseId: batch.courseId,
      instructorId: batch.instructorId || '',
      daysOfWeek: batch.daysOfWeek || [],
      startTime: batch.startTime,
      endTime: batch.endTime,
      location: batch.location || '',
      startDate: batch.startDate,
      endDate: batch.endDate,
      status: batch.status,
      customFields: batch.customFields || {},
    });
    setShowFormModal(true);
  };

  const toggleDay = (day: number) => {
    setForm(prev => ({
      ...prev,
      daysOfWeek: prev.daysOfWeek.includes(day)
        ? prev.daysOfWeek.filter(d => d !== day)
        : [...prev.daysOfWeek, day],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const missingFields: string[] = [];
    stdFields.forEach((f) => {
      if (f.isVisible && !f.isArchived && f.isRequired) {
        if (f.key === 'code' && !form.code) missingFields.push(f.label);
        if (f.key === 'courseId' && !form.courseId) missingFields.push(f.label);
        if (f.key === 'startDate' && !form.startDate) missingFields.push(f.label);
        if (f.key === 'endDate' && !form.endDate) missingFields.push(f.label);
        if (f.key === 'schedule') {
          if (form.daysOfWeek.length === 0 || !form.startTime || !form.endTime) {
            missingFields.push(f.label);
          }
        }
        if (f.key === 'room' && !form.location) missingFields.push(f.label);
        if (f.key === 'teacherId' && !form.instructorId) missingFields.push(f.label);
      }
    });

    if (missingFields.length > 0) {
      toast.error(`Vui lòng điền đầy đủ các trường bắt buộc: ${missingFields.join(', ')}`);
      return;
    }

    if (isFieldVisible('schedule') && form.daysOfWeek.length === 0) {
      toast.error('Vui lòng chọn ít nhất một ngày học trong tuần.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        ...form,
        code: form.code.toUpperCase(),
        ...(editingId ? { expectedVersion: batches.find((batch) => batch.id === editingId)?.__v } : {}),
        ...(!editingId && resolvedCenter ? { companyCode: resolvedCenter } : {}),
      };
      if (editingId) {
        await apiFetch(`/batches/${editingId}`, { method: 'PATCH', body: JSON.stringify(payload) });
        toast.success(`Đã cập nhật ${copy.entityNameLower} ${payload.code}.`);
      } else {
        await apiFetch('/batches', { method: 'POST', body: JSON.stringify(payload) });
        toast.success(`Đã tạo ${copy.entityNameLower} ${payload.code} thành công!`);
      }
      notifyBatchMutation();
      setShowFormModal(false);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : `Có lỗi xảy ra khi lưu ${copy.entityNameLower}.`;
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChangeStatus = async (batch: Batch, status: BatchStatus) => {
    try {
      await apiFetch(`/batches/${batch.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      notifyBatchMutation();
      toast.success(`${copy.entityName} ${batch.code} đã chuyển sang "${statusLabel(status)}".`);
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
      toast.success(`Đã xóa ${copy.entityNameLower} ${deleteConfirm.code}.`);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : `Có lỗi xảy ra khi xóa ${copy.entityNameLower}.`;
      toast.error(msg);
    } finally {
      setDeleteConfirm({ isOpen: false, id: '', code: '' });
    }
  };

  const handleAddLearner = async () => {
    if (!manageBatch || !selectedStudentId) return;
    try {
      await apiFetch(`/batches/${manageBatch.id}/learners`, {
        method: 'POST',
        body: JSON.stringify({ studentId: selectedStudentId }),
      });
      notifyBatchMutation();
      setSelectedStudentId('');
      toast.success(`Đã thêm ${entityLabel.singular} vào ${copy.entityNameLower}.`);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : `Có lỗi xảy ra khi thêm ${entityLabel.singular}.`;
      toast.error(msg);
    }
  };

  const handleRemoveLearner = async (studentId: string) => {
    if (!manageBatch) return;
    try {
      await apiFetch(`/batches/${manageBatch.id}/learners/${studentId}`, { method: 'DELETE' });
      notifyBatchMutation();
      toast.success(`Đã bỏ ${entityLabel.singular} khỏi ${copy.entityNameLower}.`);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : `Có lỗi xảy ra khi bỏ ${entityLabel.singular}.`;
      toast.error(msg);
    }
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

  const availableStudents = manageBatch
    ? students.filter(s => !manageBatch.learnerIds.includes(s.id))
    : [];
  const enrolledStudents = manageBatch
    ? manageBatch.learnerIds
      .map(id => students.find(s => s.id === id))
      .filter((s): s is NonNullable<typeof s> => !!s)
    : [];

  return (
    <div className="space-y-4 text-left">
      <ErpPageHeader
        title={copy.pageTitle}
        action={canManage ? (
          <ErpPrimaryButton onClick={openCreateModal}>
            {copy.createButton}
          </ErpPrimaryButton>
        ) : undefined}
      />

      {/* Controls */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <ErpSearchBar value={searchTerm} onChange={setSearchTerm} placeholder={copy.searchPlaceholder} />
        <ErpFilterRail>
          <ErpFilterTab active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>
            Tất cả
          </ErpFilterTab>
          {BATCH_STATUSES.map((st) => (
            <ErpFilterTab key={st} active={statusFilter === st} onClick={() => setStatusFilter(st)}>
              {statusLabel(st)}
            </ErpFilterTab>
          ))}
        </ErpFilterRail>
      </div>

      {/* Batch table */}
      {loading && batches.length === 0 ? (
        <ErpCard><ErpLoadingState message={`Đang tải danh sách ${copy.entityNameLower}...`} /></ErpCard>
      ) : filteredBatches.length === 0 ? (
        <ErpCard>
          <ErpEmptyState
            icon={School}
            title={copy.emptyTitle}
            subtitle={copy.emptySubtitle}
          />
        </ErpCard>
      ) : (
        <ErpCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <ErpTableHead columns={[copy.codeLabel, copy.courseLabel, copy.instructorLabel, 'Lịch hoạt động', 'Thời gian', copy.capacityLabel, 'Trạng thái', 'Thao tác']} />
              <tbody className={cn("divide-y", darkMode ? "divide-slate-800/30" : "divide-slate-100")}>
                {paginatedBatches.map((b) => (
                  <tr key={b.id} className={cn("transition-colors hover:bg-slate-50/50", darkMode ? "text-slate-355 hover:bg-slate-800/10" : "text-slate-600")}>
                    <td className="py-2 px-4 font-black text-sm">{b.code}</td>
                    <td className="py-2 px-4">
                      <p className="font-bold">{b.courseTitle}</p>
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{b.courseCode}</p>
                    </td>
                    <td className="py-2 px-4 font-bold">
                      {b.instructorName ? (
                        <span className="flex items-center gap-1.5">
                          <GraduationCap className="w-3.5 h-3.5 text-slate-400" /> {b.instructorName}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Chưa gán</span>
                      )}
                    </td>
                    <td className="py-2 px-4 font-bold">
                      <p>{formatDays(b.daysOfWeek)}</p>
                      <p className="text-[9px] text-slate-400">{b.startTime} - {b.endTime}{b.location ? ` • ${b.location}` : ''}</p>
                    </td>
                    <td className="py-2 px-4 font-bold whitespace-nowrap">
                      {formatDate(b.startDate)} → {formatDate(b.endDate)}
                    </td>
                    <td className="py-2 px-4">
                      <button
                        onClick={() => { setManageLearnersId(b.id); setSelectedStudentId(''); }}
                        title={`Quản lý ${entityLabel.singular} trong ${copy.entityNameLower}`}
                        className={cn(
                          "flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-black transition-all border cursor-pointer shadow-sm",
                          darkMode ? "bg-slate-800 hover:bg-slate-700 text-slate-300 border-transparent" : "bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200/60"
                        )}
                      >
                        <Users className="w-3 h-3 text-brand-primary" />
                        {b.learnerIds.length}{b.maxLearners ? `/${b.maxLearners}` : ''} HV
                      </button>
                    </td>
                    <td className="py-2 px-4">
                      <select
                        value={b.status}
                        onChange={(e) => handleChangeStatus(b, e.target.value as BatchStatus)}
                        className={cn(
                          "px-1.5 py-0.5 rounded text-[9px] font-black uppercase border outline-none cursor-pointer",
                          statusStyle(b.status),
                          darkMode ? "bg-slate-900" : "bg-white"
                        )}
                      >
                        {BATCH_STATUSES.map(st => <option key={st} value={st}>{statusLabel(st)}</option>)}
                      </select>
                    </td>
                    <td className="py-2 px-4">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => openEditModal(b)}
                          title={`Chỉnh sửa ${copy.entityNameLower}`}
                          className={cn(
                            "p-1 rounded-lg transition-all border cursor-pointer shadow-sm",
                            darkMode ? "bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border-transparent" : "bg-slate-50 hover:bg-slate-100 text-slate-450 hover:text-slate-700 border-slate-200/60"
                          )}
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm({ isOpen: true, id: b.id, code: b.code })}
                          title={`Xóa ${copy.entityNameLower}`}
                          className={cn(
                            "p-1 rounded-lg transition-all border cursor-pointer shadow-sm",
                            darkMode ? "bg-slate-800 hover:bg-rose-900/40 text-slate-450 hover:text-rose-450 border-transparent" : "bg-slate-50 hover:bg-rose-50 text-slate-450 hover:text-rose-550 border-slate-200/60"
                          )}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => setManageLearnersId(b.id)}
                          title={`Quản lý ${entityLabel.singular}`}
                          className={cn(
                            "p-1 rounded-lg transition-all border cursor-pointer shadow-sm",
                            darkMode ? "bg-slate-800 hover:bg-brand-primary/20 text-slate-450 hover:text-brand-primary border-transparent" : "bg-slate-50 hover:bg-brand-primary/10 text-slate-450 hover:text-brand-primary border-slate-200/60"
                          )}
                        >
                          <Users className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => setAssignmentBatchId(b.id)}
                          title={entityLabel.preset === 'worker' ? 'Giao nhiệm vụ' : 'Giao bài tập'}
                          className={cn(
                            "p-1 rounded-lg transition-all border cursor-pointer shadow-sm",
                            darkMode ? "bg-slate-800 hover:bg-brand-primary/20 text-slate-450 hover:text-brand-primary border-transparent" : "bg-slate-50 hover:bg-brand-primary/10 text-slate-450 hover:text-brand-primary border-slate-200/60"
                          )}
                        >
                          <ClipboardList className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => setAttendanceBatchId(b.id)}
                          title="Điểm danh thủ công & QR"
                          className={cn(
                            "p-1 rounded-lg transition-all border cursor-pointer shadow-sm",
                            darkMode ? "bg-slate-800 hover:bg-emerald-900/40 text-slate-450 hover:text-emerald-400 border-transparent" : "bg-slate-50 hover:bg-emerald-50 text-slate-450 hover:text-emerald-600 border-slate-200/60"
                          )}
                        >
                          <CalendarCheck className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => setViewAttendanceBatchId(b.id)}
                          title="Lịch sử & Thống kê điểm danh"
                          className={cn(
                            "p-1 rounded-lg transition-all border cursor-pointer shadow-sm",
                            darkMode ? "bg-slate-800 hover:bg-sky-900/40 text-slate-450 hover:text-sky-400 border-transparent" : "bg-slate-50 hover:bg-sky-50 text-slate-450 hover:text-sky-600 border-slate-200/60"
                          )}
                        >
                          <BarChart2 className="w-3 h-3" />
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
            itemName={copy.entityNameLower}
          />
        </ErpCard>
      )}

      {/* Create / Edit Batch Modal */}
      {showFormModal && (
        <ErpModal title={editingId ? copy.editTitle : copy.createTitle} onClose={() => setShowFormModal(false)} maxWidth="max-w-lg">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Section 1: Thông tin lớp học */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                <div className="w-1.5 h-4 bg-brand-primary rounded-full"></div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <School className="w-4 h-4 text-brand-primary" />
                  Thông tin {copy.entityNameLower}
                </h4>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {isFieldVisible('code') && (
                  <div className="relative group/std">
                    {renderFieldActions('code')}
                    <ErpField label={getFieldLabel('code', copy.codeLabel)}>
                      <div className="relative">
                        <ErpInput
                          type="text"
                          required={isFieldRequired('code', true)}
                          placeholder={getFieldPlaceholder('code', 'Ví dụ: K32')}
                          value={form.code}
                          onChange={(e) => setForm({ ...form, code: e.target.value })}
                          className="pl-10"
                        />
                        <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                          <Tag className="w-4 h-4" />
                        </div>
                      </div>
                    </ErpField>
                  </div>
                )}
                {isFieldVisible('courseId') && (
                  <div className="relative group/std">
                    {renderFieldActions('courseId')}
                    <ErpField label={getFieldLabel('courseId', copy.courseLabel)}>
                      <div className="relative">
                        <ErpSelect
                          required={isFieldRequired('courseId', true)}
                          value={form.courseId}
                          onChange={(e) => setForm({ ...form, courseId: e.target.value })}
                          className="pl-10"
                        >
                          <option value="" disabled>{`-- Chọn ${copy.courseLabel.toLocaleLowerCase('vi')} --`}</option>
                          {courses.map((c) => (
                            <option key={c.id} value={c.id}>{c.code} — {c.title}</option>
                          ))}
                        </ErpSelect>
                        <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400 z-10">
                          <BookOpen className="w-4 h-4" />
                        </div>
                      </div>
                    </ErpField>
                  </div>
                )}
              </div>

              {isFieldVisible('teacherId') && (
                <div className="relative group/std">
                  {renderFieldActions('teacherId')}
                  <ErpField label={getFieldLabel('teacherId', copy.instructorLabel)}>
                    <div className="relative">
                      <ErpSelect
                        value={form.instructorId}
                        required={isFieldRequired('teacherId', false)}
                        onChange={(e) => setForm({ ...form, instructorId: e.target.value })}
                        className="pl-10"
                      >
                        <option value="">{`— Chưa gán ${copy.instructorLabel.toLocaleLowerCase('vi')} —`}</option>
                        {instructorOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </ErpSelect>
                      <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400 z-10">
                        <GraduationCap className="w-4 h-4" />
                      </div>
                    </div>
                  </ErpField>
                </div>
              )}
            </div>

            {/* Section 2: Lịch học & Khung giờ */}
            {isFieldVisible('schedule') && (
              <div className="space-y-4 pt-2 relative group/std">
                {renderFieldActions('schedule')}
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <div className="w-1.5 h-4 bg-brand-primary rounded-full"></div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-brand-primary" />
                    {getFieldLabel('schedule', entityLabel.preset === 'worker' ? 'Lịch hoạt động & Khung giờ' : 'Lịch học & Khung giờ')}
                  </h4>
                </div>

                <ErpField label="Ngày học trong tuần">
                  <div className="grid grid-cols-7 gap-1 mt-1">
                    {DAY_OPTIONS.map((d) => (
                      <button
                        key={d.value}
                        type="button"
                        onClick={() => toggleDay(d.value)}
                        className={cn(
                          "py-1.5 rounded-lg text-[10px] font-black transition-all border cursor-pointer text-center",
                          form.daysOfWeek.includes(d.value)
                            ? "bg-brand-primary text-white border-brand-primary shadow-sm shadow-brand-primary/15 scale-[1.02]"
                            : "bg-slate-50 text-slate-550 border-slate-200 hover:bg-slate-100 hover:border-slate-300 active:scale-95"
                        )}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </ErpField>

                <div className="grid grid-cols-2 gap-4">
                  <ErpField label="Giờ bắt đầu">
                    <div className="relative">
                      <TimeInput24
                        required={isFieldRequired('schedule', true)}
                        value={form.startTime}
                        onChange={(v) => setForm({ ...form, startTime: v })}
                        className={cn(erpInputClass(darkMode), "pl-10")}
                      />
                      <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                        <Clock className="w-4 h-4" />
                      </div>
                    </div>
                  </ErpField>
                  <ErpField label="Giờ kết thúc">
                    <div className="relative">
                      <TimeInput24
                        required={isFieldRequired('schedule', true)}
                        value={form.endTime}
                        onChange={(v) => setForm({ ...form, endTime: v })}
                        className={cn(erpInputClass(darkMode), "pl-10")}
                      />
                      <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                        <Clock className="w-4 h-4" />
                      </div>
                    </div>
                  </ErpField>
                </div>
              </div>
            )}

            {/* Section 3: Thời gian & Địa điểm */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                <div className="w-1.5 h-4 bg-brand-primary rounded-full"></div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <CalendarRange className="w-4 h-4 text-brand-primary" />
                  Thời gian & Địa điểm
                </h4>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {isFieldVisible('startDate') && (
                  <div className="relative group/std">
                    {renderFieldActions('startDate')}
                    <ErpField label={getFieldLabel('startDate', entityLabel.preset === 'worker' ? 'Ngày bắt đầu' : 'Ngày khai giảng')}>
                      <div className="relative">
                        <ErpInput
                          type="date"
                          required={isFieldRequired('startDate', true)}
                          value={form.startDate}
                          onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                          className="pl-10"
                        />
                        <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                          <Calendar className="w-4 h-4" />
                        </div>
                      </div>
                    </ErpField>
                  </div>
                )}
                {isFieldVisible('endDate') && (
                  <div className="relative group/std">
                    {renderFieldActions('endDate')}
                    <ErpField label={getFieldLabel('endDate', entityLabel.preset === 'worker' ? 'Ngày kết thúc' : 'Ngày bế giảng')}>
                      <div className="relative">
                        <ErpInput
                          type="date"
                          required={isFieldRequired('endDate', true)}
                          value={form.endDate}
                          onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                          className="pl-10"
                        />
                        <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                          <Calendar className="w-4 h-4" />
                        </div>
                      </div>
                    </ErpField>
                  </div>
                )}
              </div>

              {isFieldVisible('room') && (
                <div className="relative group/std">
                  {renderFieldActions('room')}
                  <ErpField label={getFieldLabel('room', 'Địa điểm (tùy chọn)')}>
                    <div className="relative">
                      <ErpInput
                        type="text"
                        required={isFieldRequired('room', false)}
                        placeholder={getFieldPlaceholder('room', 'Ví dụ: Phòng 201 / Sân tập số 2')}
                        value={form.location}
                        onChange={(e) => setForm({ ...form, location: e.target.value })}
                        className="pl-10"
                      />
                      <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-405">
                        <MapPin className="w-4 h-4" />
                      </div>
                    </div>
                  </ErpField>
                </div>
              )}
            </div>

            <CustomFieldsSection
              moduleKey="batches"
              values={form.customFields}
              onChange={(customFields) => setForm((previous) => ({ ...previous, customFields }))}
              mode={editingId ? "edit" : "create"}
              disabled={isSubmitting}
              tenantId={resolvedCenter}
              isEditingFields={isEditingFields}
              onToggleEditingFields={setIsEditingFields}
            />

            {manageable && archivedStdFields.length ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-3 mt-4 text-left">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Trường mặc định đã lưu trữ</h4>
                <ul className="mt-2 divide-y divide-slate-100">
                  {archivedStdFields.map((field) => (
                    <li key={field.key} className="flex items-center justify-between py-2 text-xs text-slate-600">
                      <span>{field.label}</span>
                      <button
                        type="button"
                        disabled={isSubmitting}
                        className="font-bold text-cyan-600 hover:text-cyan-700 disabled:opacity-50 transition-colors cursor-pointer"
                        aria-label={`Khôi phục ${field.label}`}
                        onClick={() => restoreStdField(field.key)}
                      >
                        Khôi phục
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {/* Custom submit button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2 bg-gradient-to-r from-brand-primary to-sky-600 hover:from-brand-primary/95 hover:to-sky-700 text-white rounded-lg text-xs font-black uppercase tracking-wider shadow-md shadow-brand-primary/10 hover:shadow-brand-primary/20 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              ) : (
                <School className="w-4 h-4" />
              )}
              {isSubmitting ? 'Đang lưu...' : editingId ? 'Lưu thay đổi' : copy.createSubmit}
            </button>
          </form>
        </ErpModal>
      )}

      {/* Manage Learners Modal */}
      {manageBatch && (
        <ErpModal
          title={`${entityLabel.tabLabel} ${copy.entityNameLower} ${manageBatch.code}`}
          onClose={() => setManageLearnersId(null)}
          maxWidth="max-w-lg"
        >
          <div className="space-y-6">
            <p className={cn("text-xs font-bold", darkMode ? "text-slate-400" : "text-slate-500")}>
              {manageBatch.courseTitle} • {copy.capacityLabel}: {manageBatch.learnerIds.length}
              {manageBatch.maxLearners ? `/${manageBatch.maxLearners}` : ''} {entityLabel.singular}
            </p>

            {/* Add learner */}
            <div className="flex gap-2">
              <div className="flex-1">
                <ErpSelect
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                >
                  <option value="">{`-- Chọn ${entityLabel.singular} để thêm vào ${copy.entityNameLower} --`}</option>
                  {availableStudents.map((s) => (
                    <option key={s.id} value={s.id}>{s.fullName} ({s.phone})</option>
                  ))}
                </ErpSelect>
              </div>
              <button
                type="button"
                onClick={handleAddLearner}
                disabled={!selectedStudentId}
                className="px-3.5 py-2 bg-brand-primary text-white rounded-lg text-xs font-bold transition-all hover:bg-brand-primary/95 disabled:opacity-50 flex items-center gap-1.5 shrink-0 cursor-pointer shadow-sm"
              >
                <UserPlus className="w-3.5 h-3.5" /> Thêm
              </button>
            </div>

            {/* Enrolled learners */}
            <div className="space-y-2">
              <h5 className={cn("text-xs font-black uppercase tracking-wider", darkMode ? "text-slate-400" : "text-slate-500")}>
                Danh sách {entityLabel.singular} trong {copy.entityNameLower}
              </h5>
              {enrolledStudents.length === 0 ? (
                <p className="text-xs text-slate-400">{copy.entityName} chưa có {entityLabel.singular} nào.</p>
              ) : (
                <div className={cn("border rounded-xl p-1 max-h-72 overflow-y-auto divide-y", darkMode ? "border-slate-800 divide-slate-800/40" : "border-slate-100 divide-slate-100/60")}>
                  {enrolledStudents.map((s) => (
                    <div key={s.id} className="flex items-center justify-between py-1.5 px-2">
                      <div>
                        <p className={cn("text-xs font-bold", darkMode ? "text-slate-200" : "text-slate-700")}>{s.fullName}</p>
                        <p className="text-[9px] text-slate-400">{s.phone}{s.rank ? ` • Hạng ${s.rank}` : ''}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveLearner(s.id)}
                        title={`Bỏ khỏi ${copy.entityNameLower}`}
                        className={cn(
                          "p-1 rounded-lg transition-all border cursor-pointer shadow-sm",
                          darkMode
                            ? "bg-slate-800 hover:bg-rose-900/40 text-slate-450 hover:text-rose-400 border-transparent"
                            : "bg-slate-50 hover:bg-rose-50 text-slate-450 hover:text-rose-600 border-slate-200/60"
                        )}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ErpModal>
      )}

      {/* Confirm Delete Modal */}
      <ErpConfirmModal
        isOpen={deleteConfirm.isOpen}
        title={`Xóa ${copy.entityNameLower}`}
        message={`Bạn có chắc chắn muốn xóa ${copy.entityNameLower} "${deleteConfirm.code}" không? Danh sách ${entityLabel.singular} trong ${copy.entityNameLower} sẽ bị gỡ liên kết. Hành động này không thể hoàn tác.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm({ isOpen: false, id: '', code: '' })}
        confirmText="Xác nhận xóa"
        cancelText="Hủy bỏ"
      />

      <CustomFieldEditorModal
        open={stdEditorOpen}
        moduleKey="batches"
        initialField={editingStdField}
        onClose={() => setStdEditorOpen(false)}
        onSubmit={handleStdFieldSubmit}
        isStandard={true}
      />

      {assignmentBatchId && (() => {
        const assignmentBatch = batches.find(b => b.id === assignmentBatchId);
        if (!assignmentBatch) return null;
        const batchStudents = students.filter(s => assignmentBatch.learnerIds.includes(s.id));
        return (
          <AssignmentModal
            isOpen={true}
            batch={assignmentBatch}
            students={batchStudents}
            onClose={() => setAssignmentBatchId(null)}
          />
        );
      })()}

      {attendanceBatchId && (() => {
        const targetBatch = batches.find(b => b.id === attendanceBatchId);
        if (!targetBatch) return null;
        return (
          <AttendanceModal
            isOpen={true}
            batch={targetBatch}
            students={students}
            onClose={() => setAttendanceBatchId(null)}
            onSuccess={() => {
              notifyBatchMutation();
            }}
          />
        );
      })()}

      {viewAttendanceBatchId && (() => {
        const targetBatch = batches.find(b => b.id === viewAttendanceBatchId);
        if (!targetBatch) return null;
        return (
          <AttendanceViewModal
            isOpen={true}
            batch={targetBatch}
            students={students}
            onClose={() => setViewAttendanceBatchId(null)}
          />
        );
      })()}
    </div>
  );
}
