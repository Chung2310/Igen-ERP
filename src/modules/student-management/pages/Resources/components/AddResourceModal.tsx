import React, { useEffect, useState } from 'react';
import { Loader2, RotateCcw, Save } from 'lucide-react';
import { apiFetch } from '../../../lib/api';
import { toast } from '../../../../../pages/Toast';
import { ErpModal, ErpField, ErpInput, ErpSelect } from '../../../components/Erp/ErpUI';
import { CustomFieldsSection } from '../../../../shared/custom-fields/CustomFieldsSection';
import { FieldActionButtons } from '../../../../shared/custom-fields/FieldActionButtons';
import type { CustomFieldValues } from '../../../../shared/custom-fields/types';
import type { ResourceItem } from '../../../types';
import { useStandardFields, getAdaptedFieldDefinition, type StandardFieldConfig } from '../../../hooks/useStandardFields';
import { CustomFieldEditorModal } from '../../../../shared/custom-fields/CustomFieldEditorModal';
import { canManageCustomFields } from '../../../../shared/custom-fields/permissions';
import { useAuth } from '../../../../../context/AuthContext';
import type { CreateFieldInput, FieldDefinition } from '../../../../shared/custom-fields/types';

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
  forceType?: string;
}

export function AddResourceModal({ isOpen, onClose, categories, onSuccess, resource, forceType }: AddResourceModalProps) {
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

  const manageable = canManageCustomFields(user?.permissions);
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
      <FieldActionButtons
        label={fieldConfig.label}
        disabled={isSubmitting}
        onEdit={() => openEditStdField(fieldConfig)}
        onArchive={() => archiveStd(fieldConfig)}
        onDelete={() => deleteStd(fieldConfig)}
      />
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
      type: forceType || '',
      identifier: '',
      capacity: '',
      customFields: {},
    });
  }, [isOpen, resource, forceType]);

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
          type: forceType || (isFieldVisible('type') ? selectedType : 'Khác'),
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
    <ErpModal title={resource ? 'Cập nhật tài nguyên' : 'Khai báo tài nguyên mới'} titleClassName="font-medium" onClose={onClose} maxWidth="max-w-xl">
      <form onSubmit={handleAddResource} className="space-y-3 [&_.erp-field-label]:font-normal [&_.erp-field-label]:text-slate-600">
        {isFieldVisible('name') && (
          <div>
            <ErpField label={getFieldLabel('name', 'Tên gọi tài nguyên')} actions={renderFieldActions('name')}>
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


        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {!forceType && isFieldVisible('type') && (
            <div>
              <ErpField label={getFieldLabel('type', 'Phân loại')} actions={renderFieldActions('type')}>
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
            <div className={forceType || !isFieldVisible('type') ? 'sm:col-span-2' : ''}>
              <ErpField label={getFieldLabel('identifier', 'Mã nhận diện / Số phòng')} actions={renderFieldActions('identifier')}>
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
          <div>
            <ErpField label={getFieldLabel('capacity', 'Sức chứa / Khả năng đáp ứng')} actions={renderFieldActions('capacity')}>
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
          compact
          iconActions
        />

        {manageable && archivedStdFields.length ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-3 mt-4 text-left">
            <h4 className="text-sm font-normal text-slate-600">Trường mặc định đã lưu trữ</h4>
            <ul className="mt-2 divide-y divide-slate-100">
              {archivedStdFields.map((field) => (
                <li key={field.key} className="flex items-center justify-between py-2 text-xs text-slate-600">
                  <span>{field.label}</span>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-sky-100 bg-sky-50 text-brand-primary transition-colors hover:bg-sky-100 disabled:opacity-50"
                    aria-label={`Khôi phục ${field.label}`}
                    title={`Khôi phục ${field.label}`}
                    onClick={() => restoreStdField(field.key)}
                  >
                    <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="flex justify-end border-t border-slate-100 pt-3">
          <button
            type="submit"
            disabled={isSubmitting}
            aria-label={isSubmitting ? 'Đang lưu tài nguyên' : resource ? 'Lưu thay đổi tài nguyên' : 'Khai báo tài nguyên'}
            title={resource ? 'Lưu thay đổi tài nguyên' : 'Khai báo tài nguyên'}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-brand-primary text-white transition-colors hover:bg-brand-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
          </button>
        </div>
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
