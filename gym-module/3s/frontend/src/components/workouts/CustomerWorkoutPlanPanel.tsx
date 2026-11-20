import { useCallback, useEffect, useMemo, useState } from 'react';
import { Phone } from 'lucide-react';
import ConfirmModal from '../ui/ConfirmModal';
import DataList, { type DataColumn } from '../ui/DataList';
import Pagination from '../ui/Pagination';
import CustomerSelect from '../ui/CustomerSelect';
import { useToast } from '../ui/ToastProvider';
import { api } from '../../services/api';
import type { PaginationMeta } from '../../types';
import { errorMessage } from '../../types';
import CustomerWorkoutPlanModal from './CustomerWorkoutPlanModal';
import type { CustomerWorkoutPlan, CustomerWorkoutPlanDraft } from '../../types/workout';

interface Props { initialDraft?: CustomerWorkoutPlanDraft | null; onDraftConsumed?: () => void }
type Action = { kind: 'publish' | 'unpublish' | 'delete'; item: CustomerWorkoutPlan };

export default function CustomerWorkoutPlanPanel({ initialDraft = null, onDraftConsumed }: Props) {
  const toast = useToast();
  const [items, setItems] = useState<CustomerWorkoutPlan[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, totalPages: 0 });
  const [customerId, setCustomerId] = useState('');
  const [status, setStatus] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerWorkoutPlan | null>(null);
  const [draft, setDraft] = useState<CustomerWorkoutPlanDraft | null>(null);
  const [action, setAction] = useState<Action | null>(null);
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const hasFilters = Boolean(customerId || status);

  const load = useCallback(async (page = 1) => {
    setListLoading(true);
    try {
      const query = new URLSearchParams({ page: String(page), limit: '20' });
      if (customerId) query.set('customerId', customerId);
      if (status) query.set('status', status);
      const result = await api.get<CustomerWorkoutPlan[]>(`/api/workout-plans?${query}`);
      setItems(result.data);
      if (result.meta) setMeta(result.meta);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setListLoading(false);
    }
  }, [customerId, status, toast]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (initialDraft) { setDraft(initialDraft); setEditing(null); setFormOpen(true); onDraftConsumed?.(); } }, [initialDraft, onDraftConsumed]);

  const confirm = async () => {
    if (!action) return;
    setLoading(true);
    try {
      const path = action.kind === 'delete' ? `/api/workout-plans/${action.item._id}` : `/api/workout-plans/${action.item._id}/${action.kind}`;
      const result = action.kind === 'delete' ? await api.delete(path) : await api.patch(path);
      toast.success(result.message);
      setAction(null);
      await load(meta.page);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const columns: DataColumn<CustomerWorkoutPlan>[] = [
    { key: 'title', label: 'Giáo án' },
    {
      key: 'customerId',
      label: 'Khách hàng',
      render: (item) => {
        const raw = item.customerId as unknown;
        if (raw && typeof raw === 'object' && 'fullName' in (raw as object)) {
          const c = raw as { _id?: string; fullName?: string; phone?: string };
          return (
            <div className="workout-customer-identity">
              <strong>{c.fullName || '—'}</strong>
              {c.phone && (
                <span className="workout-customer-phone">
                  <Phone size={11} aria-hidden="true" />
                  <span>{c.phone}</span>
                </span>
              )}
            </div>
          );
        }
        return String(item.customerId || '—');
      },
    },
    { key: 'status', label: 'Trạng thái', render: (item) => <span className={`workout-customer-status ${item.status === 'PUBLISHED' ? 'is-published' : 'is-draft'}`}>{item.status === 'PUBLISHED' ? 'Đã công bố' : 'Bản nháp'}</span> },
    { key: 'version', label: 'Phiên bản', render: (item) => `v${item.version || 1}` },
  ];

  const openCreate = () => { setDraft(null); setEditing(null); setFormOpen(true); };
  const closeForm = () => { setFormOpen(false); setDraft(null); setEditing(null); };
  const renderActions = (item: CustomerWorkoutPlan) => (
    <div className="inline-actions workout-customer-actions">
      <button className="text-button" onClick={() => { setEditing(item); setDraft(null); setFormOpen(true); }}>Sửa</button>
      <button className="text-button" onClick={() => setAction({ kind: item.status === 'PUBLISHED' ? 'unpublish' : 'publish', item })}>{item.status === 'PUBLISHED' ? 'Thu hồi' : 'Công bố'}</button>
      <button className="text-button text-danger" onClick={() => setAction({ kind: 'delete', item })}>Xóa</button>
    </div>
  );

  return (
    <section className="module-card workout-customer-plan-card" aria-label="Danh sách giáo án khách hàng">
      <header className="workout-customer-plan-card-header">
        <div>
          <h2>Danh sách giáo án khách hàng</h2>
          <p>Tạo bản nháp, cá nhân hóa và công bố cho từng khách hàng.</p>
        </div>
        <button className="button button-primary" onClick={openCreate}>Tạo giáo án khách hàng</button>
      </header>

      <div className="module-toolbar workout-customer-plan-toolbar" role="search" aria-label="Bộ lọc giáo án khách hàng">
        <div className="workout-customer-filter-person">
          <CustomerSelect
            label=""
            name="customerId"
            value={customerId}
            onChange={setCustomerId}
            placeholder="Lọc theo học viên (tên hoặc SĐT)..."
          />
        </div>
        <label className="module-field workout-customer-filter-status">
          <span className="sr-only">Lọc theo trạng thái</span>
          <select aria-label="Lọc theo trạng thái" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Tất cả trạng thái</option>
            <option value="DRAFT">Bản nháp</option>
            <option value="PUBLISHED">Đã công bố</option>
          </select>
        </label>
        <button className="button button-secondary" onClick={() => void load()}>Lọc</button>
      </div>

      {listLoading ? <div className="module-skeleton workout-customer-plan-skeleton" aria-label="Đang tải giáo án khách hàng" />
        : items.length ? <DataList items={items} columns={columns} renderActions={renderActions} />
        : <div className={`module-empty workout-customer-plan-empty ${hasFilters ? 'module-filtered-empty' : ''}`}><h3>{hasFilters ? 'Không có giáo án phù hợp' : 'Chưa có giáo án khách hàng'}</h3><p>{hasFilters ? 'Xóa bộ lọc để xem toàn bộ giáo án.' : 'Tạo bản nháp đầu tiên cho một học viên.'}</p></div>}

      <Pagination page={meta.page || 1} totalPages={meta.totalPages || 0} onPageChange={load} />
      <CustomerWorkoutPlanModal open={formOpen} item={editing} initialDraft={draft} onClose={closeForm} onSaved={() => { closeForm(); void load(meta.page); }} />
      <ConfirmModal
        open={Boolean(action)}
        title={action?.kind === 'delete' ? 'Xóa giáo án?' : action?.kind === 'unpublish' ? 'Thu hồi giáo án?' : 'Công bố giáo án?'}
        description={action?.kind === 'publish' ? 'Khách hàng sẽ nhìn thấy giáo án sau khi công bố.' : action?.kind === 'unpublish' ? 'Khách hàng sẽ không còn nhìn thấy giáo án này.' : 'Dữ liệu đã xóa không thể khôi phục.'}
        confirmLabel={action?.kind === 'publish' ? 'Xác nhận công bố' : action?.kind === 'unpublish' ? 'Xác nhận thu hồi' : 'Xác nhận xóa'}
        danger={action?.kind === 'delete'}
        loading={loading}
        onClose={() => setAction(null)}
        onConfirm={confirm}
      />
    </section>
  );
}
