import React, { useState } from "react";
import { Lock, Key, Eye, EyeOff, AlertTriangle, Trash2 } from "lucide-react";
import { authService } from "../../services/authService";
import { toast } from "../../pages/Toast";
import DeleteAccountModal from "./DeleteAccountModal";

export default function SecurityTab() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword.trim()) {
      toast.error("Mật khẩu mới không được để trống!");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Mật khẩu mới phải chứa ít nhất 6 ký tự!");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Mật khẩu xác nhận không khớp!");
      return;
    }

    setUpdatingPassword(true);
    try {
      await authService.changePassword(newPassword);
      toast.success("Thay đổi mật khẩu thành công!");
      setNewPassword("");
      setConfirmPassword("");
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Thay đổi mật khẩu thất bại. Vui lòng thử lại.");
    } finally {
      setUpdatingPassword(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Thay đổi mật khẩu */}
      <div className="bg-white/80 backdrop-blur-md border border-gray-200/80 rounded-2xl p-6 shadow-xs">
        <h3 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2 border-b border-gray-100 pb-3">
          <Lock className="h-5 w-5 text-emerald-600" />
          Thay đổi mật khẩu tài khoản
        </h3>

        <form onSubmit={handleUpdatePassword} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5 text-left">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Mật khẩu mới *</label>
              <div className="relative">
                <Key className="absolute left-3.5 top-3.5 h-4 w-4 text-gray-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Nhập tối thiểu 6 ký tự"
                  className="w-full pl-11 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 placeholder-gray-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500 outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3.5 text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5 text-left">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                Xác nhận mật khẩu mới *
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-gray-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Nhập lại mật khẩu mới"
                  className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 placeholder-gray-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500 outline-none transition-all"
                />
              </div>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={updatingPassword}
              className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/10 flex items-center gap-2 cursor-pointer"
            >
              <Lock className="h-4 w-4" />
              <span>{updatingPassword ? "Đang cập nhật..." : "Đổi mật khẩu"}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Vùng nguy hiểm: Xóa tài khoản vĩnh viễn */}
      <div className="bg-rose-50/40 border border-rose-200/80 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 text-rose-700 font-bold text-base border-b border-rose-100 pb-3">
          <AlertTriangle className="h-5 w-5 text-rose-600" />
          <span>Vùng nguy hiểm: Xóa tài khoản</span>
        </div>

        <div className="space-y-1 text-left">
          <p className="text-xs text-rose-800 leading-relaxed font-medium">
            Khi bạn xóa tài khoản, tất cả quyền truy cập, phiên làm việc và dữ liệu hồ sơ cá nhân của bạn sẽ bị xóa vĩnh viễn khỏi hệ thống.
          </p>
          <p className="text-[11px] text-rose-600 leading-relaxed">
            Hành động này không thể hoàn tác. Vui lòng cân nhắc kỹ lưỡng trước khi tiếp tục.
          </p>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-rose-600/15 flex items-center gap-2 cursor-pointer active:scale-98"
          >
            <Trash2 className="h-4 w-4" />
            <span>Xóa tài khoản vĩnh viễn</span>
          </button>
        </div>
      </div>

      {/* Popup xác nhận xóa tài khoản */}
      <DeleteAccountModal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} />
    </div>
  );
}

