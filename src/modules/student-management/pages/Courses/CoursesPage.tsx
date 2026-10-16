import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  BriefcaseBusiness,
  Eye,
  LayoutGrid,
  List,
  Pause,
  Pencil,
  Play,
  Plus,
  Tag,
  Trash2,
} from 'lucide-react';
import { cn, formatVND } from '../../lib/utils';
import { apiFetch } from '../../lib/api';
import { toast } from '../../../../pages/Toast';
import { useCourses } from '../../hooks/useCourses';
import { useCourseCategories } from '../../hooks/useCourseCategories';
import { RoadmapPicker } from '../../components/ui/RoadmapPicker';
import { useAuth } from '../../../../context/AuthContext';
import { Course } from '../../types';
import {
  ErpCard,
  ErpConfirmModal,
  ErpEmptyState,
  ErpField,
  ErpFilterRail,
  ErpFilterTab,
  ErpInput,
  ErpLoadingState,
  ErpModal,
  ErpPageHeader,
  ErpPrimaryButton,
  ErpSearchBar,
  ErpSubmitButton,
  ErpTableHead,
} from '../../components/Erp/ErpUI';
import { CustomFieldsSection } from '../../../shared/custom-fields/CustomFieldsSection';
import { FieldActionButtons } from '../../../shared/custom-fields/FieldActionButtons';
import type { CustomFieldValues } from '../../../shared/custom-fields/types';
import { useStandardFields, getAdaptedFieldDefinition, type StandardFieldConfig } from '../../hooks/useStandardFields';
import { CustomFieldEditorModal } from '../../../shared/custom-fields/CustomFieldEditorModal';
import { ConfirmDialog } from '../../../../components/common/ConfirmDialog';
import { NoticeDialog } from '../../../../components/common/NoticeDialog';
import { canManageCustomFields } from '../../../shared/custom-fields/permissions';
import type { CreateFieldInput, FieldDefinition } from '../../../shared/custom-fields/types';
import { Pagination } from '../../components/ui/Pagination';
import { useEntityLabel } from '../../hooks/useEntityLabel';
import { getCoursePageCopy } from '../../config/workerRecruitmentCopy';
import { CourseIcon } from './CourseIcons';

type CourseViewMode = 'list' | 'grid';

interface DeleteConfirmState {
  isOpen: boolean;
  id: string;
  name: string;
}

interface NewCourseFormState {
  code: string;
  title: string;
  category: string;
  fee: string;
  duration: string;
  maxLearners: number | '';
  customFields?: CustomFieldValues;
}

interface MutationResponse {
  success: boolean;
}

interface CreateCoursePayload {
  code: string;
  title: string;
  category: string;
  fee: string;
  duration: string;
  maxLearners: number;
  customFields?: CustomFieldValues;
}

const ACTIVE_COURSE_STATUS: Course['status'] = 'Hoạt động';
const PAUSED_COURSE_STATUS: Course['status'] = 'Tạm dừng';

const DEFAULT_DELETE_CONFIRM: DeleteConfirmState = {
  isOpen: false,
  id: '',
  name: '',
};

const DEFAULT_NEW_COURSE: NewCourseFormState = {
  code: '',
  title: '',
  category: '',
  fee: '',
  duration: '',
  maxLearners: 20,
  customFields: {},
};

const CATEGORY_COLORS = [
  'bg-indigo-500/10 text-indigo-400 border border-indigo-500/15',
  'bg-violet-500/10 text-violet-400 border border-violet-500/15',
  'bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/15',
  'bg-pink-500/10 text-pink-400 border border-pink-500/15',
  'bg-amber-500/10 text-amber-400 border border-amber-500/15',
  'bg-cyan-500/10 text-cyan-400 border border-cyan-500/15',
] as const;

function getStoredViewMode(): CourseViewMode {
  const storedMode = localStorage.getItem('erp_view_mode_courses');
  return storedMode === 'list' || storedMode === 'grid' ? storedMode : 'grid';
}

function getCategoryColor(category: string): string {
  if (category === 'Lái xe') return 'bg-brand-primary/10 text-brand-primary border border-brand-primary/15';
  if (category === 'Ngoại ngữ') return 'bg-sky-500/10 text-sky-400 border border-sky-500/15';
  if (category === 'Kỹ năng') return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15';
  if (category === 'Khác') return 'bg-slate-500/10 text-slate-400 border border-slate-500/15';

  let hash = 0;
  for (let i = 0; i < category.length; i++) {
    hash = category.charCodeAt(i) + ((hash << 5) - hash);
  }

  return CATEGORY_COLORS[Math.abs(hash) % CATEGORY_COLORS.length];
}

export function CoursesPage({ selectedCenter, canManage = true }: { selectedCenter?: string; canManage?: boolean }) {
  const darkMode = false;
  const { userProfile: user } = useAuth();
  const entityLabel = useEntityLabel();
  const copy = getCoursePageCopy(entityLabel.preset);
  const {
    fields: stdFields,
    archivedFields: archivedStdFields,
    updateField: updateStdField,
    archiveField: archiveStdField,
    restoreField: restoreStdField,
    deleteField: deleteStdField
  } = useStandardFields("courses");

  const manageable = canManageCustomFields(user?.permissions);
  const [stdEditorOpen, setStdEditorOpen] = useState(false);
  const [editingStdField, setEditingStdField] = useState<FieldDefinition | null>(null);
  const [pendingStdFieldAction, setPendingStdFieldAction] = useState<{ action: 'archive' | 'delete'; field: StandardFieldConfig } | null>(null);
  const [validationNotice, setValidationNotice] = useState<string | null>(null);

  const openEditStdField = (field: StandardFieldConfig) => {
    setEditingStdField(getAdaptedFieldDefinition(field, "courses"));
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

  const confirmStdFieldAction = () => {
    if (!pendingStdFieldAction) return;
    const { action, field } = pendingStdFieldAction;
    if (action === 'archive') archiveStdField(field.key);
    else deleteStdField(field.key);
    setPendingStdFieldAction(null);
  };

  const [isEditingFields, setIsEditingFields] = useState(false);

  const renderFieldActions = (fieldKey: string) => {
    if (!manageable || !isEditingFields) return null;
    const fieldConfig = stdFields.find(f => f.key === fieldKey);
    if (!fieldConfig) return null;
    return <FieldActionButtons label={fieldConfig.label} onEdit={() => openEditStdField(fieldConfig)} onArchive={() => setPendingStdFieldAction({ action: 'archive', field: fieldConfig })} onDelete={() => setPendingStdFieldAction({ action: 'delete', field: fieldConfig })} />;
  };

  const isFieldVisible = (fieldKey: string) => {
    const fieldConfig = stdFields.find(f => f.key === fieldKey);
    return fieldConfig ? (fieldConfig.isVisible && !fieldConfig.isArchived) : true;
  };
  const getFieldLabel = (fieldKey: string, defaultLabel: string) => {
    // Standard course labels stored in localStorage belong to the education
    // preset. In the worker preset these fields represent recruitment-project
    // data, so the preset copy must take precedence.
    if (entityLabel.preset === "worker" || entityLabel.preset === "customer") return defaultLabel;
    const fieldConfig = stdFields.find(f => f.key === fieldKey);
    return fieldConfig ? fieldConfig.label : defaultLabel;
  };
  const getFieldPlaceholder = (fieldKey: string, defaultPlaceholder: string) => {
    if (entityLabel.preset === "worker" || entityLabel.preset === "customer") return defaultPlaceholder;
    const fieldConfig = stdFields.find(f => f.key === fieldKey);
    return fieldConfig ? fieldConfig.placeholder || defaultPlaceholder : defaultPlaceholder;
  };
  const isFieldRequired = (fieldKey: string, defaultRequired = false) => {
    const fieldConfig = stdFields.find(f => f.key === fieldKey);
    return fieldConfig ? fieldConfig.isRequired : defaultRequired;
  };
  const usesCourseFeePolicy = true;
  const courseFeeLabel = copy.feeLabel;
  const courseCodePlaceholder = copy.codePlaceholder;
  const courseTitlePlaceholder = copy.titlePlaceholder;
  const courseDurationPlaceholder = copy.durationPlaceholder;

  const resolvedCenter = selectedCenter === 'all' ? undefined : selectedCenter;
  const { courses, loading } = useCourses(resolvedCenter);
  const { categories, loading: categoriesLoading } = useCourseCategories(resolvedCenter);

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isCategorySubmitting, setIsCategorySubmitting] = useState(false);
  const [viewMode, setViewMode] = useState<CourseViewMode>(getStoredViewMode);
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState>(DEFAULT_DELETE_CONFIRM);
  const [newCourse, setNewCourse] = useState<NewCourseFormState>(DEFAULT_NEW_COURSE);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [editForm, setEditForm] = useState<NewCourseFormState>(DEFAULT_NEW_COURSE);
  const [viewingCourse, setViewingCourse] = useState<Course | null>(null);

  const pageSize = viewMode === 'grid' ? 12 : 8;

  useEffect(() => {
    if (categories.length > 0 && !newCourse.category) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNewCourse((prev) => ({ ...prev, category: categories[0].name }));
    }
  }, [categories, newCourse.category]);

  useEffect(() => {
    if (editingCourse) {
      setTimeout(() => {
        setEditForm({
          code: editingCourse.code || '',
          title: editingCourse.title || '',
          category: editingCourse.category || '',
          fee: editingCourse.fee || '',
          duration: editingCourse.duration || '',
          maxLearners: editingCourse.maxLearners || 20,
          customFields: editingCourse.customFields || {},
        });
      }, 0);
    }
  }, [editingCourse]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1);
    }, 0);
    return () => clearTimeout(timer);
  }, [searchTerm, categoryFilter, viewMode]);

  const updateViewMode = (nextViewMode: CourseViewMode) => {
    setViewMode(nextViewMode);
    localStorage.setItem('erp_view_mode_courses', nextViewMode);
  };

  const resetNewCourse = () => {
    setNewCourse({
      ...DEFAULT_NEW_COURSE,
      category: categories[0]?.name || '',
    });
  };

  const showInvalidInput = (form: HTMLFormElement) => {
    const invalid = form.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(':invalid');
    if (!invalid) return false;
    const label = invalid.getAttribute('aria-label') || invalid.closest('.space-y-1')?.querySelector('div')?.textContent?.trim() || 'trường này';
    setValidationNotice(invalid.validity.valueMissing ? `Vui lòng nhập ${label}.` : `Vui lòng kiểm tra ${label}.`);
    return true;
  };

  const handleAddCourse = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (showInvalidInput(e.currentTarget)) return;
    const missingFields: string[] = [];
    stdFields.forEach((f) => {
      if (f.isVisible && !f.isArchived && f.isRequired) {
        if (f.key === 'code' && !newCourse.code) missingFields.push(f.label);
        if (f.key === 'title' && !newCourse.title) missingFields.push(f.label);
        if (f.key === 'category' && !newCourse.category) missingFields.push(f.label);
        if (f.key === 'duration' && !newCourse.duration) missingFields.push(f.label);
        if (f.key === 'fee' && !newCourse.fee) missingFields.push(f.label);
        if (f.key === 'maxLearners' && !newCourse.maxLearners) missingFields.push(f.label);
      }
    });

    if (missingFields.length > 0) {
      setValidationNotice(`Vui lòng điền đầy đủ các trường bắt buộc: ${missingFields.join(', ')}.`);
      return;
    }

    if (usesCourseFeePolicy && isFieldVisible('fee')) {
      const numericFee = newCourse.fee.replace(/\D/g, '');
      if (newCourse.fee && (!numericFee || Number.isNaN(Number(numericFee)))) {
        setValidationNotice(copy.feeValidationError);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const payload: CreateCoursePayload = {
        code: newCourse.code.toUpperCase(),
        title: newCourse.title,
        category: newCourse.category,
        fee: usesCourseFeePolicy && isFieldVisible('fee') ? `${formatVND(newCourse.fee)}d` : '0d',
        duration: newCourse.duration,
        maxLearners: newCourse.maxLearners === '' ? 20 : newCourse.maxLearners,
        customFields: newCourse.customFields,
        ...(resolvedCenter ? { companyCode: resolvedCenter } : {}),
      };

      await apiFetch<MutationResponse>('/courses', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      window.dispatchEvent(new Event('course-mutation'));
      setShowAddModal(false);
      resetNewCourse();
      toast.success(copy.createdMessage(payload.code));
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : copy.createError;
      setValidationNotice(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditCourse = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingCourse) return;
    if (showInvalidInput(e.currentTarget)) return;

    const missingFields: string[] = [];
    stdFields.forEach((f) => {
      if (f.isVisible && !f.isArchived && f.isRequired) {
        if (f.key === 'code' && !editForm.code) missingFields.push(f.label);
        if (f.key === 'title' && !editForm.title) missingFields.push(f.label);
        if (f.key === 'category' && !editForm.category) missingFields.push(f.label);
        if (f.key === 'duration' && !editForm.duration) missingFields.push(f.label);
        if (f.key === 'fee' && !editForm.fee) missingFields.push(f.label);
        if (f.key === 'maxLearners' && !editForm.maxLearners) missingFields.push(f.label);
      }
    });

    if (missingFields.length > 0) {
      setValidationNotice(`Vui lòng điền đầy đủ các trường bắt buộc: ${missingFields.join(', ')}.`);
      return;
    }

    if (usesCourseFeePolicy && isFieldVisible('fee')) {
      const numericFee = editForm.fee.replace(/\D/g, '');
      if (editForm.fee && (!numericFee || Number.isNaN(Number(numericFee)))) {
        setValidationNotice(copy.feeValidationError);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const payload = {
        expectedVersion: editingCourse.__v,
        code: editForm.code.toUpperCase(),
        title: editForm.title,
        category: editForm.category,
        fee: usesCourseFeePolicy && isFieldVisible('fee') ? `${formatVND(editForm.fee)}d` : '0d',
        duration: editForm.duration,
        maxLearners: editForm.maxLearners === '' ? 20 : editForm.maxLearners,
        customFields: editForm.customFields,
      };

      await apiFetch<MutationResponse>(`/courses/${editingCourse.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });

      window.dispatchEvent(new Event('course-mutation'));
      setEditingCourse(null);
      toast.success(copy.updatedMessage(payload.code));
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : copy.updateError;
      setValidationNotice(msg);
    } finally {
      setIsSubmitting(false);
    }
  };
  const handleToggleStatus = async (course: Course) => {
    const nextStatus: Course['status'] = course.status === ACTIVE_COURSE_STATUS ? PAUSED_COURSE_STATUS : ACTIVE_COURSE_STATUS;
    try {
      await apiFetch<MutationResponse>(`/courses/${course.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      window.dispatchEvent(new Event('course-mutation'));
      toast.success(copy.statusMessage(course.code, nextStatus));
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : copy.updateError;
      toast.error(msg);
    }
  };

  const handleDelete = async (course: Course) => {
    try {
      await apiFetch<MutationResponse>(`/courses/${course.id}`, { method: 'DELETE' });
      window.dispatchEvent(new Event('course-mutation'));
      toast.success(copy.deletedMessage(course.code));
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : copy.deleteError;
      toast.error(msg);
    }
  };

  const handleAddCategory = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;

    setIsCategorySubmitting(true);
    try {
      await apiFetch<MutationResponse>('/courses/categories', {
        method: 'POST',
        body: JSON.stringify({ name: newCategoryName }),
      });
      window.dispatchEvent(new Event('course-category-mutation'));
      setNewCategoryName('');
      toast.success(copy.categoryCreatedMessage);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : copy.categoryCreateError;
      toast.error(msg);
    } finally {
      setIsCategorySubmitting(false);
    }
  };

  const handleDeleteCategory = async () => {
    if (!deleteConfirm.id) return;
    try {
      await apiFetch<MutationResponse>(`/courses/categories/${deleteConfirm.id}`, {
        method: 'DELETE',
      });
      window.dispatchEvent(new Event('course-category-mutation'));
      toast.success(copy.categoryDeletedMessage);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Có lỗi xảy ra khi xóa.';
      toast.error(msg);
    } finally {
      setDeleteConfirm(DEFAULT_DELETE_CONFIRM);
    }
  };
  const filteredCourses = courses.filter((course) => {
    const matchesSearch = course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      course.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || course.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const totalPages = Math.ceil(filteredCourses.length / pageSize);
  const paginatedCourses = filteredCourses.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-5 rounded-2xl bg-[#F8FBFF] px-3 py-5 text-left sm:px-5 sm:py-6">
      <ErpPageHeader
        title={copy.pageTitle}
        action={canManage ? (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowCategoryModal(true)}
              className={cn(
                'px-3.5 py-2 rounded-xl text-xs font-semibold transition-all border cursor-pointer shrink-0 shadow-sm',
                darkMode
                  ? 'bg-slate-800 hover:bg-slate-750 text-slate-200 border-slate-700'
                  : 'bg-white hover:bg-[#EAF8FF] hover:text-[#0089C7] text-slate-700 border-[#DFECF5] hover:border-[#9CDFFF]'
              )}
            >
              {copy.categoryManagerButton}
            </button>
            <ErpPrimaryButton onClick={() => setShowAddModal(true)}>
              {copy.addButton}
            </ErpPrimaryButton>
          </div>
        ) : undefined}
      />

      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 rounded-2xl border border-[#DFECF5] bg-white p-3 shadow-sm shadow-[#DCECF5]/40 [&_input]:border-[#DFECF5]">
        <ErpSearchBar value={searchTerm} onChange={setSearchTerm} placeholder={copy.searchPlaceholder} />
        <div className="flex flex-wrap items-center gap-3">
          <ErpFilterRail>
            <ErpFilterTab active={categoryFilter === 'all'} onClick={() => setCategoryFilter('all')}>
              Tất cả
            </ErpFilterTab>
            {categories.map((cat) => (
              <ErpFilterTab key={cat.id} active={categoryFilter === cat.name} onClick={() => setCategoryFilter(cat.name)}>
                {cat.name}
              </ErpFilterTab>
            ))}
          </ErpFilterRail>

          <div className={cn('flex items-center border p-0.5 rounded-xl gap-0.5 shrink-0', darkMode ? 'border-slate-800 bg-slate-900/50' : 'border-[#DFECF5] bg-[#F4FAFE]')}>
            <button
              type="button"
              onClick={() => updateViewMode('list')}
              className={cn(
                'p-1.5 rounded-md active:scale-95 transition-all cursor-pointer',
                viewMode === 'list'
                  ? (darkMode ? 'bg-slate-800 text-white' : 'bg-white text-[#008FCF] shadow-sm')
                  : 'text-slate-400 hover:text-slate-600'
              )}
              title="Hiển thị dạng danh sách"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => updateViewMode('grid')}
              className={cn(
                'p-1.5 rounded-md active:scale-95 transition-all cursor-pointer',
                viewMode === 'grid'
                  ? (darkMode ? 'bg-slate-800 text-white' : 'bg-white text-[#008FCF] shadow-sm')
                  : 'text-slate-400 hover:text-slate-600'
              )}
              title="Hiển thị dạng lưới"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {loading && courses.length === 0 ? (
        <ErpCard className="border-[#DFECF5] shadow-sm shadow-[#DCECF5]/40"><ErpLoadingState message={copy.loadingMessage} /></ErpCard>
      ) : filteredCourses.length === 0 ? (
        <ErpCard className="border-[#DFECF5] shadow-sm shadow-[#DCECF5]/40">
          <ErpEmptyState
            icon={entityLabel.preset === 'worker' || entityLabel.preset === 'customer' ? BriefcaseBusiness : BookOpen}
            title={copy.emptyTitle}
            subtitle={copy.emptySubtitle}
          />
        </ErpCard>
      ) : viewMode === 'grid' ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {paginatedCourses.map((course) => (
              <div
                key={course.id}
                className={cn(
                  'group flex min-w-0 flex-col justify-between rounded-2xl border p-3 transition-all duration-300',
                  darkMode
                    ? 'bg-slate-900/60 border-slate-800/80 backdrop-blur-md hover:border-brand-primary/20'
                    : 'bg-white border-[#DFECF5] hover:border-[#80D6FF] hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#B8E8FF]/30 shadow-sm shadow-[#DCECF5]/50'
                )}
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <span className={cn('min-w-0 break-all text-xs font-semibold tracking-wide', darkMode ? 'text-slate-500' : 'text-[#1687BE]')}>{course.code}</span>
                    <span className={cn(
                      'max-w-[45%] shrink-0 truncate rounded-lg border px-1.5 py-0.5 text-[10px] font-medium',
                      getCategoryColor(course.category)
                    )}>
                      {course.category}
                    </span>
                  </div>

                  <h4 className={cn('line-clamp-2 text-sm font-semibold leading-snug transition-colors', darkMode ? 'text-slate-100 group-hover:text-white' : 'text-slate-800 group-hover:text-[#008FCF]')}>{course.title}</h4>

                  <div className={cn('grid grid-cols-2 gap-x-1.5 gap-y-1.5 border-t pt-2 text-[11px] font-normal', darkMode ? 'text-slate-400 border-slate-800/30' : 'text-slate-600 border-[#E8F0F6]')}>
                    <div className="flex items-center gap-1"><CourseIcon name="duration" className="h-3.5 w-3.5 shrink-0" /> {course.duration} buổi</div>
                    {usesCourseFeePolicy && (
                      <div className="flex items-center gap-1"><CourseIcon name="fee" className="h-3.5 w-3.5 shrink-0" /> {course.fee}</div>
                    )}
                    <div className="flex items-center gap-1"><CourseIcon name="learners" className="h-3.5 w-3.5 shrink-0" /> {copy.capacitySummary(course.maxLearners)}</div>
                    <div className="flex items-center gap-1"><CourseIcon name="batches" className="h-3.5 w-3.5 shrink-0" /> {course.activeBatches} {copy.activeBatchUnit}</div>
                  </div>
                </div>

                <div className={cn('mt-2.5 flex flex-wrap items-center justify-between gap-1 border-t pt-2.5', darkMode ? 'border-slate-800/30' : 'border-[#E8F0F6]')}>
                  <span className={cn(
                    'shrink-0 px-2 py-1 rounded-lg text-[10px] font-medium border',
                    course.status === ACTIVE_COURSE_STATUS ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
                  )}>
                    {course.status}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleToggleStatus(course)}
                      title={course.status === ACTIVE_COURSE_STATUS ? copy.pauseTitle : copy.resumeTitle}
                      className={cn(
                        'flex items-center gap-1 px-1.5 py-1 text-[10px] font-medium rounded-lg transition-all border cursor-pointer',
                        darkMode
                          ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-transparent'
                          : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200'
                      )}
                    >
                      {course.status === ACTIVE_COURSE_STATUS
                        ? <><Pause className="h-3.5 w-3.5 shrink-0" /> Tạm dừng</>
                        : <><Play className="h-3.5 w-3.5 shrink-0" /> Kích hoạt</>}
                    </button>
                    <button
                      onClick={() => setViewingCourse(course)}
                      title="Xem chi tiết"
                      className={cn(
                        'p-1 rounded-lg transition-all border cursor-pointer',
                        darkMode
                          ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-transparent'
                          : 'bg-violet-50 hover:bg-violet-100 text-violet-700 border-violet-200'
                      )}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setEditingCourse(course)}
                      title={copy.editTitle}
                      className={cn(
                        'p-1 rounded-lg transition-all border cursor-pointer',
                        darkMode
                          ? 'bg-slate-800 hover:bg-indigo-900/40 text-slate-450 hover:text-indigo-400 border-transparent'
                          : 'bg-orange-50 hover:bg-orange-100 text-orange-700 border-orange-200'
                      )}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(course)}
                      title={copy.deleteTitle}
                      className={cn(
                        'p-1 rounded-lg transition-all border cursor-pointer',
                        darkMode
                          ? 'bg-slate-800 hover:bg-rose-900/40 text-slate-450 hover:text-rose-450 border-transparent'
                          : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                      )}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <ErpCard className="overflow-hidden border-[#DFECF5] shadow-sm shadow-[#DCECF5]/40">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              totalItems={filteredCourses.length}
              pageSize={pageSize}
              itemName={copy.paginationItemName}
            />
          </ErpCard>
        </div>
      ) : (
        <ErpCard className="overflow-hidden border-[#DFECF5] shadow-sm shadow-[#DCECF5]/40">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse [&_thead_tr]:border-[#DFECF5] [&_thead_tr]:bg-[#F4FAFE] [&_th]:font-medium [&_th]:text-slate-600">
              <ErpTableHead columns={['Mã', copy.tableTitleColumn, copy.categoryLabel, copy.durationLabel, courseFeeLabel, copy.tableCapacityColumn, 'Trạng thái', 'Thao tác']} />
              <tbody className={cn('divide-y', darkMode ? 'divide-slate-800/30' : 'divide-[#E8F0F6]')}>
                {paginatedCourses.map((course) => (
                  <tr key={course.id} className={cn('transition-colors', darkMode ? 'text-slate-355 hover:bg-slate-800/10' : 'text-slate-600 hover:bg-[#F7FCFF]')}>
                    <td className="py-3 px-4 text-sm font-semibold text-[#1687BE]">{course.code}</td>
                    <td className="py-3 px-4 font-medium text-slate-800">{course.title}</td>
                    <td className="py-2 px-4">
                      <span className={cn('px-2 py-1 rounded-lg border text-[10px] font-medium', getCategoryColor(course.category))}>
                        {course.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-normal">{course.duration} buổi</td>
                    <td className="py-3 px-4 font-normal">{usesCourseFeePolicy ? course.fee : 'Không áp dụng'}</td>
                    <td className="py-3 px-4 font-normal">{copy.tableCapacitySummary(course.maxLearners, course.activeBatches)}</td>
                    <td className="py-2 px-4">
                      <span className={cn(
                        'px-2 py-1 rounded-lg text-[10px] font-medium border',
                        course.status === ACTIVE_COURSE_STATUS ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
                      )}>
                        {course.status}
                      </span>
                    </td>
                    <td className="py-2 px-4">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleToggleStatus(course)}
                          className={cn(
                            'flex items-center gap-1 px-2 py-1.5 text-[10px] font-medium rounded-lg transition-all border cursor-pointer',
                            darkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-transparent' : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200'
                          )}
                        >
                          {course.status === ACTIVE_COURSE_STATUS ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        </button>
                        <button
                          onClick={() => setViewingCourse(course)}
                          className={cn(
                            'p-1.5 rounded-lg transition-all border cursor-pointer',
                            darkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-transparent' : 'bg-violet-50 hover:bg-violet-100 text-violet-700 border-violet-200'
                          )}
                          title="Xem chi tiết"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setEditingCourse(course)}
                          className={cn(
                            'p-1.5 rounded-lg transition-all border cursor-pointer',
                            darkMode ? 'bg-slate-800 hover:bg-indigo-900/40 text-slate-450 hover:text-indigo-455 border-transparent' : 'bg-orange-50 hover:bg-orange-100 text-orange-700 border-orange-200'
                          )}
                          title={copy.editTitle}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(course)}
                          className={cn(
                            'p-1.5 rounded-lg transition-all border cursor-pointer',
                            darkMode ? 'bg-slate-800 hover:bg-rose-900/40 text-slate-450 hover:text-rose-455 border-transparent' : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                          )}
                          title={copy.deleteTitle}
                        >
                          <Trash2 className="h-4 w-4" />
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
            totalItems={filteredCourses.length}
            pageSize={pageSize}
            itemName={copy.paginationItemName}
          />
        </ErpCard>
      )}

      {showAddModal && (
        <ErpModal title={copy.createModalTitle} onClose={() => setShowAddModal(false)}>
          <form noValidate onSubmit={handleAddCourse} className="space-y-4">
            {isFieldVisible('code') && (
              <div className="relative group/std">
                <ErpField label={getFieldLabel('code', copy.codeLabel)} actions={renderFieldActions('code')}>
                  <ErpInput
                    type="text"
                    required={isFieldRequired('code', true)}
                    placeholder={getFieldPlaceholder('code', courseCodePlaceholder)}
                    value={newCourse.code}
                    onChange={(e) => setNewCourse({ ...newCourse, code: e.target.value })}
                  />
                </ErpField>
              </div>
            )}

            {isFieldVisible('title') && (
              <div className="relative group/std">
                <ErpField label={getFieldLabel('title', copy.titleLabel)} actions={renderFieldActions('title')}>
                  <ErpInput
                    type="text"
                    required={isFieldRequired('title', true)}
                    placeholder={getFieldPlaceholder('title', courseTitlePlaceholder)}
                    value={newCourse.title}
                    onChange={(e) => setNewCourse({ ...newCourse, title: e.target.value })}
                  />
                </ErpField>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              {isFieldVisible('category') && (
                <div className="relative group/std">
                  <ErpField label={getFieldLabel('category', copy.categoryLabel)} actions={renderFieldActions('category')}>
                    <RoadmapPicker value={newCourse.category} placeholder="-- Chọn phân loại --" options={categories.map((category) => ({ value: category.name, label: category.name }))} onChange={(value) => setNewCourse({ ...newCourse, category: value })} />
                  </ErpField>
                </div>
              )}
              {isFieldVisible('duration') && (
                <div className="relative group/std">
                  <ErpField label={getFieldLabel('duration', copy.durationLabel)} actions={renderFieldActions('duration')}>
                    <ErpInput
                      type="number"
                      min="1"
                      required={isFieldRequired('duration', true)}
                      placeholder={getFieldPlaceholder('duration', courseDurationPlaceholder)}
                      value={newCourse.duration}
                      onChange={(e) => setNewCourse({ ...newCourse, duration: e.target.value })}
                    />
                  </ErpField>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              {isFieldVisible('fee') && (
                <div className="relative group/std">
                  <ErpField label={getFieldLabel('fee', `${copy.feeLabel} (VND)`)} actions={renderFieldActions('fee')}>
                    <ErpInput
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9.]*"
                      required={isFieldRequired('fee', true)}
                      placeholder={getFieldPlaceholder('fee', copy.feePlaceholder)}
                      value={newCourse.fee}
                      onChange={(e) => setNewCourse({ ...newCourse, fee: formatVND(e.target.value) })}
                    />
                  </ErpField>
                </div>
              )}
              {isFieldVisible('maxLearners') && (
                <div className="relative group/std">
                  <ErpField label={getFieldLabel('maxLearners', copy.capacityLabel)} actions={renderFieldActions('maxLearners')}>
                    <ErpInput
                      type="number"
                      min={0}
                      required={isFieldRequired('maxLearners', false)}
                      value={newCourse.maxLearners}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === '') {
                          setNewCourse({ ...newCourse, maxLearners: '' });
                          return;
                        }

                        const parsed = parseInt(value, 10);
                        setNewCourse({ ...newCourse, maxLearners: Number.isNaN(parsed) ? 20 : Math.max(0, parsed) });
                      }}
                      onBlur={() => {
                        if (newCourse.maxLearners === '' || typeof newCourse.maxLearners !== 'number' || newCourse.maxLearners < 0) {
                          setNewCourse({ ...newCourse, maxLearners: 20 });
                        }
                      }}
                    />
                  </ErpField>
                </div>
              )}
            </div>

            <CustomFieldsSection
              moduleKey="courses"
              values={newCourse.customFields}
              onChange={(customFields) => setNewCourse((previous) => ({ ...previous, customFields }))}
              mode="create"
              disabled={isSubmitting}
              tenantId={resolvedCenter}
              isEditingFields={isEditingFields}
              onToggleEditingFields={setIsEditingFields}
            />

            {manageable && archivedStdFields.length ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-3 mt-4">
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

            <ErpSubmitButton>{isSubmitting ? copy.creatingSubmit : copy.createSubmit}</ErpSubmitButton>
          </form>
        </ErpModal>
      )}

      {editingCourse && (
        <ErpModal title={copy.editModalTitle(editingCourse.code)} onClose={() => setEditingCourse(null)} maxWidth="max-w-3xl">
          <form noValidate onSubmit={handleEditCourse} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {isFieldVisible('code') && (
                <div className="relative group/std">
                  <ErpField label={getFieldLabel('code', copy.codeLabel)} actions={renderFieldActions('code')}>
                    <ErpInput
                      type="text"
                      required={isFieldRequired('code', true)}
                      placeholder={getFieldPlaceholder('code', courseCodePlaceholder)}
                      value={editForm.code}
                      onChange={(e) => setEditForm({ ...editForm, code: e.target.value })}
                    />
                  </ErpField>
                </div>
              )}

              {isFieldVisible('title') && (
                <div className="relative group/std">
                  <ErpField label={getFieldLabel('title', copy.titleLabel)} actions={renderFieldActions('title')}>
                    <ErpInput
                      type="text"
                      required={isFieldRequired('title', true)}
                      placeholder={getFieldPlaceholder('title', courseTitlePlaceholder)}
                      value={editForm.title}
                      onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    />
                  </ErpField>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {isFieldVisible('category') && (
                <div className="relative group/std">
                  <ErpField label={getFieldLabel('category', copy.categoryLabel)} actions={renderFieldActions('category')}>
                    <RoadmapPicker value={editForm.category} placeholder="-- Chọn phân loại --" options={categories.map((category) => ({ value: category.name, label: category.name }))} onChange={(value) => setEditForm({ ...editForm, category: value })} />
                  </ErpField>
                </div>
              )}
              {isFieldVisible('duration') && (
                <div className="relative group/std">
                  <ErpField label={getFieldLabel('duration', copy.durationLabel)} actions={renderFieldActions('duration')}>
                    <ErpInput
                      type="text"
                      required={isFieldRequired('duration', true)}
                      placeholder={getFieldPlaceholder('duration', courseDurationPlaceholder)}
                      value={editForm.duration}
                      onChange={(e) => setEditForm({ ...editForm, duration: e.target.value })}
                    />
                  </ErpField>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {isFieldVisible('fee') && (
                <div className="relative group/std">
                  <ErpField label={getFieldLabel('fee', `${copy.feeLabel} (VND)`)} actions={renderFieldActions('fee')}>
                    <ErpInput
                      type="text"
                      required={isFieldRequired('fee', true)}
                      placeholder={getFieldPlaceholder('fee', copy.feePlaceholder)}
                      value={editForm.fee}
                      onChange={(e) => setEditForm({ ...editForm, fee: formatVND(e.target.value) })}
                    />
                  </ErpField>
                </div>
              )}
              {isFieldVisible('maxLearners') && (
                <div className="relative group/std">
                  <ErpField label={getFieldLabel('maxLearners', copy.capacityLabel)} actions={renderFieldActions('maxLearners')}>
                    <ErpInput
                      type="number"
                      min={0}
                      required={isFieldRequired('maxLearners', false)}
                      value={editForm.maxLearners}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === '') {
                          setEditForm({ ...editForm, maxLearners: '' });
                          return;
                        }

                        const parsed = parseInt(value, 10);
                        setEditForm({ ...editForm, maxLearners: Number.isNaN(parsed) ? 20 : Math.max(0, parsed) });
                      }}
                      onBlur={() => {
                        if (editForm.maxLearners === '' || typeof editForm.maxLearners !== 'number' || editForm.maxLearners < 0) {
                          setEditForm({ ...editForm, maxLearners: 20 });
                        }
                      }}
                    />
                  </ErpField>
                </div>
              )}
            </div>

            <CustomFieldsSection
              moduleKey="courses"
              values={editForm.customFields}
              onChange={(customFields) => setEditForm((previous) => ({ ...previous, customFields }))}
              mode="edit"
              disabled={isSubmitting}
              tenantId={resolvedCenter || editingCourse.ownerId}
              isEditingFields={isEditingFields}
              onToggleEditingFields={setIsEditingFields}
            />

            {manageable && archivedStdFields.length ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-3 mt-4">
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

            <ErpSubmitButton disabled={isSubmitting}>{isSubmitting ? copy.updatingSubmit : copy.updateSubmit}</ErpSubmitButton>
          </form>
        </ErpModal>
      )}

      {showCategoryModal && (
        <ErpModal title={copy.categoryManagerTitle} titleClassName="font-medium" maxWidth="max-w-xl" onClose={() => setShowCategoryModal(false)}>
          <div className="space-y-4">
            <form onSubmit={handleAddCategory} className="flex flex-col gap-2 sm:flex-row">
              <div className="min-w-0 flex-1">
                <ErpInput
                  type="text"
                  required
                  aria-label={copy.categoryInputPlaceholder}
                  placeholder={copy.categoryInputPlaceholder}
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                />
              </div>
              <button
                type="submit"
                disabled={isCategorySubmitting}
                className="flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-brand-primary px-4 text-sm font-medium text-white transition-colors hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus className="h-4 w-4" /> Thêm
              </button>
            </form>

            <div className="space-y-3 border-t border-slate-100 pt-4">
              <h5 className="text-sm font-medium text-slate-700">{copy.categoryListTitle}</h5>
              {categoriesLoading ? (
                <p className="text-sm text-slate-500">Đang tải...</p>
              ) : categories.length === 0 ? (
                <div className="flex items-center gap-2 rounded-xl border border-dashed border-sky-100 bg-sky-50/50 px-3 py-4 text-sm text-slate-500">
                  <Tag className="h-4 w-4 shrink-0 text-brand-primary" />
                  {copy.emptyCategory}
                </div>
              ) : (
                <div className="max-h-60 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-sky-100 bg-white px-2">
                  {categories.map((cat) => (
                    <div key={cat.id} className="flex items-center justify-between gap-3 px-2 py-2.5">
                      <div className="flex min-w-0 items-center gap-2">
                        <Tag className="h-4 w-4 shrink-0 text-brand-primary" />
                        <span className="truncate text-sm font-normal text-slate-700" title={cat.name}>{cat.name}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirm({ isOpen: true, id: cat.id, name: cat.name })}
                        title={copy.deleteCategoryTitle}
                        aria-label={`${copy.deleteCategoryTitle}: ${cat.name}`}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ErpModal>
      )}

      <ErpConfirmModal
        isOpen={deleteConfirm.isOpen}
        title={copy.deleteCategoryTitle}
        message={copy.deleteCategoryMessage(deleteConfirm.name)}
        onConfirm={handleDeleteCategory}
        onCancel={() => setDeleteConfirm(DEFAULT_DELETE_CONFIRM)}
        confirmText="Xác nhận xóa"
        cancelText="Hủy bỏ"
      />

      <CustomFieldEditorModal
        open={stdEditorOpen}
        moduleKey="courses"
        initialField={editingStdField}
        onClose={() => setStdEditorOpen(false)}
        onSubmit={handleStdFieldSubmit}
        isStandard={true}
      />

      <ConfirmDialog
        isOpen={pendingStdFieldAction !== null}
        title={pendingStdFieldAction?.action === 'archive' ? 'Lưu trữ trường?' : 'Xóa trường vĩnh viễn?'}
        description={pendingStdFieldAction?.action === 'archive'
          ? `Lưu trữ trường “${pendingStdFieldAction.field.label}”? Dữ liệu hiện có sẽ được giữ lại.`
          : `Xóa vĩnh viễn trường “${pendingStdFieldAction?.field.label ?? ''}”? Dữ liệu liên quan có thể bị mất.`}
        tone={pendingStdFieldAction?.action === 'archive' ? 'warning' : 'danger'}
        confirmLabel={pendingStdFieldAction?.action === 'archive' ? 'Lưu trữ' : 'Xóa trường'}
        cancelLabel="Hủy"
        onClose={() => setPendingStdFieldAction(null)}
        onConfirm={confirmStdFieldAction}
      />

      <NoticeDialog message={validationNotice} onClose={() => setValidationNotice(null)} />

      {viewingCourse && (
        <ErpModal title={`Chi tiết khóa học: ${viewingCourse.title}`} titleClassName="font-medium" onClose={() => setViewingCourse(null)}>
          <div className="space-y-4 text-slate-700 text-left">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-normal text-slate-500">Mã khóa học</label>
                <p className="mt-0.5 text-sm font-medium text-slate-800">{viewingCourse.code}</p>
              </div>
              <div>
                <label className="text-xs font-normal text-slate-500">Danh mục</label>
                <p className="mt-0.5 text-sm font-normal text-slate-800">{viewingCourse.category}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-normal text-slate-500">Số buổi học</label>
                <p className="mt-0.5 text-sm font-normal text-slate-700">{viewingCourse.duration} buổi</p>
              </div>
              {usesCourseFeePolicy && (
                <div>
                  <label className="text-xs font-normal text-slate-500">Học phí</label>
                  <p className="mt-0.5 text-sm font-medium text-brand-primary">{viewingCourse.fee}</p>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-normal text-slate-500">Số học viên tối đa</label>
                <p className="mt-0.5 text-sm font-normal text-slate-700">{viewingCourse.maxLearners}</p>
              </div>
              <div>
                <label className="text-xs font-normal text-slate-500">Trạng thái</label>
                <p className="mt-0.5 text-sm font-medium text-slate-700">{viewingCourse.status}</p>
              </div>
            </div>

            {viewingCourse.customFields && Object.keys(viewingCourse.customFields).length > 0 && (
              <div className="border-t border-slate-100 pt-4">
                <h5 className="mb-3 text-xs font-medium text-slate-800">Trường thông tin thêm</h5>
                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(viewingCourse.customFields).map(([key, val]) => (
                    <div key={key}>
                      <label className="text-xs font-normal text-slate-500">{key}</label>
                      <p className="mt-0.5 text-sm font-normal text-slate-700">{String(val || 'N/A')}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ErpModal>
      )}
    </div>
  );
}
