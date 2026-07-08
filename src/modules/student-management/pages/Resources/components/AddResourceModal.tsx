import React, { useState } from 'react';
import { apiFetch } from '../../../lib/api';
import { toast } from '../../../../../pages/Toast';
import { ErpModal, ErpField, ErpInput, ErpSelect, ErpSubmitButton } from '../../../components/Erp/ErpUI';

interface Category {
  id: string;
  name: string;
}

interface AddResourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  onSuccess: () => void;
}

export function AddResourceModal({ isOpen, onClose, categories, onSuccess }: AddResourceModalProps) {
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [newResource, setNewResource] = useState({
    name: '',
    type: '',
    identifier: '',
    capacity: '',
  });

  const selectedType = newResource.type || categories[0]?.name || '';

  const handleAddResource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newResource.name || !newResource.identifier || !newResource.capacity || !selectedType) {
      toast.error('Vui lòng nhập đầy đủ thông tin tài nguyên.');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiFetch('/resources', {
        method: 'POST',
        body: JSON.stringify({
          ...newResource,
          type: selectedType,
          identifier: newResource.identifier.toUpperCase(),
        }),
      });
      toast.success(`Đã thêm mới tài nguyên ${newResource.name} vào danh sách!`);
      setNewResource({ 
        name: '', 
        type: '', 
        identifier: '', 
        capacity: '' 
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
    <ErpModal title="Khai báo tài nguyên mới" onClose={onClose}>
      <form onSubmit={handleAddResource} className="space-y-4">
        <ErpField label="Tên gọi tài nguyên">
          <ErpInput
            type="text"
            required
            placeholder="Ví dụ: Phòng Lab thực hành 102"
            value={newResource.name}
            onChange={(e) => setNewResource({ ...newResource, name: e.target.value })}
          />
        </ErpField>

        <div className="grid grid-cols-2 gap-4">
          <ErpField label="Phân loại">
            <ErpSelect
              required
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
          <ErpField label="Mã nhận diện / Số phòng">
            <ErpInput
              type="text"
              required
              placeholder="Ví dụ: P.102, MT-01, MC-02"
              value={newResource.identifier}
              onChange={(e) => setNewResource({ ...newResource, identifier: e.target.value })}
            />
          </ErpField>
        </div>

        <ErpField label="Sức chứa / Khả năng đáp ứng">
          <ErpInput
            type="text"
            required
            placeholder="Ví dụ: 30 người / 2 người / 1 bộ"
            value={newResource.capacity}
            onChange={(e) => setNewResource({ ...newResource, capacity: e.target.value })}
          />
        </ErpField>

        <ErpSubmitButton disabled={isSubmitting}>
          {isSubmitting ? 'Đang lưu...' : 'Khai báo tài nguyên'}
        </ErpSubmitButton>
      </form>
    </ErpModal>
  );
}
