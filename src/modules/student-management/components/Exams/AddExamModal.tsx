import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Save, ChevronDown, Loader2, Calendar } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { ExamSession } from '../../types';
import { toast } from '../../../../pages/Toast';
import { CustomFieldsSection } from '../../custom-fields/CustomFieldsSection';
import type { CustomFieldValues } from '../../custom-fields/types';
import { useStandardFields, getAdaptedFieldDefinition, type StandardFieldConfig } from '../../hooks/useStandardFields';
import { CustomFieldEditorModal } from '../../custom-fields/CustomFieldEditorModal';
import { canManageCustomFields } from '../../custom-fields/permissions';
import { useAuth } from '../../../../context/AuthContext';
import type { CreateFieldInput, FieldDefinition } from '../../custom-fields/types';
import { useCourses } from '../../hooks/useCourses';
import { useBatches } from '../../hooks/useBatches';

interface AddExamModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (exam: ExamSession) => void;
  initialData?: ExamSession | null;
  tenantId?: string;
}

export function AddExamModal({ isOpen, onClose, onSuccess, initialData, tenantId }: AddExamModalProps) {
  const { userProfile: user } = useAuth();
  const {
    fields: stdFields,
    activeFields: activeStdFields,
    archivedFields: archivedStdFields,
    updateField: updateStdField,
    archiveField: archiveStdField,
    restoreField: restoreStdField,
    deleteField: deleteStdField
  } = useStandardFields("exams");

  const { courses } = useCourses(tenantId);
  const { batches } = useBatches(tenantId);
  // QLHV lấy khóa học qua lớp đã chọn; trường này chỉ phục vụ dữ liệu kỳ thi lái xe cũ.
  const showLegacyCourseField = false;
  const [isOpenCourses, setIsOpenCourses] = useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpenCourses(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
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
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<{
    name: string;
    rank: string;
    tentativeDate: string;
    location: string;
    batchId: string;
    maxScore: number;
    customFields?: CustomFieldValues;
  }>({
    name: '',
    rank: '',
    tentativeDate: '',
    location: '',
    batchId: '',
    maxScore: 100,
    customFields: {},
  });

  const dateInputRef = React.useRef<HTMLInputElement>(null);
  const [localTentativeDate, setLocalTentativeDate] = useState('');

  useEffect(() => {
    if (document.activeElement !== dateInputRef.current) {
      setLocalTentativeDate(formData.tentativeDate);
    }
  }, [formData.tentativeDate]);

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
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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
          className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[95vh] flex flex-col"
        >
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 flex-shrink-0">
            <h2 className="text-base font-bold text-slate-800">
              {initialData ? 'Chỉnh sửa đợt thi' : 'Tạo đợt thi mới'}
            </h2>
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="p-1.5 rounded-full hover:bg-slate-100 transition-colors disabled:opacity-50"
            >
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>

          <form className="p-5 overflow-y-auto space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-3.5">
              {isFieldVisible('name') && (
                <div className="space-y-1 relative group/std">
                  {renderFieldActions('name')}
                  <label className="text-[10px] font-bold text-slate-800 uppercase tracking-wider">
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
                  <label className="text-[10px] font-bold text-slate-800 uppercase tracking-wider">Lớp học <span className="text-rose-500">*</span></label>
                  <select name="batchId" required value={formData.batchId} disabled={Boolean(initialData?.batchId)} onChange={handleInputChange} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-brand-primary/5 focus:border-brand-primary disabled:bg-slate-50">
                    <option value="">-- Chọn lớp học --</option>
                    {batches.map((batch) => <option key={batch.id} value={batch.id}>{batch.code} - {batch.courseTitle}</option>)}
                  </select>
                  <p className="min-h-5 pt-1 text-xs text-slate-500">{formData.batchId ? <>Khóa học: <span className="font-bold text-cyan-700">{batches.find((batch) => batch.id === formData.batchId)?.courseTitle || 'Đang tải khóa học'}</span></> : 'Khóa học sẽ hiển thị theo lớp đã chọn.'}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-800 uppercase tracking-wider">Thang điểm</label>
                  <input type="number" name="maxScore" min="1" value={formData.maxScore} onChange={handleInputChange} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-brand-primary/5 focus:border-brand-primary" />
                </div>
                {showLegacyCourseField && isFieldVisible('rank') && (
                  <div className="space-y-1 relative group/std">
                    {renderFieldActions('rank')}
                    <label className="text-[10px] font-bold text-slate-800 uppercase tracking-wider">
                      {getFieldLabel('rank', 'Nhóm thi')}{' '}
                      {isFieldRequired('rank', false) && <span className="text-rose-500">*</span>}
                    </label>
                    <div ref={dropdownRef} className="relative">
                      <button
                        type="button"
                        onClick={() => setIsOpenCourses(!isOpenCourses)}
                        className="w-full flex items-center justify-between px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-brand-primary/5 focus:border-brand-primary transition-all text-slate-800 text-left select-none cursor-pointer"
                      >
                        <span className={formData.rank ? "text-slate-850 font-bold" : "text-slate-350 font-medium"}>
                          {formData.rank || "-- Chọn khóa học --"}
                        </span>
                        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpenCourses ? "rotate-180" : ""}`} />
                      </button>

                      {isOpenCourses && (
                        <div className="absolute left-0 right-0 mt-1.5 bg-white border border-slate-100 rounded-2xl shadow-xl z-50 py-1.5 max-h-[250px] overflow-y-auto no-scrollbar">
                          <div 
                            onClick={() => {
                              setFormData(prev => ({ ...prev, rank: '' }));
                              setIsOpenCourses(false);
                            }}
                            className={`px-4 py-2 text-xs font-medium cursor-pointer transition-colors hover:bg-slate-50 ${!formData.rank ? "text-brand-primary bg-slate-50/50 font-bold" : "text-slate-500"}`}
                          >
                            -- Chọn khóa học --
                          </div>
                          {courses.map(course => (
                            <div
                              key={course.id}
                              onClick={() => {
                                setFormData(prev => ({ ...prev, rank: course.title }));
                                setIsOpenCourses(false);
                              }}
                              className={`px-4 py-2 text-xs font-medium cursor-pointer transition-colors hover:bg-slate-50 flex items-center justify-between ${formData.rank === course.title ? "text-brand-primary bg-slate-50/50 font-bold" : "text-slate-700"}`}
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
                    <label className="text-[10px] font-bold text-slate-800 uppercase tracking-wider">
                      {getFieldLabel('tentativeDate', 'Ngày thi dự kiến')}{' '}
                      {isFieldRequired('tentativeDate', true) && <span className="text-rose-500">*</span>}
                    </label>
                    <div className="relative">
                      <input
                        ref={dateInputRef}
                        type="date"
                        name="tentativeDate"
                        value={localTentativeDate}
                        onChange={(e) => {
                          setLocalTentativeDate(e.target.value);
                          handleInputChange(e);
                        }}
                        required={isFieldRequired('tentativeDate', true)}
                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-brand-primary/5 focus:border-brand-primary transition-all pr-10"
                      />
                    </div>
                  </div>
                )}
              </div>

              {isFieldVisible('location') && (
                <div className="space-y-1 relative group/std">
                  {renderFieldActions('location')}
                  <label className="text-[10px] font-bold text-slate-800 uppercase tracking-wider">
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

            <div className="flex items-center justify-end gap-3 pt-3 mt-4 border-t border-slate-50 flex-shrink-0">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-cyan-100 transition-all hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-70 disabled:hover:translate-y-0"
              >
                {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                {isSubmitting ? 'Đang lưu...' : initialData ? 'Cập nhật đợt thi' : 'Tạo đợt thi'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>

      <CustomFieldEditorModal
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
