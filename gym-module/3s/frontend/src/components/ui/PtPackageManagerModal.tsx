import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { Sparkles } from 'lucide-react';
import ConfirmModal from './ConfirmModal';
import FormField from './FormField';
import FormModal from './FormModal';
import Pagination from './Pagination';
import StatusBadge from './StatusBadge';
import { useToast } from './ToastProvider';
import { api } from '../../services/api';
import type { PaginationMeta } from '../../types';
import { errorMessage } from '../../types';

interface CustomerSummary { _id?: string; fullName?: string }
interface PtPackage { _id: string; name: string; totalSessions: number; remainingSessions: number; startDate: string; endDate: string; status: string }
interface PackageForm { name: string; totalSessions: string; startDate: string; endDate: string; status: string }
interface TemplateOption { _id: string; name: string; totalSessions: number; durationDays: number; price?: number; status: string }
interface PtPackageManagerModalProps { open: boolean; customer: CustomerSummary | null; onClose: () => void }

const getTodayStr = (): string => new Date().toISOString().slice(0, 10);

const calculateEndDate = (startDateStr: string, totalSessionsNum: number): string => {
  if (!startDateStr || isNaN(Date.parse(startDateStr))) return '';
  const sessions = Number(totalSessionsNum) || 0;
  if (sessions <= 0) return '';
  // Chuẩn phòng gym: 12 buổi = 30 ngày (1 tháng), 24 buổi = 60 ngày, 36 buổi = 90 ngày...
  const durationDays = Math.max(30, Math.ceil(sessions / 12) * 30);
  const start = new Date(startDateStr);
  const end = new Date(start);
  end.setDate(end.getDate() + durationDays);
  return end.toISOString().slice(0, 10);
};

const getInitialForm = (): PackageForm => ({
  name: '',
  totalSessions: '',
  startDate: getTodayStr(),
  endDate: '',
  status: 'ACTIVE',
});

const dateValue = (value?: string): string => value ? new Date(value).toISOString().slice(0, 10) : '';

export default function PtPackageManagerModal({ open, customer, onClose }: PtPackageManagerModalProps) {
  const toast = useToast();
  const [items, setItems] = useState<PtPackage[]>([]);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, totalPages: 0 });
  const [form, setForm] = useState<PackageForm>(getInitialForm());
  const [editing, setEditing] = useState<PtPackage | null>(null);
  const [deleting, setDeleting] = useState<PtPackage | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');

  const load = async (page = 1) => {
    if (!customer?._id) return;
    try {
      const result = await api.get<PtPackage[]>(`/api/customers/${customer._id}/packages?page=${page}&limit=20${statusFilter ? `&status=${statusFilter}` : ''}`);
      setItems(result.data || []);
      setMeta(result.meta || { page, totalPages: 0 });
    } catch (error) { toast.error(errorMessage(error)); }
  };

  const loadTemplates = async () => {
    try {
      const result = await api.get<TemplateOption[]>('/api/package-templates?status=ACTIVE&limit=50');
      setTemplates(result.data || []);
    } catch {
      // Ignore template load error if not critical
    }
  };

  useEffect(() => {
    if (!open) return;
    setEditing(null);
    setForm(getInitialForm());
    setStatusFilter('');
    load();
    loadTemplates();
    // The customer id identifies each modal session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, customer?._id]);

  const applyTemplate = (template: TemplateOption) => {
    const startStr = form.startDate || getTodayStr();
    const startDateObj = new Date(startStr);
    const endDateObj = new Date(startDateObj);
    endDateObj.setDate(endDateObj.getDate() + (Number(template.durationDays) || 30));
    const endStr = endDateObj.toISOString().slice(0, 10);

    setForm({
      name: template.name,
      totalSessions: String(template.totalSessions),
      startDate: startStr,
      endDate: endStr,
      status: 'ACTIVE',
    });
  };

  const change = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    if (name === 'totalSessions') {
      const start = form.startDate || getTodayStr();
      const calculatedEnd = calculateEndDate(start, Number(value));
      setForm((current) => ({
        ...current,
        totalSessions: value,
        startDate: start,
        endDate: calculatedEnd || current.endDate,
      }));
    } else if (name === 'startDate') {
      const calculatedEnd = calculateEndDate(value, Number(form.totalSessions));
      setForm((current) => ({
        ...current,
        startDate: value,
        endDate: calculatedEnd || current.endDate,
      }));
    } else {
      setForm((current) => ({ ...current, [name]: value }));
    }
  };

  const reset = () => { setEditing(null); setForm(getInitialForm()); };
  const edit = (item: PtPackage) => {
    setEditing(item);
    setForm({ name: item.name, totalSessions: String(item.totalSessions), startDate: dateValue(item.startDate), endDate: dateValue(item.endDate), status: item.status });
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setLoading(true);
    try {
      const body = { ...form, totalSessions: Number(form.totalSessions) };
      if (!customer?._id) return;
      const result = editing ? await api.patch(`/api/customers/${customer._id}/packages/${editing._id}`, body) : await api.post(`/api/customers/${customer._id}/packages`, body);
      toast.success(result.message); reset(); await load(meta.page || 1);
    } catch (error) { toast.error(errorMessage(error)); }
    finally { setLoading(false); }
  };
  const remove = async () => {
    if (!customer?._id || !deleting) return;
    setLoading(true);
    try {
      const result = await api.delete(`/api/customers/${customer._id}/packages/${deleting._id}`);
      toast.success(result.message); setDeleting(null); await load(meta.page || 1);
    } catch (error) { toast.error(errorMessage(error)); }
    finally { setLoading(false); }
  };

  return <>
    <FormModal open={open} title={`Gói PT của ${customer?.fullName || 'khách hàng'}`} description="" dirty={Boolean(form.name || form.totalSessions || form.startDate || form.endDate)} loading={loading} submitLabel={editing ? 'Lưu thay đổi' : 'Thêm gói PT'} onClose={onClose} onSubmit={submit}>
      {templates.length > 0 && !editing && (
        <div style={{ background: '#f0f9ff', padding: '12px 14px', borderRadius: '10px', border: '1px solid #bae6fd', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.84rem', fontWeight: 700, color: '#0369a1', marginBottom: '8px' }}>
            <Sparkles size={15} />
            <span>Chọn nhanh từ gói mẫu phòng gym:</span>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {templates.map((tpl) => (
              <button
                key={tpl._id}
                type="button"
                onClick={() => applyTemplate(tpl)}
                style={{
                  background: form.name === tpl.name ? '#0284c7' : '#ffffff',
                  color: form.name === tpl.name ? '#ffffff' : '#0369a1',
                  border: '1px solid #7dd3fc',
                  borderRadius: '20px',
                  padding: '4px 12px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'all 0.15s ease',
                }}
              >
                <span>{tpl.name}</span>
                <small style={{ opacity: 0.85 }}>({tpl.totalSessions} buổi • {tpl.durationDays} ngày)</small>
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="form-grid">
        <FormField label="Tên gói" name="name" placeholder="Nhập tên gói PT (ví dụ: Gói 24 buổi Tăng cơ)..." value={form.name} onChange={change} required />
        <FormField label="Tổng số buổi" name="totalSessions" type="number" min="1" placeholder="Nhập số buổi (ví dụ: 24)..." value={form.totalSessions} onChange={change} required />
        <FormField label="Ngày bắt đầu" name="startDate" type="date" value={form.startDate} onChange={change} required />
        <FormField label="Ngày kết thúc" name="endDate" type="date" value={form.endDate} onChange={change} required />
        <FormField label="Trạng thái" name="status" as="select" value={form.status} onChange={change}><option value="ACTIVE">Đang hoạt động</option><option value="EXPIRED">Hết hạn</option><option value="COMPLETED">Hoàn thành</option><option value="CANCELLED">Đã hủy</option></FormField>
        {editing && <button type="button" className="button button-secondary" onClick={reset}>Hủy sửa gói</button>}
      </div>
      <div className="package-list"><h3>Các gói đã tạo</h3>
        <div className="filter-bar" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <select
            className="filter-select"
            aria-label="Lọc trạng thái gói PT"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="ACTIVE">Đang hoạt động</option>
            <option value="EXPIRED">Hết hạn</option>
            <option value="COMPLETED">Hoàn thành</option>
            <option value="CANCELLED">Đã hủy</option>
          </select>
          <button type="button" className="button button-secondary" onClick={() => load(1)}>
            Lọc gói
          </button>
        </div>
        {items.length ? items.map((item) => <article className="published-card" key={item._id}><div><strong>{item.name}</strong> <StatusBadge status={item.status} /></div><p>{item.remainingSessions}/{item.totalSessions} buổi còn lại</p><div className="inline-actions"><button type="button" className="text-button" onClick={() => edit(item)}>Sửa gói</button><button type="button" className="text-button text-danger" onClick={() => setDeleting(item)}>Xóa gói</button></div></article>) : <div className="empty-state">Khách hàng chưa có gói PT.</div>}
        <Pagination page={meta.page || 1} totalPages={meta.totalPages || 0} onPageChange={load} />
      </div>
    </FormModal>
    <ConfirmModal open={Boolean(deleting)} title="Xóa gói PT vĩnh viễn?" description="Gói PT đã xóa không thể khôi phục." danger confirmLabel="Xóa gói" loading={loading} onClose={() => setDeleting(null)} onConfirm={remove} />
  </>;
}
