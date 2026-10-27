import { useEffect, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { apiFetch } from '../../shared/lib/apiFetch';

type Item = { _id: string; ticketCode: string; ticketType?: string; device: { name: string }; status: string; receivedAt: string; dueAmount: number };
type Result = { items: Item[]; total: number; page: number; limit: number };
const labels: Record<string, string> = { received: 'Tiếp nhận', diagnosing: 'Kiểm tra', quoted: 'Báo giá', approved: 'Đã duyệt', repairing: 'Đang thực hiện', waiting_parts: 'Chờ vật tư', waiting_supplier: 'Chờ nhà cung cấp', done: 'Hoàn tất', delivered: 'Đã bàn giao', cancelled: 'Đã hủy', returned: 'Đã trả lại' };

export default function CustomerRepairsPanel({ customerId, companyCode, branchId }: { customerId: string; companyCode: string; branchId?: string }) {
  const { userProfile, hasPermission } = useAuth();
  const allowed = ['admin', 'superadmin'].includes(userProfile?.role || '') || hasPermission('repair:read') || hasPermission('repair:manage');
  if (!allowed) return <p className="text-sm text-on-surface-variant">Bạn chưa có quyền xem lịch sử sửa chữa.</p>;
  if (!branchId) return <p className="text-sm text-on-surface-variant">Chọn chi nhánh để xem lịch sử sửa chữa và bảo hành.</p>;
  return <History key={`${companyCode}:${branchId}:${customerId}`} customerId={customerId} companyCode={companyCode} branchId={branchId} />;
}

function History({ customerId, companyCode, branchId }: { customerId: string; companyCode: string; branchId: string }) {
  const [page, setPage] = useState(1);
  const [loaded, setLoaded] = useState<{ page: number; data?: Result; error?: string } | null>(null);
  const loading = loaded?.page !== page;
  useEffect(() => {
    const controller = new AbortController();
    void apiFetch<{ data: Result }>(`/customers/${customerId}/repairs`, { params: { companyCode, branchId, page }, signal: controller.signal })
      .then(({ data }) => { if (!controller.signal.aborted) setLoaded({ page, data }); })
      .catch((cause: unknown) => { if (!controller.signal.aborted) setLoaded({ page, error: cause instanceof Error ? cause.message : 'Không tải được lịch sử sửa chữa.' }); });
    return () => controller.abort();
  }, [customerId, companyCode, branchId, page]);
  const data = !loading ? loaded?.data : undefined;
  return <section className="space-y-4 text-on-surface [--color-on-surface-variant:var(--color-slate-600)]" aria-label="Lịch sử sửa chữa và bảo hành" aria-busy={loading}>
    <div><h2 className="text-balance text-lg font-semibold">Sửa chữa và bảo hành</h2><p className="mt-1 text-pretty text-sm text-on-surface-variant">Các phiếu gắn với hồ sơ khách hàng tại chi nhánh đang chọn.</p></div>
    {loading && <p role="status">Đang tải lịch sử…</p>}
    {!loading && loaded?.error && <p role="alert" className="text-pretty text-sm text-error">{loaded.error}</p>}
    {data && (data.items.length ? <div className="overflow-x-auto rounded-xl border border-outline-variant"><table className="w-full min-w-2xl text-left text-sm"><caption className="sr-only">Lịch sử tiếp nhận của khách hàng</caption><thead className="bg-surface-container"><tr>{['Phiếu', 'Đối tượng', 'Trạng thái', 'Ngày nhận', 'Còn phải thu'].map((label) => <th key={label} scope="col" className="p-3 font-medium">{label}</th>)}</tr></thead><tbody>{data.items.map((item) => <tr key={item._id} className="border-t border-outline-variant"><td className="p-3"><span className="font-medium">{item.ticketCode}</span><p className="text-xs text-on-surface-variant">{item.ticketType === 'service' ? 'Dịch vụ' : 'Bảo hành'}</p></td><td className="p-3">{item.device.name}</td><td className="p-3">{labels[item.status] || item.status}</td><td className="p-3 tabular-nums">{new Date(item.receivedAt).toLocaleDateString('vi-VN')}</td><td className="p-3 tabular-nums">{item.dueAmount.toLocaleString('vi-VN')} ₫</td></tr>)}</tbody></table></div> : <p className="text-sm text-on-surface-variant">Chưa có phiếu sửa chữa hoặc bảo hành tại chi nhánh này.</p>)}
    {data && data.total > data.limit && <div className="flex items-center justify-between gap-3 text-sm"><span className="tabular-nums">Trang {page} / {Math.ceil(data.total / data.limit)}</span><div className="flex gap-2">{[-1, 1].map((delta) => <button key={delta} type="button" disabled={delta < 0 ? page <= 1 : page * data.limit >= data.total} onClick={() => setPage((current) => current + delta)} className="min-h-11 rounded-lg border border-outline-variant px-3 focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50">{delta < 0 ? 'Trước' : 'Sau'}</button>)}</div></div>}
  </section>;
}
