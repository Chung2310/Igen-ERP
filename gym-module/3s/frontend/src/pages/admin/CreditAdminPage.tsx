import { useCallback, useEffect, useState } from 'react';
import {
  Coins,
  CreditCard,
  Dumbbell,
  History,
  Mail,
  MinusCircle,
  Phone,
  Plus,
  PlusCircle,
  RefreshCw,
  Search,
  Shield,
  Sparkles,
  TrendingUp,
  User as UserIcon,
  Users,
  WalletCards,
  Zap,
} from 'lucide-react';
import CreditAdjustmentModal, { type TargetCreditUser } from '../../components/credits/CreditAdjustmentModal';
import CreditLedgerTable from '../../components/credits/CreditLedgerTable';
import Pagination from '../../components/ui/Pagination';
import StatusBadge from '../../components/ui/StatusBadge';
import { useToast } from '../../components/ui/ToastProvider';
import { api } from '../../services/api';
import { creditsService } from '../../services/credits';
import { errorMessage } from '../../types';
import type { PaginationMeta, UserRole } from '../../types';
import type { CreditLedgerEntry } from '../../types/credits';

interface AccountCreditRecord {
  _id?: string;
  id?: string;
  username: string;
  fullName?: string;
  role: UserRole;
  phone?: string;
  email?: string;
  status?: string;
  availableCredits?: number;
  reservedCredits?: number;
  createdAt?: string;
}

export default function CreditAdminPage() {
  const toast = useToast();

  const [accounts, setAccounts] = useState<AccountCreditRecord[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [keyword, setKeyword] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');

  const [targetUser, setTargetUser] = useState<TargetCreditUser | null>(null);
  const [modalMode, setModalMode] = useState<'GRANT' | 'DEDUCT'>('GRANT');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Recent ledger entries
  const [ledgerEntries, setLedgerEntries] = useState<CreditLedgerEntry[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  const loadAccounts = useCallback(
    async (page = 1) => {
      try {
        setLoading(true);
        const params = new URLSearchParams({
          page: String(page),
          limit: '15',
        });
        if (keyword.trim()) params.set('keyword', keyword.trim());
        if (roleFilter) params.set('role', roleFilter);

        const result = await api.get<AccountCreditRecord[]>(`/api/users?${params.toString()}`);
        setAccounts(result.data || []);
        if (result.meta) setMeta(result.meta);
      } catch (error) {
        toast.error(errorMessage(error));
      } finally {
        setLoading(false);
      }
    },
    [keyword, roleFilter, toast]
  );

  const loadLedger = useCallback(async () => {
    try {
      setLedgerLoading(true);
      const res = await creditsService.ledger(1);
      setLedgerEntries(res.items || []);
    } catch {
      // ignore ledger load error
    } finally {
      setLedgerLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAccounts(1);
    loadLedger();
  }, [loadAccounts, loadLedger]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadAccounts(meta.page || 1), loadLedger()]);
    setRefreshing(false);
    toast.success('Đã cập nhật số dư credit mới nhất.');
  };

  const handleOpenGrant = (account?: AccountCreditRecord) => {
    if (account) {
      setTargetUser({
        id: account._id || account.id,
        fullName: account.fullName,
        username: account.username,
        role: account.role,
        phone: account.phone,
        email: account.email,
        availableCredits: account.availableCredits,
      });
    } else {
      setTargetUser(null);
    }
    setModalMode('GRANT');
    setIsModalOpen(true);
  };

  const handleOpenDeduct = (account: AccountCreditRecord) => {
    setTargetUser({
      id: account._id || account.id,
      fullName: account.fullName,
      username: account.username,
      role: account.role,
      phone: account.phone,
      email: account.email,
      availableCredits: account.availableCredits,
    });
    setModalMode('DEDUCT');
    setIsModalOpen(true);
  };

  const totalCirculatingCredits = accounts.reduce(
    (sum, acc) => sum + (acc.availableCredits || 0),
    0
  );

  const renderRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'ADMIN':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
            <Shield size={11} />
            <span>Quản trị viên</span>
          </span>
        );
      case 'PT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Dumbbell size={11} />
            <span>HLV (PT)</span>
          </span>
        );
      case 'CUSTOMER':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-50 text-sky-700 border border-sky-200">
            <UserIcon size={11} />
            <span>Hội viên</span>
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#003b70]">
            Quản trị Credit Tài khoản
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Cấp hoặc trừ credit trực tiếp cho khách hàng, Huấn luyện viên và theo dõi số dư ví.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="h-10 px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs inline-flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
            title="Đồng bộ số dư"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin text-sky-600' : ''} />
            <span>Làm mới</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenGrant()}
            className="h-10 px-4 rounded-xl bg-gradient-to-r from-[#003b70] to-[#00264d] hover:from-[#002e59] hover:to-[#001c38] text-white font-bold text-xs sm:text-sm inline-flex items-center gap-2 transition-all shadow-md shadow-[#003b70]/20 cursor-pointer"
          >
            <Coins size={16} />
            <span>Cấp credit cho tài khoản</span>
          </button>
        </div>
      </div>

      {/* 2. Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50/60 to-white p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-sky-800">
              Tổng tài khoản
            </span>
            <div className="w-8 h-8 rounded-xl bg-sky-100/80 text-sky-700 flex items-center justify-center">
              <Users size={16} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-[#003b70] font-sans">
              {meta.total || accounts.length}
            </span>
            <span className="text-xs font-semibold text-slate-500">tài khoản hệ thống</span>
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/60 to-white p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
              Credit đang lưu hành (Trang này)
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-100/80 text-emerald-700 flex items-center justify-center">
              <Coins size={16} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-emerald-700 font-sans">
              {totalCirculatingCredits.toLocaleString('vi-VN')}
            </span>
            <span className="text-xs font-bold text-emerald-600">credit khả dụng</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Quy đổi giá trị AI
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200/60">
              <Zap size={16} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-[#003b70] font-sans">
              100 đ
            </span>
            <span className="text-xs font-semibold text-slate-500">= 1 Credit (1.000 đ = 10 Credit)</span>
          </div>
        </div>
      </div>

      {/* 3. Bảng Quản lý Credit Khách hàng / Tài khoản */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
        {/* Filters */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/40">
          {/* Role Chips */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: '', label: 'Tất cả tài khoản' },
              { id: 'CUSTOMER', label: 'Hội viên' },
              { id: 'PT', label: 'Huấn luyện viên' },
              { id: 'ADMIN', label: 'Quản trị viên' },
            ].map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={() => setRoleFilter(chip.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${roleFilter === chip.id
                    ? 'bg-[#003b70] text-white shadow-2xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
                  }`}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative min-w-[240px]">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              placeholder="Tìm theo tên, @username, SĐT..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadAccounts(1)}
              className="w-full h-9 pl-9 pr-3 rounded-xl border border-slate-200 bg-white text-xs font-medium focus:outline-none focus:border-sky-500"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                <th className="px-5 py-3.5">Người dùng</th>
                <th className="px-4 py-3.5">Vai trò</th>
                <th className="px-4 py-3.5">Số dư Credit</th>
                <th className="px-4 py-3.5">Tạm giữ</th>
                <th className="px-4 py-3.5">Liên hệ</th>
                <th className="px-4 py-3.5 text-right">Cấp / Trừ credit</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-xs">
              {loading && accounts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                    <RefreshCw size={24} className="animate-spin text-sky-600 mx-auto mb-2" />
                    <p className="font-semibold">Đang tải danh sách tài khoản...</p>
                  </td>
                </tr>
              ) : accounts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                    <Users size={32} className="text-slate-300 mx-auto mb-2" />
                    <p className="font-bold text-slate-700">Không tìm thấy tài khoản nào</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Thử đổi từ khóa hoặc bộ lọc vai trò.</p>
                  </td>
                </tr>
              ) : (
                accounts.map((acc) => {
                  const initial = acc.fullName
                    ? acc.fullName.trim().charAt(0).toUpperCase()
                    : (acc.username || 'U').charAt(0).toUpperCase();

                  const available = acc.availableCredits ?? 0;
                  const reserved = acc.reservedCredits ?? 0;

                  return (
                    <tr key={acc._id || acc.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Avatar & Tên */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-50 to-blue-50 border border-sky-100 text-sky-700 font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                            {initial}
                          </div>
                          <div>
                            <div className="font-bold text-xs sm:text-sm text-[#003b70]">
                              {acc.fullName || acc.username}
                            </div>
                            <div className="text-[11px] text-slate-400 font-medium">
                              @{acc.username}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Vai trò */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {renderRoleBadge(acc.role)}
                      </td>

                      {/* Số dư Credit */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-sky-50 border border-sky-200/80 text-[#003b70]">
                          <Coins size={14} className="text-sky-600 shrink-0" />
                          <span className="font-black text-sm">
                            {available.toLocaleString('vi-VN')}
                          </span>
                          <span className="text-[11px] font-bold text-sky-700">credit</span>
                        </div>
                      </td>

                      {/* Tạm giữ */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {reserved > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 font-bold text-xs">
                            {reserved} credit
                          </span>
                        ) : (
                          <span className="text-slate-400 font-medium text-xs">0 credit</span>
                        )}
                      </td>

                      {/* Liên hệ */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                          <Phone size={12} className="text-slate-400 shrink-0" />
                          <span>{acc.phone || '—'}</span>
                        </div>
                        {acc.email && (
                          <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                            <Mail size={12} className="text-slate-400 shrink-0" />
                            <span className="truncate max-w-[150px]">{acc.email}</span>
                          </div>
                        )}
                      </td>

                      {/* Thao tác Cấp / Trừ */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-right">
                        <div className="inline-flex items-center gap-2 justify-end">
                          <button
                            type="button"
                            onClick={() => handleOpenGrant(acc)}
                            title="Cấp thêm credit cho tài khoản này"
                            className="h-8 px-2.5 rounded-lg text-xs font-bold text-sky-700 bg-sky-50 border border-sky-200 hover:bg-sky-100 hover:border-sky-300 transition-all cursor-pointer inline-flex items-center gap-1.5 shrink-0"
                          >
                            <PlusCircle size={13} className="text-sky-600 shrink-0" />
                            <span>Cấp (+)</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenDeduct(acc)}
                            title="Khấu trừ credit của tài khoản này"
                            className="h-8 px-2.5 rounded-lg text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 hover:border-rose-300 transition-all cursor-pointer inline-flex items-center gap-1.5 shrink-0"
                          >
                            <MinusCircle size={13} className="text-rose-600 shrink-0" />
                            <span>Trừ (-)</span>
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

        {/* Phân trang */}
        {meta.totalPages > 1 && (
          <div className="px-5 py-3 border-t border-slate-100 flex justify-center bg-slate-50/40">
            <Pagination
              page={meta.page}
              totalPages={meta.totalPages}
              onPageChange={loadAccounts}
            />
          </div>
        )}
      </div>

      {/* 4. Lịch Sử Biến Động Credit Gần Đây (Ledger) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 text-sm font-bold text-[#003b70]">
            <History size={16} className="text-secondary" />
            <span>Lịch sử biến động credit gần đây (Ledger)</span>
          </div>
          <span className="text-xs text-slate-400 font-medium">Ghi nhận tự động từ hệ thống</span>
        </div>

        {ledgerLoading ? (
          <div className="py-8 text-center text-slate-400">
            <RefreshCw size={20} className="animate-spin text-sky-600 mx-auto mb-2" />
            <p className="text-xs">Đang tải lịch sử giao dịch...</p>
          </div>
        ) : (
          <CreditLedgerTable entries={ledgerEntries} />
        )}
      </div>

      {/* Modal Cấp / Trừ Credit */}
      <CreditAdjustmentModal
        open={isModalOpen}
        targetUser={targetUser}
        mode={modalMode}
        onClose={() => {
          setIsModalOpen(false);
          setTargetUser(null);
        }}
        onSuccess={async () => {
          await Promise.all([loadAccounts(meta.page || 1), loadLedger()]);
        }}
      />
    </div>
  );
}
