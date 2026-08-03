import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Save, Loader2, ChevronDown } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { toast } from '../../../../pages/Toast';
import { Student, Partner } from '../../types';
import { cn, toInputDate, toDisplayDate } from '../../lib/utils';
import { findDuplicateStudentField } from '../../lib/studentUniqueness';
import { useAuth } from '../../../../context/AuthContext';
import { FormInput } from './components/StudentFormFields';
import { FaceEnrollmentTab } from './DetailTabs/FaceEnrollmentTab';
import { CustomFieldsSection } from '../../custom-fields/CustomFieldsSection';
import type { CustomFieldValues } from '../../custom-fields/types';
import { useStandardFields, getAdaptedFieldDefinition, type StandardFieldConfig } from '../../hooks/useStandardFields';
import { useEntityLabel } from '../../hooks/useEntityLabel';
import { getOperationalStatusLabel } from '../../config/workerRecruitmentCopy';
import { isFaceAttendanceVisible } from '../../config/faceAttendanceVisibility';
import { CustomFieldEditorModal } from '../../custom-fields/CustomFieldEditorModal';
import { canManageCustomFields } from '../../custom-fields/permissions';
import type { CreateFieldInput, FieldDefinition } from '../../custom-fields/types';

interface EditStudentModalProps {
  student: Student | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  students: Student[];
  selectedCenter?: string;
}

export function EditStudentModal({ student, isOpen, onClose, onSuccess, students }: EditStudentModalProps) {
  const { userProfile: user } = useAuth();
  const {
    fields: stdFields,
    archivedFields: archivedStdFields,
    updateField: updateStdField,
    archiveField: archiveStdField,
    restoreField: restoreStdField,
    deleteField: deleteStdField
  } = useStandardFields("students");
  const entityLabel = useEntityLabel();
  const faceAttendanceVisible = isFaceAttendanceVisible(user, 'student');

  const manageable = canManageCustomFields(user?.permissions);
  const [stdEditorOpen, setStdEditorOpen] = useState(false);
  const [editingStdField, setEditingStdField] = useState<FieldDefinition | null>(null);

  const openEditStdField = (field: StandardFieldConfig) => {
    setEditingStdField(getAdaptedFieldDefinition(field, "students"));
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
    if (entityLabel.preset === 'worker' || entityLabel.preset === 'customer') return defaultLabel;
    const fieldConfig = stdFields.find(f => f.key === fieldKey);
    return fieldConfig ? fieldConfig.label : defaultLabel;
  };
  const getFieldPlaceholder = (fieldKey: string, defaultPlaceholder: string) => {
    if (entityLabel.preset === 'worker' || entityLabel.preset === 'customer') return defaultPlaceholder;
    const fieldConfig = stdFields.find(f => f.key === fieldKey);
    return fieldConfig ? fieldConfig.placeholder || defaultPlaceholder : defaultPlaceholder;
  };
  const isFieldRequired = (fieldKey: string, defaultRequired = false) => {
    const fieldConfig = stdFields.find(f => f.key === fieldKey);
    return fieldConfig ? fieldConfig.isRequired : defaultRequired;
  };
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [referralMode, setReferralMode] = useState<'none' | 'partner' | 'custom'>('none');
  const [partners, setPartners] = useState<Partner[]>([]);

  useEffect(() => {
    const fetchPartners = async () => {
      try {
        const ownerId = student?.centerId || student?.ownerId;
        const params = new URLSearchParams({ isActive: 'true' });
        if (ownerId) params.append('ownerFilter', ownerId);

        const res = await apiFetch(`/partners?${params.toString()}`);
        if (res.success && res.partners) {
          setPartners(res.partners);
        }
      } catch (error) {
        console.error('Failed to fetch partners:', error);
      }
    };
    if (isOpen && student) {
      fetchPartners();
    }
  }, [isOpen, student]);

  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    referral: '',
    partnerId: '',
    birthday: '',
    idCard: '',
    registrationDate: '',
    enrollmentDate: '',
    fee: '',
    address: '',
    email: '',
    status: [] as string[],
    customFields: {} as CustomFieldValues,
  });

  useEffect(() => {
    if (student) {
      setTimeout(() => {
        const isPartnerRef = !!student.partnerId;
        const isCustomRef = !student.partnerId && !!student.referral;
        setReferralMode(isPartnerRef ? 'partner' : (isCustomRef ? 'custom' : 'none'));

        setFormData({
          fullName: student.fullName || '',
          email: student.email || '',
          phone: student.phone || '',
          referral: student.referral || '',
          partnerId: student.partnerId || '',
          birthday: student.birthday || '',
          idCard: student.idCard || '',
          registrationDate: student.registrationDate || '',
          enrollmentDate: student.enrollmentDate || '',
          fee: student.fee || '',
          address: student.address || '',
          status: Array.isArray(student.status) ? student.status : (student.status ? [student.status] : []),
          customFields: student.customFields || {},
        });
      }, 0);
    }
  }, [student]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const missingFields: string[] = [];
    stdFields.forEach((f) => {
      if (f.isVisible && !f.isArchived && f.isRequired) {
        if (f.key === 'fullName' && !formData.fullName) missingFields.push(f.label);
        if (f.key === 'phone' && !formData.phone) missingFields.push(f.label);
        if (f.key === 'referral' && !formData.referral && referralMode === 'custom') missingFields.push(f.label);
        if (f.key === 'referral' && referralMode === 'partner' && !formData.partnerId) missingFields.push(f.label);
        if (f.key === 'birthday' && !formData.birthday) missingFields.push(f.label);
        if (f.key === 'idCard' && !formData.idCard) missingFields.push(f.label);
        if (f.key === 'enrollmentDate' && !formData.enrollmentDate) missingFields.push(f.label);
        if (f.key === 'address' && !formData.address) missingFields.push(f.label);
        if (f.key === 'email' && !formData.email) missingFields.push(f.label);
      }
    });

    if (missingFields.length > 0) {
      toast.error(`Vui lòng điền đầy đủ các trường bắt buộc: ${missingFields.join(', ')}`);
      return;
    }

    const duplicateField = findDuplicateStudentField(
      students,
      {
        email: formData.email,
        phone: formData.phone,
        idCard: formData.idCard,
      },
      student?.id,
      'general'
    );
    if (duplicateField) {
      toast.error(`${duplicateField.label} đã tồn tại trong hệ thống, không được trùng.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        ...formData,
        expectedVersion: student?.__v,
        birthday: toDisplayDate(formData.birthday),
        enrollmentDate: toDisplayDate(formData.enrollmentDate),
        partnerId: formData.partnerId || "",
      };
      if (!isFieldVisible('phone')) delete (payload as Partial<typeof payload>).phone;
      await apiFetch(`/students/${student?.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      window.dispatchEvent(new Event('student-mutation'));
      toast.success(`Đã cập nhật thông tin ${entityLabel.singular} thành công!`);
      onSuccess();
      onClose();
    } catch (error: unknown) {
      console.error('Error updating student:', error);
      toast.error(error instanceof Error ? error.message : 'Có lỗi xảy ra khi cập nhật thông tin.');
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
      {isOpen && student && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[95vh] flex flex-col"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
              <h2 className="text-base font-bold text-slate-800">{entityLabel.editTitle}</h2>
              <button
                onClick={onClose}
                disabled={isSubmitting}
                className="p-1.5 rounded-full hover:bg-slate-100 transition-colors disabled:opacity-50"
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <form className="p-6 overflow-y-auto space-y-4" onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                {isFieldVisible('fullName') && (
                  <div className="relative group/std space-y-1">
                    {renderFieldActions('fullName')}
                    <FormInput
                      label={getFieldLabel('fullName', 'Họ và tên')}
                      name="fullName"
                      value={formData.fullName}
                      onChange={handleInputChange}
                      required={isFieldRequired('fullName', true)}
                      placeholder={getFieldPlaceholder('fullName', 'Nhập họ và tên...')}
                    />
                  </div>
                )}
                {(
                  <div className="relative group/std space-y-1">
                    {renderFieldActions('phone')}
                    <FormInput
                      label={getFieldLabel('phone', 'Số điện thoại')}
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      required={isFieldRequired('phone', true)}
                      placeholder={getFieldPlaceholder('phone', 'Nhập số điện thoại...')}
                    />
                  </div>
                )}
                {isFieldVisible('email') && (
                  <div className="sm:col-span-2 relative group/std space-y-1">
                    {renderFieldActions('email')}
                    <FormInput
                      label={getFieldLabel('email', `Email ${entityLabel.singular}`)}
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      required={isFieldRequired('email', false)}
                      placeholder={getFieldPlaceholder('email', 'Nhập địa chỉ email...')}
                    />
                  </div>
                )}

                {isFieldVisible('referral') && (
                  <div className="sm:col-span-2 relative group/std space-y-1">
                    {renderFieldActions('referral')}
                    <label className="text-[10px] font-bold text-slate-800 uppercase tracking-wider block">
                      {getFieldLabel('referral', 'Nguồn giới thiệu')}{' '}
                      {isFieldRequired('referral', false) && <span className="text-rose-500">*</span>}
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="relative">
                        <select
                          value={referralMode}
                          onChange={(e) => {
                            const mode = e.target.value as 'none' | 'partner' | 'custom';
                            setReferralMode(mode);
                            if (mode === 'none') {
                              setFormData(prev => ({ ...prev, partnerId: '', referral: '' }));
                            } else if (mode === 'custom') {
                              setFormData(prev => ({ ...prev, partnerId: '', referral: '' }));
                            } else {
                              setFormData(prev => ({ ...prev, partnerId: partners[0]?._id || '', referral: partners[0]?.name || '' }));
                            }
                          }}
                          className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm appearance-none focus:outline-none focus:ring-4 focus:ring-cyan-600/5 focus:border-cyan-600 transition-all cursor-pointer"
                        >
                          <option value="none">Không có giới thiệu</option>
                          <option value="partner">Đối tác / CTV hệ thống</option>
                          <option value="custom">Nhập người giới thiệu khác</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      </div>

                      {referralMode === 'partner' && (
                        <div className="relative">
                          <select
                            value={formData.partnerId}
                            onChange={(e) => {
                              const pId = e.target.value;
                              const pObj = partners.find(p => p._id === pId);
                              setFormData(prev => ({ ...prev, partnerId: pId, referral: pObj ? pObj.name : '' }));
                            }}
                            className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm appearance-none focus:outline-none focus:ring-4 focus:ring-cyan-600/5 focus:border-cyan-600 transition-all cursor-pointer"
                          >
                            <option value="">-- Chọn đối tác --</option>
                            {partners.map(p => (
                              <option key={p._id} value={p._id}>
                                {p.name} ({p.phone})
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        </div>
                      )}

                      {referralMode === 'custom' && (
                        <input
                          type="text"
                          name="referral"
                          value={formData.referral}
                          onChange={handleInputChange}
                          placeholder={getFieldPlaceholder('referral', 'Nhập tên người giới thiệu...')}
                          className="w-full h-10 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-cyan-600 transition-all"
                        />
                      )}
                    </div>
                  </div>
                )}

                {isFieldVisible('birthday') && (
                  <div className="relative group/std space-y-1">
                    {renderFieldActions('birthday')}
                    <FormInput
                      label={getFieldLabel('birthday', 'Ngày sinh')}
                      name="birthday"
                      type="date"
                      value={toInputDate(formData.birthday)}
                      onChange={handleInputChange}
                      required={isFieldRequired('birthday', false)}
                    />
                  </div>
                )}
                {isFieldVisible('idCard') && (
                  <div className="relative group/std space-y-1">
                    {renderFieldActions('idCard')}
                    <FormInput
                      label={getFieldLabel('idCard', 'CCCD / CMND')}
                      name="idCard"
                      value={formData.idCard}
                      onChange={handleInputChange}
                      required={isFieldRequired('idCard', false)}
                      placeholder={getFieldPlaceholder('idCard', 'Nhập số CCCD (12 số)...')}
                    />
                  </div>
                )}

                {isFieldVisible('registrationDate') && (
                  <div className="relative group/std space-y-1">
                    {renderFieldActions('registrationDate')}
                    <FormInput
                      label={getFieldLabel('registrationDate', entityLabel.preset === 'worker' || entityLabel.preset === 'customer' ? 'Ngày tạo hồ sơ' : 'Ngày đăng ký')}
                      name="registrationDate"
                      value={formData.registrationDate}
                      onChange={handleInputChange}
                      placeholder="DD/MM/YYYY"
                      required={isFieldRequired('registrationDate', false)}
                      readOnly
                    />
                  </div>
                )}
                {isFieldVisible('enrollmentDate') && (
                  <div className="relative group/std space-y-1">
                    {renderFieldActions('enrollmentDate')}
                    <FormInput
                      label={getFieldLabel('enrollmentDate', entityLabel.preset === 'worker' ? 'Ngày tiếp nhận' : entityLabel.preset === 'customer' ? 'Ngày bắt đầu sử dụng' : 'Ngày nhập học')}
                      name="enrollmentDate"
                      type="date"
                      value={toInputDate(formData.enrollmentDate)}
                      onChange={handleInputChange}
                      required={isFieldRequired('enrollmentDate', false)}
                    />
                  </div>
                )}
                {entityLabel.preset !== 'worker' && entityLabel.preset !== 'customer' && isFieldVisible('fee') && (
                  <div className="relative group/std space-y-1">
                    {renderFieldActions('fee')}
                    <FormInput
                      label={getFieldLabel('fee', 'Học phí đã chốt (VND)')}
                      name="fee"
                      value={formData.fee}
                      onChange={handleInputChange}
                      required={isFieldRequired('fee', false)}
                      placeholder={getFieldPlaceholder('fee', 'Nhập học phí đã chốt...')}
                    />
                  </div>
                )}
                {isFieldVisible('address') && (
                  <div className="sm:col-span-2 relative group/std space-y-1">
                    {renderFieldActions('address')}
                    <FormInput
                      label={getFieldLabel('address', 'Địa chỉ')}
                      name="address"
                      value={formData.address}
                      onChange={handleInputChange}
                      required={isFieldRequired('address', false)}
                      placeholder={getFieldPlaceholder('address', 'Nhập địa chỉ...')}
                    />
                  </div>
                )}

                <div className="sm:col-span-2 space-y-1">
                  <label className="text-[10px] font-bold text-slate-800 uppercase tracking-wider">
                    Trạng thái (Chọn nhiều)
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                    {(entityLabel.preset === 'worker' || entityLabel.preset === 'customer'
                      ? ['Đang học', 'Đã đậu', 'Thi lại', 'Nghỉ học']
                      : ['Đang học', 'Đã đậu', 'Thi lại', 'Nghỉ học', 'Nợ học phí']).map((st) => {
                      const isChecked = formData.status.includes(st);
                      return (
                        <label
                          key={st}
                          className={cn(
                            "flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold cursor-pointer transition-all select-none",
                            isChecked
                              ? "bg-cyan-50 border-cyan-200 text-cyan-700 shadow-sm"
                              : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              setFormData(prev => {
                                const current = prev.status || [];
                                const next = current.includes(st)
                                  ? current.filter(x => x !== st)
                                  : [...current, st];
                                return { ...prev, status: next };
                              });
                            }}
                            className="rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 w-3.5 h-3.5"
                          />
                          {getOperationalStatusLabel(entityLabel.preset, st)}
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              {faceAttendanceVisible && student && (
                <div className="pt-2">
                  <FaceEnrollmentTab student={student} />
                </div>
              )}

              <CustomFieldsSection
                moduleKey="students"
                values={formData.customFields}
                onChange={(customFields) => setFormData((previous) => ({ ...previous, customFields }))}
                mode="edit"
                disabled={isSubmitting}
                tenantId={student?.centerId || student?.ownerId || undefined}
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
                          className="font-bold text-cyan-600 hover:text-cyan-700 disabled:opacity-50 transition-colors"
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

              <div className="flex items-center justify-end gap-4 pt-4 mt-2 border-t border-slate-50 flex-shrink-0">
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
                  className="flex items-center gap-2 px-6 py-2.5 bg-brand-primary hover:bg-brand-primary/95 text-white rounded-xl text-xs font-bold shadow-lg shadow-cyan-100 transition-all disabled:opacity-70"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  Lưu {entityLabel.singular}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      <CustomFieldEditorModal
        open={stdEditorOpen}
        moduleKey="students"
        initialField={editingStdField}
        onClose={() => setStdEditorOpen(false)}
        onSubmit={handleStdFieldSubmit}
        isStandard={true}
      />
    </AnimatePresence>
  );
}
