import { useEffect, useState } from 'react';
import {
  Coins,
  LoaderCircle,
  MinusCircle,
  PlusCircle,
  Search,
  User as UserIcon,
  X,
} from 'lucide-react';
import { useToast } from '../ui/ToastProvider';
import { api } from '../../services/api';
import { creditsService } from '../../services/credits';
import { errorMessage } from '../../types';

export interface TargetCreditUser {
  id?: string;
  _id?: string;
  fullName?: string;
  username?: string;
  role?: string;
  phone?: string;
  email?: string;
  availableCredits?: number;
  reservedCredits?: number;
}

interface CreditAdjustmentModalProps {
  open?: boolean;
  onClose?: () => void;
  targetUser?: TargetCreditUser | null;
  mode?: 'GRANT' | 'DEDUCT';
  onSubmit?: (input: { userId: string; credits: number; reason: string }) => Promise<void>;
  onSuccess?: () => void;
  triggerButton?: React.ReactNode;
}

const PRESET_AMOUNTS = [20, 50, 100, 200, 500];

export default function CreditAdjustmentModal({
  open: controlledOpen,
  onClose: controlledOnClose,
  targetUser,
  mode = 'GRANT',
  onSubmit,
  onSuccess,
  triggerButton,
}: CreditAdjustmentModalProps) {
  const toast = useToast();
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = typeof controlledOpen === 'boolean';
  const open = isControlled ? controlledOpen : internalOpen;

  const [isDeduct, setIsDeduct] = useState(mode === 'DEDUCT');
  const [selectedUser, setSelectedUser] = useState<TargetCreditUser | null>(targetUser || null);
  const [userSearch, setUserSearch] = useState('');
  const [searchResults, setSearchResults] = useState<TargetCreditUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const [rawAmount, setRawAmount] = useState<string>('50');
  const [reason, setReason] = useState<string>('Cấp credit trải nghiệm Trợ lý AI 3S');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (targetUser) {
      setSelectedUser(targetUser);
    }
  }, [targetUser]);

  useEffect(() => {
    setIsDeduct(mode === 'DEDUCT');
    setReason(
      mode === 'DEDUCT'
        ? 'Thu hồi / giảm credit tài khoản'
        : 'Cấp credit trải nghiệm Trợ lý AI 3S'
    );
  }, [mode, open]);

  // Debounced search
  useEffect(() => {
    if (!open || selectedUser || !userSearch.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await api.get<TargetCreditUser[]>(
          `/api/users?keyword=${encodeURIComponent(userSearch.trim())}&limit=6`
        );
        setSearchResults(res.data || []);
        setShowDropdown(true);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [userSearch, open, selectedUser]);

  const handleClose = () => {
    if (isControlled) {
      controlledOnClose?.();
    } else {
      setInternalOpen(false);
    }
    if (!targetUser) {
      setSelectedUser(null);
      setUserSearch('');
    }
  };

  const handleOpen = () => {
    if (targetUser) {
      setSelectedUser(targetUser);
    }
    if (!isControlled) {
      setInternalOpen(true);
    }
  };

  const userId = selectedUser?._id || selectedUser?.id || '';
  const parsedAmt = Math.abs(Number(rawAmount) || 0);
  const numCredits = isDeduct ? -parsedAmt : parsedAmt;
  const validCredits = Number.isInteger(parsedAmt) && parsedAmt > 0;
  const validReason = reason.trim().length >= 2;
  const valid = Boolean(userId) && validCredits && validReason;

  const handleConfirm = async () => {
    if (!valid) return;
    setLoading(true);
    try {
      if (onSubmit) {
        await onSubmit({
          userId,
          credits: numCredits,
          reason: reason.trim(),
        });
      } else {
        await creditsService.adjust({
          userId,
          credits: numCredits,
          reason: reason.trim(),
        });
        toast.success(
          `Đã ${numCredits > 0 ? 'cấp' : 'khấu trừ'} ${Math.abs(numCredits)} credit cho ${selectedUser?.fullName || selectedUser?.username} thành công!`
        );
      }
      onSuccess?.();
      handleClose();
      setRawAmount('50');
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {!isControlled && (
        triggerButton ? (
          <span onClick={handleOpen}>{triggerButton}</span>
        ) : (
          <button
            type="button"
            onClick={handleOpen}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-sky-600 bg-sky-50 text-sky-700 hover:bg-sky-100 font-bold text-xs transition-colors cursor-pointer"
          >
            <Coins size={14} />
            <span>Cấp credit</span>
          </button>
        )
      )}

      {open && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(e) => e.target === e.currentTarget && handleClose()}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 16,
            backdropFilter: 'blur(3px)',
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            style={{
              width: '100%',
              maxWidth: 440,
              maxHeight: 'calc(100vh - 32px)',
              background: '#ffffff',
              borderRadius: 16,
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.22)',
              border: '1px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              animation: 'fadeIn 0.15s ease-out',
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: '14px 18px',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#fafafa',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: isDeduct ? '#ffe4e6' : '#e0f2fe',
                    color: isDeduct ? '#e11d48' : '#0284c7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Coins size={16} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#003b70' }}>
                    {isDeduct ? 'Khấu trừ Credit' : 'Cấp Credit tài khoản'}
                  </h3>
                </div>
              </div>

              <button
                type="button"
                onClick={handleClose}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: 4,
                  display: 'flex',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>
              {/* Type Switcher */}
              <div style={{ display: 'flex', gap: 6, background: '#f1f5f9', padding: 3, borderRadius: 10 }}>
                <button
                  type="button"
                  onClick={() => setIsDeduct(false)}
                  style={{
                    flex: 1,
                    padding: '5px 8px',
                    borderRadius: 8,
                    border: 'none',
                    background: !isDeduct ? '#ffffff' : 'transparent',
                    color: !isDeduct ? '#0369a1' : '#64748b',
                    fontWeight: 750,
                    fontSize: '0.76rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 5,
                    cursor: 'pointer',
                    boxShadow: !isDeduct ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  }}
                >
                  <PlusCircle size={13} />
                  <span>Cấp credit (+)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsDeduct(true)}
                  style={{
                    flex: 1,
                    padding: '5px 8px',
                    borderRadius: 8,
                    border: 'none',
                    background: isDeduct ? '#ffffff' : 'transparent',
                    color: isDeduct ? '#e11d48' : '#64748b',
                    fontWeight: 750,
                    fontSize: '0.76rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 5,
                    cursor: 'pointer',
                    boxShadow: isDeduct ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  }}
                >
                  <MinusCircle size={13} />
                  <span>Trừ credit (-)</span>
                </button>
              </div>

              {/* 1. Tài khoản */}
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                  Tài khoản
                </label>

                {selectedUser ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '7px 10px',
                      background: isDeduct ? '#fff1f2' : '#f0f9ff',
                      border: isDeduct ? '1px solid #fecdd3' : '1px solid #bae6fd',
                      borderRadius: 9,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          background: isDeduct ? '#e11d48' : '#0284c7',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 750,
                          fontSize: '0.75rem',
                          flexShrink: 0,
                        }}
                      >
                        {(selectedUser.fullName || selectedUser.username || 'U').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 750, color: '#003b70', fontSize: '0.82rem', lineHeight: 1.2 }}>
                          {selectedUser.fullName || selectedUser.username}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: '#64748b' }}>
                          @{selectedUser.username}
                          {selectedUser.availableCredits !== undefined && (
                            <span style={{ marginLeft: 4, color: '#0284c7', fontWeight: 700 }}>
                              · Số dư: {selectedUser.availableCredits} cr
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {!targetUser && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedUser(null);
                          setUserSearch('');
                        }}
                        style={{ border: 'none', background: 'transparent', color: '#94a3b8', cursor: 'pointer', padding: 2 }}
                        title="Đổi tài khoản"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ) : (
                  <div style={{ position: 'relative' }}>
                    <Search
                      size={14}
                      style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}
                    />
                    <input
                      type="text"
                      placeholder="Tìm theo họ tên, @username, SĐT..."
                      value={userSearch}
                      onChange={(e) => {
                        setUserSearch(e.target.value);
                        setShowDropdown(true);
                      }}
                      style={{
                        width: '100%',
                        height: 34,
                        padding: '0 30px',
                        borderRadius: 8,
                        border: '1px solid #cbd5e1',
                        fontSize: '0.8rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                    {searching && (
                      <LoaderCircle
                        size={13}
                        className="animate-spin"
                        style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#0284c7' }}
                      />
                    )}

                    {showDropdown && searchResults.length > 0 && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          marginTop: 3,
                          background: '#ffffff',
                          borderRadius: 8,
                          border: '1px solid #cbd5e1',
                          boxShadow: '0 8px 20px rgba(0,0,0,0.12)',
                          maxHeight: 180,
                          overflowY: 'auto',
                          zIndex: 60,
                        }}
                      >
                        {searchResults.map((u) => (
                          <div
                            key={u._id || u.id}
                            onClick={() => {
                              setSelectedUser(u);
                              setShowDropdown(false);
                              setUserSearch('');
                            }}
                            style={{
                              padding: '6px 10px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              borderBottom: '1px solid #f1f5f9',
                              cursor: 'pointer',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = '#ffffff')}
                          >
                            <span style={{ fontWeight: 700, fontSize: '0.78rem', color: '#1e293b' }}>
                              {u.fullName || u.username} <span style={{ color: '#64748b', fontWeight: 500 }}>@{u.username}</span>
                            </span>
                            <span style={{ fontSize: '0.66rem', color: '#0284c7', fontWeight: 700 }}>
                              {u.role}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 2. Số credit */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569' }}>
                    Số credit {isDeduct ? 'khấu trừ' : 'cấp'}
                  </label>
                  <span style={{ fontSize: '0.7rem', color: isDeduct ? '#be123c' : '#0369a1', fontWeight: 600 }}>
                    Quy đổi: {(parsedAmt * 1000).toLocaleString('vi-VN')} đ
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="number"
                    min="1"
                    placeholder="50"
                    value={rawAmount}
                    onChange={(e) => setRawAmount(e.target.value)}
                    style={{
                      flex: 1,
                      height: 36,
                      padding: '0 10px',
                      borderRadius: 8,
                      border: isDeduct ? '1.5px solid #fecdd3' : '1.5px solid #cbd5e1',
                      fontSize: '1rem',
                      fontWeight: 800,
                      color: isDeduct ? '#e11d48' : '#0284c7',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b' }}>credit</span>
                </div>

                <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                  {PRESET_AMOUNTS.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setRawAmount(String(amt))}
                      style={{
                        padding: '2px 8px',
                        borderRadius: 6,
                        border: Number(rawAmount) === amt ? (isDeduct ? '1px solid #e11d48' : '1px solid #0284c7') : '1px solid #e2e8f0',
                        background: Number(rawAmount) === amt ? (isDeduct ? '#fff1f2' : '#e0f2fe') : '#ffffff',
                        color: Number(rawAmount) === amt ? (isDeduct ? '#be123c' : '#0369a1') : '#475569',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {isDeduct ? `-${amt}` : `+${amt}`}
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. Lý do */}
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                  Lý do ghi nhận
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: Thưởng InBody, Khuyến mãi, Bù lỗi..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  style={{
                    width: '100%',
                    height: 34,
                    padding: '0 10px',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    fontSize: '0.78rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {!valid && (userId || rawAmount || reason) && (
                <p style={{ margin: 0, fontSize: '0.7rem', color: '#e11d48', fontWeight: 600 }}>
                  Vui lòng chọn tài khoản, nhập số credit &gt; 0 và lý do.
                </p>
              )}
            </div>

            {/* Footer Actions */}
            <div
              style={{
                padding: '10px 18px',
                borderTop: '1px solid #f1f5f9',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 8,
                background: '#fafafa',
              }}
            >
              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                style={{
                  padding: '6px 14px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#475569',
                  fontWeight: 700,
                  fontSize: '0.76rem',
                  cursor: 'pointer',
                }}
              >
                Hủy
              </button>

              <button
                type="button"
                onClick={handleConfirm}
                disabled={!valid || loading}
                style={{
                  padding: '6px 16px',
                  borderRadius: 8,
                  border: 'none',
                  background: isDeduct ? '#e11d48' : '#003b70',
                  color: '#ffffff',
                  fontWeight: 750,
                  fontSize: '0.78rem',
                  cursor: valid && !loading ? 'pointer' : 'not-allowed',
                  opacity: valid && !loading ? 1 : 0.5,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {loading && <LoaderCircle size={13} className="animate-spin" />}
                <span>
                  {isDeduct ? `Khấu trừ ${parsedAmt} cr` : `Cấp +${parsedAmt} credit`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
