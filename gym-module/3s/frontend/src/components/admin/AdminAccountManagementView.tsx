import { useCallback, useEffect, useState } from 'react';
import { Mail, Pencil, Phone, Plus, RefreshCw, RotateCcw, Search, ShieldCheck, Trash2, Users } from 'lucide-react';
import { api } from '../../services/api';
import { errorMessage, type AdminAccount, type PaginationMeta, type User } from '../../types';
import ConfirmModal from '../ui/ConfirmModal';
import Pagination from '../ui/Pagination';
import StatusBadge from '../ui/StatusBadge';
import { useToast } from '../ui/ToastProvider';
import AdminAccountFormModal from './AdminAccountFormModal';

export default function AdminAccountManagementView({ actor }: { actor: User }) {
  const toast = useToast();
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, totalPages: 0, total: 0, limit: 20 });
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AdminAccount | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminAccount | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadAccounts = useCallback(async (page = 1) => {
    const params = new URLSearchParams({ role: 'ADMIN', page: String(page), limit: '20' });
    if (keyword.trim()) params.set('keyword', keyword.trim());
    if (status) params.set('status', status);

    try {
      setLoading(true);
      const result = await api.get<AdminAccount[]>(`/api/users?${params.toString()}`);
      setAccounts(result.data || []);
      if (result.meta) setMeta(result.meta);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [keyword, status, toast]);

  useEffect(() => {
    void loadAccounts(1);
  }, [loadAccounts]);

  const closeForm = () => {
    setFormOpen(false);
    setEditingAccount(null);
  };

  const handleSaved = () => {
    closeForm();
    void loadAccounts(meta.page || 1);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const accountId = deleteTarget._id || deleteTarget.id;
    try {
      setDeleting(true);
      const result = await api.delete(`/api/users/${accountId}`);
      toast.success(result.message || 'Xóa Admin thành công.');
      setDeleteTarget(null);
      await loadAccounts(meta.page || 1);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setDeleting(false);
    }
  };

  if (actor.role !== 'SUPER_ADMIN') {
    return (
      <section role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm font-semibold text-red-800">
        Chỉ Super Admin mới có thể quản lý tài khoản Admin.
      </section>
    );
  }

  return (
    <section className="mx-auto flex w-full max-w-7xl flex-col gap-5 font-montserrat">
      <header className="flex flex-col gap-4 rounded-2xl border border-sky-100 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-sky-50 text-primary">
            <ShieldCheck size={23} aria-hidden="true" />
          </span>
          <div>
            <h1 className="font-oswald text-2xl font-bold text-primary">Quản lý tài khoản Admin</h1>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingAccount(null);
            setFormOpen(true);
          }}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-white transition hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2"
        >
          <Plus size={17} aria-hidden="true" />
          Thêm Admin
        </button>
      </header>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <label htmlFor="admin-account-search" className="sr-only">Tìm kiếm Admin</label>
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} aria-hidden="true" />
          <input
            id="admin-account-search"
            type="search"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="Tìm theo tên, tên đăng nhập hoặc email..."
            className="min-h-11 w-full rounded-xl border border-slate-300 bg-white py-2 pl-10 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-secondary focus:ring-2 focus:ring-sky-100"
          />
        </div>
        <label htmlFor="admin-account-status" className="sr-only">Lọc trạng thái</label>
        <select
          id="admin-account-status"
          aria-label="Lọc trạng thái"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-secondary focus:ring-2 focus:ring-sky-100 lg:w-52"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="ACTIVE">Đang hoạt động</option>
          <option value="LOCKED">Đã khóa</option>
        </select>
        {(keyword || status) && (
          <button
            type="button"
            onClick={() => {
              setKeyword('');
              setStatus('');
            }}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-600 transition hover:border-sky-300 hover:bg-sky-50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
          >
            <RotateCcw size={15} aria-hidden="true" />
            Đặt lại
          </button>
        )}
        <button
          type="button"
          onClick={() => void loadAccounts(meta.page || 1)}
          disabled={loading}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-primary transition hover:border-sky-300 hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
          Tải lại
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-4 font-bold">Admin</th>
                <th className="px-5 py-4 font-bold">Liên hệ</th>
                <th className="px-5 py-4 font-bold">Trạng thái</th>
                <th className="px-5 py-4 font-bold">Ngày tạo</th>
                <th className="px-5 py-4 text-right font-bold">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && accounts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-14 text-center text-slate-500">
                    <RefreshCw className="mx-auto mb-3 animate-spin text-secondary" size={24} aria-hidden="true" />
                    Đang tải danh sách Admin...
                  </td>
                </tr>
              ) : accounts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-14 text-center text-slate-500">
                    <Users className="mx-auto mb-3 text-slate-300" size={32} aria-hidden="true" />
                    <strong className="block text-slate-800">Chưa có tài khoản Admin phù hợp</strong>
                    <span className="mt-1 block text-xs">Thử thay đổi bộ lọc hoặc tạo tài khoản Admin mới.</span>
                  </td>
                </tr>
              ) : accounts.map((account) => (
                <tr key={account._id || account.id} className="transition hover:bg-sky-50/40">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-sky-100 font-bold text-primary">
                        {(account.fullName || account.username).charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <strong className="block truncate text-slate-900">{account.fullName || 'Chưa đặt tên'}</strong>
                        <span className="block truncate text-xs text-slate-500">@{account.username}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-slate-600">
                    <span className="flex items-center gap-2"><Phone size={14} aria-hidden="true" />{account.phone || '—'}</span>
                    <span className="mt-1 flex items-center gap-2 text-xs"><Mail size={14} aria-hidden="true" />{account.email || '—'}</span>
                  </td>
                  <td className="px-5 py-4"><StatusBadge status={account.status} /></td>
                  <td className="px-5 py-4 text-slate-600">
                    {account.createdAt ? new Intl.DateTimeFormat('vi-VN').format(new Date(account.createdAt)) : '—'}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        aria-label={`Sửa ${account.username}`}
                        title="Sửa tài khoản Admin"
                        onClick={() => {
                          setEditingAccount(account);
                          setFormOpen(true);
                        }}
                        className="grid size-9 place-items-center rounded-lg border border-slate-300 text-primary transition hover:border-sky-300 hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
                      >
                        <Pencil size={15} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Xóa ${account.username}`}
                        title="Xóa tài khoản Admin"
                        onClick={() => setDeleteTarget(account)}
                        className="grid size-9 place-items-center rounded-lg border border-red-200 bg-red-50 text-red-600 transition hover:border-red-300 hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                      >
                        <Trash2 size={15} aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-slate-100 px-5 py-4">
          <Pagination page={meta.page || 1} totalPages={meta.totalPages || 0} onPageChange={loadAccounts} />
        </div>
      </div>

      <AdminAccountFormModal
        open={formOpen}
        account={editingAccount}
        onClose={closeForm}
        onSaved={handleSaved}
      />

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Xóa tài khoản Admin?"
        description={`Bạn có chắc chắn muốn xóa tài khoản "${deleteTarget?.fullName || deleteTarget?.username}"? Hành động này không thể khôi phục.`}
        confirmLabel="Xóa Admin"
        danger
        loading={deleting}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </section>
  );
}
