import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { Calendar, FileText, MessageSquare, Pencil, Plus, Trash2, UserCheck, X } from 'lucide-react';
import ConfirmModal from './ConfirmModal';
import FormField from './FormField';
import FormModal from './FormModal';
import Pagination from './Pagination';
import { useToast } from './ToastProvider';
import { api } from '../../services/api';
import type { PaginationMeta } from '../../types';
import { errorMessage } from '../../types';

interface CustomerSummary { _id?: string; fullName?: string; phone?: string }
export interface ConsultationItem {
  _id: string;
  customerId: string;
  ptId: string;
  consultationDate: string;
  topic: string;
  currentCondition: string;
  advice: string;
  actionPlan?: string;
  notes?: string;
  createdAt?: string;
}

interface ConsultationFormState {
  consultationDate: string;
  topic: string;
  currentCondition: string;
  advice: string;
  actionPlan: string;
  notes: string;
}

interface CustomerConsultationModalProps {
  open: boolean;
  customer: CustomerSummary | null;
  onClose: () => void;
}

const emptyForm: ConsultationFormState = {
  consultationDate: new Date().toISOString().slice(0, 10),
  topic: '',
  currentCondition: '',
  advice: '',
  actionPlan: '',
  notes: '',
};

export default function CustomerConsultationModal({ open, customer, onClose }: CustomerConsultationModalProps) {
  const toast = useToast();
  const [items, setItems] = useState<ConsultationItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, totalPages: 0 });
  const [form, setForm] = useState<ConsultationFormState>(emptyForm);
  const [editing, setEditing] = useState<ConsultationItem | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleting, setDeleting] = useState<ConsultationItem | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async (page = 1) => {
    if (!customer?._id) return;
    try {
      setLoading(true);
      const result = await api.get<ConsultationItem[]>(
        `/api/customers/${customer._id}/consultations?page=${page}&limit=20`
      );
      setItems(result.data || []);
      setMeta(result.meta || { page, totalPages: 0 });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setShowForm(false);
    setEditing(null);
    setForm(emptyForm);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, customer?._id]);

  const handleChange = (field: keyof ConsultationFormState) => (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const startCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, consultationDate: new Date().toISOString().slice(0, 10) });
    setShowForm(true);
  };

  const startEdit = (item: ConsultationItem) => {
    setEditing(item);
    setForm({
      consultationDate: item.consultationDate ? new Date(item.consultationDate).toISOString().slice(0, 10) : '',
      topic: item.topic || '',
      currentCondition: item.currentCondition || '',
      advice: item.advice || '',
      actionPlan: item.actionPlan || '',
      notes: item.notes || '',
    });
    setShowForm(true);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!customer?._id) return;
    try {
      setLoading(true);
      const payload = {
        ...form,
        topic: form.topic.trim(),
        currentCondition: form.currentCondition.trim(),
        advice: form.advice.trim(),
        actionPlan: form.actionPlan.trim(),
        notes: form.notes.trim(),
      };
      const result = editing
        ? await api.patch(`/api/customers/${customer._id}/consultations/${editing._id}`, payload)
        : await api.post(`/api/customers/${customer._id}/consultations`, payload);
      toast.success(result.message);
      setShowForm(false);
      setEditing(null);
      setForm(emptyForm);
      load();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!customer?._id || !deleting) return;
    try {
      const result = await api.delete(`/api/customers/${customer._id}/consultations/${deleting._id}`);
      toast.success(result.message);
      setDeleting(null);
      load();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  if (!open || !customer) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="consultation-modal-title">
      <div className="modal-content" style={{ maxWidth: '850px', width: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', background: '#ffffff', color: '#0f172a', borderRadius: '16px', boxShadow: '0 25px 50px -12px rgba(0, 38, 77, 0.45)' }}>
        {/* Header */}
        <div className="modal-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: '1px solid #e2e8f0', background: '#ffffff' }}>
          <div>
            <h2 id="consultation-modal-title" style={{ fontSize: '1.25rem', fontWeight: 700, color: '#003b70', margin: 0 }}>
              Lịch sử tư vấn: {customer.fullName}
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '0.84rem', color: '#475569' }}>
              Ghi nhận các buổi tư vấn 1-1, thể trạng, lời khuyên và kế hoạch hành động.
            </p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Đóng">
            <X size={20} />
          </button>
        </div>

        {/* Body Content */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          {showForm ? (
            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid #e2e8f0' }}>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
                  {editing ? 'Chỉnh sửa buổi tư vấn' : 'Thêm buổi tư vấn mới'}
                </h3>
                <button type="button" className="button button-secondary" onClick={() => setShowForm(false)}>
                  Quay lại danh sách
                </button>
              </div>

              <div className="profile-form-grid">
                <FormField
                  label="Ngày tư vấn"
                  name="consultationDate"
                  type="date"
                  value={form.consultationDate}
                  onChange={handleChange('consultationDate')}
                  required
                />
                <FormField
                  label="Chủ đề tư vấn"
                  name="topic"
                  placeholder="Ví dụ: Tư vấn dinh dưỡng ban đầu, Đánh giá sau 4 tuần, Điều chỉnh phác đồ..."
                  value={form.topic}
                  onChange={handleChange('topic')}
                  required
                />
              </div>

              <FormField
                label="Tình trạng hiện tại / Thể trạng học viên"
                name="currentCondition"
                as="textarea"
                rows={3}
                placeholder="Ghi nhận thể trạng, mức năng lượng, thói quen ăn uống hoặc triệu chứng đau mỏi..."
                value={form.currentCondition}
                onChange={handleChange('currentCondition')}
                required
              />

              <FormField
                label="Lời khuyên & Chỉ định của PT"
                name="advice"
                as="textarea"
                rows={3}
                placeholder="Lời khuyên về khẩu phần dinh dưỡng, lưu ý tập luyện, chế độ nghỉ ngơi..."
                value={form.advice}
                onChange={handleChange('advice')}
                required
              />

              <div className="profile-form-grid">
                <div className="grid-full-width">
                  <FormField
                    label="Kế hoạch hành động (Action Plan)"
                    name="actionPlan"
                    as="textarea"
                    rows={2}
                    placeholder="Các mục tiêu và hành động cần học viên hoàn thành trong tuần tới..."
                    value={form.actionPlan}
                    onChange={handleChange('actionPlan')}
                  />
                </div>
                <div className="grid-full-width">
                  <FormField
                    label="Ghi chú nội bộ PT"
                    name="notes"
                    as="textarea"
                    rows={2}
                    placeholder="Ghi chú riêng của PT (bệnh lý phát sinh, tâm lý học viên...)"
                    value={form.notes}
                    onChange={handleChange('notes')}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
                <button type="button" className="button button-secondary" onClick={() => setShowForm(false)}>
                  Hủy
                </button>
                <button type="submit" className="button button-primary" disabled={loading}>
                  {editing ? 'Lưu thay đổi' : 'Tạo buổi tư vấn'}
                </button>
              </div>
            </form>
          ) : (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 500 }}>
                  Tổng cộng: <strong>{items.length}</strong> buổi tư vấn đã ghi nhận
                </span>
                <button type="button" className="button button-primary" onClick={startCreate} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Plus size={16} /> Thêm buổi tư vấn
                </button>
              </div>

              {items.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                  <MessageSquare size={36} style={{ color: '#94a3b8', margin: '0 auto 12px' }} />
                  <h4 style={{ margin: '0 0 6px', color: '#334155' }}>Chưa có lịch sử tư vấn</h4>
                  <p style={{ margin: 0, fontSize: '0.86rem', color: '#64748b' }}>
                    Hãy ghi lại các buổi tư vấn định kỳ để theo dõi sát sao lộ trình của học viên.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {items.map((item) => (
                    <div
                      key={item._id}
                      style={{
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        padding: '16px 20px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem', background: '#e0f2fe', color: '#0369a1', padding: '4px 10px', borderRadius: '20px', fontWeight: 600 }}>
                            <Calendar size={13} />
                            {item.consultationDate ? new Date(item.consultationDate).toLocaleDateString('vi-VN') : '—'}
                          </span>
                          <strong style={{ fontSize: '1rem', color: '#003b70' }}>{item.topic}</strong>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <button
                            type="button"
                            className="icon-button"
                            onClick={() => startEdit(item)}
                            title="Sửa buổi tư vấn"
                            aria-label="Sửa buổi tư vấn"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            type="button"
                            className="icon-button"
                            onClick={() => setDeleting(item)}
                            title="Xóa buổi tư vấn"
                            aria-label="Xóa buổi tư vấn"
                            style={{ color: '#e11d48' }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', fontSize: '0.86rem', marginTop: '10px' }}>
                        <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '8px' }}>
                          <span style={{ fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                            Thể trạng / Tình trạng:
                          </span>
                          <p style={{ margin: 0, color: '#1e293b', whiteSpace: 'pre-line' }}>{item.currentCondition}</p>
                        </div>
                        <div style={{ background: '#f0fdf4', padding: '10px 14px', borderRadius: '8px', borderLeft: '3px solid #16a34a' }}>
                          <span style={{ fontWeight: 600, color: '#15803d', display: 'block', marginBottom: '4px' }}>
                            Lời khuyên & Chỉ định:
                          </span>
                          <p style={{ margin: 0, color: '#1e293b', whiteSpace: 'pre-line' }}>{item.advice}</p>
                        </div>
                      </div>

                      {item.actionPlan && (
                        <div style={{ marginTop: '10px', fontSize: '0.84rem', color: '#0284c7', background: '#f0f9ff', padding: '8px 12px', borderRadius: '6px' }}>
                          <strong>Kế hoạch hành động:</strong> {item.actionPlan}
                        </div>
                      )}

                      {item.notes && (
                        <div style={{ marginTop: '8px', fontSize: '0.82rem', color: '#64748b', fontStyle: 'italic' }}>
                          <strong>Ghi chú nội bộ:</strong> {item.notes}
                        </div>
                      )}
                    </div>
                  ))}
                  <Pagination page={meta.page || 1} totalPages={meta.totalPages || 1} onPageChange={load} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        open={Boolean(deleting)}
        title="Xóa buổi tư vấn"
        description="Bạn có chắc chắn muốn xóa buổi tư vấn này? Dữ liệu đã xóa không thể khôi phục."
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}
