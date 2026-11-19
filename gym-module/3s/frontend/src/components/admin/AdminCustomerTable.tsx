import {
  Users,
  RefreshCw,
  UserCheck,
  Phone,
  Mail,
  Target,
  ArrowRightLeft,
  Pencil,
  Trash2,
} from 'lucide-react';
import StatusBadge from '../ui/StatusBadge';
import Pagination from '../ui/Pagination';
import type { PaginationMeta } from '../../types';
import type { CustomerAdminRecord, PtOption } from './AdminCustomersView';

interface AdminCustomerTableProps {
  customers: CustomerAdminRecord[];
  pts: PtOption[];
  loading: boolean;
  meta: PaginationMeta;
  selectedCustomerIds?: string[];
  onToggleSelect?: (id: string) => void;
  onToggleSelectAll?: () => void;
  onPageChange: (page: number) => void;
  onOpenTransfer: (c: CustomerAdminRecord) => void;
  onOpenEdit: (c: CustomerAdminRecord) => void;
  onOpenDelete: (c: CustomerAdminRecord) => void;
}

export default function AdminCustomerTable({
  customers,
  pts,
  loading,
  meta,
  selectedCustomerIds = [],
  onToggleSelect,
  onToggleSelectAll,
  onPageChange,
  onOpenTransfer,
  onOpenEdit,
  onOpenDelete,
}: AdminCustomerTableProps) {
  const getPtName = (c: CustomerAdminRecord) => {
    if (!c.assignedPtId) return null;
    if (typeof c.assignedPtId === 'object') {
      return c.assignedPtId.fullName || c.assignedPtId.username || 'PT';
    }
    const found = pts.find((p) => p._id === c.assignedPtId);
    return found ? found.fullName || found.username : 'PT phụ trách';
  };

  const isAllSelected = customers.length > 0 && customers.every((c) => selectedCustomerIds.includes(c._id));
  const isPartiallySelected = customers.some((c) => selectedCustomerIds.includes(c._id)) && !isAllSelected;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200/90 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <th className="w-10 px-4 py-3.5 text-center">
                <input
                  type="checkbox"
                  aria-label="Chọn tất cả khách hàng trên trang"
                  checked={isAllSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = isPartiallySelected;
                  }}
                  onChange={onToggleSelectAll}
                  className="w-4 h-4 rounded border-slate-300 cursor-pointer accent-[#003b70]"
                />
              </th>
              <th className="px-4 py-3.5">Khách hàng</th>
              <th className="px-4 py-3.5">PT Phụ Trách</th>
              <th className="px-4 py-3.5">Liên hệ</th>
              <th className="px-4 py-3.5">Mục tiêu & Thể trạng</th>
              <th className="px-4 py-3.5 text-center">Trạng thái</th>
              <th className="px-5 py-3.5 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && customers.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 px-4 text-center text-slate-500">
                  <RefreshCw size={22} className="animate-spin mx-auto mb-2 text-sky-600" />
                  <p className="text-xs font-semibold">Đang tải danh sách khách hàng...</p>
                </td>
              </tr>
            ) : customers.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-14 px-4 text-center text-slate-500">
                  <div className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center mx-auto mb-2.5">
                    <Users size={24} />
                  </div>
                  <p className="font-bold text-sm text-slate-800 mb-0.5">Không tìm thấy khách hàng nào</p>
                  <p className="text-xs text-slate-400">Thử thay đổi bộ lọc hoặc thêm khách hàng mới.</p>
                </td>
              </tr>
            ) : (
              customers.map((c) => {
                const ptName = getPtName(c);
                const initial = c.fullName ? c.fullName.trim().charAt(0).toUpperCase() : 'K';
                const isSelected = selectedCustomerIds.includes(c._id);

                return (
                  <tr
                    key={c._id}
                    className={`transition-colors ${isSelected ? 'bg-sky-50/60' : 'hover:bg-slate-50/70'}`}
                  >
                    {/* Checkbox chọn hàng */}
                    <td className="w-10 px-4 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={`Chọn khách hàng ${c.fullName}`}
                        checked={isSelected}
                        onChange={() => onToggleSelect?.(c._id)}
                        className="w-4 h-4 rounded border-slate-300 cursor-pointer accent-[#003b70]"
                      />
                    </td>

                    {/* Khách hàng */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-50 to-blue-50 border border-sky-100 text-sky-700 font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                          {initial}
                        </div>
                        <div>
                          <div className="font-bold text-xs sm:text-sm text-[#003b70]">
                            {c.fullName}
                          </div>
                          <div className="text-[11px] text-slate-400 font-medium">
                            {c.gender === 'FEMALE' ? 'Nữ' : c.gender === 'MALE' ? 'Nam' : 'Khác'}
                            {c.userId?.username ? ` · @${c.userId.username}` : ''}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* PT Phụ trách */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {ptName ? (
                        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-emerald-50/80 border border-emerald-200/80 text-emerald-800 max-w-[200px]">
                          <UserCheck size={13} className="text-emerald-600 shrink-0" />
                          <span className="text-xs font-semibold truncate" title={ptName}>
                            {ptName}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs font-medium text-slate-400 italic">
                          Chưa gán PT
                        </span>
                      )}
                    </td>

                    {/* Liên hệ */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                        <Phone size={12} className="text-slate-400 shrink-0" />
                        <span>{c.phone}</span>
                      </div>
                      {c.email && (
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5 max-w-[180px] truncate" title={c.email}>
                          <Mail size={12} className="text-slate-400 shrink-0" />
                          <span className="truncate">{c.email}</span>
                        </div>
                      )}
                    </td>

                    {/* Mục tiêu & Thể trạng */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-sky-800">
                        <Target size={12} className="text-secondary shrink-0" />
                        <span>{c.initialGoal || 'Cải thiện vóc dáng'}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-medium mt-0.5">
                        {c.height ? `${c.height} cm` : '—'} / {c.initialWeight ? `${c.initialWeight} kg` : '—'}
                      </div>
                    </td>

                    {/* Trạng thái */}
                    <td className="px-4 py-3.5 whitespace-nowrap text-center">
                      <StatusBadge status={c.status} />
                    </td>

                    {/* Thao tác */}
                    <td className="px-5 py-3.5 whitespace-nowrap text-right">
                      <div className="inline-flex items-center gap-1.5 justify-end">
                        <button
                          type="button"
                          onClick={() => onOpenTransfer(c)}
                          title="Điều chuyển sang PT khác"
                          className="h-8 px-2.5 rounded-lg text-xs font-bold text-sky-700 bg-sky-50 border border-sky-200/80 hover:bg-sky-100 hover:border-sky-300 transition-all cursor-pointer inline-flex items-center gap-1.5 shrink-0"
                        >
                          <ArrowRightLeft size={13} className="shrink-0" />
                          <span>Chuyển PT</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => onOpenEdit(c)}
                          title="Chỉnh sửa hồ sơ"
                          className="w-8 h-8 rounded-lg text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-900 transition-all cursor-pointer inline-flex items-center justify-center shrink-0"
                        >
                          <Pencil size={13} />
                        </button>

                        <button
                          type="button"
                          onClick={() => onOpenDelete(c)}
                          title="Xóa khách hàng"
                          className="w-8 h-8 rounded-lg text-rose-600 bg-rose-50 border border-rose-200/80 hover:bg-rose-100 hover:border-rose-300 transition-all cursor-pointer inline-flex items-center justify-center shrink-0"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {meta.totalPages > 1 && (
        <div className="px-5 py-3 border-t border-slate-100 flex justify-center bg-slate-50/40">
          <Pagination
            page={meta.page}
            totalPages={meta.totalPages}
            onPageChange={onPageChange}
          />
        </div>
      )}
    </div>
  );
}
