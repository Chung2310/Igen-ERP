import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../../lib/api';
import { toast } from '../../../../../pages/Toast';
import { ErpModal, ErpField, ErpInput, ErpSelect, ErpSubmitButton } from '../../../components/Erp/ErpUI';
import { CustomFieldsSection } from '../../../custom-fields/CustomFieldsSection';
import type { CustomFieldValues } from '../../../custom-fields/types';
import type { ResourceItem } from '../../../types';
import { useStandardFields, getAdaptedFieldDefinition, type StandardFieldConfig } from '../../../hooks/useStandardFields';
import { CustomFieldEditorModal } from '../../../custom-fields/CustomFieldEditorModal';
import { canManageCustomFields } from '../../../custom-fields/permissions';
import { useAuth } from '../../../../../context/AuthContext';
import type { CreateFieldInput, FieldDefinition } from '../../../custom-fields/types';

interface Category {
  id: string;
  name: string;
}

interface AddResourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  onSuccess: () => void;
  resource?: ResourceItem;
}

export function AddResourceModal({ isOpen, onClose, categories, onSuccess, resource }: AddResourceModalProps) {
  const { userProfile: user } = useAuth();
  const {
    fields: stdFields,
    activeFields: activeStdFields,
    archivedFields: archivedStdFields,
    updateField: updateStdField,
    archiveField: archiveStdField,
    restoreField: restoreStdField,
    deleteField: deleteStdField
  } = useStandardFields("resources");

  const manageable = canManageCustomFields(user?.role);
  const [stdEditorOpen, setStdEditorOpen] = useState(false);
  const [editingStdField, setEditingStdField] = useState<FieldDefinition | null>(null);

  const openEditStdField = (field: StandardFieldConfig) => {
    setEditingStdField(getAdaptedFieldDefinition(field, "resources"));
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

  const [newResource, setNewResource] = useState({
    name: '',
    type: '',
    identifier: '',
    capacity: '',
    customFields: {} as CustomFieldValues,
  });

  useEffect(() => {
    if (!isOpen) return;
    setNewResource(resource ? {
      name: resource.name || '',
      type: resource.type || '',
      identifier: resource.identifier || '',
      capacity: resource.capacity || '',
      customFields: resource.customFields || {},
    } : {
      name: '',
      type: '',
      identifier: '',
      capacity: '',
      customFields: {},
    });
  }, [isOpen, resource]);

  const selectedType = newResource.type || categories[0]?.name || '';

  const handleAddResource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    const missingFields: string[] = [];
    stdFields.forEach((f) => {
      if (f.isVisible && !f.isArchived && f.isRequired) {
        if (f.key === 'name' && !newResource.name) missingFields.push(f.label);
        if (f.key === 'type' && !selectedType) missingFields.push(f.label);
        if (f.key === 'identifier' && !newResource.identifier) missingFields.push(f.label);
        if (f.key === 'capacity' && !newResource.capacity) missingFields.push(f.label);
      }
    });

    if (missingFields.length > 0) {
      toast.error(`Vui lòng điền đầy đủ các trường bắt buộc: ${missingFields.join(', ')}`);
      return;
    }

    setIsSubmitting(true);
    try {
      await apiFetch(resource ? `/student-resources/${resource.id}` : '/student-resources', {
        method: resource ? 'PATCH' : 'POST',
        body: JSON.stringify({
          ...newResource,
          ...(resource ? { expectedVersion: resource.__v } : {}),
          type: isFieldVisible('type') ? selectedType : 'Khác',
          identifier: newResource.identifier.toUpperCase(),
        }),
      });
      toast.success(resource
        ? `Đã cập nhật tài nguyên ${newResource.name}!`
        : `Đã thêm mới tài nguyên ${newResource.name} vào danh sách!`);
      setNewResource({
        name: '',
        type: '',
        identifier: '',
        capacity: '',
        customFields: {},
      });
      onSuccess();
      onClose();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Có lỗi xảy ra khi khai báo tài nguyên.';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <ErpModal title={resource ? 'Cập nhật tài nguyên' : 'Khai báo tài nguyên mới'} onClose={onClose}>
      <form onSubmit={handleAddResource} className="space-y-4">
        {isFieldVisible('name') && (
          <div className="relative group/std">
            {renderFieldActions('name')}
            <ErpField label={getFieldLabel('name', 'Tên gọi tài nguyên')}>
              <ErpInput
                type="text"
                required={isFieldRequired('name', true)}
                placeholder={getFieldPlaceholder('name', 'Ví dụ: Phòng Lab thực hành 102')}
                value={newResource.name}
                onChange={(e) => setNewResource({ ...newResource, name: e.target.value })}
              />
            </ErpField>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          {isFieldVisible('type') && (
            <div className="relative group/std">
              {renderFieldActions('type')}
              <ErpField label={getFieldLabel('type', 'Phân loại')}>
                <ErpSelect
                  required={isFieldRequired('type', true)}
                  value={selectedType}
                  onChange={(e) => setNewResource({ ...newResource, type: e.target.value })}
                >
                  <option value="" disabled>-- Chọn phân loại --</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.name}>
                      {cat.name}
                    </option>
                  ))}
                </ErpSelect>
              </ErpField>
            </div>
          )}
          {isFieldVisible('identifier') && (
            <div className="relative group/std">
              {renderFieldActions('identifier')}
              <ErpField label={getFieldLabel('identifier', 'Mã nhận diện / Số phòng')}>
                <ErpInput
                  type="text"
                  required={isFieldRequired('identifier', true)}
                  placeholder={getFieldPlaceholder('identifier', 'Ví dụ: P.102, MT-01, MC-02')}
                  value={newResource.identifier}
                  onChange={(e) => setNewResource({ ...newResource, identifier: e.target.value })}
                />
              </ErpField>
            </div>
          )}
        </div>

        {isFieldVisible('capacity') && (
          <div className="relative group/std">
            {renderFieldActions('capacity')}
            <ErpField label={getFieldLabel('capacity', 'Sức chứa / Khả năng đáp ứng')}>
              <ErpInput
                type="text"
                required={isFieldRequired('capacity', true)}
                placeholder={getFieldPlaceholder('capacity', 'Ví dụ: 30 người / 2 người / 1 bộ')}
                value={newResource.capacity}
                onChange={(e) => setNewResource({ ...newResource, capacity: e.target.value })}
              />
            </ErpField>
          </div>
        )}

        <CustomFieldsSection
          moduleKey="resources"
          values={newResource.customFields}
          onChange={(customFields) => setNewResource((previous) => ({ ...previous, customFields }))}
          mode={resource ? 'edit' : 'create'}
          disabled={isSubmitting}
          tenantId={resource?.ownerId}
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

        <ErpSubmitButton disabled={isSubmitting}>
          {isSubmitting ? 'Đang lưu...' : resource ? 'Cập nhật tài nguyên' : 'Khai báo tài nguyên'}
        </ErpSubmitButton>
      </form>

      <CustomFieldEditorModal
        open={stdEditorOpen}
        moduleKey="resources"
        initialField={editingStdField}
        onClose={() => setStdEditorOpen(false)}
        onSubmit={handleStdFieldSubmit}
        isStandard={true}
      />
    </ErpModal>
  );
}
