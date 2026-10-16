import React, { useEffect, useState } from 'react';
import {
  School, Trash2, Pencil, Users, UserPlus, X, GraduationCap,
  Tag, BookOpen, Clock, CalendarRange, MapPin, ClipboardList,
  CalendarCheck, BarChart2, LayoutGrid, Rows3, Eye, ChevronDown, Settings
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
import { Batch, BatchStatus, BatchProgressLevel, BatchAgeLabel } from '../../types';
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
import { CustomFieldsSection } from '../../../shared/custom-fields/CustomFieldsSection';
import type { CustomFieldValues } from '../../../shared/custom-fields/types';
import { useStandardFields, getAdaptedFieldDefinition, type StandardFieldConfig } from '../../hooks/useStandardFields';
import { useEntityLabel } from '../../hooks/useEntityLabel';
import { getBatchPageCopy, getBatchStatusLabel } from '../../config/workerRecruitmentCopy';
import { CustomFieldEditorModal } from '../../../shared/custom-fields/CustomFieldEditorModal';
import { AssignmentModal } from '../../components/Batches/AssignmentModal';
import { InstructorCombobox } from '../../components/Batches/InstructorCombobox';
import { VietnameseDatePicker } from '../../components/Batches/VietnameseDatePicker';
import { AttendanceModal } from '../../components/Batches/AttendanceModal';
import { AttendanceViewModal } from '../../components/Batches/AttendanceViewModal';
import { ManageLearnersModal } from '../../components/Batches/ManageLearnersModal';
import { canManageCustomFields } from '../../../shared/custom-fields/permissions';
import type { CreateFieldInput, FieldDefinition } from '../../../shared/custom-fields/types';
import { DEFAULT_BATCH_PROGRESS_COLORS, getBatchProgressColors, updateBatchProgressColors, type BatchProgressColors } from '../../api/batchProgressSettings.api';

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

function calculateEstimatedEndDate(startDate: string, daysOfWeek: number[], sessionCount: number): string {
  if (!startDate || !daysOfWeek.length || !Number.isInteger(sessionCount) || sessionCount < 1) return '';
  const date = new Date(`${startDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return '';

  let remaining = sessionCount;
  for (let index = 0; index < 3700; index += 1) {
    if (daysOfWeek.includes(date.getUTCDay()) && --remaining === 0) return date.toISOString().slice(0, 10);
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return '';
}

const formatDays = (days: number[]) =>
  DAY_OPTIONS.filter(d => (days || []).includes(d.value)).map(d => d.label).join(', ');

const formatDate = (d: string) => (d ? d.split('-').reverse().join('/') : '');

const progressStatusText = (level: BatchProgressLevel) => {
  if (level === 'red') return "Quá hạn";
  if (level === 'yellow') return "Cần chú ý";
  if (level === 'green') return "Tốt";
  if (level === 'black') return "Đã kết thúc 6–12 tháng";
  return "Chưa có dữ liệu";
};

const progressColor = (level: BatchProgressLevel, colors: BatchProgressColors) => {
  if (level === 'green') return colors.green;
  if (level === 'yellow') return colors.yellow;
  if (level === 'red') return colors.red;
  if (level === 'black') return colors.black;
  return '#64748b';
};

/** Nhãn phụ theo tuổi lớp đã hoàn thành, độc lập với màu tiến độ */
const ageLabelText = (label: BatchAgeLabel) => {
  if (label === 'red') return 'Hoàn thành quá 1 năm';
  if (label === 'yellow') return 'Hoàn thành 6–12 tháng';
  return '';
};

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
  const hasTeacherOperation = Boolean(user?.permissions?.includes('*') || user?.permissions?.includes('people:manage'));
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
  const [showProgressColors, setShowProgressColors] = useState(false);
  const [progressColors, setProgressColors] = useState<BatchProgressColors>(DEFAULT_BATCH_PROGRESS_COLORS);
  const [savingProgressColors, setSavingProgressColors] = useState(false);
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

  useEffect(() => {
    getBatchProgressColors().then(setProgressColors).catch(() => toast.error('Không thể tải cấu hình màu tiến độ lớp.'));
  }, [activeBranchId]);

  const saveProgressColors = async () => {
    setSavingProgressColors(true);
    try {
      setProgressColors(await updateBatchProgressColors(progressColors));
      setShowProgressColors(false);
      toast.success('Đã lưu màu tiến độ lớp học.');
    } catch {
      toast.error('Không thể lưu cấu hình màu tiến độ lớp.');
    } finally {
      setSavingProgressColors(false);
    }
  };

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

  const withEstimatedEndDate = (nextForm: BatchForm): BatchForm => {
    if (entityLabel.preset === 'worker') return nextForm;
    const course = courses.find((item) => item.id === nextForm.courseId);
    const sessionCount = Number(course?.duration);
    const endDate = calculateEstimatedEndDate(nextForm.startDate, nextForm.daysOfWeek, sessionCount);
    return endDate ? { ...nextForm, endDate } : nextForm;
  };

  const toggleDay = (day: number) => {
    setForm((previous) => withEstimatedEndDate({
      ...previous,
      daysOfWeek: previous.daysOfWeek.includes(day)
        ? previous.daysOfWeek.filter((value) => value !== day)
        : [...previous.daysOfWeek, day],
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
    <RoadmapPicker
      ariaLabel={`Trạng thái ${b.code}`}
      value={b.status}
      options={BATCH_STATUSES.map(st => ({ value: st, label: statusLabel(st) }))}
      placeholder={statusLabel(b.status)}
      allowClear={false}
      portal
      className="min-w-[150px] rounded-lg border-slate-200 text-xs"
      onChange={(value) => handleChangeStatus(b, value as BatchStatus)}
    />
  );

  const renderProgressSummary = (b: Batch, compact = false) => {
    if (!b.progress) return null;
    const progress = b.progress;
    const color = progressColor(progress.progressLevel, progressColors);
    const completion = progress.totalSessions > 0
      ? Math.min(100, Math.max(0, progress.doneSessions / progress.totalSessions * 100))
      : 0;
    const details = [
      progress.missingAttendanceSessions > 0 ? `Chưa điểm danh ${progress.missingAttendanceSessions} buổi` : null,
      progress.remainingSessions > 0 ? `Còn ${progress.remainingSessions} buổi` : null,
      progress.ageLabel ? ageLabelText(progress.ageLabel) : null,
    ].filter(Boolean);
    return (
      <div className={cn("space-y-1.5 text-xs", compact ? "min-w-[88px]" : "min-w-[160px]")} title={compact ? [progressStatusText(progress.progressLevel), ...details].join(' · ') : undefined}>
        <div className="flex items-center justify-between gap-2">
          {!compact && <span className="inline-flex items-center gap-1.5 font-medium" style={{ color }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
            {progressStatusText(progress.progressLevel)}
          </span>}
          <span className="whitespace-nowrap tabular-nums text-slate-600">{progress.doneSessions}/{progress.totalSessions} buổi</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label={`Tiến độ điểm danh: ${progressStatusText(progress.progressLevel)}`} aria-valuemin={0} aria-valuemax={progress.totalSessions} aria-valuenow={Math.min(progress.doneSessions, progress.totalSessions)}>
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${completion}%`, backgroundColor: color }} />
        </div>
        {!compact && details.length > 0 && <p className="text-[11px] leading-4 text-slate-500">{details.join(' · ')}</p>}
      </div>
    );
  };

  const actionButtonClass = (tone: 'neutral' | 'danger' | 'brand' | 'emerald' | 'sky') => cn(
    "inline-flex h-7 w-7 items-center justify-center rounded-lg border border-transparent transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30",
    tone === 'danger'
      ? "text-rose-500 hover:bg-rose-50"
      : tone === 'brand'
        ? "text-sky-600 hover:bg-sky-50"
        : tone === 'emerald'
          ? "text-emerald-600 hover:bg-emerald-50"
          : tone === 'sky'
            ? "text-sky-600 hover:bg-sky-50"
            : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
  );

  const renderRowActions = (b: Batch, compact = false) => {
    const canOperateAssignedBatch = canManage || (hasTeacherOperation && b.instructorId === user?.uid);
    return (
    <div className={cn("flex items-center gap-0.5", compact ? "flex-nowrap" : "flex-wrap")} role="group" aria-label={`Thao tác ${b.code}`}>
      <button onClick={() => setViewingBatch(b)} title={`Xem chi tiết ${copy.entityNameLower}`} className={actionButtonClass('neutral')}>
        <Eye className="h-4 w-4" />
      </button>
      {canManage && <button onClick={() => openEditModal(b)} title={`Chỉnh sửa ${copy.entityNameLower}`} className={actionButtonClass('neutral')}>
        <Pencil className="h-4 w-4" />
      </button>}
      {canManage && <button onClick={() => setDeleteConfirm({ isOpen: true, id: b.id, code: b.code })} title={`Xóa ${copy.entityNameLower}`} className={actionButtonClass('danger')}>
        <Trash2 className="h-4 w-4" />
      </button>}
      {canManage && <button onClick={() => setManageLearnersId(b.id)} title={`Quản lý ${entityLabel.singular}`} className={actionButtonClass('brand')}>
        <Users className="h-4 w-4" />
      </button>}
      {canOperateAssignedBatch && <button onClick={() => setAssignmentBatchId(b.id)} title={entityLabel.preset === 'worker' ? 'Giao nhiệm vụ' : 'Giao bài tập'} className={actionButtonClass('brand')}>
        <ClipboardList className="h-4 w-4" />
      </button>}
      {canOperateAssignedBatch && <button onClick={() => setAttendanceBatchId(b.id)} title="Điểm danh thủ công & QR" className={actionButtonClass('emerald')}>
        <CalendarCheck className="h-4 w-4" />
      </button>}
      <button onClick={() => setViewAttendanceBatchId(b.id)} title="Lịch sử & Thống kê điểm danh" className={actionButtonClass('sky')}>
        <BarChart2 className="h-4 w-4" />
      </button>
    </div>
    );
  };

  const renderLearnerCountButton = (b: Batch, compact = false) => (
    <button
      onClick={() => { setManageLearnersId(b.id); setSelectedStudentId(''); }}
      title={`Quản lý ${entityLabel.singular} trong ${copy.entityNameLower}`}
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-sky-50 px-2.5 py-1.5 text-xs font-medium text-sky-700 transition-colors hover:bg-sky-100"
    >
      <Users className="h-3.5 w-3.5" />
      {b.learnerIds.length}{b.maxLearners ? `/${b.maxLearners}` : ''}{!compact && ` ${entityLabel.singular}`}
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
      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap items-center gap-2">
          <ErpSearchBar value={searchTerm} onChange={setSearchTerm} placeholder={copy.searchPlaceholder} />
          {canManage && (
            <button type="button" onClick={() => setShowProgressColors(true)} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-normal text-slate-600 hover:bg-slate-50">
              <Settings className="h-3.5 w-3.5" /> Màu tiến độ
            </button>
          )}
          <div className="ml-auto flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
            <button type="button" onClick={() => changeViewMode('table')} title="Dạng bảng" aria-label="Dạng bảng" aria-pressed={viewMode === 'table'} className={cn("rounded-lg p-1.5 transition-colors", viewMode === 'table' ? "bg-brand-primary text-white" : "text-slate-500 hover:bg-white hover:text-slate-700")}>
              <Rows3 className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => changeViewMode('card')} title="Dạng thẻ" aria-label="Dạng thẻ" aria-pressed={viewMode === 'card'} className={cn("rounded-lg p-1.5 transition-colors", viewMode === 'card' ? "bg-brand-primary text-white" : "text-slate-500 hover:bg-white hover:text-slate-700")}>
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <ErpFilterRail className="max-w-full">
            <ErpFilterTab active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>
              Tất cả
            </ErpFilterTab>
            {BATCH_STATUSES.map((st) => (
              <ErpFilterTab key={st} active={statusFilter === st} onClick={() => setStatusFilter(st)}>
                {statusLabel(st)}
              </ErpFilterTab>
            ))}
          </ErpFilterRail>
          <ErpFilterRail className="max-w-full">
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
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {paginatedBatches.map((b) => (
              <ErpCard key={b.id} className="flex min-w-0 flex-col gap-3 border border-slate-200 bg-white p-4 shadow-none transition-colors hover:border-sky-200">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-sky-700">{b.code}</p>
                    <p className="mt-1 line-clamp-2 text-sm font-semibold leading-5 text-slate-900" title={displayTitle(b)}>{displayTitle(b)}</p>
                    {displaySubtitle(b) && <p className="mt-0.5 text-xs font-normal text-slate-500">{displaySubtitle(b)}</p>}
                  </div>
                  {renderStatusSelect(b)}
                </div>

                <div className="grid gap-1.5 border-y border-slate-100 py-3 text-xs font-normal text-slate-600">
                  <span className="inline-flex items-center gap-2"><GraduationCap className="h-3.5 w-3.5 shrink-0 text-slate-400" />{b.instructorName || <span className="text-slate-400">Chưa gán giáo viên</span>}</span>
                  <span className="inline-flex items-center gap-2"><Clock className="h-3.5 w-3.5 shrink-0 text-slate-400" />{formatDays(b.daysOfWeek)} · {b.startTime}–{b.endTime}</span>
                  {b.location && <span className="inline-flex min-w-0 items-center gap-2"><MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" /><span className="truncate" title={b.location}>{b.location}</span></span>}
                </div>

                <div className="space-y-2">
                  {renderProgressSummary(b)}
                  <p className="flex items-center gap-2 text-xs font-normal text-slate-500"><CalendarRange className="h-3.5 w-3.5" />{formatDate(b.startDate)} → {formatDate(b.endDate)}</p>
                  {b.instructorQualification && <p className="text-xs text-slate-500">Trình độ giáo viên: {b.instructorQualification}</p>}
                </div>

                <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
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
            <table className={cn(
              "w-full min-w-[1100px] border-collapse text-left text-xs [&_thead_tr]:border-brand-primary/15 [&_thead_tr]:bg-brand-primary/10 [&_th:not(:last-child)]:border-r [&_td:not(:last-child)]:border-r [&_tbody_tr:not(:last-child)]:border-b",
              darkMode
                ? "[&_th]:border-slate-800/40 [&_td]:border-slate-800/40 [&_tbody_tr]:border-slate-800/40"
                : "[&_th]:border-[#E8F0F8] [&_td]:border-[#E8F0F8] [&_tbody_tr]:border-[#E8F0F8]"
            )}>
              <ErpTableHead columns={[copy.entityName, copy.instructorLabel, 'Lịch học', 'Thời gian', 'Tiến độ', copy.capacityLabel, 'Trạng thái', 'Thao tác']} />
              <tbody>
                {paginatedBatches.map((b) => (
                  <tr key={b.id} className="text-slate-600 transition-colors hover:bg-sky-50/30">
                    <td className="max-w-[240px] px-4 py-3">
                      <p className="text-xs font-medium text-sky-700">{b.code}</p>
                      <p className="mt-0.5 line-clamp-2 text-sm font-semibold leading-5 text-slate-900" title={displayTitle(b)}>{displayTitle(b)}</p>
                    </td>
                    <td className="px-4 py-3">
                      {b.instructorName ? (
                        <span className="flex items-center gap-1.5">
                          <GraduationCap className="h-3.5 w-3.5 shrink-0 text-slate-400" /> {b.instructorName}
                        </span>
                      ) : (
                        <span className="text-slate-400">Chưa gán</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-700">{formatDays(b.daysOfWeek)}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{b.startTime}–{b.endTime}</p>
                      {b.location && <p className="mt-0.5 max-w-[140px] truncate text-xs text-slate-500" title={b.location}>{b.location}</p>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {formatDate(b.startDate)} → {formatDate(b.endDate)}
                    </td>
                    <td className="min-w-[110px] px-4 py-3">
                      {renderProgressSummary(b, true)}
                    </td>
                    <td className="px-4 py-3">
                      {renderLearnerCountButton(b, true)}
                    </td>
                    <td className="px-4 py-3">
                      {renderStatusSelect(b)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {renderRowActions(b, true)}
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
      {showProgressColors && (
        <ErpModal title="Cấu hình màu tiến độ lớp" titleClassName="font-normal" onClose={() => setShowProgressColors(false)} maxWidth="max-w-lg">
          <p className="text-sm font-normal text-slate-500">Áp dụng cho các lớp học của chi nhánh hiện tại.</p>
          <div className="space-y-2">
            {([
              ['green', 'Xanh — dưới 80%'],
              ['yellow', 'Vàng — từ 80% số buổi'],
              ['red', 'Đỏ — quá buổi cuối, chưa kết thúc'],
              ['black', 'Đen — đã kết thúc 6–12 tháng'],
            ] as const).map(([key, label]) => (
              <label key={key} className="flex min-h-12 items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal text-slate-700 transition-colors hover:border-sky-200 hover:bg-sky-50/30">
                <span className="min-w-0">{label}</span>
                <span className="flex shrink-0 items-center gap-2.5">
                  <span className="relative h-8 w-8 overflow-hidden rounded-lg border border-slate-200 shadow-sm focus-within:ring-2 focus-within:ring-brand-primary/20" style={{ backgroundColor: progressColors[key] }}>
                    <input type="color" aria-label={`Chọn màu ${label}`} value={progressColors[key]} onChange={(event) => setProgressColors((current) => ({ ...current, [key]: event.target.value }))} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
                  </span>
                  <span className="w-[4.5rem] font-mono text-xs font-normal tabular-nums text-slate-500">{progressColors[key]}</span>
                </span>
              </label>
            ))}
          </div>
          <div className="flex justify-end border-t border-slate-100 pt-3">
            <button type="button" disabled={savingProgressColors} onClick={() => void saveProgressColors()} className="inline-flex h-9 items-center rounded-lg bg-brand-primary px-4 text-sm font-medium text-white transition-colors hover:bg-brand-primary/90 disabled:cursor-not-allowed disabled:opacity-50">{savingProgressColors ? 'Đang lưu...' : 'Lưu màu'}</button>
          </div>
        </ErpModal>
      )}

      {showFormModal && (
        <ErpModal title={editingId ? copy.editTitle : copy.createTitle} titleClassName="font-medium" onClose={() => setShowFormModal(false)} maxWidth="max-w-2xl">
          <form onSubmit={handleSubmit} className="space-y-6 [&_.erp-field-label]:font-normal [&_.erp-field-label]:text-slate-600 [&_h3]:font-medium">
            {/* Section 1: Thông tin lớp học */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                <div className="h-4 w-1 rounded-full bg-brand-primary" />
                <h4 className="flex items-center gap-1.5 text-sm font-medium text-slate-800">
                  <School className="w-4 h-4 text-brand-primary" />
                  Thông tin {copy.entityNameLower}
                </h4>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                  <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3 sm:col-span-2">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs font-normal text-slate-600">Cách áp dụng khóa học</p>
                      <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
                        <button type="button" onClick={() => setForm((current) => ({ ...current, learningMode: 'standalone', roadmapId: '', roadmapStepId: '' }))} className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${form.learningMode === 'standalone' ? 'bg-brand-primary text-white' : 'text-slate-600 hover:bg-slate-50'}`}>Lớp độc lập</button>
                        <button type="button" onClick={() => setForm((current) => ({ ...current, learningMode: 'roadmap', courseId: '', roadmapId: '', roadmapStepId: '' }))} className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${form.learningMode === 'roadmap' ? 'bg-brand-primary text-white' : 'text-slate-600 hover:bg-slate-50'}`}>Theo lộ trình</button>
                      </div>
                    </div>
                    {form.learningMode === 'roadmap' && (
                      <div className="grid gap-3 md:grid-cols-2">
                        <RoadmapPicker value={form.roadmapId} placeholder="-- Chọn lộ trình --" options={roadmaps.map((roadmap) => ({ value: roadmap.id, label: roadmap.name }))} onChange={(value) => setForm((current) => ({ ...current, roadmapId: value, roadmapStepId: '', courseId: '' }))} />
                        <RoadmapPicker value={form.roadmapStepId} disabled={!form.roadmapId} placeholder="-- Chọn chặng học --" options={(roadmaps.find((roadmap) => roadmap.id === form.roadmapId)?.steps || []).sort((a, b) => a.order - b.order).map((step) => ({ value: step.id, label: `Chặng ${step.order}: ${courses.find((item) => item.id === step.courseId)?.title || 'Khóa học đã xóa'}` }))} onChange={(value) => { const step = roadmaps.find((roadmap) => roadmap.id === form.roadmapId)?.steps.find((item) => item.id === value); setForm((current) => withEstimatedEndDate({ ...current, roadmapStepId: value, courseId: step?.courseId || '' })); }} />
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
                        <RoadmapPicker value={form.courseId} className="h-9 rounded-lg border-slate-200 bg-slate-50 px-3 pl-10 text-xs shadow-none focus:ring-brand-primary/5" placeholder={`-- Chọn ${copy.courseLabel.toLocaleLowerCase('vi')} --`} options={courses.map((course) => ({ value: course.id, label: `${course.code} — ${course.title}` }))} onChange={(value) => setForm((current) => withEstimatedEndDate({ ...current, courseId: value }))} />
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
                  <p className="mt-1 text-xs text-slate-500">
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
                  <div className="h-4 w-1 rounded-full bg-brand-primary" />
                  <h4 className="flex items-center gap-1.5 text-sm font-medium text-slate-800">
                    <Clock className="w-4 h-4 text-brand-primary" />
                    {getFieldLabel('schedule', entityLabel.preset === 'worker' ? 'Lịch hoạt động & Khung giờ' : 'Lịch học & Khung giờ')}
                  </h4>
                </div>

                <ErpField label={entityLabel.preset === 'worker' ? 'Ngày hoạt động trong tuần' : 'Ngày học trong tuần'}>
                  <div className="mt-1 grid grid-cols-4 gap-1.5 sm:grid-cols-7">
                    {DAY_OPTIONS.map((d) => (
                      <button
                        key={d.value}
                        type="button"
                        onClick={() => toggleDay(d.value)}
                        className={cn(
                          "rounded-lg border py-2 text-xs font-medium text-center transition-colors cursor-pointer",
                          form.daysOfWeek.includes(d.value)
                            ? "border-brand-primary bg-brand-primary text-white"
                            : "border-slate-200 bg-white text-slate-600 hover:border-sky-200 hover:bg-sky-50"
                        )}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </ErpField>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                <div className="h-4 w-1 rounded-full bg-brand-primary" />
                <h4 className="flex items-center gap-1.5 text-sm font-medium text-slate-800">
                  <CalendarRange className="w-4 h-4 text-brand-primary" />
                  Thời gian & Địa điểm
                </h4>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {isFieldVisible('startDate') && (
                  <div className="relative group/std">
                    {renderFieldActions('startDate')}
                    <ErpField label={getFieldLabel('startDate', entityLabel.preset === 'worker' ? 'Ngày bắt đầu' : 'Ngày khai giảng')}>
                      <VietnameseDatePicker
                        ariaLabel={entityLabel.preset === 'worker' ? 'Ngày bắt đầu' : 'Ngày khai giảng'}
                        required={isFieldRequired('startDate', true)}
                        value={form.startDate}
                        onChange={(value) => setForm((current) => withEstimatedEndDate({ ...current, startDate: value }))}
                      />
                    </ErpField>
                  </div>
                )}
                {isFieldVisible('endDate') && (
                  <div className="relative group/std">
                    {renderFieldActions('endDate')}
                    <ErpField label={getFieldLabel('endDate', entityLabel.preset === 'worker' ? 'Ngày kết thúc' : 'Ngày bế giảng dự kiến')}>
                      <VietnameseDatePicker
                        ariaLabel={entityLabel.preset === 'worker' ? 'Ngày kết thúc' : 'Ngày bế giảng dự kiến'}
                        required={isFieldRequired('endDate', true)}
                        value={form.endDate}
                        onChange={(value) => setForm({ ...form, endDate: value })}
                      />
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
                        <span className="truncate text-xs font-normal">
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
                          className="flex h-7 items-center gap-1 rounded-md bg-brand-primary px-2.5 text-xs font-medium text-white transition-colors hover:bg-sky-600 disabled:opacity-50"
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
                        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-normal text-slate-400">
                          m
                        </div>
                      </div>
                    )}
                  </div>
                </ErpField>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <p className="text-xs text-slate-500">
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
                <h4 className="text-sm font-medium text-slate-700">Trường mặc định đã lưu trữ</h4>
                <ul className="mt-2 divide-y divide-slate-100">
                  {archivedStdFields.map((field) => (
                    <li key={field.key} className="flex items-center justify-between py-2 text-xs text-slate-600">
                      <span>{field.label}</span>
                      <button
                        type="button"
                        disabled={isSubmitting}
                        className="font-medium text-cyan-600 transition-colors hover:text-cyan-700 disabled:opacity-50"
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
              className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl bg-brand-primary py-2.5 text-sm font-medium text-white transition-colors hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-50"
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
          batches={batches}
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
        <ErpModal title={`Chi tiết lớp học: ${viewingBatch.code}`} titleClassName="font-medium" maxWidth="max-w-xl" onClose={() => setViewingBatch(null)}>
          <div className="space-y-5 text-left text-slate-700">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-normal text-slate-500">Mã lớp</p>
                <p className="mt-1 text-sm font-medium text-slate-800">{viewingBatch.code}</p>
              </div>
              <div>
                <p className="text-xs font-normal text-slate-500">Khóa học</p>
                <p className="mt-1 text-sm font-medium text-slate-800">
                  {courses.find(c => c.id === viewingBatch.courseId)?.title || viewingBatch.courseTitle || 'N/A'}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-normal text-slate-500">Giáo viên / Phụ trách</p>
                <p className="mt-1 text-sm font-normal text-slate-700">{viewingBatch.instructorName || "Chưa gán"}</p>
                {viewingBatch.instructorQualification && <p className="mt-0.5 text-xs text-slate-500">Trình độ: {viewingBatch.instructorQualification}</p>}
              </div>
              <div>
                <p className="text-xs font-normal text-slate-500">Trạng thái</p>
                <p className="mt-1 text-sm font-normal text-slate-700">{statusLabel(viewingBatch.status)}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-normal text-slate-500">Thời gian học</p>
                <p className="mt-1 text-sm font-normal text-slate-700">
                  {formatDays(viewingBatch.daysOfWeek)} • {viewingBatch.startTime} - {viewingBatch.endTime}
                </p>
              </div>
              <div>
                <p className="text-xs font-normal text-slate-500">Thời hạn lớp học</p>
                <p className="mt-1 text-sm font-normal text-slate-700">
                  {formatDate(viewingBatch.startDate)} → {formatDate(viewingBatch.endDate)}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-normal text-slate-500">Địa điểm</p>
                <p className="mt-1 text-sm font-normal text-slate-700">{viewingBatch.location || 'Chưa cập nhật'}</p>
              </div>
              <div>
                <p className="text-xs font-normal text-slate-500">Sức chứa</p>
                <p className="mt-1 text-sm font-normal text-slate-700">
                  {viewingBatch.learnerIds.length} / {viewingBatch.maxLearners || 'Không giới hạn'} {entityLabel.singular}
                </p>
              </div>
            </div>

            {viewingBatch.customFields && Object.keys(viewingBatch.customFields).length > 0 && (
              <div className="border-t border-slate-100 pt-4">
                <h5 className="mb-3 text-sm font-medium text-slate-800">Trường thông tin thêm</h5>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {Object.entries(viewingBatch.customFields).map(([key, val]) => (
                    <div key={key}>
                      <p className="break-words text-xs font-normal text-slate-500">{key}</p>
                      <p className="mt-1 break-words text-sm font-normal text-slate-700">{String(val || 'N/A')}</p>
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
