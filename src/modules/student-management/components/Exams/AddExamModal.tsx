import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Save, ChevronDown, Loader2, Pencil, Archive, Trash2, RotateCcw } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { ExamSession } from '../../types';
import { toast } from '../../../../pages/Toast';
import { CustomFieldsSection } from '../../../shared/custom-fields/CustomFieldsSection';
import type { CustomFieldValues } from '../../../shared/custom-fields/types';
import { useStandardFields, getAdaptedFieldDefinition, type StandardFieldConfig } from '../../hooks/useStandardFields';
import { CustomFieldEditorModal } from '../../../shared/custom-fields/CustomFieldEditorModal';
import { canManageCustomFields } from '../../../shared/custom-fields/permissions';
import { useAuth } from '../../../../context/AuthContext';
import type { CreateFieldInput, FieldDefinition } from '../../../shared/custom-fields/types';
import { useCourses } from '../../hooks/useCourses';
import { useBatches } from '../../hooks/useBatches';
import { cn } from '../../lib/utils';
import { VietnameseDatePicker } from '../Batches/VietnameseDatePicker';

interface AddExamModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (exam: ExamSession) => void;
  initialData?: ExamSession | null;
  tenantId?: string;
}

function getEarliestExamDate(batch?: { startDate?: string; endDate?: string; daysOfWeek?: number[] }) {
  if (!batch?.startDate || !batch?.endDate || !batch.daysOfWeek?.length) return '';
  const dates: string[] = [];
  const cursor = new Date(`${batch.startDate}T00:00:00`);
  const end = new Date(`${batch.endDate}T00:00:00`);
  while (cursor <= end) {
    if (batch.daysOfWeek.includes(cursor.getDay())) dates.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`);
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates[Math.max(0, Math.ceil(dates.length * 0.85) - 1)] || '';
}

export function AddExamModal({ isOpen, onClose, onSuccess, initialData, tenantId }: AddExamModalProps) {
  const { userProfile: user } = useAuth();
  const {
    fields: stdFields,
    archivedFields: archivedStdFields,
    updateField: updateStdField,
    archiveField: archiveStdField,
    restoreField: restoreStdField,
    deleteField: deleteStdField
  } = useStandardFields("exams");

  const { courses } = useCourses(tenantId);
  const { batches } = useBatches(tenantId);
  // Có thể lập lịch thi trước khi lớp kết thúc; lớp đóng/hủy không được tạo lịch mới.
  // Lớp của lịch thi cũ vẫn được giữ lại khi người dùng mở để chỉnh sửa.
  const isBatchExamEligible = React.useCallback((batch: typeof batches[number]) => (
    batch.id === initialData?.batchId || (
      batch.status === 'Đang học'
    )
  ), [initialData?.batchId]);
  const examEligibleBatches = React.useMemo(() => batches.filter(isBatchExamEligible), [batches, isBatchExamEligible]);
  // QLHV lấy khóa học qua lớp đã chọn; trường này chỉ phục vụ dữ liệu kỳ thi lái xe cũ.
  const showLegacyCourseField = false;
  const [isOpenCourses, setIsOpenCourses] = useState(false);
  const [isOpenBatches, setIsOpenBatches] = useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const batchDropdownRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpenCourses(false);
      }
      if (batchDropdownRef.current && !batchDropdownRef.current.contains(event.target as Node)) {
        setIsOpenBatches(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  const manageable = canManageCustomFields(user?.permissions);
  const [stdEditorOpen, setStdEditorOpen] = useState(false);
  const [editingStdField, setEditingStdField] = useState<FieldDefinition | null>(null);

  const openEditStdField = (field: StandardFieldConfig) => {
    setEditingStdField(getAdaptedFieldDefinition(field, "exams"));
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
      <div className="absolute right-0 top-0 z-10 flex items-center gap-1" role="group" aria-label={`Công cụ trường ${fieldConfig.label}`}>
        <button type="button" title={`Sửa ${fieldConfig.label}`} aria-label={`Sửa ${fieldConfig.label}`} className="flex h-7 w-7 items-center justify-center rounded-lg border border-sky-100 bg-sky-50 text-sky-600 transition-colors hover:bg-sky-100" onClick={() => openEditStdField(fieldConfig)}><Pencil className="h-3.5 w-3.5" /></button>
        <button type="button" title={`Lưu trữ ${fieldConfig.label}`} aria-label={`Lưu trữ ${fieldConfig.label}`} className="flex h-7 w-7 items-center justify-center rounded-lg border border-amber-100 bg-amber-50 text-amber-700 transition-colors hover:bg-amber-100" onClick={() => archiveStd(fieldConfig)}><Archive className="h-3.5 w-3.5" /></button>
        <button type="button" title={`Xóa ${fieldConfig.label}`} aria-label={`Xóa ${fieldConfig.label}`} className="flex h-7 w-7 items-center justify-center rounded-lg border border-rose-100 bg-rose-50 text-rose-600 transition-colors hover:bg-rose-100" onClick={() => deleteStd(fieldConfig)}><Trash2 className="h-3.5 w-3.5" /></button>
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
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<{
    name: string;
    rank: string;
    tentativeDate: string;
    location: string;
    batchId: string;
    maxScore: number;
    passScore: number;
    customFields?: CustomFieldValues;
  }>({
    name: '',
    rank: '',
    tentativeDate: '',
    location: '',
    batchId: '',
    maxScore: 100,
    passScore: 50,
    customFields: {},
  });

  const selectedBatch = React.useMemo(
    () => batches.find((batch) => batch.id === formData.batchId),
    [batches, formData.batchId]
  );
  const earliestExamDate = React.useMemo(() => getEarliestExamDate(selectedBatch), [selectedBatch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (initialData) {
        let formattedDate = '';
        if (initialData.tentativeDate) {
          const parts = initialData.tentativeDate.split('/');
          if (parts.length === 3) {
            formattedDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          }
        }

        setFormData({
          name: initialData.name || '',
          rank: initialData.rank || '',
          tentativeDate: formattedDate,
          location: initialData.location || '',
          batchId: initialData.batchId || '',
          maxScore: initialData.maxScore || 100,
          passScore: initialData.passScore ?? Math.ceil((initialData.maxScore || 100) / 2),
          customFields: initialData.customFields || {},
        });
      } else {
        setFormData({
          name: '',
          rank: '',
          tentativeDate: '',
          location: '',
          batchId: '',
          maxScore: 100,
          passScore: 50,
          customFields: {},
        });
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const missingFields: string[] = [];
    stdFields.forEach((f) => {
      if (f.isVisible && !f.isArchived && f.isRequired) {
        if (f.key === 'name' && !formData.name) missingFields.push(f.label);
        if (f.key === 'rank' && !formData.rank) missingFields.push(f.label);
        if (f.key === 'tentativeDate' && !formData.tentativeDate) missingFields.push(f.label);
        if (f.key === 'location' && !formData.location) missingFields.push(f.label);
      }
    });

    if (missingFields.length > 0) {
      toast.warning(`Vui lòng điền đầy đủ các trường bắt buộc: ${missingFields.join(', ')}`);
      return;
    }
    if (!formData.batchId) {
      toast.warning('Vui lòng chọn lớp học trước khi tạo lịch thi.');
      return;
    }
    if (!selectedBatch) {
      toast.warning('Không tìm thấy lớp học đã chọn. Hãy tải lại danh sách lớp rồi thử lại.');
      return;
    }
    if (!isBatchExamEligible(selectedBatch)) {
      toast.warning('Chỉ lớp đang học mới có thể lập lịch thi. Lớp đã kết thúc, bị hủy hoặc chưa khai giảng không thể tạo lịch mới.');
      return;
    }
    const maxScore = Number(formData.maxScore);
    const passScore = Number(formData.passScore);
    if (!Number.isFinite(maxScore) || maxScore <= 0 || !Number.isFinite(passScore) || passScore < 0 || passScore > maxScore) {
      toast.warning('Ngưỡng đạt phải nằm trong khoảng từ 0 đến thang điểm.');
      return;
    }
    if (earliestExamDate && formData.tentativeDate && formData.tentativeDate < earliestExamDate) {
      toast.warning(`Ngày thi chỉ được sớm tối đa 15% tiến độ lớp, từ ngày ${earliestExamDate.split('-').reverse().join('/')}.`);
      return;
    }
    if (!initialData && formData.tentativeDate) {
      const now = new Date();
      const today = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
      if (formData.tentativeDate < today) {
        toast.warning('Ngày thi dự kiến không được nằm trong quá khứ.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const dateParts = formData.tentativeDate.split('-');
      const formattedDate = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : formData.tentativeDate;

      if (initialData) {
        const updateData = {
          expectedVersion: initialData.__v,
          name: formData.name,
          rank: formData.rank,
          tentativeDate: formattedDate,
          location: formData.location,
          batchId: formData.batchId,
          maxScore: Number(formData.maxScore),
          passScore: Number(formData.passScore),
          customFields: formData.customFields,
        };

        const res = await apiFetch(`/exams/${initialData.id}`, {
          method: 'PATCH',
          body: JSON.stringify(updateData),
        });

        toast.success('Đã cập nhật đợt thi thành công!');
        onSuccess({ ...initialData, ...updateData, id: res.data?._id || res.data?.id || initialData.id });
      } else {
        const examData = {
          ...formData,
          tentativeDate: formattedDate,
          status: 'Sắp diễn ra',
        };

        const res = await apiFetch('/exams', {
          method: 'POST',
          body: JSON.stringify(examData),
        });

        toast.success('Đã tạo đợt thi thành công!');
        onSuccess({ 
          ...examData, 
          status: 'Sắp diễn ra',
          studentCount: 0,
          passCount: 0,
          failCount: 0,
          id: res.data?._id || res.data?.id 
        });
      }

      window.dispatchEvent(new Event('exam-mutation'));
      onClose();
      setFormData({
        name: '',
        rank: '',
        tentativeDate: '',
        location: '',
        batchId: '',
          maxScore: 100,
          passScore: 50,
        customFields: {},
      });
    } catch (error) {
      console.error('Error creating/updating exam:', error);
      toast.error('Lỗi khi xử lý đợt thi: ' + (error instanceof Error ? error.message : 'Không rõ nguyên nhân'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => {
      if (name === "maxScore") {
        const nextMax = Number(value) || 1;
        return { ...prev, maxScore: nextMax, passScore: Math.min(prev.passScore, nextMax) };
      }
      if (name === "passScore") return { ...prev, passScore: Number(value) || 0 };
      return { ...prev, [name]: value };
    });
  };

  return (
    <AnimatePresence>
      <div key="exam-modal-portal" className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 30 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-xl bg-white rounded-2xl shadow-xl overflow-hidden max-h-[92vh] flex flex-col"
        >
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 flex-shrink-0">
            <h2 className="flex items-center gap-2 text-base font-medium text-slate-900 before:w-1 before:h-5 before:rounded-full before:bg-brand-primary">
              {initialData ? 'Chỉnh sửa đợt thi' : 'Tạo đợt thi mới'}
            </h2>
            <button
              onClick={onClose}
              disabled={isSubmitting}
              aria-label="Đóng"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-500 text-white hover:bg-rose-600 transition-colors disabled:opacity-50"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form className="p-5 overflow-y-auto space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-3.5">
              {isFieldVisible('name') && (
                <div className="space-y-1 relative group/std">
                  {renderFieldActions('name')}
                  <label className="text-sm text-slate-700">
                    {getFieldLabel('name', 'Tên đợt thi')}{' '}
                    {isFieldRequired('name', true) && <span className="text-rose-500">*</span>}
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required={isFieldRequired('name', true)}
                    placeholder={getFieldPlaceholder('name', 'Ví dụ: Đợt thi Ô tô - Tháng 3/2026')}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm placeholder:text-slate-300 focus:outline-none focus:ring-4 focus:ring-brand-primary/5 focus:border-brand-primary transition-all"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm text-slate-700">Lớp học <span className="text-rose-500">*</span></label>
                  <div ref={batchDropdownRef} className="relative">
                    <button
                      type="button"
                      disabled={Boolean(initialData?.batchId)}
                      onClick={() => setIsOpenBatches(!isOpenBatches)}
                      className="w-full flex items-center justify-between px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-brand-primary/5 focus:border-brand-primary transition-all text-slate-800 text-left select-none cursor-pointer disabled:bg-slate-50 disabled:cursor-not-allowed"
                    >
                      <span className={formData.batchId ? "text-slate-800 truncate pr-2" : "text-slate-400"}>
                        {formData.batchId
                          ? `${batches.find((b) => b.id === formData.batchId)?.code} - ${batches.find((b) => b.id === formData.batchId)?.courseTitle}`
                          : "-- Chọn lớp học --"}
                      </span>
                      <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ${isOpenBatches ? "rotate-180" : ""}`} />
                    </button>

                    {isOpenBatches && (
                      <div className="absolute left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 py-1.5 max-h-[180px] overflow-y-auto scrollbar-thin">
                        <div
                          key="default-batch-option"
                          onClick={() => {
                            setFormData(prev => ({ ...prev, batchId: '' }));
                            setIsOpenBatches(false);
                          }}
                          className={`px-4 py-2 text-sm cursor-pointer transition-colors hover:bg-sky-50 ${!formData.batchId ? "text-brand-primary bg-sky-50" : "text-slate-500"}`}
                        >
                          -- Chọn lớp học --
                        </div>
                        {batches.map((batch, index) => {
                          const eligible = isBatchExamEligible(batch);
                          return (
                            <div
                              key={batch.id || `batch-${index}`}
                              onClick={() => {
                                if (eligible) {
                                  setFormData(prev => ({ ...prev, batchId: batch.id }));
                                  setIsOpenBatches(false);
                                }
                              }}
                              className={cn(
                                "px-4 py-2 text-sm transition-colors flex items-center justify-between",
                                eligible
                                  ? "cursor-pointer hover:bg-slate-50 text-slate-700"
                                  : "cursor-not-allowed bg-slate-50/30 text-slate-400",
                                formData.batchId === batch.id && "text-brand-primary bg-sky-50"
                              )}
                            >
                              <div className="truncate pr-2">
                                <span className="font-medium text-slate-800">{batch.code}</span> - {batch.courseTitle}
                                {!eligible && <span className="text-[10px] text-slate-400 ml-1 italic">(không thể lập lịch)</span>}
                              </div>
                              {formData.batchId === batch.id && <span className="w-1.5 h-1.5 rounded-full bg-cyan-600 shrink-0" />}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <p className="min-h-5 pt-1 text-xs text-slate-500">{formData.batchId ? <>Khóa học: <span className="text-brand-primary">{batches.find((batch) => batch.id === formData.batchId)?.courseTitle || 'Đang tải khóa học'}</span></> : examEligibleBatches.length ? 'Có thể lập lịch trước; đến ngày thi mới chốt điểm danh và kết quả.' : batches.length ? 'Chỉ lớp đang học mới có thể lập lịch thi.' : 'Chưa tải được danh sách lớp học.'}</p>
                  {selectedBatch ? <div className={`mt-1 rounded-lg border px-2.5 py-2 text-[11px] leading-relaxed ${selectedBatch.status === 'Đang học' ? 'border-cyan-100 bg-cyan-50 text-cyan-800' : 'border-amber-100 bg-amber-50 text-amber-800'}`}>
                    {selectedBatch.status === 'Đang học'
                      ? 'Lớp đang học: có thể tạo lịch trước. Trước ngày thi cần hoàn tất các buổi học và chốt điểm danh.'
                      : `Đang chỉnh sửa lịch của lớp ${selectedBatch.status.toLowerCase()}. Không thể dùng lớp này để tạo lịch thi mới.`}
                  </div> : null}
                </div>
                <div className="space-y-1">
                  <label className="text-sm text-slate-700">Thang điểm</label>
                  <input type="number" name="maxScore" min="1" value={formData.maxScore} onChange={handleInputChange} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-brand-primary/5 focus:border-brand-primary" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm text-slate-700">Ngưỡng đạt</label>
                  <input type="number" name="passScore" min="0" max={formData.maxScore} value={formData.passScore} onChange={handleInputChange} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-brand-primary/5 focus:border-brand-primary" />
                  <p className="text-[11px] text-slate-500">Điểm từ ngưỡng này trở lên được tính là Đậu.</p>
                </div>
                {showLegacyCourseField && isFieldVisible('rank') && (
                  <div className="space-y-1 relative group/std">
                    {renderFieldActions('rank')}
                    <label className="text-sm text-slate-700">
                      {getFieldLabel('rank', 'Nhóm thi')}{' '}
                      {isFieldRequired('rank', false) && <span className="text-rose-500">*</span>}
                    </label>
                    <div ref={dropdownRef} className="relative">
                      <button
                        type="button"
                        onClick={() => setIsOpenCourses(!isOpenCourses)}
                        className="w-full flex items-center justify-between px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-brand-primary/5 focus:border-brand-primary transition-all text-slate-800 text-left select-none cursor-pointer"
                      >
                        <span className={formData.rank ? "text-slate-800" : "text-slate-350 font-medium"}>
                          {formData.rank || "-- Chọn khóa học --"}
                        </span>
                        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpenCourses ? "rotate-180" : ""}`} />
                      </button>

                      {isOpenCourses && (
                        <div className="absolute left-0 right-0 mt-1.5 bg-white border border-slate-100 rounded-2xl shadow-xl z-50 py-1.5 max-h-[250px] overflow-y-auto no-scrollbar">
                          <div 
                            key="default-course-option"
                            onClick={() => {
                              setFormData(prev => ({ ...prev, rank: '' }));
                              setIsOpenCourses(false);
                            }}
                            className={`px-4 py-2 text-sm cursor-pointer transition-colors hover:bg-sky-50 ${!formData.rank ? "text-brand-primary bg-slate-50/50 font-bold" : "text-slate-500"}`}
                          >
                            -- Chọn khóa học --
                          </div>
                          {courses.map((course, index) => (
                            <div
                              key={course.id || `course-${index}`}
                              onClick={() => {
                                setFormData(prev => ({ ...prev, rank: course.title }));
                                setIsOpenCourses(false);
                              }}
                              className={`px-4 py-2 text-sm cursor-pointer transition-colors hover:bg-sky-50 flex items-center justify-between ${formData.rank === course.title ? "text-brand-primary bg-slate-50/50 font-bold" : "text-slate-700"}`}
                            >
                              <span>{course.title}</span>
                              {formData.rank === course.title && <span className="w-1.5 h-1.5 rounded-full bg-brand-primary" />}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {isFieldVisible('tentativeDate') && (
                  <div className="space-y-1 relative group/std">
                    {renderFieldActions('tentativeDate')}
                    <label className="text-sm text-slate-700">
                      {getFieldLabel('tentativeDate', 'Ngày thi dự kiến')}{' '}
                      {isFieldRequired('tentativeDate', true) && <span className="text-rose-500">*</span>}
                    </label>
                    <VietnameseDatePicker ariaLabel={getFieldLabel('tentativeDate', 'Ngày thi dự kiến')} value={formData.tentativeDate} min={earliestExamDate || undefined} onChange={(value) => setFormData((previous) => ({ ...previous, tentativeDate: value }))} required={isFieldRequired('tentativeDate', true)} selectionOnly variant="filter" />
                    {earliestExamDate && <p className="text-[10px] text-slate-400">Có thể thi sớm tối đa 15%: từ {earliestExamDate.split('-').reverse().join('/')}.</p>}
                  </div>
                )}
              </div>

              {isFieldVisible('location') && (
                <div className="space-y-1 relative group/std">
                  {renderFieldActions('location')}
                  <label className="text-sm text-slate-700">
                    {getFieldLabel('location', 'Địa điểm thi')}{' '}
                    {isFieldRequired('location', true) && <span className="text-rose-500">*</span>}
                  </label>
                  <input
                    type="text"
                    name="location"
                    value={formData.location}
                    onChange={handleInputChange}
                    required={isFieldRequired('location', true)}
                    placeholder={getFieldPlaceholder('location', 'Ví dụ: Trung tâm sát hạch quận 1')}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm placeholder:text-slate-300 focus:outline-none focus:ring-4 focus:ring-brand-primary/5 focus:border-brand-primary transition-all"
                  />
                </div>
              )}
            </div>

            <CustomFieldsSection
              moduleKey="exams"
              values={formData.customFields}
              onChange={(customFields) => setFormData((previous) => ({ ...previous, customFields }))}
              mode={initialData ? 'edit' : 'create'}
              disabled={isSubmitting}
              tenantId={tenantId}
              isEditingFields={isEditingFields}
              onToggleEditingFields={setIsEditingFields}
            />

            {manageable && archivedStdFields.length ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-3 mt-4 text-left">
                <h4 className="text-sm font-medium text-slate-700">Trường mặc định đã lưu trữ</h4>
                <ul className="mt-2 divide-y divide-slate-100">
                  {archivedStdFields.map((field, index) => (
                    <li key={field.key || `archived-${index}`} className="flex items-center justify-between py-2 text-xs text-slate-600">
                      <span>{field.label}</span>
                      <button
                        type="button"
                        disabled={isSubmitting}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-sky-100 bg-sky-50 text-sky-600 transition-colors hover:bg-sky-100 disabled:opacity-50"
                        aria-label={`Khôi phục ${field.label}`}
                        title={`Khôi phục ${field.label}`}
                        onClick={() => restoreStdField(field.key)}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="flex items-center justify-end gap-3 pt-3 mt-4 border-t border-slate-50 flex-shrink-0">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 px-5 py-2.5 bg-brand-primary hover:bg-brand-primary/90 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-70"
              >
                {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                {isSubmitting ? 'Đang lưu...' : initialData ? 'Cập nhật đợt thi' : 'Tạo đợt thi'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>

      <CustomFieldEditorModal
        key="exam-modal-custom-field-editor"
        open={stdEditorOpen}
        moduleKey="exams"
        initialField={editingStdField}
        onClose={() => setStdEditorOpen(false)}
        onSubmit={handleStdFieldSubmit}
        isStandard={true}
      />
    </AnimatePresence>
  );
}
