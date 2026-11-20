import React, { useState, useEffect } from "react";
import { AlertTriangle, Lock, Eye, EyeOff, X, Trash2, ShieldAlert } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

interface DeleteAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DeleteAccountModal({ isOpen, onClose }: DeleteAccountModalProps) {
  const { deleteAccount, userProfile } = useAuth();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [confirmedCheckbox, setConfirmedCheckbox] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setPassword("");
      setShowPassword(false);
      setConfirmedCheckbox(false);
      setErrorMessage(null);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isDeleting) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isDeleting, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setErrorMessage("Vui lòng nhập mật khẩu xác nhận.");
      return;
    }
    if (!confirmedCheckbox) {
      setErrorMessage("Vui lòng tích chọn xác nhận hiểu rõ hậu quả xóa tài khoản.");
      return;
    }

    setIsDeleting(true);
    setErrorMessage(null);
    try {
      await deleteAccount(password);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || "Không thể xóa tài khoản. Vui lòng kiểm tra lại mật khẩu.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      onClick={() => !isDeleting && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-account-title"
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-3xl border border-rose-100 bg-white shadow-2xl transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Danger Accent Bar */}
        <div className="h-2 w-full bg-gradient-to-r from-rose-500 via-red-500 to-rose-600" />

        <div className="p-6">
          {/* Close button */}
          <button
            type="button"
            disabled={isDeleting}
            onClick={onClose}
            aria-label="Đóng popup xác nhận xóa"
            className="absolute top-5 right-5 rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Modal Header */}
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 shadow-xs ring-4 ring-rose-50">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div className="space-y-1 pr-6">
              <h3 id="delete-account-title" className="text-lg font-bold text-gray-900">
                Xác nhận xóa tài khoản
              </h3>
              <p className="text-xs text-gray-500">
                Tài khoản: <span className="font-semibold text-gray-700">{userProfile?.email}</span>
              </p>
            </div>
          </div>

          {/* Warning Content */}
          <div className="mt-4 rounded-2xl border border-rose-100 bg-rose-50/50 p-4 space-y-2">
            <div className="flex items-center gap-2 text-rose-700 font-bold text-xs">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>Cảnh báo: Hành động này KHÔNG THỂ HOÀN TÁC!</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-[11px] leading-relaxed text-rose-800/90 pl-1">
              <li>Toàn bộ thông tin cá nhân và quyền truy cập sẽ bị hủy bỏ vĩnh viễn.</li>
              <li>Bạn sẽ bị đăng xuất ngay lập tức khỏi tất cả các thiết bị.</li>
              <li>Bạn sẽ không thể khôi phục lại tài khoản sau khi đã xác nhận xóa.</li>
            </ul>
          </div>

          {/* Error Message if any */}
          {errorMessage && (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700">
              {errorMessage}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-gray-600 block">
                Mật khẩu xác nhận <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-gray-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="Nhập mật khẩu hiện tại của bạn"
                  disabled={isDeleting}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-10 text-xs text-gray-800 placeholder-gray-400 outline-none transition-all focus:border-rose-500 focus:bg-white focus:ring-2 focus:ring-rose-500/20 disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isDeleting}
                  className="absolute right-3.5 top-3.5 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Confirmation Checkbox */}
            <label className="flex items-start gap-2.5 rounded-xl border border-gray-200/80 bg-gray-50/60 p-3 cursor-pointer hover:bg-gray-50 transition-colors select-none">
              <input
                type="checkbox"
                checked={confirmedCheckbox}
                onChange={(e) => {
                  setConfirmedCheckbox(e.target.checked);
                  if (errorMessage) setErrorMessage(null);
                }}
                disabled={isDeleting}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
              />
              <span className="text-xs leading-5 text-gray-700">
                Tôi hiểu rằng thao tác xóa tài khoản là vĩnh viễn và không thể khôi phục lại dữ liệu.
              </span>
            </label>

            {/* Modal Actions */}
            <div className="mt-6 flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={onClose}
                className="rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50 cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                disabled={isDeleting || !password.trim() || !confirmedCheckbox}
                className="flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-rose-600/20 hover:bg-rose-700 active:scale-98 transition-all disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
              >
                {isDeleting ? (
                  <>
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Đang xóa tài khoản...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    <span>Xác nhận xóa tài khoản</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
