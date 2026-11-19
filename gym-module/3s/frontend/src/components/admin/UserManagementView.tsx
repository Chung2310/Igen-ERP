import { useCallback, useEffect, useState } from 'react';
import {
  Plus,
  RefreshCw,
  Pencil,
  Trash2,
  Users,
  Shield,
  Dumbbell,
  User as UserIcon,
  RotateCcw,
  Search,
  Phone,
  Mail,
  Coins,
} from 'lucide-react';
import Pagination from '../../components/ui/Pagination';
import StatusBadge from '../../components/ui/StatusBadge';
import ConfirmModal from '../../components/ui/ConfirmModal';
import UserFormModal, { type UserRecord } from '../../components/ui/UserFormModal';
import CreditAdjustmentModal, { type TargetCreditUser } from '../../components/credits/CreditAdjustmentModal';
import RoleBadge from '../../components/ui/RoleBadge';
import { useToast } from '../../components/ui/ToastProvider';
import { api } from '../../services/api';
import { canDeleteAccount, canEditAccount } from '../../services/roles';
import type { PaginationMeta, User, UserRole } from '../../types';
import { errorMessage } from '../../types';

export default function UserManagementView({ actor }: { actor: User }) {
  const toast = useToast();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, totalPages: 0, total: 0 });
  const [keyword, setKeyword] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [formUser, setFormUser] = useState<UserRecord | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deleteUser, setDeleteUser] = useState<UserRecord | null>(null);
  const [creditTargetUser, setCreditTargetUser] = useState<TargetCreditUser | null>(null);
  const [isCreditModalOpen, setIsCreditModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadUsers = useCallback(
    async (page = 1) => {
      try {
        setLoading(true);
        const params = new URLSearchParams({
          page: String(page),
          limit: '20',
        });
        if (keyword.trim()) params.set('keyword', keyword.trim());
        if (roleFilter) params.set('role', roleFilter);
        if (statusFilter) params.set('status', statusFilter);

        const result = await api.get<UserRecord[]>(`/api/users?${params.toString()}`);
        setUsers(result.data || []);
        if (result.meta) setMeta(result.meta);
      } catch (error) {
        toast.error(errorMessage(error));
      } finally {
        setLoading(false);
      }
    },
    [keyword, roleFilter, statusFilter, toast]
  );

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleDeleteUser = async () => {
    if (!deleteUser) return;
    const userId = deleteUser._id || deleteUser.id;
    try {
      const result = await api.delete(`/api/users/${userId}`);
      toast.success(result.message || 'Xóa tài khoản thành công');
      setDeleteUser(null);
      loadUsers(meta.page || 1);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const handleResetFilters = () => {
    setKeyword('');
    setRoleFilter('');
    setStatusFilter('');
  };

  const hasActiveFilters = Boolean(keyword || roleFilter || statusFilter);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* 1. Header & Actions */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#003b70', margin: 0 }}>
          Quản lý toàn bộ tài khoản
        </h2>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            onClick={() => {
              setCreditTargetUser(null);
              setIsCreditModalOpen(true);
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 16px',
              borderRadius: '10px',
              border: '1.5px solid #bae6fd',
              background: '#f0f9ff',
              color: '#0369a1',
              fontSize: '0.84rem',
              fontWeight: 750,
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(2, 132, 199, 0.1)',
            }}
          >
            <Coins size={16} />
            <span>Cấp credit tài khoản</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setFormUser(null);
              setIsCreateOpen(true);
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 18px',
              borderRadius: '10px',
              border: 0,
              background: '#003b70',
              color: '#ffffff',
              fontSize: '0.84rem',
              fontWeight: 750,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0, 59, 112, 0.25)',
            }}
          >
            <Plus size={16} />
            <span>Thêm tài khoản mới</span>
          </button>
        </div>
      </div>

      {/* 2. Chips Lọc Nhanh Vai Trò */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          alignItems: 'center',
        }}
      >
        <button
          type="button"
          onClick={() => setRoleFilter('')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 14px',
            borderRadius: '20px',
            border: roleFilter === '' ? '1.5px solid #003b70' : '1px solid #cbd5e1',
            background: roleFilter === '' ? '#003b70' : '#ffffff',
            color: roleFilter === '' ? '#ffffff' : '#475569',
            fontSize: '0.78rem',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <span>Tất cả tài khoản</span>
          {meta.total !== undefined && meta.total > 0 && (
            <span
              style={{
                fontSize: '0.7rem',
                background: roleFilter === '' ? 'rgba(255,255,255,0.25)' : '#f1f5f9',
                padding: '1px 6px',
                borderRadius: '10px',
              }}
            >
              {meta.total}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setRoleFilter('ADMIN')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 14px',
            borderRadius: '20px',
            border: roleFilter === 'ADMIN' ? '1.5px solid #6b21a8' : '1px solid #cbd5e1',
            background: roleFilter === 'ADMIN' ? '#6b21a8' : '#ffffff',
            color: roleFilter === 'ADMIN' ? '#ffffff' : '#475569',
            fontSize: '0.78rem',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <Shield size={13} />
          <span>Quản trị viên</span>
        </button>

        <button
          type="button"
          onClick={() => setRoleFilter('PT')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 14px',
            borderRadius: '20px',
            border: roleFilter === 'PT' ? '1.5px solid #166534' : '1px solid #cbd5e1',
            background: roleFilter === 'PT' ? '#166534' : '#ffffff',
            color: roleFilter === 'PT' ? '#ffffff' : '#475569',
            fontSize: '0.78rem',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <Dumbbell size={13} />
          <span>Huấn luyện viên</span>
        </button>

        <button
          type="button"
          onClick={() => setRoleFilter('CUSTOMER')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 14px',
            borderRadius: '20px',
            border: roleFilter === 'CUSTOMER' ? '1.5px solid #0369a1' : '1px solid #cbd5e1',
            background: roleFilter === 'CUSTOMER' ? '#0369a1' : '#ffffff',
            color: roleFilter === 'CUSTOMER' ? '#ffffff' : '#475569',
            fontSize: '0.78rem',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <UserIcon size={13} />
          <span>Hội viên</span>
        </button>
      </div>

      {/* 3. Toolbar Tìm kiếm & Trạng thái */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          padding: '10px 14px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', flex: 1 }}>
          <div style={{ position: 'relative', minWidth: '220px', flex: 1 }}>
            <Search
              size={15}
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#94a3b8',
              }}
            />
            <input
              type="text"
              placeholder="Tìm theo họ tên, @username, SĐT, email..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadUsers(1)}
              style={{
                width: '100%',
                height: '36px',
                padding: '0 12px 0 36px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.82rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              height: '36px',
              padding: '0 12px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '0.8rem',
              background: '#ffffff',
              color: '#1e293b',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="ACTIVE">Đang hoạt động</option>
            <option value="LOCKED">Đã khóa tài khoản</option>
          </select>

          <button
            type="button"
            onClick={() => loadUsers(1)}
            style={{
              height: '36px',
              padding: '0 14px',
              borderRadius: '8px',
              border: 0,
              background: '#0284c7',
              color: '#ffffff',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Tìm kiếm
          </button>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              style={{
                height: '36px',
                padding: '0 10px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#f8fafc',
                color: '#64748b',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <RotateCcw size={12} />
              <span>Xóa lọc</span>
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => loadUsers(meta.page || 1)}
          disabled={loading}
          style={{
            height: '36px',
            padding: '0 12px',
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
            background: '#ffffff',
            color: '#003b70',
            fontSize: '0.78rem',
            fontWeight: 650,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          <span>Tải lại</span>
        </button>
      </div>

      {/* 4. Table View (Bảng duy nhất, sang trọng, responsive) */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 10px rgba(0, 59, 112, 0.04)',
          overflow: 'hidden',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.84rem' }}>
            <thead>
              <tr
                style={{
                  background: '#f8fafc',
                  borderBottom: '1px solid #e2e8f0',
                  color: '#64748b',
                  fontSize: '0.74rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                <th style={{ padding: '12px 16px', fontWeight: 750 }}>Người dùng</th>
                <th style={{ padding: '12px 16px', fontWeight: 750 }}>Vai trò</th>
                <th style={{ padding: '12px 16px', fontWeight: 750 }}>Số dư Credit</th>
                <th style={{ padding: '12px 16px', fontWeight: 750 }}>Liên hệ</th>
                <th style={{ padding: '12px 16px', fontWeight: 750 }}>Trạng thái</th>
                <th style={{ padding: '12px 16px', fontWeight: 750, textAlign: 'right' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading && users.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '40px 16px', textAlign: 'center', color: '#64748b' }}>
                    <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 8px', color: '#0284c7' }} />
                    <p style={{ margin: 0, fontSize: '0.85rem' }}>Đang tải danh sách tài khoản...</p>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '48px 16px', textAlign: 'center', color: '#64748b' }}>
                    <Users size={32} style={{ color: '#cbd5e1', margin: '0 auto 8px' }} />
                    <p style={{ margin: '0 0 4px', fontWeight: 700, color: '#1e293b' }}>Không tìm thấy tài khoản nào</p>
                    <p style={{ margin: 0, fontSize: '0.78rem' }}>Thử thay đổi bộ lọc hoặc thêm tài khoản mới.</p>
                  </td>
                </tr>
              ) : (
                users.map((item) => (
                  <tr key={item._id || item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%',
                            background: '#e0f2fe',
                            color: '#0284c7',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 750,
                            fontSize: '0.85rem',
                            flexShrink: 0,
                          }}
                        >
                          {item.fullName ? item.fullName.charAt(0).toUpperCase() : (item.username || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 750, color: '#003b70' }}>{item.fullName || 'Chưa đặt tên'}</div>
                          <div style={{ fontSize: '0.74rem', color: '#64748b' }}>@{item.username || 'user'}</div>
                        </div>
                      </div>
                    </td>

                    <td style={{ padding: '12px 16px' }}><RoleBadge role={item.role} /></td>

                    <td style={{ padding: '12px 16px' }}>
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '3px 8px',
                          borderRadius: '8px',
                          background: '#f0f9ff',
                          border: '1px solid #bae6fd',
                          color: '#0369a1',
                          fontWeight: 750,
                          fontSize: '0.78rem',
                        }}
                      >
                        <Coins size={13} className="text-sky-600" />
                        <span>{(typeof item.availableCredits === 'number' ? item.availableCredits : 0).toLocaleString('vi-VN')}</span>
                        <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>credit</span>
                      </div>
                    </td>

                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontSize: '0.8rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Phone size={11} color="#64748b" />
                        <span>{item.phone || '—'}</span>
                      </div>
                      {item.email && (
                        <div style={{ fontSize: '0.74rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                          <Mail size={11} color="#94a3b8" />
                          <span>{item.email}</span>
                        </div>
                      )}
                    </td>

                    <td style={{ padding: '12px 16px' }}>
                      <StatusBadge status={item.status || 'ACTIVE'} />
                    </td>

                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                        {canEditAccount(actor, item) && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setCreditTargetUser({
                                  id: item._id || item.id,
                                  fullName: item.fullName,
                                  username: item.username,
                                  role: item.role,
                                  phone: item.phone,
                                  email: item.email,
                                });
                                setIsCreditModalOpen(true);
                              }}
                              title="Cấp credit cho tài khoản này"
                              style={{
                                padding: '5px 9px',
                                borderRadius: '6px',
                                border: '1px solid #bae6fd',
                                background: '#f0f9ff',
                                color: '#0369a1',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontWeight: 700,
                                fontSize: '0.74rem',
                              }}
                            >
                              <Coins size={13} />
                              <span>Cấp credit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setFormUser(item);
                                setIsCreateOpen(true);
                              }}
                              title="Chỉnh sửa tài khoản"
                              style={{
                                padding: '5px 8px',
                                borderRadius: '6px',
                                border: '1px solid #cbd5e1',
                                background: '#ffffff',
                                color: '#475569',
                                cursor: 'pointer',
                              }}
                            >
                              <Pencil size={13} />
                            </button>
                          </>
                        )}
                        {canDeleteAccount(actor, item) && <button
                          type="button"
                          onClick={() => setDeleteUser(item)}
                          title="Xóa tài khoản"
                          style={{
                            padding: '5px 8px',
                            borderRadius: '6px',
                            border: '1px solid #fecaca',
                            background: '#fef2f2',
                            color: '#dc2626',
                            cursor: 'pointer',
                          }}
                        >
                          <Trash2 size={13} />
                        </button>}
                        {!canEditAccount(actor, item) && !canDeleteAccount(actor, item) && <span aria-label="Không có thao tác">—</span>}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {meta.totalPages !== undefined && meta.totalPages > 1 && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'center' }}>
            <Pagination
              page={meta.page || 1}
              totalPages={meta.totalPages || 0}
              onPageChange={loadUsers}
            />
          </div>
        )}
      </div>

      {/* Form Modal */}
      <UserFormModal
        open={isCreateOpen}
        user={formUser}
        actorRole={actor.role}
        defaultRole={(roleFilter as UserRole) || 'PT'}
        onClose={() => {
          setIsCreateOpen(false);
          setFormUser(null);
        }}
        onSaved={() => {
          setIsCreateOpen(false);
          setFormUser(null);
          loadUsers(meta.page || 1);
        }}
      />

      {/* Modal Xóa */}
      <ConfirmModal
        open={Boolean(deleteUser)}
        title="Xóa tài khoản người dùng?"
        description={`Bạn có chắc chắn muốn xóa tài khoản "${deleteUser?.fullName || deleteUser?.username}". Hành động này không thể khôi phục.`}
        danger
        confirmLabel="Xóa vĩnh viễn"
        onClose={() => setDeleteUser(null)}
        onConfirm={handleDeleteUser}
      />

      {/* Modal Cấp Credit */}
      <CreditAdjustmentModal
        open={isCreditModalOpen}
        targetUser={creditTargetUser}
        onClose={() => {
          setIsCreditModalOpen(false);
          setCreditTargetUser(null);
        }}
        onSuccess={() => {
          loadUsers(meta.page || 1);
        }}
      />
    </div>
  );
}
