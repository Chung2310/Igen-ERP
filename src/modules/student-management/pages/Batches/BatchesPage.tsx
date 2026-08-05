import React, { useState } from 'react';
import {
  School, Trash2, Pencil, Users, UserPlus, X, GraduationCap,
  Tag, BookOpen, Clock, Calendar, CalendarRange, MapPin, ClipboardList,
  CalendarCheck, BarChart2, LayoutGrid, Rows3, Eye, ChevronDown
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { apiFetch } from '../../lib/api';
import { toast } from '../../../../pages/Toast';
import { useBatches } from '../../hooks/useBatches';
import { useCourses } from '../../hooks/useCourses';
import { getRoadmaps, type LearningRoadmap } from '../../api/learningRoadmap.api';
import { authService } from '../../../../services/authService';
import { useStudents } from '../../hooks/useStudents';
import { useResources } from '../../hooks/useResources';
import { Batch, BatchStatus, BatchProgress, BatchProgressLevel, BatchAgeLabel } from '../../types';
import {
  ErpPageHeader, ErpPrimaryButton, ErpSearchBar, ErpFilterTab, ErpFilterRail,
  ErpModal, ErpField, ErpInput, ErpSelect,
  ErpEmptyState, ErpLoadingState, ErpCard, ErpConfirmModal, ErpTableHead,
  erpInputClass
} from '../../components/Erp/ErpUI';
import { Pagination } from '../../components/ui/Pagination';
import { RoadmapPicker } from '../../components/ui/RoadmapPicker';
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
import { InstructorCombobox } from '../../components/Batches/InstructorCombobox';
import { AttendanceModal } from '../../components/Batches/AttendanceModal';
import { AttendanceViewModal } from '../../components/Batches/AttendanceViewModal';
import { ManageLearnersModal } from '../../components/Batches/ManageLearnersModal';
import { canManageCustomFields } from '../../custom-fields/permissions';
import type { CreateFieldInput, FieldDefinition } from '../../custom-fields/types';

const BATCH_STATUSES: BatchStatus[] = ['Sắp khai giảng', 'Đang học', 'Đã kết thúc', 'Đã hủy'];

/** Bộ lọc nhanh theo mức cảnh báo tiến độ */
type ProgressFilter = 'all' | 'yellow' | 'red';

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
  if (status === 'Đã hủy') return "bg-rose-500/10 text-rose-400 border-rose-500/15";
  return "bg-slate-500/10 text-slate-400 border-slate-500/15";
};

const progressStyle = (level: BatchProgressLevel) => {
  if (level === 'red') return "bg-rose-500/10 text-rose-500 border-rose-500/20";
  if (level === 'yellow') return "bg-amber-500/10 text-amber-500 border-amber-500/20";
  if (level === 'green') return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
  return "bg-slate-500/10 text-slate-400 border-slate-500/15";
};

/** Nội dung chip cảnh báo tiến độ; đỏ nghĩa là quá hạn mà lớp chưa được đóng */
const progressAccentStyle = (level?: BatchProgressLevel) => {
  if (level === 'red') return "border-l-rose-600";
  if (level === 'yellow') return "border-l-amber-500";
  if (level === 'green') return "border-l-emerald-600";
  return "border-l-slate-400";
};

const progressStatusText = (level: BatchProgressLevel) => {
  if (level === 'red') return "Quá hạn";
  if (level === 'yellow') return "Cần chú ý";
  if (level === 'green') return "Tốt";
  return "Chưa có dữ liệu";
};

const progressText = (p: BatchProgress) => {
  const sessionSummary = `Đã học ${p.doneSessions}/${p.totalSessions} buổi`;
  if (p.progressLevel === 'red') return `Quá hạn — chưa đóng lớp • ${sessionSummary}`;
  if (p.progressLevel === 'grey') return sessionSummary;
  return `${sessionSummary} • còn ${p.remainingSessions} buổi`;
};

/** Nhãn phụ theo tuổi lớp đã hoàn thành, độc lập với màu tiến độ */
const ageLabelText = (label: BatchAgeLabel) => {
  if (label === 'red') return 'Hoàn thành quá 1 năm';
  if (label === 'yellow') return 'Hoàn thành 6–12 tháng';
  return '';
};

const ageLabelStyle = (label: BatchAgeLabel) =>
  label === 'red'
    ? "bg-rose-500/10 text-rose-500 border-rose-500/20"
    : "bg-amber-500/10 text-amber-500 border-amber-500/20";

interface BatchForm {
  code: string;
  /** Tên dự án — dùng thay danh mục tuyển dụng ở preset lao động */
  name: string;
  /** Chỉ tiêu riêng; '' = theo chỉ tiêu của khóa học/danh mục */
  quota: number | '';
  /** Vị trí công trường dùng để chặn chấm công từ xa; '' = không giới hạn */
  geoLat: number | '';
  geoLng: number | '';
  geoRadius: number | '';
  courseId: string;
  learningMode: 'standalone' | 'roadmap';
  roadmapId: string;
  roadmapStepId: string;
  instructorId: string;
  instructorText: string;
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  location: string;
  startDate: string;
  endDate: string;
  status: BatchStatus;
  customFields?: CustomFieldValues;
}

const BATCH_VIEW_MODE_KEY = 'batches:viewMode';

/** Bán kính mặc định quanh công trường khi người dùng không nhập, mét. */
const DEFAULT_PROJECT_RADIUS_METERS = 300;

const EMPTY_FORM: BatchForm = {
  code: '',
  name: '',
  quota: '',
  geoLat: '',
  geoLng: '',
  geoRadius: '',
  courseId: '',
  learningMode: 'standalone',
  roadmapId: '',
  roadmapStepId: '',
  instructorId: '',
  instructorText: '',
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
  } = useStandardFields("batches", entityLabel.preset);

  const manageable = canManageCustomFields(user?.permissions);
  const [stdEditorOpen, setStdEditorOpen] = useState(false);
  const [editingStdField, setEditingStdField] = useState<FieldDefinition | null>(null);
  const [isEditingFields, setIsEditingFields] = useState(false);
  // Kiểu hiển thị danh sách: bảng hoặc thẻ (ghi nhớ lựa chọn của người dùng)
  const [viewMode, setViewMode] = useState<'table' | 'card'>(() => {
    if (typeof window === 'undefined') return 'table';
    return window.localStorage.getItem(BATCH_VIEW_MODE_KEY) === 'card' ? 'card' : 'table';
  });
  const changeViewMode = (mode: 'table' | 'card') => {
    setViewMode(mode);
    if (typeof window !== 'undefined') window.localStorage.setItem(BATCH_VIEW_MODE_KEY, mode);
  };

  const [locating, setLocating] = useState(false);

  /** Lấy toạ độ máy đang đứng để đặt tâm công trường — người đặt thường đứng tại chỗ. */
  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Trình duyệt không hỗ trợ định vị.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setForm((previous) => ({
          ...previous,
          geoLat: Number(position.coords.latitude.toFixed(6)),
          geoLng: Number(position.coords.longitude.toFixed(6)),
          geoRadius: previous.geoRadius === '' ? DEFAULT_PROJECT_RADIUS_METERS : previous.geoRadius,
        }));
        setLocating(false);
      },
      (error) => {
        setLocating(false);
        toast.error(error.code === error.PERMISSION_DENIED
          ? 'Bạn đã chặn quyền vị trí cho trang này.'
          : 'Không lấy được vị trí hiện tại.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

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

  const isFieldVisible = (fieldKey: string, defaultVisible = true) => {
    const fieldConfig = stdFields.find(f => f.key === fieldKey);
    return fieldConfig ? fieldConfig.isVisible : defaultVisible;
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
    if (fieldKey === 'courseId' && entityLabel.preset === 'worker') {
      return false;
    }
    const fieldConfig = stdFields.find(f => f.key === fieldKey);
    return fieldConfig ? fieldConfig.isRequired : defaultRequired;
  };

  const resolvedCenter = selectedCenter === 'all' ? undefined : selectedCenter;
  const { batches, loading } = useBatches(resolvedCenter);
  const { courses } = useCourses(resolvedCenter);
  const [roadmaps, setRoadmaps] = useState<LearningRoadmap[]>([]);
  React.useEffect(() => {
    if (entityLabel.preset === 'worker') return;
    void getRoadmaps().then(setRoadmaps).catch(() => setRoadmaps([]));
  }, [entityLabel.preset, resolvedCenter]);
  const { resources } = useResources();
  const classrooms = React.useMemo(() => resources.filter(r => r.type === 'Phòng học'), [resources]);
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
  const [progressFilter, setProgressFilter] = useState<ProgressFilter>('all');
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BatchForm>(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [manageLearnersId, setManageLearnersId] = useState<string | null>(null);
  const [assignmentBatchId, setAssignmentBatchId] = useState<string | null>(null);
  const [attendanceBatchId, setAttendanceBatchId] = useState<string | null>(null);
  const [viewAttendanceBatchId, setViewAttendanceBatchId] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [viewingBatch, setViewingBatch] = useState<Batch | null>(null);
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
      name: batch.name || '',
      quota: batch.quota && batch.quota > 0 ? batch.quota : '',
      geoLat: batch.geoLocation?.latitude ?? '',
      geoLng: batch.geoLocation?.longitude ?? '',
      geoRadius: batch.geoLocation?.radiusMeters ?? '',
      courseId: batch.courseId,
      learningMode: batch.roadmapId && batch.roadmapStepId ? 'roadmap' : 'standalone',
      roadmapId: batch.roadmapId || '',
      roadmapStepId: batch.roadmapStepId || '',
      instructorId: batch.instructorId || '',
      instructorText: batch.instructorText || '',
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
        if (f.key === 'courseId') {
          // Preset lao động dùng ô "Tên dự án" thay cho danh mục tuyển dụng
          if (entityLabel.preset === 'worker') {
            if (!form.name.trim()) missingFields.push(f.label);
          } else if (!form.courseId) {
            missingFields.push(f.label);
          }
        }
        if (f.key === 'startDate' && !form.startDate) missingFields.push(f.label);
        if (f.key === 'endDate' && !form.endDate) missingFields.push(f.label);
        if (f.key === 'schedule') {
          if (form.daysOfWeek.length === 0 || !form.startTime || !form.endTime) {
            missingFields.push(f.label);
          }
        }
        if (f.key === 'room' && !form.location) missingFields.push(f.label);
        if (f.key === 'teacherId' && !form.instructorId && !form.instructorText.trim()) missingFields.push(f.label);
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
      let resolvedCourseId = form.courseId;
      if (entityLabel.preset === 'worker' && !resolvedCourseId) {
        if (courses.length > 0) {
          resolvedCourseId = courses[0].id;
        } else {
          // Tự động tạo danh mục tuyển dụng mặc định nếu chưa có
          const newCourseRes = await apiFetch<any>('/courses', {
            method: 'POST',
            body: JSON.stringify({
              code: 'MAC_DINH',
              title: 'Danh mục mặc định',
              duration: '12 tháng',
              fee: '0',
              category: 'Tuyển dụng',
              maxLearners: 1000,
              ...(resolvedCenter ? { companyCode: resolvedCenter } : {}),
            }),
          });
          if (newCourseRes?.success && (newCourseRes?.data?.id || newCourseRes?.data?._id)) {
            resolvedCourseId = newCourseRes.data.id || newCourseRes.data._id;
          } else {
            throw new Error("Không thể tự động tạo danh mục tuyển dụng mặc định.");
          }
        }
      }

      const { geoLat, geoLng, geoRadius, learningMode: _learningMode, ...restForm } = form;
      const payload = {
        ...restForm,
        courseId: resolvedCourseId,
        code: form.code.toUpperCase(),
        name: form.name.trim(),
        quota: form.quota === '' ? 0 : Number(form.quota),
        geoLocation: form.geoLat === '' || form.geoLng === ''
          ? null
          : {
              latitude: Number(form.geoLat),
              longitude: Number(form.geoLng),
              radiusMeters: form.geoRadius === '' ? DEFAULT_PROJECT_RADIUS_METERS : Number(form.geoRadius),
            },
        // Chỉ một trong hai: gán tài khoản hoặc tên nhập tay
        instructorText: form.instructorId ? '' : form.instructorText.trim(),
        ...(editingId ? { expectedVersion: batches.find((batch) => batch.id === editingId)?.__v } : {}),
        ...(!editingId && resolvedCenter ? { companyCode: resolvedCenter } : {}),
      };
      if (editingId) {
        // Mã lớp và tên lớp bị khóa sau khi tạo nên không gửi lên khi sửa.
        const { code: _lockedCode, name: _lockedName, ...editPayload } = payload;
        await apiFetch(`/batches/${editingId}`, { method: 'PATCH', body: JSON.stringify(editPayload) });
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
      (b.name || '').toLowerCase().includes(term) ||
      (b.courseTitle || '').toLowerCase().includes(term) ||
      (b.instructorName || '').toLowerCase().includes(term);
    const matchesStatus = statusFilter === 'all' || b.status === statusFilter;
    const matchesProgress = progressFilter === 'all' || b.progress?.progressLevel === progressFilter;
    return matchesSearch && matchesStatus && matchesProgress;
  });
  const totalPages = Math.ceil(filteredBatches.length / pageSize);
  const paginatedBatches = filteredBatches.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1);
    }, 0);
    return () => clearTimeout(timer);
  }, [searchTerm, statusFilter, progressFilter]);

  const availableStudents = manageBatch
    ? students.filter(s => !manageBatch.learnerIds.includes(s.id))
    : [];
  const enrolledStudents = manageBatch
    ? manageBatch.learnerIds
      .map(id => students.find(s => s.id === id))
      .filter((s): s is NonNullable<typeof s> => !!s)
    : [];

  // Tiêu đề hiển thị: preset lao động dùng tên dự án, các preset khác dùng khóa học
  const displayTitle = (b: Batch) =>
    entityLabel.preset === 'worker' ? (b.name || b.code) : b.courseTitle;
  const displaySubtitle = (b: Batch) =>
    entityLabel.preset === 'worker' ? '' : b.courseCode;

  const renderStatusSelect = (b: Batch) => (
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
  );

  /**
   * Chip cảnh báo tiến độ + nhãn tuổi lớp. Nhãn tuổi là nhãn phụ, hiển thị
   * song song chứ không thay thế màu tiến độ.
   */
  const renderProgressChips = (b: Batch) => {
    if (!b.progress) return null;
    return (
      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
        <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide", b.progress.progressLevel === 'red' ? "bg-rose-600 text-white" : b.progress.progressLevel === 'yellow' ? "bg-amber-500 text-white" : b.progress.progressLevel === 'green' ? "bg-emerald-600 text-white" : "bg-slate-500 text-white")}>
          {progressStatusText(b.progress.progressLevel)}
        </span>
        <span className={cn(
          "px-1.5 py-0.5 rounded text-[9px] font-black uppercase border",
          progressStyle(b.progress.progressLevel)
        )}>
          {progressText(b.progress)}
        </span>
        {b.progress.ageLabel && (
          <span
            title="Nhãn rà soát dữ liệu lớp cũ"
            className={cn(
              "px-1.5 py-0.5 rounded text-[9px] font-black uppercase border",
              ageLabelStyle(b.progress.ageLabel)
            )}
          >
            {ageLabelText(b.progress.ageLabel)}
          </span>
        )}
      </div>
    );
  };

  const actionButtonClass = (tone: 'neutral' | 'danger' | 'brand' | 'emerald' | 'sky') => cn(
    "p-1 rounded-lg transition-all border cursor-pointer shadow-sm",
    tone === 'danger'
      ? (darkMode ? "bg-slate-800 hover:bg-rose-900/40 text-slate-450 hover:text-rose-450 border-transparent" : "bg-slate-50 hover:bg-rose-50 text-slate-450 hover:text-rose-550 border-slate-200/60")
      : tone === 'brand'
        ? (darkMode ? "bg-slate-800 hover:bg-brand-primary/20 text-slate-450 hover:text-brand-primary border-transparent" : "bg-slate-50 hover:bg-brand-primary/10 text-slate-450 hover:text-brand-primary border-slate-200/60")
        : tone === 'emerald'
          ? (darkMode ? "bg-slate-800 hover:bg-emerald-900/40 text-slate-450 hover:text-emerald-400 border-transparent" : "bg-slate-50 hover:bg-emerald-50 text-slate-450 hover:text-emerald-600 border-slate-200/60")
          : tone === 'sky'
            ? (darkMode ? "bg-slate-800 hover:bg-sky-900/40 text-slate-450 hover:text-sky-400 border-transparent" : "bg-slate-50 hover:bg-sky-50 text-slate-450 hover:text-sky-600 border-slate-200/60")
            : (darkMode ? "bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border-transparent" : "bg-slate-50 hover:bg-slate-100 text-slate-450 hover:text-slate-700 border-slate-200/60")
  );

  const renderRowActions = (b: Batch) => (
    <div className="flex items-center gap-1.5">
      <button onClick={() => setViewingBatch(b)} title={`Xem chi tiết ${copy.entityNameLower}`} className={actionButtonClass('neutral')}>
        <Eye className="w-3 h-3" />
      </button>
      <button onClick={() => openEditModal(b)} title={`Chỉnh sửa ${copy.entityNameLower}`} className={actionButtonClass('neutral')}>
        <Pencil className="w-3 h-3" />
      </button>
      <button onClick={() => setDeleteConfirm({ isOpen: true, id: b.id, code: b.code })} title={`Xóa ${copy.entityNameLower}`} className={actionButtonClass('danger')}>
        <Trash2 className="w-3 h-3" />
      </button>
      <button onClick={() => setManageLearnersId(b.id)} title={`Quản lý ${entityLabel.singular}`} className={actionButtonClass('brand')}>
        <Users className="w-3 h-3" />
      </button>
      <button onClick={() => setAssignmentBatchId(b.id)} title={entityLabel.preset === 'worker' ? 'Giao nhiệm vụ' : 'Giao bài tập'} className={actionButtonClass('brand')}>
        <ClipboardList className="w-3 h-3" />
      </button>
      <button onClick={() => setAttendanceBatchId(b.id)} title="Điểm danh thủ công & QR" className={actionButtonClass('emerald')}>
        <CalendarCheck className="w-3 h-3" />
      </button>
      <button onClick={() => setViewAttendanceBatchId(b.id)} title="Lịch sử & Thống kê điểm danh" className={actionButtonClass('sky')}>
        <BarChart2 className="w-3 h-3" />
      </button>
    </div>
  );

  const renderLearnerCountButton = (b: Batch) => (
    <button
      onClick={() => { setManageLearnersId(b.id); setSelectedStudentId(''); }}
      title={`Quản lý ${entityLabel.singular} trong ${copy.entityNameLower}`}
      className={cn(
        "flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-black transition-all border cursor-pointer shadow-sm",
        darkMode ? "bg-slate-800 hover:bg-slate-700 text-slate-300 border-transparent" : "bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200/60"
      )}
    >
      <Users className="w-3 h-3 text-brand-primary" />
      {b.learnerIds.length}{b.maxLearners ? `/${b.maxLearners}` : ''} {entityLabel.singular}
    </button>
  );

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
        {/* Lọc nhanh theo cảnh báo tiến độ — dữ liệu do server tính sẵn */}
        <ErpFilterRail>
          <ErpFilterTab active={progressFilter === 'all'} onClick={() => setProgressFilter('all')}>
            Mọi tiến độ
          </ErpFilterTab>
          <ErpFilterTab active={progressFilter === 'yellow'} onClick={() => setProgressFilter('yellow')}>
            Sắp hết buổi
          </ErpFilterTab>
          <ErpFilterTab active={progressFilter === 'red'} onClick={() => setProgressFilter('red')}>
            Quá hạn
          </ErpFilterTab>
        </ErpFilterRail>
        <div className={cn(
          "flex items-center gap-1 p-1 rounded-xl border self-start",
          darkMode ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-200/60"
        )}>
          <button
            type="button"
            onClick={() => changeViewMode('table')}
            title="Dạng bảng"
            className={cn(
              "p-1.5 rounded-lg transition-all cursor-pointer",
              viewMode === 'table' ? "bg-brand-primary text-white shadow-sm" : "text-slate-450 hover:text-slate-700"
            )}
          >
            <Rows3 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => changeViewMode('card')}
            title="Dạng thẻ"
            className={cn(
              "p-1.5 rounded-lg transition-all cursor-pointer",
              viewMode === 'card' ? "bg-brand-primary text-white shadow-sm" : "text-slate-450 hover:text-slate-700"
            )}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
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
      ) : viewMode === 'card' ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {paginatedBatches.map((b) => (
              <ErpCard key={b.id} className={cn("overflow-hidden border-l-[6px] p-4 flex flex-col gap-3", progressAccentStyle(b.progress?.progressLevel))}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{b.code}</p>
                    <p className="font-bold text-sm truncate" title={displayTitle(b)}>{displayTitle(b)}</p>
                    {displaySubtitle(b) && (
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{displaySubtitle(b)}</p>
                    )}
                  </div>
                  {renderStatusSelect(b)}
                </div>

                <div className="space-y-1.5 text-xs text-slate-600">
                  <p className="flex items-center gap-1.5 font-bold">
                    <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
                    {b.instructorName || <span className="text-slate-400 italic">Chưa gán</span>}
                  </p>
                  {b.instructorQualification && (
                    <p className="ml-1 flex w-fit items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 text-[10px] font-bold text-indigo-700 shadow-sm ring-1 ring-indigo-100">
                      <GraduationCap className="h-3 w-3 text-indigo-500" />
                      Trình độ: {b.instructorQualification}
                    </p>
                  )}
                  <p className="flex items-center gap-1.5 font-bold">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    {formatDays(b.daysOfWeek)} • {b.startTime} - {b.endTime}
                  </p>
                  <p className="flex items-center gap-1.5 font-bold whitespace-nowrap">
                    <CalendarRange className="w-3.5 h-3.5 text-slate-400" />
                    {formatDate(b.startDate)} → {formatDate(b.endDate)}
                  </p>
                  {b.location && (
                    <p className="flex items-center gap-1.5 font-bold truncate" title={b.location}>
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      {b.location}
                    </p>
                  )}
                  {renderProgressChips(b)}
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                  {renderLearnerCountButton(b)}
                  {renderRowActions(b)}
                </div>
              </ErpCard>
            ))}
          </div>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            totalItems={filteredBatches.length}
            pageSize={pageSize}
            itemName={copy.entityNameLower}
          />
        </div>
      ) : (
        <ErpCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <ErpTableHead columns={[copy.codeLabel, copy.courseLabel, copy.instructorLabel, 'Lịch hoạt động', 'Thời gian', 'Tiến độ', copy.capacityLabel, 'Trạng thái', 'Thao tác']} />
              <tbody className={cn("divide-y", darkMode ? "divide-slate-800/30" : "divide-slate-100")}>
                {paginatedBatches.map((b) => (
                  <tr key={b.id} className={cn("transition-colors hover:bg-slate-50/50", darkMode ? "text-slate-355 hover:bg-slate-800/10" : "text-slate-600")}>
                    <td className="py-2 px-4 font-black text-sm">{b.code}</td>
                    <td className="py-2 px-4">
                      <p className="font-bold">{displayTitle(b)}</p>
                      {displaySubtitle(b) && (
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{displaySubtitle(b)}</p>
                      )}
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
                      {renderProgressChips(b)}
                    </td>
                    <td className="py-2 px-4">
                      {renderLearnerCountButton(b)}
                    </td>
                    <td className="py-2 px-4">
                      {renderStatusSelect(b)}
                    </td>
                    <td className="py-2 px-4">
                      {renderRowActions(b)}
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
                    <ErpField
                      label={getFieldLabel('code', copy.codeLabel)}
                      hint={editingId ? 'Không thể thay đổi sau khi tạo' : undefined}
                    >
                      <div className="relative">
                        <ErpInput
                          type="text"
                          required={isFieldRequired('code', true)}
                          readOnly={!!editingId}
                          disabled={!!editingId}
                          placeholder={getFieldPlaceholder('code', entityLabel.preset === 'worker' ? 'Ví dụ: DA-001' : 'Ví dụ: K32')}
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
                {entityLabel.preset !== 'worker' && (
                  <div className="col-span-2 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-bold text-slate-700">Cách áp dụng khóa học</p>
                      <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
                        <button type="button" onClick={() => setForm((current) => ({ ...current, learningMode: 'standalone', roadmapId: '', roadmapStepId: '' }))} className={`rounded-md px-3 py-1.5 text-xs font-bold ${form.learningMode === 'standalone' ? 'bg-slate-800 text-white' : 'text-slate-600'}`}>Lớp độc lập</button>
                        <button type="button" onClick={() => setForm((current) => ({ ...current, learningMode: 'roadmap', courseId: '', roadmapId: '', roadmapStepId: '' }))} className={`rounded-md px-3 py-1.5 text-xs font-bold ${form.learningMode === 'roadmap' ? 'bg-cyan-700 text-white' : 'text-slate-600'}`}>Theo lộ trình</button>
                      </div>
                    </div>
                    {form.learningMode === 'roadmap' && (
                      <div className="grid gap-3 md:grid-cols-2">
                        <RoadmapPicker value={form.roadmapId} placeholder="-- Chọn lộ trình --" options={roadmaps.map((roadmap) => ({ value: roadmap.id, label: roadmap.name }))} onChange={(value) => setForm((current) => ({ ...current, roadmapId: value, roadmapStepId: '', courseId: '' }))} />
                        <RoadmapPicker value={form.roadmapStepId} disabled={!form.roadmapId} placeholder="-- Chọn chặng học --" options={(roadmaps.find((roadmap) => roadmap.id === form.roadmapId)?.steps || []).sort((a, b) => a.order - b.order).map((step) => ({ value: step.id, label: `Chặng ${step.order}: ${courses.find((item) => item.id === step.courseId)?.title || 'Khóa học đã xóa'}` }))} onChange={(value) => { const step = roadmaps.find((roadmap) => roadmap.id === form.roadmapId)?.steps.find((item) => item.id === value); setForm((current) => ({ ...current, roadmapStepId: value, courseId: step?.courseId || '' })); }} />
                      </div>
                    )}
                  </div>
                )}
                {isFieldVisible('courseId') && (
                  <div className="relative group/std">
                    {renderFieldActions('courseId')}
                    <ErpField
                      label={getFieldLabel('courseId', copy.courseLabel)}
                      hint={editingId && entityLabel.preset === 'worker' ? 'Không thể thay đổi sau khi tạo' : undefined}
                    >
                      <div className="relative">
                        {entityLabel.preset === 'worker' ? (
                          <ErpInput
                            type="text"
                            required
                            readOnly={!!editingId}
                            disabled={!!editingId}
                            placeholder={getFieldPlaceholder('courseId', 'Ví dụ: Tuyển 100 công nhân nhà máy Samsung')}
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            className="pl-10"
                          />
                        ) : form.learningMode === 'roadmap' ? (
                          <ErpInput
                            type="text"
                            readOnly
                            placeholder="Chọn lộ trình và chặng học ở trên"
                            value={courses.find((course) => course.id === form.courseId)?.title || ''}
                            className="pl-10 bg-slate-50"
                          />
                        ) : (
                        <RoadmapPicker value={form.courseId} className="h-9 rounded-lg border-slate-200 bg-slate-50 px-3 pl-10 text-xs shadow-none focus:ring-brand-primary/5" placeholder={`-- Chọn ${copy.courseLabel.toLocaleLowerCase('vi')} --`} options={courses.map((course) => ({ value: course.id, label: `${course.code} — ${course.title}` }))} onChange={(value) => setForm({ ...form, courseId: value })} />
                        )}
                        <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400 z-10">
                          <BookOpen className="w-4 h-4" />
                        </div>
                      </div>
                    </ErpField>
                  </div>
                )}
                <div className="relative group/std">
                  <ErpField label={copy.capacityLabel}>
                    <div className="relative">
                      <ErpInput
                        type="number"
                        min={0}
                        placeholder={entityLabel.preset === 'worker' ? 'Ví dụ: 30' : 'Để trống = theo khóa học'}
                        value={form.quota}
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (raw === '') { setForm({ ...form, quota: '' }); return; }
                          const parsed = parseInt(raw, 10);
                          setForm({ ...form, quota: Number.isNaN(parsed) ? '' : Math.max(0, parsed) });
                        }}
                        className="pl-10"
                      />
                      <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400 z-10">
                        <Users className="w-4 h-4" />
                      </div>
                    </div>
                  </ErpField>
                  <p className="mt-1 text-[10px] text-slate-400">
                    Để trống sẽ lấy theo {entityLabel.preset === 'worker' ? 'danh mục gốc' : 'sĩ số tối đa của khóa học'}.
                  </p>
                </div>
              </div>

              {isFieldVisible('teacherId') && (
                <div className="relative group/std">
                  {renderFieldActions('teacherId')}
                  <ErpField label={getFieldLabel('teacherId', copy.instructorLabel)}>
                    <InstructorCombobox
                      instructorId={form.instructorId}
                      instructorText={form.instructorText}
                      options={instructorOptions}
                      required={isFieldRequired('teacherId', false)}
                      placeholder={`Nhập tên ${copy.instructorLabel.toLocaleLowerCase('vi')} hoặc chọn tài khoản...`}
                      onChange={(next) => setForm({ ...form, ...next })}
                    />
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

                <ErpField label={entityLabel.preset === 'worker' ? 'Ngày hoạt động trong tuần' : 'Ngày học trong tuần'}>
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
                    <TimeInput24
                      required={isFieldRequired('schedule', true)}
                      value={form.startTime}
                      onChange={(v) => setForm({ ...form, startTime: v })}
                      className="w-full"
                    />
                  </ErpField>
                  <ErpField label="Giờ kết thúc">
                    <TimeInput24
                      required={isFieldRequired('schedule', true)}
                      value={form.endTime}
                      onChange={(v) => setForm({ ...form, endTime: v })}
                      className="w-full"
                    />
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
                  <ErpField label={getFieldLabel('room', 'Địa điểm / Phòng học (tùy chọn)')}>
                    <div className="relative">
                      {classrooms.length > 0 ? (
                        <RoadmapPicker value={form.location} placeholder="-- Chọn phòng học --" options={classrooms.map((room) => ({ value: room.name, label: `${room.name} (${room.identifier})` }))} onChange={(value) => setForm({ ...form, location: value })} />
                      ) : (
                        <>
                          <ErpInput
                            type="text"
                            required={isFieldRequired('room', false)}
                            placeholder={getFieldPlaceholder('room', entityLabel.preset === 'worker' ? 'Ví dụ: Công trường số 2 / Nhà máy A' : 'Ví dụ: Phòng 201 / Sân tập số 2')}
                            value={form.location}
                            onChange={(e) => setForm({ ...form, location: e.target.value })}
                            className="pl-10"
                          />
                          <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-405">
                            <MapPin className="w-4 h-4" />
                          </div>
                        </>
                      )}
                    </div>
                  </ErpField>
                </div>
              )}

              <div className="relative group/std md:col-span-2">
                <ErpField label="Giới hạn chấm công bằng GPS (tùy chọn)">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                    <div className="relative flex-1 w-full">
                      <div
                        className={cn(
                          erpInputClass(darkMode),
                          "flex items-center gap-2 pr-28 select-none border-dashed",
                          (form.geoLat !== '' && form.geoLng !== '')
                            ? "text-brand-primary bg-brand-primary/5 border-brand-primary/30"
                            : "text-slate-400 bg-slate-50/50"
                        )}
                      >
                        <MapPin className="w-4 h-4 shrink-0" />
                        <span className="truncate text-xs font-semibold">
                          {(form.geoLat !== '' && form.geoLng !== '')
                            ? `Đã lưu tọa độ GPS`
                            : `Chưa thiết lập tọa độ`}
                        </span>
                      </div>
                      <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        {(form.geoLat !== '' && form.geoLng !== '') && (
                          <button
                            type="button"
                            title="Xóa tọa độ"
                            onClick={() => setForm({ ...form, geoLat: '', geoLng: '', geoRadius: '' })}
                            className="w-7 h-7 flex items-center justify-center rounded-md text-rose-500 hover:bg-rose-100 transition-colors cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={useCurrentLocation}
                          disabled={locating}
                          className="h-7 px-2.5 rounded-md text-[10px] font-black uppercase tracking-wide bg-slate-800 text-white hover:bg-slate-700 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1"
                        >
                          {locating ? 'Đang lấy...' : 'Lấy vị trí'}
                        </button>
                      </div>
                    </div>

                    {(form.geoLat !== '' && form.geoLng !== '') && (
                      <div className="w-full sm:w-48 shrink-0 relative group">
                        <ErpInput
                          type="number"
                          min={10}
                          placeholder={`Bán kính (m), mặc định ${DEFAULT_PROJECT_RADIUS_METERS}`}
                          value={form.geoRadius}
                          onChange={(e) => setForm({ ...form, geoRadius: e.target.value === '' ? '' : Number(e.target.value) })}
                          className="pl-2 pr-8"
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none">
                          m
                        </div>
                      </div>
                    )}
                  </div>
                </ErpField>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <p className="text-[10px] text-slate-400">
                    Để trống thì {copy.entityNameLower} không giới hạn nơi chấm công.
                  </p>
                </div>
              </div>
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
        <ManageLearnersModal
          isOpen={true}
          batch={manageBatch}
          onClose={() => setManageLearnersId(null)}
          students={students}
          onSuccess={() => notifyBatchMutation()}
        />
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

      {viewingBatch && (
        <ErpModal title={`Chi tiết lớp học: ${viewingBatch.code}`} onClose={() => setViewingBatch(null)}>
          <div className="space-y-4 text-slate-700 text-left">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mã lớp</label>
                <p className="text-sm font-bold text-slate-800 mt-0.5">{viewingBatch.code}</p>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Khóa học</label>
                <p className="text-sm font-bold text-slate-800 mt-0.5">
                  {courses.find(c => c.id === viewingBatch.courseId)?.title || viewingBatch.courseTitle || 'N/A'}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Giáo viên / Phụ trách</label>
                <p className="text-sm font-medium text-slate-700 mt-0.5">{viewingBatch.instructorName || "Chưa gán"}</p>
                {viewingBatch.instructorQualification && <p className="text-xs text-slate-400 mt-0.5">Trình độ: {viewingBatch.instructorQualification}</p>}
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Trạng thái</label>
                <p className="text-sm font-bold text-slate-700 mt-0.5">{statusLabel(viewingBatch.status)}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Thời gian học</label>
                <p className="text-sm font-medium text-slate-700 mt-0.5">
                  {formatDays(viewingBatch.daysOfWeek)} • {viewingBatch.startTime} - {viewingBatch.endTime}
                </p>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Thời hạn lớp học</label>
                <p className="text-sm font-medium text-slate-700 mt-0.5">
                  {formatDate(viewingBatch.startDate)} → {formatDate(viewingBatch.endDate)}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Địa điểm</label>
                <p className="text-sm font-medium text-slate-700 mt-0.5">{viewingBatch.location || 'Chưa cập nhật'}</p>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sức chứa</label>
                <p className="text-sm font-medium text-slate-700 mt-0.5">
                  {viewingBatch.learnerIds.length} / {viewingBatch.maxLearners || 'Không giới hạn'} {entityLabel.singular}
                </p>
              </div>
            </div>

            {viewingBatch.customFields && Object.keys(viewingBatch.customFields).length > 0 && (
              <div className="border-t border-slate-100 pt-4">
                <h5 className="text-xs font-bold text-slate-800 mb-3">Trường thông tin thêm</h5>
                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(viewingBatch.customFields).map(([key, val]) => (
                    <div key={key}>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{key}</label>
                      <p className="text-sm font-medium text-slate-700 mt-0.5">{String(val || 'N/A')}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ErpModal>
      )}

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
