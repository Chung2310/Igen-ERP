import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import FormField from '../ui/FormField';
import FormModal from '../ui/FormModal';
import { useToast } from '../ui/ToastProvider';
import { api } from '../../services/api';
import { errorMessage } from '../../types';

export interface PackageTemplateRecord {
  _id?: string;
  name: string;
  totalSessions: number | string;
  durationDays: number | string;
  price?: number | string;
  description?: string;
  status: 'ACTIVE' | 'INACTIVE';
  [key: string]: unknown;
}

interface PackageTemplateModalProps {
  open: boolean;
  template?: PackageTemplateRecord | null;
  onClose: () => void;
  onSaved: (data: unknown) => void;
}

const emptyForm: PackageTemplateRecord = {
  name: '',
  totalSessions: '12',
  durationDays: '30',
  price: '0',
  description: '',
  status: 'ACTIVE',
};

export default function PackageTemplateModal({
  open,
  template,
  onClose,
  onSaved,
}: PackageTemplateModalProps) {
  const toast = useToast();
  const [form, setForm] = useState<PackageTemplateRecord>(emptyForm);
  const [initial, setInitial] = useState<PackageTemplateRecord>(emptyForm);
  const [loading, setLoading] = useState(false);

  const editing = Boolean(template?._id);

  useEffect(() => {
    if (open) {
      if (template) {
        const data: PackageTemplateRecord = {
          _id: template._id,
          name: template.name || '',
          totalSessions: String(template.totalSessions || '12'),
          durationDays: String(template.durationDays || '30'),
          price: String(template.price ?? '0'),
          description: template.description || '',
          status: template.status || 'ACTIVE',
        };
        setForm(data);
        setInitial(data);
      } else {
        setForm(emptyForm);
        setInitial(emptyForm);
      }
    }
  }, [open, template]);

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(initial), [form, initial]);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        name: form.name.trim(),
        totalSessions: Number(form.totalSessions),
        durationDays: Number(form.durationDays),
        price: Number(form.price || 0),
        description: form.description?.trim() || '',
        status: form.status,
      };

      const result = editing
        ? await api.patch(`/api/package-templates/${template!._id}`, payload)
        : await api.post('/api/package-templates', payload);

      toast.success(result.message);
      onSaved(result.data);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormModal
      open={open}
      title={editing ? 'Sửa gói tập mẫu' : 'Tạo gói tập mẫu mới'}
      description=""
      dirty={dirty}
      loading={loading}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitLabel={editing ? 'Lưu thay đổi' : 'Tạo gói mẫu'}
    >
      <div className="form-grid">
        <div className="grid-full-width">
          <FormField
            label="Tên gói tập mẫu"
            name="name"
            placeholder="Ví dụ: Gói PT 1:1 - 12 buổi (1 tháng), Gói Tăng cơ 36 buổi..."
            value={form.name}
            onChange={handleChange}
            required
          />
        </div>

        <FormField
          label="Tổng số buổi"
          name="totalSessions"
          type="number"
          min="1"
          placeholder="Nhập số buổi (ví dụ: 12, 24, 36)..."
          value={form.totalSessions}
          onChange={handleChange}
          required
        />

        <FormField
          label="Thời hạn sử dụng (ngày)"
          name="durationDays"
          type="number"
          min="1"
          placeholder="Nhập số ngày hiệu lực (ví dụ: 30, 60, 90)..."
          value={form.durationDays}
          onChange={handleChange}
          required
        />

        <FormField
          label="Giá niêm yết (VNĐ)"
          name="price"
          type="number"
          min="0"
          placeholder="Nhập giá gói (ví dụ: 3600000)..."
          value={form.price}
          onChange={handleChange}
        />

        <FormField
          label="Trạng thái áp dụng"
          name="status"
          as="select"
          value={form.status}
          onChange={handleChange}
        >
          <option value="ACTIVE">Đang kích hoạt (Cho phép PT chọn)</option>
          <option value="INACTIVE">Tạm ngưng</option>
        </FormField>

        <div className="grid-full-width">
          <FormField
            label="Mô tả / Quyền lợi gói tập"
            name="description"
            as="textarea"
            rows={3}
            placeholder="Ghi chú chi tiết về quyền lợi, đối tượng phù hợp, ưu đãi kèm theo..."
            value={form.description}
            onChange={handleChange}
          />
        </div>
      </div>
    </FormModal>
  );
}
