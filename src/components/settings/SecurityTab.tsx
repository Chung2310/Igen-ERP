import React, { useState } from "react";
import { Lock, Key, Eye, EyeOff } from "lucide-react";
import { authService } from "../../services/authService";
import { toast } from "../../pages/Toast";

export default function SecurityTab() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);

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
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Thay đổi mật khẩu thất bại. Vui lòng thử lại.");
    } finally {
      setUpdatingPassword(false);
    }
  };

  return (
    <div className="rounded-2xl border border-sky-100 bg-white p-5 shadow-sm">
      <h3 className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3 text-base font-medium text-slate-800">
        <Lock className="h-4 w-4 text-brand-primary" />
        Thay đổi mật khẩu tài khoản
      </h3>

      <form onSubmit={handleUpdatePassword} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1.5 text-left">
            <label className="block text-xs font-medium text-slate-600">Mật khẩu mới <span className="text-rose-500">*</span></label>
            <div className="relative">
              <Key className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type={showPassword ? "text" : "password"}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Nhập tối thiểu 6 ký tự"
                className="h-10 w-full rounded-xl border border-sky-100 bg-white py-0 pl-11 pr-10 text-sm font-normal text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5 text-left">
            <label className="block text-xs font-medium text-slate-600">Xác nhận mật khẩu mới <span className="text-rose-500">*</span></label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type={showPassword ? "text" : "password"}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Nhập lại mật khẩu mới"
                className="h-10 w-full rounded-xl border border-sky-100 bg-white py-0 pl-11 pr-4 text-sm font-normal text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <button
            type="submit"
            disabled={updatingPassword}
            className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-xl bg-brand-primary px-4 text-sm font-medium text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Lock className="h-4 w-4" />
            <span>{updatingPassword ? "Đang cập nhật..." : "Đổi mật khẩu"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
