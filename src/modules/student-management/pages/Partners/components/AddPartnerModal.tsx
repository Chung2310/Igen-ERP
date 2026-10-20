import React, { useState, useEffect } from 'react';
import { toast } from '../../../../../pages/Toast';
import { useAuth } from '../../../../../context/AuthContext';
import { useAdminCenters } from '../../../hooks/useAdminCenters';
import { apiFetch } from '../../../lib/api';
import { ErpModal, ErpField, ErpInput } from '../../../components/Erp/ErpUI';
import { PartnerFormDropdown } from './PartnerFormDropdown';
import { formatVND } from '../../../lib/utils';
import { Loader2 } from 'lucide-react';
import { Partner } from '../../../types';
import { CustomFieldsSection } from '../../../../shared/custom-fields/CustomFieldsSection';
import type { CustomFieldValues } from '../../../../shared/custom-fields/types';
import { useStandardFields, getAdaptedFieldDefinition, type StandardFieldConfig } from '../../../hooks/useStandardFields';
import { CustomFieldEditorModal } from '../../../../shared/custom-fields/CustomFieldEditorModal';
import { canManageCustomFields } from '../../../../shared/custom-fields/permissions';
import type { CreateFieldInput, FieldDefinition } from '../../../../shared/custom-fields/types';
import { useBranchOptional } from '../../../../../context/BranchContext';
import { buildPartnerBranchHeaders } from '../partnerBranchScope';

interface AddPartnerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newPartner?: Partner) => void;
  partner?: Partner;
  defaultCenterId?: string;
  zIndex?: string;
}

export function AddPartnerModal({ isOpen, onClose, onSuccess, partner, defaultCenterId, zIndex }: AddPartnerModalProps) {
  const { userProfile: user } = useAuth();
  const branchContext = useBranchOptional();
  const activeBranchId = branchContext?.activeBranchId;
  const {
    fields: stdFields,
    archivedFields: archivedStdFields,
    updateField: updateStdField,
    archiveField: archiveStdField,
    restoreField: restoreStdField,
    deleteField: deleteStdField
  } = useStandardFields("partners");

  const manageable = canManageCustomFields(user?.permissions);
  const [stdEditorOpen, setStdEditorOpen] = useState(false);
  const [editingStdField, setEditingStdField] = useState<FieldDefinition | null>(null);

  const openEditStdField = (field: StandardFieldConfig) => {
    setEditingStdField(getAdaptedFieldDefinition(field, "partners"));
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
  const { centers } = useAdminCenters();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    commissionType: 'fixed' as 'fixed' | 'percentage',
    commissionValue: '',
    bankName: '',
    bankAccountNo: '',
    bankAccountName: '',
    isActive: true,
    notes: '',
    centerId: '',
    customFields: {} as CustomFieldValues,
  });

  useEffect(() => {
    setTimeout(() => {
      if (partner) {
        setFormData({
          name: partner.name || '',
          phone: partner.phone || '',
          email: partner.email || '',
          commissionType: partner.commissionType || 'fixed',
          commissionValue: partner.commissionType === 'fixed'
            ? formatVND(String(partner.commissionValue))
            : String(partner.commissionValue),
          bankName: partner.bankName || '',
          bankAccountNo: partner.bankAccountNo || '',
          bankAccountName: partner.bankAccountName || '',
          isActive: partner.isActive !== false,
          notes: partner.notes || '',
          centerId: partner.ownerId || '',
          customFields: partner.customFields || {},
        });
      } else {
        setFormData({
          name: '',
          phone: '',
          email: '',
          commissionType: 'fixed',
          commissionValue: '',
          bankName: '',
          bankAccountNo: '',
          bankAccountName: '',
          isActive: true,
          notes: '',
          centerId: defaultCenterId || '',
          customFields: {},
        });
      }
    }, 0);
  }, [partner, isOpen, defaultCenterId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const missingFields: string[] = [];
    stdFields.forEach((f) => {
      if (f.isVisible && !f.isArchived && f.isRequired) {
        if (f.key === 'name' && !formData.name.trim()) missingFields.push(f.label);
        if (f.key === 'phone' && !formData.phone.trim()) missingFields.push(f.label);
        if (f.key === 'email' && !formData.email.trim()) missingFields.push(f.label);
      }
    });

    if (missingFields.length > 0) {
      toast.error(`Vui lòng điền đầy đủ các trường bắt buộc: ${missingFields.join(', ')}`);
      return;
    }

    if (user?.role === 'superadmin' && !partner && !formData.centerId) {
      toast.error('Vui lòng chọn trung tâm quản lý cho đối tác này.');
      return;
    }

    setIsSubmitting(true);
    try {
      const url = partner ? `/partners/${partner._id}` : '/partners';
      const method = partner ? 'PATCH' : 'POST';

      const payload = {
        ...(partner ? { expectedVersion: partner.__v } : {}),
        name: formData.name,
        phone: formData.phone,
        email: formData.email,
        bankName: formData.bankName,
        bankAccountNo: formData.bankAccountNo,
        bankAccountName: formData.bankAccountName,
        isActive: formData.isActive,
        notes: formData.notes,
        customFields: formData.customFields,
        ...(user?.role === 'superadmin' && !partner ? { centerId: formData.centerId } : {}),
      };

      const res = await apiFetch(url, {
        method,
        headers: buildPartnerBranchHeaders(activeBranchId),
        body: JSON.stringify(payload),
      });

      if (res.success) {
        toast.success(partner ? 'Đã cập nhật thông tin đối tác thành công!' : 'Đã thêm đối tác mới thành công!');
        onSuccess(res.data);
        onClose();
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Lỗi lưu thông tin đối tác.';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  if (!isOpen) return null;

  return (
    <>
      <ErpModal title={partner ? 'Cập nhật đối tác' : 'Thêm đối tác mới'} onClose={onClose} maxWidth="max-w-4xl" zIndex={zIndex}>
      <form onSubmit={handleSubmit} className="text-left space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
          {/* Cột 1: Thông tin đối tác */}
          <div className="space-y-2.5">
            <div className="pb-1 border-b border-slate-100 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">Thông tin đối tác / CTV</span>
            </div>

            {user?.role === 'superadmin' && !partner && (
              <ErpField label="Trung tâm quản lý *">
                <PartnerFormDropdown
                  label="Trung tâm quản lý"
                  value={formData.centerId}
                  onChange={(centerId) => setFormData(prev => ({ ...prev, centerId }))}
                  options={[
                    { value: '', label: 'Chọn trung tâm quản lý' },
                    ...centers.map(center => ({ value: center.uid, label: `${center.displayName} (${center.email})` })),
                  ]}
                />
              </ErpField>
            )}

            {isFieldVisible('name') && (
              <div className="relative group/std">
                {renderFieldActions('name')}
                <ErpField label={getFieldLabel('name', 'Tên đối tác / CTV')}>
                  <ErpInput
                    name="name"
                    required={isFieldRequired('name', true)}
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder={getFieldPlaceholder('name', 'Nhập họ và tên...')}
                  />
                </ErpField>
              </div>
            )}

            {isFieldVisible('phone') && (
              <div className="relative group/std">
                {renderFieldActions('phone')}
                <ErpField label={getFieldLabel('phone', 'Số điện thoại')}>
                  <ErpInput
                    name="phone"
                    required={isFieldRequired('phone', true)}
                    value={formData.phone}
                    onChange={handleInputChange}
                    placeholder={getFieldPlaceholder('phone', 'Nhập số điện thoại...')}
                  />
                </ErpField>
              </div>
            )}

            {isFieldVisible('email') && (
              <div className="relative group/std">
                {renderFieldActions('email')}
                <ErpField label={getFieldLabel('email', 'Địa chỉ Email')}>
                  <ErpInput
                    name="email"
                    type="email"
                    required={isFieldRequired('email', false)}
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder={getFieldPlaceholder('email', 'Nhập địa chỉ email...')}
                  />
                </ErpField>
              </div>
            )}

            <ErpField label="Trạng thái hoạt động">
              <PartnerFormDropdown
                label="Trạng thái hoạt động"
                value={formData.isActive ? 'true' : 'false'}
                onChange={(value) => setFormData(prev => ({ ...prev, isActive: value === 'true' }))}
                options={[
                  { value: 'true', label: 'Đang hoạt động' },
                  { value: 'false', label: 'Ngưng hoạt động' },
                ]}
              />
            </ErpField>
          </div>

          {/* Cột 2: Thông tin chi trả & ghi chú */}
          <div className="space-y-2.5">
            <div className="pb-1 border-b border-slate-100 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">Tài khoản ngân hàng chi trả</span>
            </div>

            <ErpField label="Ngân hàng (VietQR)">
              <PartnerFormDropdown
                label="Ngân hàng (VietQR)"
                value={formData.bankName}
                onChange={(bankName) => setFormData(prev => ({ ...prev, bankName }))}
                options={[
                  { value: '', label: 'Chọn ngân hàng' },
                  { value: 'mbbank', label: 'MBBank (MB)' },
                  { value: 'vietcombank', label: 'Vietcombank (VCB)' },
                  { value: 'techcombank', label: 'Techcombank (TCB)' },
                  { value: 'vietinbank', label: 'Vietinbank (CTG)' },
                  { value: 'bidv', label: 'BIDV' },
                  { value: 'agribank', label: 'Agribank (VBA)' },
                  { value: 'acb', label: 'ACB' },
                  { value: 'sacombank', label: 'Sacombank (STB)' },
                  { value: 'tpbank', label: 'TPBank (TPB)' },
                  { value: 'vpbank', label: 'VPBank (VPB)' },
                ]}
              />
            </ErpField>

            <ErpField label="Số tài khoản">
              <ErpInput
                name="bankAccountNo"
                value={formData.bankAccountNo}
                onChange={(e) => setFormData(prev => ({ ...prev, bankAccountNo: e.target.value.replace(/\D/g, '') }))}
                placeholder="Nhập số tài khoản..."
              />
            </ErpField>

            <ErpField label="Tên chủ tài khoản">
              <ErpInput
                name="bankAccountName"
                value={formData.bankAccountName}
                onChange={handleInputChange}
                placeholder="Nhập tên chủ tài khoản (viết hoa không dấu)..."
              />
            </ErpField>

            <ErpField label="Ghi chú">
              <ErpInput
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                placeholder="Ghi chú thêm về đối tác này..."
              />
            </ErpField>
          </div>
        </div>

        {/* Thông tin bổ sung */}
        <CustomFieldsSection
          moduleKey="partners"
          values={formData.customFields}
          onChange={(customFields) => setFormData((previous) => ({ ...previous, customFields }))}
          mode={partner ? 'edit' : 'create'}
          disabled={isSubmitting}
          tenantId={formData.centerId || partner?.ownerId}
          isEditingFields={isEditingFields}
          onToggleEditingFields={setIsEditingFields}
          compact={true}
        />

        {manageable && archivedStdFields.length ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-2.5 text-left">
            <h4 className="text-[11px] font-semibold text-slate-700">Trường mặc định đã lưu trữ</h4>
            <ul className="mt-1.5 divide-y divide-slate-100">
              {archivedStdFields.map((field) => (
                <li key={field.key} className="flex items-center justify-between py-1 text-xs text-slate-600">
                  <span>{field.label}</span>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    className="font-semibold text-[#00ADFC] hover:text-[#0095d9] disabled:opacity-50 transition-colors cursor-pointer text-xs"
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

        {/* Thanh nút hành động gọn gàng */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 active:scale-95 transition-all cursor-pointer"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center justify-center gap-1.5 px-6 py-2 bg-[#00ADFC] hover:bg-[#0095d9] active:bg-[#0085c2] text-white rounded-xl text-xs font-semibold shadow-xs active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Đang lưu...</span>
              </>
            ) : (
              partner ? 'Cập nhật đối tác' : 'Khai báo đối tác'
            )}
          </button>
        </div>
      </form>
    </ErpModal>

    <CustomFieldEditorModal
      open={stdEditorOpen}
      moduleKey="partners"
      initialField={editingStdField}
      onClose={() => setStdEditorOpen(false)}
      onSubmit={handleStdFieldSubmit}
      isStandard={true}
    />
    </>
  );
}
