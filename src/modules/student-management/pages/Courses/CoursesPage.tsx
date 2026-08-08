import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  BriefcaseBusiness,
  Calendar,
  DollarSign,
  Layers,
  LayoutGrid,
  List,
  Pause,
  Play,
  Plus,
  Tag,
  Trash2,
  Users,
  Pencil,
  Eye,
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
import { CustomFieldsSection } from '../../custom-fields/CustomFieldsSection';
import type { CustomFieldValues } from '../../custom-fields/types';
import { useStandardFields, getAdaptedFieldDefinition, type StandardFieldConfig } from '../../hooks/useStandardFields';
import { CustomFieldEditorModal } from '../../custom-fields/CustomFieldEditorModal';
import { canManageCustomFields } from '../../custom-fields/permissions';
import type { CreateFieldInput, FieldDefinition } from '../../custom-fields/types';
import { Pagination } from '../../components/ui/Pagination';
import { useEntityLabel } from '../../hooks/useEntityLabel';
import { getCoursePageCopy } from '../../config/workerRecruitmentCopy';

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

  const [isEditingFields, setIsEditingFields] = useState(false);

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

  const pageSize = viewMode === 'grid' ? 6 : 8;

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

  const handleAddCourse = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
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
      toast.error(`Vui lòng điền đầy đủ các trường bắt buộc: ${missingFields.join(', ')}`);
      return;
    }

    if (usesCourseFeePolicy && isFieldVisible('fee')) {
      const numericFee = newCourse.fee.replace(/\D/g, '');
      if (newCourse.fee && (!numericFee || Number.isNaN(Number(numericFee)))) {
        toast.error(copy.feeValidationError);
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
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditCourse = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingCourse) return;

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
      toast.error(`Vui lòng điền đầy đủ các trường bắt buộc: ${missingFields.join(', ')}`);
      return;
    }

    if (usesCourseFeePolicy && isFieldVisible('fee')) {
      const numericFee = editForm.fee.replace(/\D/g, '');
      if (editForm.fee && (!numericFee || Number.isNaN(Number(numericFee)))) {
        toast.error(copy.feeValidationError);
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
      toast.error(msg);
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
    <div className="space-y-4 text-left">
      <ErpPageHeader
        title={copy.pageTitle}
        action={canManage ? (
          <div className="flex gap-2">
            <button
              onClick={() => setShowCategoryModal(true)}
              className={cn(
                'px-3.5 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all border cursor-pointer shrink-0 shadow-sm',
                darkMode
                  ? 'bg-slate-800 hover:bg-slate-750 text-slate-200 border-slate-700'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
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

      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
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

          <div className={cn('flex items-center border p-0.5 rounded-lg gap-0.5 shrink-0 shadow-sm', darkMode ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-slate-50')}>
            <button
              type="button"
              onClick={() => updateViewMode('list')}
              className={cn(
                'p-1.5 rounded-md active:scale-95 transition-all cursor-pointer',
                viewMode === 'list'
                  ? (darkMode ? 'bg-slate-800 text-white' : 'bg-white text-slate-855 shadow-sm')
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
                  ? (darkMode ? 'bg-slate-800 text-white' : 'bg-white text-slate-855 shadow-sm')
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
        <ErpCard><ErpLoadingState message={copy.loadingMessage} /></ErpCard>
      ) : filteredCourses.length === 0 ? (
        <ErpCard>
          <ErpEmptyState
            icon={entityLabel.preset === 'worker' || entityLabel.preset === 'customer' ? BriefcaseBusiness : BookOpen}
            title={copy.emptyTitle}
            subtitle={copy.emptySubtitle}
          />
        </ErpCard>
      ) : viewMode === 'grid' ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {paginatedCourses.map((course) => (
              <div
                key={course.id}
                className={cn(
                  'p-4 rounded-2xl border flex flex-col justify-between transition-all duration-300 group',
                  darkMode
                    ? 'bg-slate-900/60 border-slate-800/80 backdrop-blur-md hover:border-brand-primary/20'
                    : 'bg-white border-slate-100 hover:border-brand-primary/20 shadow-sm shadow-slate-100/50'
                )}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={cn('text-[10px] font-black uppercase tracking-widest', darkMode ? 'text-slate-500' : 'text-slate-400')}>{course.code}</span>
                    <span className={cn(
                      'px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider',
                      getCategoryColor(course.category)
                    )}>
                      {course.category}
                    </span>
                  </div>

                  <h4 className={cn('text-sm font-black line-clamp-1 transition-colors', darkMode ? 'text-slate-100 group-hover:text-white' : 'text-slate-850 group-hover:text-slate-950')}>{course.title}</h4>

                  <div className={cn('grid grid-cols-2 gap-y-2.5 gap-x-2 pt-2 text-[10px] font-bold border-t', darkMode ? 'text-slate-400 border-slate-800/30' : 'text-slate-550 border-slate-100')}>
                    <div className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-slate-400" /> {course.duration}</div>
                    {usesCourseFeePolicy && (
                      <div className="flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5 text-slate-400" /> {course.fee}</div>
                    )}
                    <div className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-slate-400" /> {copy.capacitySummary(course.maxLearners)}</div>
                    <div className="flex items-center gap-1.5"><Layers className="w-3.5 h-3.5 text-slate-400" /> {course.activeBatches} {copy.activeBatchUnit}</div>
                  </div>
                </div>

                <div className={cn('flex items-center justify-between pt-3 mt-2 border-t', darkMode ? 'border-slate-800/30' : 'border-slate-100')}>
                  <span className={cn(
                    'px-1.5 py-0.5 rounded text-[9px] font-black uppercase border',
                    course.status === ACTIVE_COURSE_STATUS ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/15' : 'bg-rose-500/10 text-rose-400 border-rose-500/15'
                  )}>
                    {course.status}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleToggleStatus(course)}
                      title={course.status === ACTIVE_COURSE_STATUS ? copy.pauseTitle : copy.resumeTitle}
                      className={cn(
                        'flex items-center gap-1 px-2.5 py-1 text-[9px] font-black uppercase rounded-lg transition-all border cursor-pointer shadow-sm',
                        darkMode
                          ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-transparent'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200/60'
                      )}
                    >
                      {course.status === ACTIVE_COURSE_STATUS
                        ? <><Pause className="w-3 h-3 text-amber-500" /> Tạm dừng</>
                        : <><Play className="w-3 h-3 text-brand-primary" /> Kích hoạt</>}
                    </button>
                    <button
                      onClick={() => setViewingCourse(course)}
                      title="Xem chi tiết"
                      className={cn(
                        'p-1 rounded-lg transition-all border cursor-pointer shadow-sm',
                        darkMode
                          ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-transparent'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 border-slate-200/60'
                      )}
                    >
                      <Eye className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => setEditingCourse(course)}
                      title={copy.editTitle}
                      className={cn(
                        'p-1 rounded-lg transition-all border cursor-pointer shadow-sm',
                        darkMode
                          ? 'bg-slate-800 hover:bg-indigo-900/40 text-slate-450 hover:text-indigo-400 border-transparent'
                          : 'bg-slate-50 hover:bg-indigo-50 text-slate-400 hover:text-indigo-500 border-slate-200/60'
                      )}
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleDelete(course)}
                      title={copy.deleteTitle}
                      className={cn(
                        'p-1 rounded-lg transition-all border cursor-pointer shadow-sm',
                        darkMode
                          ? 'bg-slate-800 hover:bg-rose-900/40 text-slate-450 hover:text-rose-450 border-transparent'
                          : 'bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-550 border-slate-200/60'
                      )}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <ErpCard className="overflow-hidden">
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
        <ErpCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <ErpTableHead columns={['Mã', copy.tableTitleColumn, copy.categoryLabel, copy.durationLabel, courseFeeLabel, copy.tableCapacityColumn, 'Trạng thái', 'Thao tác']} />
              <tbody className={cn('divide-y', darkMode ? 'divide-slate-800/30' : 'divide-slate-100')}>
                {paginatedCourses.map((course) => (
                  <tr key={course.id} className={cn('transition-colors hover:bg-slate-50/50', darkMode ? 'text-slate-355 hover:bg-slate-800/10' : 'text-slate-600')}>
                    <td className="py-2 px-4 font-black text-sm">{course.code}</td>
                    <td className="py-2 px-4 font-bold">{course.title}</td>
                    <td className="py-2 px-4">
                      <span className={cn('px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider', getCategoryColor(course.category))}>
                        {course.category}
                      </span>
                    </td>
                    <td className="py-2 px-4 font-bold">{course.duration}</td>
                    <td className="py-2 px-4 font-bold">{usesCourseFeePolicy ? course.fee : 'Không áp dụng'}</td>
                    <td className="py-2 px-4 font-bold">{copy.tableCapacitySummary(course.maxLearners, course.activeBatches)}</td>
                    <td className="py-2 px-4">
                      <span className={cn(
                        'px-1.5 py-0.5 rounded text-[9px] font-black uppercase border',
                        course.status === ACTIVE_COURSE_STATUS ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/15' : 'bg-rose-500/10 text-rose-400 border-rose-500/15'
                      )}>
                        {course.status}
                      </span>
                    </td>
                    <td className="py-2 px-4">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleToggleStatus(course)}
                          className={cn(
                            'flex items-center gap-1 px-2 py-1 text-[9px] font-black uppercase rounded-lg transition-all border cursor-pointer shadow-sm',
                            darkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-transparent' : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200/60'
                          )}
                        >
                          {course.status === ACTIVE_COURSE_STATUS ? <Pause className="w-3 h-3 text-amber-500" /> : <Play className="w-3 h-3 text-brand-primary" />}
                        </button>
                        <button
                          onClick={() => setViewingCourse(course)}
                          className={cn(
                            'p-1 rounded-lg transition-all border cursor-pointer shadow-sm',
                            darkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-transparent' : 'bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 border-slate-200/60'
                          )}
                          title="Xem chi tiết"
                        >
                          <Eye className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => setEditingCourse(course)}
                          className={cn(
                            'p-1 rounded-lg transition-all border cursor-pointer shadow-sm',
                            darkMode ? 'bg-slate-800 hover:bg-indigo-900/40 text-slate-450 hover:text-indigo-455 border-transparent' : 'bg-slate-50 hover:bg-indigo-50 text-slate-450 hover:text-indigo-550 border-slate-200/60'
                          )}
                          title={copy.editTitle}
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleDelete(course)}
                          className={cn(
                            'p-1 rounded-lg transition-all border cursor-pointer shadow-sm',
                            darkMode ? 'bg-slate-800 hover:bg-rose-900/40 text-slate-450 hover:text-rose-455 border-transparent' : 'bg-slate-50 hover:bg-rose-50 text-slate-450 hover:text-rose-550 border-slate-200/60'
                          )}
                          title={copy.deleteTitle}
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
            totalItems={filteredCourses.length}
            pageSize={pageSize}
            itemName={copy.paginationItemName}
          />
        </ErpCard>
      )}

      {showAddModal && (
        <ErpModal title={copy.createModalTitle} onClose={() => setShowAddModal(false)}>
          <form onSubmit={handleAddCourse} className="space-y-4">
            {isFieldVisible('code') && (
              <div className="relative group/std">
                {renderFieldActions('code')}
                <ErpField label={getFieldLabel('code', copy.codeLabel)}>
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
                {renderFieldActions('title')}
                <ErpField label={getFieldLabel('title', copy.titleLabel)}>
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
                  {renderFieldActions('category')}
                  <ErpField label={getFieldLabel('category', copy.categoryLabel)}>
                    <RoadmapPicker value={newCourse.category} placeholder="-- Chọn phân loại --" options={categories.map((category) => ({ value: category.name, label: category.name }))} onChange={(value) => setNewCourse({ ...newCourse, category: value })} />
                  </ErpField>
                </div>
              )}
              {isFieldVisible('duration') && (
                <div className="relative group/std">
                  {renderFieldActions('duration')}
                  <ErpField label={getFieldLabel('duration', copy.durationLabel)}>
                    <ErpInput
                      type="text"
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
                  {renderFieldActions('fee')}
                  <ErpField label={getFieldLabel('fee', `${copy.feeLabel} (VND)`)}>
                    <ErpInput
                      type="text"
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
                  {renderFieldActions('maxLearners')}
                  <ErpField label={getFieldLabel('maxLearners', copy.capacityLabel)}>
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
        <ErpModal title={copy.editModalTitle(editingCourse.code)} onClose={() => setEditingCourse(null)}>
          <form onSubmit={handleEditCourse} className="space-y-4">
            {isFieldVisible('code') && (
              <div className="relative group/std">
                {renderFieldActions('code')}
                <ErpField label={getFieldLabel('code', copy.codeLabel)}>
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
                {renderFieldActions('title')}
                <ErpField label={getFieldLabel('title', copy.titleLabel)}>
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

            <div className="grid grid-cols-2 gap-4">
              {isFieldVisible('category') && (
                <div className="relative group/std">
                  {renderFieldActions('category')}
                  <ErpField label={getFieldLabel('category', copy.categoryLabel)}>
                    <RoadmapPicker value={editForm.category} placeholder="-- Chọn phân loại --" options={categories.map((category) => ({ value: category.name, label: category.name }))} onChange={(value) => setEditForm({ ...editForm, category: value })} />
                  </ErpField>
                </div>
              )}
              {isFieldVisible('duration') && (
                <div className="relative group/std">
                  {renderFieldActions('duration')}
                  <ErpField label={getFieldLabel('duration', copy.durationLabel)}>
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

            <div className="grid grid-cols-2 gap-4">
              {isFieldVisible('fee') && (
                <div className="relative group/std">
                  {renderFieldActions('fee')}
                  <ErpField label={getFieldLabel('fee', `${copy.feeLabel} (VND)`)}>
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
                  {renderFieldActions('maxLearners')}
                  <ErpField label={getFieldLabel('maxLearners', copy.capacityLabel)}>
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
        <ErpModal title={copy.categoryManagerTitle} onClose={() => setShowCategoryModal(false)}>
          <div className="space-y-6">
            <form onSubmit={handleAddCategory} className="flex gap-2">
              <div className="flex-1">
                <ErpInput
                  type="text"
                  required
                  placeholder={copy.categoryInputPlaceholder}
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                />
              </div>
              <button
                type="submit"
                disabled={isCategorySubmitting}
                className="px-4 py-2 bg-brand-primary text-white rounded-xl text-xs font-bold transition-all hover:bg-brand-primary/95 disabled:opacity-50 flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Thêm
              </button>
            </form>

            <div className="space-y-2">
              <h5 className={cn('text-xs font-black uppercase tracking-wider', darkMode ? 'text-slate-400' : 'text-slate-500')}>{copy.categoryListTitle}</h5>
              {categoriesLoading ? (
                <p className="text-xs text-slate-400">Đang tải...</p>
              ) : categories.length === 0 ? (
                <p className="text-xs text-slate-400">{copy.emptyCategory}</p>
              ) : (
                <div className={cn('border rounded-2xl p-2 max-h-60 overflow-y-auto divide-y', darkMode ? 'border-slate-800 divide-slate-800/40' : 'border-slate-100 divide-slate-100/60')}>
                  {categories.map((cat) => (
                    <div key={cat.id} className="flex items-center justify-between py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <Tag className="w-3.5 h-3.5 text-slate-400" />
                        <span className={cn('text-xs font-bold', darkMode ? 'text-slate-200' : 'text-slate-700')}>{cat.name}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirm({ isOpen: true, id: cat.id, name: cat.name })}
                        title={copy.deleteCategoryTitle}
                        className={cn(
                          'p-1.5 rounded-lg transition-all border cursor-pointer',
                          darkMode
                            ? 'bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-400 border-transparent'
                            : 'bg-slate-50 hover:bg-rose-55 text-slate-450 hover:text-rose-600 border-slate-200/60'
                        )}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
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

      {viewingCourse && (
        <ErpModal title={`Chi tiết khóa học: ${viewingCourse.title}`} onClose={() => setViewingCourse(null)}>
          <div className="space-y-4 text-slate-700 text-left">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mã khóa học</label>
                <p className="text-sm font-bold text-slate-800 mt-0.5">{viewingCourse.code}</p>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Danh mục</label>
                <p className="text-sm font-bold text-slate-800 mt-0.5">{viewingCourse.category}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Thời lượng</label>
                <p className="text-sm font-medium text-slate-700 mt-0.5">{viewingCourse.duration}</p>
              </div>
              {usesCourseFeePolicy && (
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Học phí</label>
                  <p className="text-sm font-bold text-brand-primary mt-0.5">{viewingCourse.fee}</p>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Số học viên tối đa</label>
                <p className="text-sm font-medium text-slate-700 mt-0.5">{viewingCourse.maxLearners}</p>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Trạng thái</label>
                <p className="text-sm font-bold text-slate-700 mt-0.5">{viewingCourse.status}</p>
              </div>
            </div>

            {viewingCourse.customFields && Object.keys(viewingCourse.customFields).length > 0 && (
              <div className="border-t border-slate-100 pt-4">
                <h5 className="text-xs font-bold text-slate-800 mb-3">Trường thông tin thêm</h5>
                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(viewingCourse.customFields).map(([key, val]) => (
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
    </div>
  );
}
