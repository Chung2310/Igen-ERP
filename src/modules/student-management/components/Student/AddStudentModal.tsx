import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Save, Loader2, Plus } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../../../context/AuthContext';
import { toast } from '../../../../pages/Toast';
import { useBatches } from '../../hooks/useBatches';
import { useAdminCenters } from '../../hooks/useAdminCenters';
import { formatVND, toDisplayDate } from '../../lib/utils';
import { Student, Partner } from '../../types';
import { findDuplicateStudentField } from '../../lib/studentUniqueness';
import { FormInput } from './components/StudentFormFields';
import { CustomFieldsSection } from '../../../shared/custom-fields/CustomFieldsSection';
import type { CustomFieldValues } from '../../../shared/custom-fields/types';
import { useStandardFields, getAdaptedFieldDefinition, type StandardFieldConfig } from '../../hooks/useStandardFields';
import { RoadmapPicker } from '../ui/RoadmapPicker';
import { useEntityLabel } from '../../hooks/useEntityLabel';
import { CustomFieldEditorModal } from '../../../shared/custom-fields/CustomFieldEditorModal';
import { canManageCustomFields } from '../../../shared/custom-fields/permissions';
import type { CreateFieldInput, FieldDefinition } from '../../../shared/custom-fields/types';
import { AddPartnerModal } from '../../pages/Partners/components/AddPartnerModal';

interface AddStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (student: Student) => void;
  students: Student[];
  selectedCenter?: string;
}

export function AddStudentModal({ isOpen, onClose, onSuccess, students, selectedCenter }: AddStudentModalProps) {
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
    if (entityLabel.preset === 'student') return ['fullName', 'phone'].includes(fieldKey);
    const fieldConfig = stdFields.find(f => f.key === fieldKey);
    return fieldConfig ? fieldConfig.isRequired : defaultRequired;
  };
  
  const { centers } = useAdminCenters();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [batchId, setBatchId] = useState('');
  const [selectedCenterId, setSelectedCenterId] = useState<string>(() => {
    return selectedCenter && selectedCenter !== 'all' ? selectedCenter : '';
  });
  const [prevSelectedCenter, setPrevSelectedCenter] = useState(selectedCenter);
  const batchesOwnerFilter = selectedCenterId || (selectedCenter && selectedCenter !== 'all' ? selectedCenter : undefined);
  const { batches } = useBatches(batchesOwnerFilter);
  const isWorkerPreset = entityLabel.preset === 'worker';
  const showBatchDropdown = entityLabel.preset !== 'customer' && isFieldVisible('batchId');

  if (selectedCenter !== prevSelectedCenter) {
    setPrevSelectedCenter(selectedCenter);
    setSelectedCenterId(selectedCenter && selectedCenter !== 'all' ? selectedCenter : '');
  }

  const [referralMode, setReferralMode] = useState<'none' | 'partner' | 'custom'>('none');
  const [partners, setPartners] = useState<Partner[]>([]);
  const [faceBlob, setFaceBlob] = useState<Blob | null>(null);

  // Modal Thêm nhanh đối tác
  const [isQuickAddPartnerOpen, setIsQuickAddPartnerOpen] = useState(false);

  const fetchPartners = async () => {
    try {
      const ownerId = user?.role === 'superadmin' ? selectedCenterId : undefined;
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

  useEffect(() => {
    if (isOpen) {
      void fetchPartners();
    }
  }, [isOpen, selectedCenterId, user]);

  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    referral: '',
    partnerId: '',
    birthday: '',
    idCard: '',
    registrationDate: new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    enrollmentDate: '',
    fee: '',
    address: '',
    email: '',
    customFields: {} as CustomFieldValues,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!user) {
      setErrorMsg(`Vui lòng đăng nhập để lưu hồ sơ ${entityLabel.singular}.`);
      return;
    }

    const missingFields: string[] = [];
    stdFields.forEach((f) => {
      const required = entityLabel.preset === 'student' ? ['fullName', 'phone'].includes(f.key) : f.isRequired;
      if (f.isVisible && !f.isArchived && required) {
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
      const message = `Vui lòng điền đầy đủ các trường bắt buộc: ${missingFields.join(', ')}`;
      setErrorMsg(message);
      toast.error(message);
      return;
    }

    const duplicateField = findDuplicateStudentField(students, {
      email: formData.email,
      phone: formData.phone,
    }, undefined, 'general');
    if (duplicateField) {
      const message = `${duplicateField.label} đã tồn tại trong hệ thống, không được trùng.`;
      setErrorMsg(message);
      toast.error(message);
      return;
    }

    if (user?.role === 'superadmin' && !selectedCenterId) {
      const message = `Vui lòng chọn công ty quản lý ${entityLabel.singular}.`;
      setErrorMsg(message);
      toast.error(message);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiFetch('/students', {
        method: 'POST',
        body: JSON.stringify({
          ...formData,
          birthday: toDisplayDate(formData.birthday),
          enrollmentDate: toDisplayDate(formData.enrollmentDate),
          fee: '',
          idCardFront: '',
          idCardBack: '',
          status: ['Đang học'],
          registrationDate: new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }),
          centerId: selectedCenterId || undefined,
          partnerId: formData.partnerId || undefined,
        }),
      });

      if (res.success && res.data) {
        const studentWithId = { id: res.data._id, ...res.data };

        if (faceBlob) {
          try {
            const faceBody = new FormData();
            faceBody.append('file', new File([faceBlob], 'face.jpg', { type: faceBlob.type || 'image/jpeg' }));
            await apiFetch(`/students/${res.data._id}/face`, { method: 'POST', body: faceBody });
          } catch (faceError: unknown) {
            const msg = faceError instanceof Error ? faceError.message : 'Không thể lưu mẫu khuôn mặt.';
            toast.warning(`Đã tạo ${entityLabel.singular} nhưng chưa lưu được mẫu khuôn mặt: ${msg}`);
          }
        }

        if (batchId) {
          try {
            await apiFetch(`/batches/${batchId}/learners`, {
              method: 'POST',
              body: JSON.stringify({ studentId: res.data._id }),
            });
            window.dispatchEvent(new Event('batch-mutation'));
          } catch (batchError: unknown) {
            const msg = batchError instanceof Error ? batchError.message : (isWorkerPreset ? 'Không thể thêm vào dự án.' : 'Không thể xếp lớp.');
            toast.warning(isWorkerPreset
              ? `Đã tạo ${entityLabel.singular} nhưng chưa thêm được vào dự án: ${msg}`
              : `Đã tạo ${entityLabel.singular} nhưng chưa xếp được vào lớp: ${msg}`);
          }
        }

        window.dispatchEvent(new Event('student-mutation'));
        toast.success(`Đã lưu hồ sơ ${entityLabel.singular} thành công!`);
        onClose();
        onSuccess(studentWithId);

        setFormData({
          fullName: '',
          phone: '',
          referral: '',
          partnerId: '',
          birthday: '',
          idCard: '',
          registrationDate: new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }),
          enrollmentDate: '',
          fee: '',
          address: '',
          email: '',
          customFields: {},
        });
        setReferralMode('none');
        setBatchId('');
        setFaceBlob(null);
        setSelectedCenterId(selectedCenter && selectedCenter !== 'all' ? selectedCenter : '');
      }
    } catch (error: unknown) {
      console.error('Error saving student:', error);
      const message = error instanceof Error ? error.message : `Lỗi lưu hồ sơ ${entityLabel.singular}.`;
      setErrorMsg(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: name === 'fee' ? formatVND(value) : value }));
  };

  return (
    <AnimatePresence>
      {isOpen && (
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
            className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[95vh] flex flex-col"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
              <h2 className="text-base font-bold text-slate-800">{entityLabel.addTitle}</h2>
              <button
                onClick={onClose}
                disabled={isSubmitting}
                className="p-1.5 rounded-full hover:bg-slate-100 transition-colors disabled:opacity-50"
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <form className="p-6 overflow-y-auto space-y-4" onSubmit={handleSubmit}>
              {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-sm font-bold text-rose-600">
                  {errorMsg}
                </div>
              )}

              {user?.role === 'superadmin' && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-800 uppercase tracking-wider">
                    Trung tâm quản lý *
                  </label>
                  <RoadmapPicker value={selectedCenterId} placeholder="-- Chọn trung tâm quản lý --" options={centers.map((center) => ({ value: center.uid, label: `${center.displayName} (${center.email})` }))} onChange={setSelectedCenterId} />
                </div>
              )}

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
                {isFieldVisible('phone') && (
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
                        <RoadmapPicker
                          value={referralMode}
                          options={[
                            { value: 'none', label: 'Không có giới thiệu' },
                            { value: 'partner', label: 'Đối tác / CTV hệ thống' },
                            { value: 'custom', label: 'Nhập người giới thiệu khác' }
                          ]}
                          placeholder="Chọn nguồn giới thiệu"
                          onChange={(value) => {
                            const mode = value as 'none' | 'partner' | 'custom';
                            setReferralMode(mode);
                            if (mode === 'none') {
                              setFormData(prev => ({ ...prev, partnerId: '', referral: '' }));
                            } else if (mode === 'custom') {
                              setFormData(prev => ({ ...prev, partnerId: '', referral: '' }));
                            } else {
                              setFormData(prev => ({
                                ...prev,
                                partnerId: partners[0]?._id || '',
                                referral: partners[0]?.name || ''
                              }));
                            }
                          }}
                        />
                      </div>

                      {referralMode === 'partner' && (
                        <div className="flex items-center gap-2">
                          <div className="relative flex-1">
                            <RoadmapPicker
                              value={formData.partnerId}
                              placeholder="-- Chọn đối tác --"
                              options={partners.map((partner) => ({
                                value: partner._id,
                                label: `${partner.name} (${partner.phone})`
                              }))}
                              onChange={(pId) => {
                                const pObj = partners.find(p => p._id === pId);
                                setFormData(prev => ({ ...prev, partnerId: pId, referral: pObj ? pObj.name : '' }));
                              }}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => setIsQuickAddPartnerOpen(true)}
                            className="flex items-center justify-center h-10 px-3 bg-cyan-50 hover:bg-cyan-100/80 text-cyan-700 hover:text-cyan-800 border border-cyan-200/80 rounded-xl text-xs font-bold whitespace-nowrap transition-all active:scale-95 shadow-sm cursor-pointer"
                            title="Thêm đối tác mới chưa có trong danh sách"
                          >
                            <Plus className="w-3.5 h-3.5 mr-1" />
                            <span>Thêm nhanh</span>
                          </button>
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
                      value={toDisplayDate(formData.birthday)}
                      onChange={handleInputChange}
                      required={isFieldRequired('birthday', false)}
                      placeholder="DD/MM/YYYY"
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
                
                {showBatchDropdown && (
                  <div className="relative group/std space-y-1">
                    {renderFieldActions('batchId')}
                    <label className="text-[10px] font-bold text-slate-800 uppercase tracking-wider block">
                      {isWorkerPreset ? 'Thêm vào dự án (tùy chọn)' : getFieldLabel('batchId', 'Xếp vào lớp (tùy chọn)')}{' '}
                      {isFieldRequired('batchId', false) && <span className="text-rose-500">*</span>}
                    </label>
                    <select
                      name="batchId"
                      value={batchId}
                      onChange={(e) => {
                        const value = e.target.value;
                        setBatchId(value);
                        const batch = batches.find((item) => item.id === value);
                        if (!isWorkerPreset && batch?.status === 'Sắp khai giảng' && batch.startDate) {
                          setFormData((current) => ({ ...current, enrollmentDate: batch.startDate }));
                        }
                      }}
                      className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:border-cyan-600 focus:bg-white transition-all cursor-pointer"
                    >
                      <option value="">{isWorkerPreset ? '-- Chưa thêm vào dự án --' : '-- Chưa xếp lớp --'}</option>
                      {batches.filter((batch) => String(batch.status) !== 'Đã kết thúc').map((batch) => (
                        <option key={batch.id} value={batch.id}>
                          {batch.code} — {batch.courseTitle}
                        </option>
                      ))}
                    </select>
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
                      value={toDisplayDate(formData.enrollmentDate)}
                      onChange={handleInputChange}
                      required={isFieldRequired('enrollmentDate', false)}
                      placeholder="DD/MM/YYYY"
                    />
                  </div>
                )}
                {entityLabel.preset !== 'worker' && entityLabel.preset !== 'customer' && isFieldVisible('fee') && (
                  <div className="relative group/std space-y-1">
                    {renderFieldActions('fee')}
                    <label className="text-[10px] font-bold text-slate-800 uppercase tracking-wider block">
                      {getFieldLabel('fee', 'Học phí đã chốt')}{' '}
                      {isFieldRequired('fee', false) && <span className="text-rose-500">*</span>}
                    </label>
                    <div className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-500">
                      {getFieldPlaceholder('fee', 'Sẽ lấy tự động từ khóa học khi xếp lớp.')}
                    </div>
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
              </div>

              <CustomFieldsSection
                moduleKey="students"
                values={formData.customFields}
                onChange={(customFields) => setFormData((previous) => ({ ...previous, customFields }))}
                mode="create"
                disabled={isSubmitting}
                tenantId={selectedCenterId || undefined}
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
                  className="flex items-center gap-2 px-6 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-cyan-100 transition-all hover:-translate-y-0.5 active:scale-95 disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {isSubmitting ? 'Đang lưu...' : 'Lưu hồ sơ'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Modal Thêm nhanh đối tác / CTV đầy đủ từ trang Quản lý Đối tác */}
      {isQuickAddPartnerOpen && (
        <AddPartnerModal
          isOpen={isQuickAddPartnerOpen}
          zIndex="z-[60]"
          defaultCenterId={selectedCenterId}
          onClose={() => setIsQuickAddPartnerOpen(false)}
          onSuccess={(newPartner) => {
            setIsQuickAddPartnerOpen(false);
            if (newPartner) {
              setPartners((prev) => [newPartner, ...prev.filter((p) => p._id !== newPartner._id)]);
              setFormData((prev) => ({
                ...prev,
                partnerId: newPartner._id,
                referral: newPartner.name,
              }));
              setReferralMode('partner');
            }
            void fetchPartners();
          }}
        />
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
