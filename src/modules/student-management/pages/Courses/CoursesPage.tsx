import React, { useEffect, useState } from 'react';
import {
  BookOpen,
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
} from 'lucide-react';
import { cn, formatVND } from '../../lib/utils';
import { apiFetch } from '../../lib/api';
import { toast } from '../../../../pages/Toast';
import { useCourses } from '../../hooks/useCourses';
import { useCourseCategories } from '../../hooks/useCourseCategories';
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
  ErpSelect,
  ErpSubmitButton,
  ErpTableHead,
} from '../../components/Erp/ErpUI';
import { Pagination } from '../../components/ui/Pagination';

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

export function CoursesPage({ selectedCenter }: { selectedCenter?: string }) {
  const darkMode = false;
  const { userProfile: user } = useAuth();
  const usesCourseFeePolicy = true;
  const courseFeeLabel = 'Học phí niêm yết';
  const courseCodePlaceholder = 'Ví dụ: ENG-TOEIC';
  const courseTitlePlaceholder = 'Ví dụ: Luyện thi TOEIC 650+ cam kết chuẩn đầu ra';
  const courseDurationPlaceholder = 'Ví dụ: 3 tháng / 8 tuần';

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
    if (!newCourse.code || !newCourse.title || !newCourse.duration || !newCourse.category || (usesCourseFeePolicy && !newCourse.fee)) {
      toast.error('Vui lòng nhập đầy đủ thông tin khóa học.');
      return;
    }

    if (usesCourseFeePolicy) {
      const numericFee = newCourse.fee.replace(/\D/g, '');
      if (!numericFee || Number.isNaN(Number(numericFee))) {
        toast.error('Học phí phải là một số hợp lệ.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const payload: CreateCoursePayload = {
        code: newCourse.code.toUpperCase(),
        title: newCourse.title,
        category: newCourse.category,
        fee: usesCourseFeePolicy ? `${formatVND(newCourse.fee)}d` : '0d',
        duration: newCourse.duration,
        maxLearners: newCourse.maxLearners === '' ? 20 : newCourse.maxLearners,
      };

      await apiFetch<MutationResponse>('/courses', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      window.dispatchEvent(new Event('course-mutation'));
      setShowAddModal(false);
      resetNewCourse();
      toast.success(`Đã thêm mới khóa học ${payload.code} thành công!`);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Có lỗi xảy ra khi tạo khóa học.';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };
  const handleEditCourse = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingCourse) return;

    if (!editForm.code || !editForm.title || !editForm.duration || !editForm.category || (usesCourseFeePolicy && !editForm.fee)) {
      toast.error('Vui lòng nhập đầy đủ thông tin khóa học.');
      return;
    }

    if (usesCourseFeePolicy) {
      const numericFee = editForm.fee.replace(/\D/g, '');
      if (!numericFee || Number.isNaN(Number(numericFee))) {
        toast.error('Học phí phải là một số hợp lệ.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const payload = {
        code: editForm.code.toUpperCase(),
        title: editForm.title,
        category: editForm.category,
        fee: usesCourseFeePolicy ? `${formatVND(editForm.fee)}d` : '0d',
        duration: editForm.duration,
        maxLearners: editForm.maxLearners === '' ? 20 : editForm.maxLearners,
      };

      await apiFetch<MutationResponse>(`/courses/${editingCourse.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });

      window.dispatchEvent(new Event('course-mutation'));
      setEditingCourse(null);
      toast.success(`Đã cập nhật khóa học ${payload.code} thành công!`);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Có lỗi xảy ra khi cập nhật khóa học.';
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
      toast.success(`Khóa học ${course.code} đã chuyển sang "${nextStatus}".`);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Có lỗi xảy ra khi cập nhật khóa học.';
      toast.error(msg);
    }
  };

  const handleDelete = async (course: Course) => {
    try {
      await apiFetch<MutationResponse>(`/courses/${course.id}`, { method: 'DELETE' });
      window.dispatchEvent(new Event('course-mutation'));
      toast.success(`Đã xóa khóa học ${course.code}.`);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Có lỗi xảy ra khi xóa khóa học.';
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
      toast.success('Đã thêm phân loại mới thành công!');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Có lỗi xảy ra khi tạo phân loại.';
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
      toast.success('Đã xóa phân loại thành công.');
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
        title="Danh mục khóa học"
        subtitle="Thiết lập chương trình đào tạo và lớp học hành chính"
        action={
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
              Quản lý phân loại
            </button>
            <ErpPrimaryButton onClick={() => setShowAddModal(true)}>
              Thêm khóa học mới
            </ErpPrimaryButton>
          </div>
        }
      />

      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <ErpSearchBar value={searchTerm} onChange={setSearchTerm} placeholder="Tìm theo tên hoặc mã khóa học..." />
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
        <ErpCard><ErpLoadingState message="Đang tải danh mục khóa học..." /></ErpCard>
      ) : filteredCourses.length === 0 ? (
        <ErpCard>
          <ErpEmptyState
            icon={BookOpen}
            title="Chưa có khóa học nào"
            subtitle="Bấm 'Thêm khóa học mới' để khởi tạo chương trình đào tạo đầu tiên."
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
                    <div className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-slate-400" /> Max: {course.maxLearners} HV</div>
                    <div className="flex items-center gap-1.5"><Layers className="w-3.5 h-3.5 text-slate-400" /> {course.activeBatches} lớp đang chạy</div>
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
                      title={course.status === ACTIVE_COURSE_STATUS ? 'Tạm dừng khóa học' : 'Kích hoạt lại khóa học'}
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
                      onClick={() => setEditingCourse(course)}
                      title="Chỉnh sửa khóa học"
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
                      title="Xóa khóa học"
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
              itemName="khóa học"
            />
          </ErpCard>
        </div>
      ) : (
        <ErpCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <ErpTableHead columns={['Mã', 'Tên khóa học', 'Phân loại', 'Thời lượng', courseFeeLabel, 'Quy mô', 'Trạng thái', 'Thao tác']} />
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
                    <td className="py-2 px-4 font-bold">{course.maxLearners} HV ({course.activeBatches} lớp)</td>
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
                          onClick={() => setEditingCourse(course)}
                          className={cn(
                            'p-1 rounded-lg transition-all border cursor-pointer shadow-sm',
                            darkMode ? 'bg-slate-800 hover:bg-indigo-900/40 text-slate-450 hover:text-indigo-455 border-transparent' : 'bg-slate-50 hover:bg-indigo-50 text-slate-450 hover:text-indigo-550 border-slate-200/60'
                          )}
                          title="Chỉnh sửa khóa học"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleDelete(course)}
                          className={cn(
                            'p-1 rounded-lg transition-all border cursor-pointer shadow-sm',
                            darkMode ? 'bg-slate-800 hover:bg-rose-900/40 text-slate-450 hover:text-rose-455 border-transparent' : 'bg-slate-50 hover:bg-rose-50 text-slate-450 hover:text-rose-550 border-slate-200/60'
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
            totalItems={filteredCourses.length}
            pageSize={pageSize}
            itemName="khóa học"
          />
        </ErpCard>
      )}

      {showAddModal && (
        <ErpModal title="Thêm chương trình học mới" onClose={() => setShowAddModal(false)}>
          <form onSubmit={handleAddCourse} className="space-y-4">
            <ErpField label="Mã khóa học">
              <ErpInput
                type="text"
                required
                placeholder={courseCodePlaceholder}
                value={newCourse.code}
                onChange={(e) => setNewCourse({ ...newCourse, code: e.target.value })}
              />
            </ErpField>

            <ErpField label="Tên chương trình đào tạo">
              <ErpInput
                type="text"
                required
                placeholder={courseTitlePlaceholder}
                value={newCourse.title}
                onChange={(e) => setNewCourse({ ...newCourse, title: e.target.value })}
              />
            </ErpField>

            <div className="grid grid-cols-2 gap-4">
              <ErpField label="Phân loại">
                <ErpSelect
                  value={newCourse.category}
                  onChange={(e) => setNewCourse({ ...newCourse, category: e.target.value })}
                >
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.name}>
                      {cat.name}
                    </option>
                  ))}
                </ErpSelect>
              </ErpField>
              <ErpField label="Thời lượng">
                <ErpInput
                  type="text"
                  required
                  placeholder={courseDurationPlaceholder}
                  value={newCourse.duration}
                  onChange={(e) => setNewCourse({ ...newCourse, duration: e.target.value })}
                />
              </ErpField>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <ErpField label="Học phí niêm yết (VND)">
                <ErpInput
                  type="text"
                  required
                  placeholder="Vi du: 5.500.000"
                  value={newCourse.fee}
                  onChange={(e) => setNewCourse({ ...newCourse, fee: formatVND(e.target.value) })}
                />
              </ErpField>
              <ErpField label="Tối đa học viên lớp">
                <ErpInput
                  type="number"
                  min={0}
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

            <ErpSubmitButton>{isSubmitting ? 'Đang khởi tạo...' : 'Khởi tạo chương trình'}</ErpSubmitButton>
          </form>
        </ErpModal>
      )}

      {editingCourse && (
        <ErpModal title={`Chỉnh sửa chương trình học: ${editingCourse.code}`} onClose={() => setEditingCourse(null)}>
          <form onSubmit={handleEditCourse} className="space-y-4">
            <ErpField label="Mã khóa học">
              <ErpInput
                type="text"
                required
                placeholder={courseCodePlaceholder}
                value={editForm.code}
                onChange={(e) => setEditForm({ ...editForm, code: e.target.value })}
              />
            </ErpField>

            <ErpField label="Tên chương trình đào tạo">
              <ErpInput
                type="text"
                required
                placeholder={courseTitlePlaceholder}
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
              />
            </ErpField>

            <div className="grid grid-cols-2 gap-4">
              <ErpField label="Phân loại">
                <ErpSelect
                  value={editForm.category}
                  onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                >
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.name}>
                      {cat.name}
                    </option>
                  ))}
                </ErpSelect>
              </ErpField>
              <ErpField label="Thời lượng">
                <ErpInput
                  type="text"
                  required
                  placeholder={courseDurationPlaceholder}
                  value={editForm.duration}
                  onChange={(e) => setEditForm({ ...editForm, duration: e.target.value })}
                />
              </ErpField>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <ErpField label="Học phí niêm yết (VND)">
                <ErpInput
                  type="text"
                  required
                  placeholder="Vi du: 5.500.000"
                  value={editForm.fee}
                  onChange={(e) => setEditForm({ ...editForm, fee: formatVND(e.target.value) })}
                />
              </ErpField>
              <ErpField label="Tối đa học viên lớp">
                <ErpInput
                  type="number"
                  min={0}
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

            <ErpSubmitButton disabled={isSubmitting}>{isSubmitting ? 'Đang cập nhật...' : 'Cập nhật khóa học'}</ErpSubmitButton>
          </form>
        </ErpModal>
      )}

      {showCategoryModal && (
        <ErpModal title="Quản lý phân loại khóa học" onClose={() => setShowCategoryModal(false)}>
          <div className="space-y-6">
            <form onSubmit={handleAddCategory} className="flex gap-2">
              <div className="flex-1">
                <ErpInput
                  type="text"
                  required
                  placeholder="Nhập tên phân loại mới..."
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
              <h5 className={cn('text-xs font-black uppercase tracking-wider', darkMode ? 'text-slate-400' : 'text-slate-500')}>Danh sách phân loại hiện tại</h5>
              {categoriesLoading ? (
                <p className="text-xs text-slate-400">Đang tải...</p>
              ) : categories.length === 0 ? (
                <p className="text-xs text-slate-400">Chưa có phân loại nào.</p>
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
                        title="Xóa phân loại"
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
        title="Xóa phân loại khóa học"
        message={`Bạn có chắc chắn muốn xóa phân loại "${deleteConfirm.name}" không? Hành động này không thể hoàn tác.`}
        onConfirm={handleDeleteCategory}
        onCancel={() => setDeleteConfirm(DEFAULT_DELETE_CONFIRM)}
        confirmText="Xác nhận xóa"
        cancelText="Hủy bỏ"
      />
    </div>
  );
}
